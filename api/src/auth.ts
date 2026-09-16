/* Email-OTP auth — same contract as the Node API (shared Aiven DB).
 * POST /api/auth/otp {email} → {ok:true}
 * POST /api/auth/verify {email,code} → {token,email,serverTime}
 * POST /api/auth/logout (Bearer) → {ok:true}
 * GET  /api/me (Bearer) → {email}
 */

import type { Sql } from 'postgres';
import {
  json,
  readJson,
  sha256Hex,
  timingSafeEqual,
  genOtpCode,
  genToken,
  makeDeliveryRequest,
  sendDeliveryRequest,
  type Env,
} from './util.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface Session {
  id: string;
  user_id: string;
  email: string;
}

export async function handleOtp(req: Request, env: Env, sql: Sql): Promise<Response> {
  const body = await readJson(req);
  const raw = body?.email;
  if (typeof raw !== 'string' || !EMAIL_RE.test(raw)) {
    return json(req, env, { error: 'email' }, 400);
  }
  const email = raw.toLowerCase();

  const code = genOtpCode();
  const codeHash = await sha256Hex((env.OTP_PEPPER ?? '') + code);
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  const source = req.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { request, signature } = await makeDeliveryRequest(env, email, code, source);
  const permitted = await sql.begin(async (tx) => {
    const locks: Array<[string, string]> = [['account', request.accountId], ['recipient', request.accountId], ['source', request.sourceId]];
    locks.sort(([kindA, idA], [kindB, idB]) => `${kindA}:${idA}`.localeCompare(`${kindB}:${idB}`));
    for (const [kind, scopeId] of locks) {
      await tx`INSERT INTO delivery_limit_scopes (kind, scope_id) VALUES (${kind}, ${scopeId}) ON CONFLICT DO NOTHING`;
      await tx`SELECT kind FROM delivery_limit_scopes WHERE kind=${kind} AND scope_id=${scopeId} FOR UPDATE`;
    }
    const recipient = await tx`SELECT count(*)::int AS n FROM otp_delivery_attempts WHERE recipient_hash=${request.accountId} AND created_at > now() - interval '15 minutes'`;
    const sourceRows = await tx`SELECT count(*)::int AS n FROM otp_delivery_attempts WHERE source_id=${request.sourceId} AND created_at > now() - interval '1 hour'`;
    const account = await tx`SELECT count(*)::int AS n FROM otp_delivery_attempts WHERE account_id=${request.accountId} AND created_at > now() - interval '1 day'`;
    if (Number(recipient[0]!.n) >= 3 || Number(sourceRows[0]!.n) >= 10 || Number(account[0]!.n) >= 20) return false;
    await tx`INSERT INTO otp_delivery_attempts (request_id, recipient_hash, source_id, account_id) VALUES (${request.requestId}, ${request.accountId}, ${request.sourceId}, ${request.accountId})`;
    await tx`INSERT INTO otp_codes (email, code_hash, expires_at) VALUES (${email}, ${codeHash}, ${expires})`;
    return true;
  });
  if (!permitted) return json(req, env, { error: 'throttled' }, 429);
  const sent = await sendDeliveryRequest(env, request, signature);
  await sql`UPDATE otp_delivery_attempts SET relay_status=${sent.ok ? 'accepted' : 'failed'} WHERE request_id=${request.requestId}`;
  if (!sent.ok) {
    console.log(JSON.stringify({ event: 'mail_relay_failed', requestId: request.requestId, relayStatus: sent.status }));
    const debugToken = req.headers.get('X-Mail-Relay-Debug') ?? '';
    const debugging = Boolean(env.MAIL_RELAY_DEBUG_TOKEN) && timingSafeEqual(debugToken, env.MAIL_RELAY_DEBUG_TOKEN!);
    return json(req, env, debugging ? { error: 'mail', relayStatus: sent.status ?? 'network', requestId: request.requestId } : { error: 'mail' }, 502);
  }
  return json(req, env, { ok: true });
}

export async function handleVerify(req: Request, env: Env, sql: Sql): Promise<Response> {
  const body = await readJson(req);
  const rawEmail = body?.email;
  const rawCode = body?.code;
  if (typeof rawEmail !== 'string' || !EMAIL_RE.test(rawEmail)) {
    return json(req, env, { error: 'email' }, 400);
  }
  if (typeof rawCode !== 'string' || rawCode.length < 4 || rawCode.length > 10) {
    return json(req, env, { error: 'code' }, 400);
  }
  const email = rawEmail.toLowerCase();

  const rows = await sql`
    SELECT id, code_hash, attempts FROM otp_codes
    WHERE email=${email} AND consumed_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1`;
  const row = rows[0] as { id: string; code_hash: string; attempts: number } | undefined;
  if (!row) return json(req, env, { error: 'code' }, 400);
  if (Number(row.attempts) >= 5) return json(req, env, { error: 'throttled' }, 429);

  const codeHash = await sha256Hex((env.OTP_PEPPER ?? '') + rawCode);
  if (!timingSafeEqual(String(row.code_hash), codeHash)) {
    await sql`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ${row.id}`;
    return json(req, env, { error: 'code' }, 400);
  }

  await sql`UPDATE otp_codes SET consumed_at = now() WHERE id = ${row.id}`;
  await sql`INSERT INTO users (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING`;
  await sql`DELETE FROM sessions WHERE expires_at < now()`;
  await sql`DELETE FROM otp_codes WHERE created_at < now() - interval '1 day'`;

  const token = genToken();
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await sql`INSERT INTO sessions (user_id, token_hash, expires_at)
            SELECT id, ${tokenHash}, ${expires} FROM users WHERE email = ${email}`;

  return json(req, env, { token, email, serverTime: new Date().toISOString() });
}

export async function authSession(req: Request, sql: Sql): Promise<Session | null> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const tokenHash = await sha256Hex(header.slice(7));
  const rows = await sql`
    SELECT s.id, s.user_id, u.email FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > now()`;
  const s = rows[0] as Session | undefined;
  if (!s) return null;
  await sql`UPDATE sessions SET last_seen_at = now()
            WHERE id = ${s.id} AND last_seen_at < now() - interval '1 hour'`;
  return { id: String(s.id), user_id: String(s.user_id), email: String(s.email) };
}

export async function handleLogout(req: Request, env: Env, sql: Sql): Promise<Response> {
  const session = await authSession(req, sql);
  if (!session) return json(req, env, { error: 'unauthorized' }, 401);
  await sql`DELETE FROM sessions WHERE id = ${session.id}`;
  return json(req, env, { ok: true });
}

export async function handleMe(req: Request, env: Env, sql: Sql): Promise<Response> {
  const session = await authSession(req, sql);
  if (!session) return json(req, env, { error: 'unauthorized' }, 401);
  return json(req, env, { email: session.email });
}
