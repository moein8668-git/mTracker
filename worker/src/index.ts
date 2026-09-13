interface Env {
  RESEND_API_KEY: string;
  MAIL_RELAY_SECRET: string;
  MAIL_FROM: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true });
    }

    if (req.method !== 'POST' || url.pathname !== '/send') {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }

    if (!env.RESEND_API_KEY || !env.MAIL_RELAY_SECRET || !env.MAIL_FROM) {
      return Response.json({ error: 'misconfigured' }, { status: 500 });
    }

    const auth = req.headers.get('Authorization') ?? '';
    if (!timingSafeEqual(auth, 'Bearer ' + env.MAIL_RELAY_SECRET)) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'body' }, { status: 400 });
    }
    const { to, subject, text } =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    if (typeof to !== 'string' || !to.includes('@') || to.length > 320) {
      return Response.json({ error: 'to' }, { status: 400 });
    }
    if (typeof subject !== 'string' || typeof text !== 'string') {
      return Response.json({ error: 'body' }, { status: 400 });
    }
    if (subject.length > 200 || text.length > 2000) {
      return Response.json({ error: 'too_large' }, { status: 400 });
    }

    let res: Response;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + env.RESEND_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
      });
    } catch {
      return Response.json({ error: 'resend_unreachable' }, { status: 502 });
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return Response.json(
        { error: 'resend', detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { id?: string };
    return Response.json({ ok: true, id: data.id ?? null });
  },
};
