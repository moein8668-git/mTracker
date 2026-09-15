/* mTracker API worker — auth surface (sync endpoints land here next).
 * Deployment marker: cloudflare production branch trigger.
 * DB via the HYPERDRIVE binding (dashboard-attached, same Aiven database the
 * Node API uses). Mail via the standalone mail-relay worker + Resend.
 */

import postgres from 'postgres';
import { json, corsPreflight, type Env } from './util.js';
import { handleOtp, handleVerify, handleLogout, handleMe } from './auth.js';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return corsPreflight(req, env);
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(req, env, { ok: true });
    }
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(req);
    }
    if (!env.HYPERDRIVE) {
      return json(req, env, { error: 'misconfigured' }, 500);
    }

    const sql = postgres(env.HYPERDRIVE.connectionString);
    try {
      if (url.pathname === '/api/auth/otp' && req.method === 'POST') {
        return await handleOtp(req, env, sql);
      }
      if (url.pathname === '/api/auth/verify' && req.method === 'POST') {
        return await handleVerify(req, env, sql);
      }
      if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
        return await handleLogout(req, env, sql);
      }
      if (url.pathname === '/api/me' && req.method === 'GET') {
        return await handleMe(req, env, sql);
      }
      return json(req, env, { error: 'not_found' }, 404);
    } finally {
      await sql.end({ timeout: 5 }).catch(() => {});
    }
  },
};
