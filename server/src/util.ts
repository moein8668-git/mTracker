import crypto from 'crypto';

export function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export function genOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function genSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function safeTs(v?: string): Date {
  const d = v ? new Date(v) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}
