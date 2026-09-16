/* mTracker API worker — auth surface (sync endpoints land here next).
 * Deployment marker: cloudflare production branch trigger.
 * DB via the HYPERDRIVE binding (dashboard-attached, same Aiven database the
 * Node API uses). Mail via the standalone mail-relay worker + Resend.
 */

import { json, corsPreflight, type Env } from './util.js';
import { handleOtp, handleVerify, handleLogout, handleMe } from './auth.js';
import { createSql } from './db.js';
import { handlePull, handlePush } from './sync.js';

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

    const sql = createSql(env);
    if (url.pathname === '/api/auth/otp' && req.method === 'POST') return handleOtp(req, env, sql);
    if (url.pathname === '/api/auth/verify' && req.method === 'POST') return handleVerify(req, env, sql);
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') return handleLogout(req, env, sql);
    if (url.pathname === '/api/me' && req.method === 'GET') return handleMe(req, env, sql);
    if (url.pathname === '/api/sync/push' && req.method === 'POST') return handlePush(req, env, sql);
    if (url.pathname === '/api/sync/pull' && req.method === 'GET') return handlePull(req, env, sql);
    return json(req, env, { error: 'not_found' }, 404);
  },
};
