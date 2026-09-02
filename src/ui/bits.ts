/* Small shared UI pieces + feedback helpers. */

import { fmtHours, faNum } from '../settings';
import type { AppSettings } from '../settings';
import type { StabilityStatus } from '../types';

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(msg: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el!.classList.remove('show'), 2600);
}

export const BADGES: Record<StabilityStatus, { cls: string; label: string }> = {
  ok:       { cls: 'ok',    label: 'پایدار' },
  volatile: { cls: 'warn',  label: 'نوسانی' },
  nodata:   { cls: 'mutedb', label: 'بدون داده' },
  empty:    { cls: 'mutedb', label: 'بدون داده' }
};

export const badge = (st: StabilityStatus): string => {
  const b = BADGES[st] || BADGES.empty;
  return '<span class="badge ' + b.cls + '">' + b.label + '</span>';
};

export const VERDICT_NOTE: Record<StabilityStatus, string> = {
  ok: 'مسیر پایدار است؛ همین‌طور ادامه بده.',
  volatile: 'نوسان زیاد است؛ برنامه را سبک‌تر اما منظم‌تر کن.',
  nodata: 'هنوز ساعتی در این بازه ثبت نشده.',
  empty: 'در این بازه داده‌ای وجود ندارد.'
};

export function statBox(label: string, value: string, unit: string, extra = ''): string {
  return '<div class="stat"><span class="s-label">' + label + '</span>' +
    '<span class="s-value">' + value + (unit ? '<i>' + unit + '</i>' : '') + '</span>' +
    extra + '</div>';
}

export function hoursFmt(h: number, s: AppSettings): string {
  return fmtHours(h, s);
}

export function numFmt(n: number): string {
  return faNum(n);
}
