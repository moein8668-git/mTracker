import { describe, it, expect } from 'vitest';
import { sha256Hex, constantTimeEqualHex, genOtpCode, genSessionToken, safeTs } from './util.js';

describe('sha256Hex / constantTimeEqualHex', () => {
  it('hashes deterministically', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
    expect(sha256Hex('abc')).toHaveLength(64);
    expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'));
  });

  it('constant-time equal accepts identical hashes and rejects different', () => {
    const a = sha256Hex('secret');
    expect(constantTimeEqualHex(a, a)).toBe(true);
    expect(constantTimeEqualHex(a, sha256Hex('secret2'))).toBe(false);
  });

  it('rejects different-length inputs without throwing', () => {
    expect(constantTimeEqualHex('ab', 'abcd')).toBe(false);
  });
});

describe('genOtpCode', () => {
  it('generates 6-digit numeric codes', () => {
    for (let i = 0; i < 50; i++) {
      const c = genOtpCode();
      expect(c).toMatch(/^\d{6}$/);
      expect(Number(c)).toBeGreaterThanOrEqual(100000);
      expect(Number(c)).toBeLessThanOrEqual(999999);
    }
  });
});

describe('genSessionToken', () => {
  it('generates 256-bit url-safe tokens', () => {
    const t = genSessionToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes → 43 base64url chars
    expect(genSessionToken()).not.toBe(t);
  });
});

describe('safeTs', () => {
  it('coerces garbage to a valid Date instead of throwing', () => {
    for (const junk of [undefined, '', 'not-a-date', '13/45/9999']) {
      const d = safeTs(junk);
      expect(d).toBeInstanceOf(Date);
      expect(d.getTime()).not.toBeNaN();
    }
  });

  it('parses valid ISO strings faithfully', () => {
    expect(safeTs('2026-01-02T03:04:05.000Z').toISOString()).toBe('2026-01-02T03:04:05.000Z');
  });
});
