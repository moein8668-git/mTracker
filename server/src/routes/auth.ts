import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryOne, queryResult } from '../db.js';
import { sha256Hex, constantTimeEqualHex, genOtpCode, genSessionToken } from '../util.js';
import { createMailer } from '../mailer.js';

export interface Session {
  id: string;
  user_id: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    session?: Session;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'unauthorized' });
    return;
  }
  const tokenHash = sha256Hex(authHeader.slice(7));
  const session = await queryOne<Session>(
    `SELECT s.id, s.user_id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  if (!session) {
    reply.status(401).send({ error: 'unauthorized' });
    return;
  }
  queryResult(
    `UPDATE sessions SET last_seen_at = now() WHERE id = $1 AND last_seen_at < now() - interval '1 hour'`,
    [session.id],
  ).catch(() => {});
  req.session = session;
}

const OtpBody = z.object({ email: z.string().email() });
const VerifyBody = z.object({ email: z.string().email(), code: z.string().min(4).max(10) });

export function registerAuthRoutes(fastify: FastifyInstance): void {
  const mailer = createMailer();

  fastify.post('/api/auth/otp', { preHandler: [] }, async (req, reply) => {
    const parsed = OtpBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'email' });
    const email = parsed.data.email.toLowerCase();

    const recentCode = await queryOne<{ created_at: string }>(
      `SELECT created_at FROM otp_codes WHERE email=$1 AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [email],
    );
    if (recentCode) {
      const age = (Date.now() - new Date(recentCode.created_at).getTime()) / 1000;
      if (age < 60) return reply.status(429).send({ error: 'throttled' });
    }

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM otp_codes WHERE email=$1 AND created_at > $2`,
      [email, fifteenMinAgo.toISOString()],
    );
    if (recentCount && parseInt(recentCount.count) >= 5) {
      return reply.status(429).send({ error: 'throttled' });
    }

    const code = genOtpCode();
    const codeHash = sha256Hex((process.env.OTP_PEPPER || '') + code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await queryResult(
      `INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1, $2, $3)`,
      [email, codeHash, expiresAt.toISOString()],
    );
    await mailer.sendOtp(email, code);

    const response: { ok: true; devCode?: string } = { ok: true };
    if (process.env.DEV_RETURN_OTP === '1') response.devCode = code;
    return response;
  });

  fastify.post('/api/auth/verify', { preHandler: [] }, async (req, reply) => {
    const parsed = VerifyBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'email' });
    const email = parsed.data.email.toLowerCase();
    const code = parsed.data.code;

    const row = await queryOne<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM otp_codes WHERE email=$1 AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [email],
    );
    if (!row) return reply.status(400).send({ error: 'code' });
    if (row.attempts >= 5) return reply.status(429).send({ error: 'throttled' });

    const codeHash = sha256Hex((process.env.OTP_PEPPER || '') + code);
    if (!constantTimeEqualHex(row.code_hash, codeHash)) {
      await queryResult(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
      return reply.status(400).send({ error: 'code' });
    }

    await queryResult(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [row.id]);
    await queryResult(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [email]);
    await queryResult(`DELETE FROM sessions WHERE expires_at < now()`, []);
    await queryResult(`DELETE FROM otp_codes WHERE created_at < now() - interval '1 day'`, []);

    const token = genSessionToken();
    const tokenHash = sha256Hex(token);
    const ttlDays = parseInt(process.env.SESSION_TTL_DAYS || '90');
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await queryResult(
      `INSERT INTO sessions (user_id, token_hash, expires_at) SELECT id, $1, $2 FROM users WHERE email = $3`,
      [tokenHash, expiresAt.toISOString(), email],
    );

    return { token, email, serverTime: new Date().toISOString() };
  });

  fastify.post('/api/auth/logout', { preHandler: requireAuth }, async (req) => {
    await queryResult(`DELETE FROM sessions WHERE id = $1`, [req.session!.id]);
    return { ok: true };
  });

  fastify.get('/api/me', { preHandler: requireAuth }, async (req) => {
    return { email: req.session!.email };
  });
}
