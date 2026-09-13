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
  sendOtpMail,
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

  const recent = await sql`
    SELECT created_at FROM otp_codes
    WHERE email=${email} AND consumed_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1`;
  if (recent.length > 0) {
    const age = (Date.now() - new Date(recent[0]!.created_at as string).getTime()) / 1000;
    if (age < 60) return json(req, env, { error: 'throttled' }, 429);
  }

  const fifteen = new Date(Date.now() - 15 * 60 * 1000);
  const counted = await sql`
    SELECT COUNT(*)::text AS count FROM otp_codes
    WHERE email=${email} AND created_at > ${fifteen}`;
  if (Number(counted[0]!.count) >= 5) {
    return json(req, env, { error: 'throttled' }, 429);
  }

  const code = genOtpCode();
  const codeHash = await sha256Hex((env.OTP_PEPPER ?? '') + code);
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await sql`INSERT INTO otp_codes (email, code_hash, expires_at) VALUES (${email}, ${codeHash}, ${expires})`;

  const sent = await sendOtpMail(env, email, code);
  if (!sent.ok) return json(req, env, { error: 'mail', detail: sent.detail }, 502);
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
