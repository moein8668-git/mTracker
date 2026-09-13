/* Shared worker utilities: env, CORS, hashing, randomness, mail relay. */

export interface Env {
  HYPERDRIVE: Hyperdrive;
  MAIL_RELAY_URL: string;
  API_SECRET: string;
  MAIL_FROM: string;
  CORS_ORIGIN?: string;
  OTP_PEPPER?: string;
}

export function corsAllowed(origin: string, env: Env): boolean {
  const list = (env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(origin);
}

export function json(req: Request, env: Env, body: unknown, status = 200): Response {
  const res = Response.json(body, { status });
  const origin = req.headers.get('Origin');
  if (origin && corsAllowed(origin, env)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
  }
  res.headers.set('Vary', 'Origin');
  return res;
}

export function corsPreflight(req: Request, env: Env): Response {
  const res = new Response(null, { status: 204 });
  const origin = req.headers.get('Origin');
  if (origin && corsAllowed(origin, env)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
  }
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Max-Age', '86400');
  res.headers.set('Vary', 'Origin');
  return res;
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Hex SHA-256 — byte-identical to the Node API's sha256Hex, same shared DB. */
export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** 6-digit code, same range as the Node API (100000–999999). */
export function genOtpCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String((buf[0]! % 900000) + 100000);
}

/** 256-bit opaque token, base64url — same shape as the Node API's. */
export function genToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function sendOtpMail(
  env: Env,
  to: string,
  code: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  let res: Response;
  try {
    res = await fetch(env.MAIL_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.API_SECRET,
        from: env.MAIL_FROM,
        to,
        subject: 'کد ورود mTracker',
        text: code + ' کد ورود شماست. ۱۰ دقیقه اعتبار دارد.',
      }),
    });
  } catch {
    return { ok: false, detail: 'relay_unreachable' };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, detail: detail.slice(0, 200) };
  }
  return { ok: true };
}
