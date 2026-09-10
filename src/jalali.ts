/* Dates: Gregorian ISO storage, Jalali display. Pure. */

export function isoOf(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

export function localDateOf(isoDateTime: string): string {
  return isoOf(new Date(isoDateTime));
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function todayIso(): string {
  return isoOf(new Date());
}

const J_FMT = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric' });

export interface JalaliDate { jy: number; jm: number; jd: number; }

const TO_J_CACHE = new Map<number, JalaliDate>();

export function toJ(date: Date): JalaliDate {
  const key = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const hit = TO_J_CACHE.get(key);
  if (hit) return hit;

  const o: Record<string, string> = {};
  for (const p of J_FMT.formatToParts(date)) o[p.type] = p.value;
  const res: JalaliDate = { jy: +o['year']!, jm: +o['month']!, jd: +o['day']! };
  if (TO_J_CACHE.size > 2000) TO_J_CACHE.clear();
  TO_J_CACHE.set(key, res);
  return res;
}

export const J_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];

export const weekdayName = (iso: string): string => WEEKDAYS[isoToDate(iso).getDay()]!;

export function monthStartOf(date: Date): Date {
  return addDays(date, -(toJ(date).jd - 1));
}

export function prevMonthStart(ms: Date): Date {
  const d = addDays(ms, -1);
  return addDays(d, -(toJ(d).jd - 1));
}

export function nextMonthStart(ms: Date): Date {
  const d = addDays(ms, 31);
  return addDays(d, -(toJ(d).jd - 1));
}

export interface MonthMeta { startIso: string; endIso: string; length: number; }

export function monthMeta(ms: Date): MonthMeta {
  const last = addDays(nextMonthStart(ms), -1);
  return { startIso: isoOf(ms), endIso: isoOf(last), length: toJ(last).jd };
}

export function jLabel(ms: Date): string {
  const { jy, jm } = toJ(ms);
  return J_MONTHS[jm - 1]! + ' ' + FA_YEAR_FMT.format(jy);
}

export function jDayLabel(iso: string): string {
  const { jm, jd } = toJ(isoToDate(iso));
  return weekdayName(iso) + ' ' + FA_NUM_FMT.format(jd) + ' ' + J_MONTHS[jm - 1]!;
}

export function jShortLabel(iso: string): string {
  const { jm, jd } = toJ(isoToDate(iso));
  return FA_NUM_FMT.format(jd) + ' ' + J_MONTHS[jm - 1]!;
}

const FA_NUM_FMT = new Intl.NumberFormat('fa-IR');
const FA_YEAR_FMT = new Intl.NumberFormat('fa-IR', { useGrouping: false });

export function formatPersianFull(date: Date): string {
  const { jy, jm, jd } = toJ(date);
  const weekday = WEEKDAYS[date.getDay()]!;
  const month = J_MONTHS[jm - 1]!;
  return `${weekday}، ${FA_NUM_FMT.format(jd)} ${month} ${FA_YEAR_FMT.format(jy)}`;
}
