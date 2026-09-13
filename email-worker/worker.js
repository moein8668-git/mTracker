/**
 * Generic transactional-email relay — Cloudflare Worker + Resend.
 *
 * Single file, no imports, no build step: paste the whole file into
 * Workers & Pages → your worker → Edit code (Quick Edit) → Save and deploy.
 *
 * ---------------------------------------------------------------------------
 * HOW IT WORKS
 *   POST /send  { secret?, from, to, subject, text?, html? }
 *     1. Origin check  — a browser `Origin` header, when present, must be in
 *                        ALLOWED_ORIGINS, otherwise 403. Requests without an
 *                        Origin (curl, servers) skip this check.
 *     2. Secret check  — `Authorization: Bearer <API_SECRET>` header or the
 *                        `secret` JSON field must match. Otherwise 401.
 *     3. Forward       — the payload is sent to Resend (api.resend.com/emails).
 *                        Resend itself enforces that `from` uses YOUR verified
 *                        domain, so a leaked secret can't spoof strangers.
 *   GET  /health → { ok:true } (uptime check)
 *
 * ---------------------------------------------------------------------------
 * DASHBOARD SETUP (Settings → Variables / Secrets — never in this file)
 *   Variables:
 *     ALLOWED_ORIGINS — comma-separated browser origins allowed to call /send.
 *                       e.g. https://app.yourdomain.com,http://localhost:5189
 *                       Empty = no browser caller allowed (secret-only use).
 *   Secrets:
 *     RESEND_API_KEY  — Resend API key (re_...).
 *     API_SECRET      — long random string you invent (openssl rand -hex 32).
 *                       Every caller must present it.
 *
 * ---------------------------------------------------------------------------
 * EXAMPLE
 *   curl -X POST https://mail.<account>.workers.dev/send \
 *     -H 'Content-Type: application/json' \
 *     -d '{"secret":"<API_SECRET>",
 *           "from":"mTracker <login@mail.yourdomain.com>",
 *           "to":"user@example.com",
 *           "subject":"کد ورود mTracker",
 *           "text":"123456 کد ورود شماست. ۱۰ دقیقه اعتبار دارد."}'
 *   → { "ok": true, "id": "<resend-id>" }
 *
 * Resend API reference: https://resend.com/docs/api-reference/emails/send-email
 */

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function allowedOrigin(req, env) {
  const origin = req.headers.get('Origin');
  if (!origin) return null; // non-browser caller: no CORS needed, secret still required
  const list = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(origin) ? origin : false;
}

function reply(req, env, body, status) {
  const res = Response.json(body, { status });
  const origin = allowedOrigin(req, env);
  if (origin) res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Vary', 'Origin');
  return res;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      const res = new Response(null, { status: 204 });
      const origin = allowedOrigin(req, env);
      if (origin) res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.headers.set('Access-Control-Max-Age', '86400');
      res.headers.set('Vary', 'Origin');
      return res;
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return reply(req, env, { ok: true, service: 'mail-relay' }, 200);
    }

    if (req.method !== 'POST' || url.pathname !== '/send') {
      return reply(req, env, { error: 'not_found' }, 404);
    }

    if (!env.RESEND_API_KEY || !env.API_SECRET) {
      return reply(req, env, { error: 'misconfigured' }, 500);
    }

    if (allowedOrigin(req, env) === false) {
      return reply(req, env, { error: 'forbidden_origin' }, 403);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return reply(req, env, { error: 'body' }, 400);
    }
    if (!body || typeof body !== 'object') {
      return reply(req, env, { error: 'body' }, 400);
    }

    const headerAuth = req.headers.get('Authorization') ?? '';
    const presented =
      headerAuth.startsWith('Bearer ') && headerAuth.length > 7
        ? headerAuth.slice(7)
        : typeof body.secret === 'string'
          ? body.secret
          : '';
    if (!timingSafeEqual(presented, env.API_SECRET)) {
      return reply(req, env, { error: 'unauthorized' }, 401);
    }

    const { from, to, subject, text, html } = body;
    if (typeof from !== 'string' || !from.includes('@') || from.length > 320) {
      return reply(req, env, { error: 'from' }, 400);
    }
    const toOk =
      (typeof to === 'string' && to.includes('@')) ||
      (Array.isArray(to) &&
        to.length > 0 &&
        to.every((t) => typeof t === 'string' && t.includes('@')));
    if (!toOk) {
      return reply(req, env, { error: 'to' }, 400);
    }
    if (typeof subject !== 'string' || subject.length === 0 || subject.length > 500) {
      return reply(req, env, { error: 'subject' }, 400);
    }
    if (
      (text !== undefined && typeof text !== 'string') ||
      (html !== undefined && typeof html !== 'string')
    ) {
      return reply(req, env, { error: 'body' }, 400);
    }
    if (text === undefined && html === undefined) {
      return reply(req, env, { error: 'empty' }, 400);
    }
    if ((text && text.length > 100000) || (html && html.length > 100000)) {
      return reply(req, env, { error: 'too_large' }, 400);
    }

    const payload = { from, to, subject };
    if (text !== undefined) payload.text = text;
    if (html !== undefined) payload.html = html;

    let res;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + env.RESEND_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return reply(req, env, { error: 'resend_unreachable' }, 502);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return reply(req, env, { error: 'resend', detail: detail.slice(0, 300) }, 502);
    }
    const data = await res.json();
    return reply(req, env, { ok: true, id: data.id ?? null }, 200);
  },
};
