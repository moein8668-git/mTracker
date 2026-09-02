/* Number/date formatting per user settings. Pure. */

import type { DBData } from './types';
export interface AppSettings {
  chartDir: 'ltr' | 'rtl';
  timeFormat: 'hm' | 'decimal';
}
const FA_NUM = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const FA_NUM1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
export const FA_DATE_FULL = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export const faNum = (n: number): string => FA_NUM.format(n);
export const fmt1 = (n: number): string => FA_NUM1.format(Math.round(n * 100) / 100);

export function appSettings(db: DBData | null): AppSettings {
  return {
    chartDir: db && db.settings && db.settings.chartDir === 'rtl' ? 'rtl' : 'ltr',
    timeFormat: db && db.settings && db.settings.timeFormat === 'decimal' ? 'decimal' : 'hm'
  };
}

export function fmtHours(h: number, s: AppSettings): string {
  if (s.timeFormat === 'decimal') return fmt1(h);
  const total = Math.round(Math.abs(h) * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  return FA_NUM.format(hh) + ':' + (mm < 10 ? '۰' : '') + FA_NUM.format(mm);
}
