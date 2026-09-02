/* Layer 0 — generic utilities (DOM-free unless stated). */

export const $ = (sel: string, root: ParentNode = document): Element | null => root.querySelector(sel);

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const uid = (): string =>
  (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

export const PALETTE = ['#4f46e5', '#0e9384', '#b54708', '#c01048', '#175cd3', '#6941c6', '#079455', '#d92d20'];

export function normDigits(s: unknown): string {
  return String(s ?? '')
    .replace(/[۰-۹]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 1584))
    .replace(/٫/g, '.');
}

export function toNumber(s: unknown): number {
  const n = parseFloat(normDigits(s).replace(/,/g, '.').replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : NaN;
}

export function clampHours(h: number): number {
  return Math.min(24, Math.max(0, Math.round(h * 100) / 100));
}
