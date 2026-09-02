/* Layer 2 — analytics (pure, DOM-free)  [SEAM: lift to TS module]
   Rule: SD < Mean/2  →  consistent */

import type { AnalyzeResult, DayPoint } from './types';
import { isoOf, isoToDate, addDays } from './jalali';

export const EMPTY_RESULT: AnalyzeResult = { status: 'empty', days: [], n: 0, total: 0, mean: 0, sd: 0, cv: 0, sdLimit: 0, activeDays: 0, targetPct: null };

/** Max days in one analyze window — 500 covers any Jalali year + margin. */
export const MAX_RANGE_DAYS = 500;

export function analyze({ startIso, endIso, entries, target = 0 }: {
  startIso: string;
  endIso: string;
  entries: { date: string; hours: number }[];
  target?: number;
}): AnalyzeResult {
  const byDate = new Map<string, number>();
  for (const e of entries) byDate.set(e.date, (byDate.get(e.date) || 0) + e.hours);
  const days: DayPoint[] = [];
  let d = isoToDate(startIso);
  const end = isoToDate(endIso);
  let guard = 0;
  while (d <= end) {
    if (guard++ > MAX_RANGE_DAYS) throw new Error('analyze: range longer than ' + MAX_RANGE_DAYS + ' days');
    const iso = isoOf(d);
    days.push({ date: iso, hours: byDate.get(iso) || 0 });
    d = addDays(d, 1);
  }
  const n = days.length;
  if (!n) return { ...EMPTY_RESULT };
  const xs = days.map(x => x.hours);
  const total = xs.reduce((a, b) => a + b, 0);
  const mean = total / n;
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) * (x - mean), 0) / n);
  const status = total <= 1e-9 ? 'nodata' : (sd < mean / 2 - 1e-9 ? 'ok' : 'volatile');
  return {
    status, days, n, total, mean, sd,
    cv: mean > 0 ? sd / mean : 0,
    sdLimit: mean / 2,
    activeDays: xs.filter(x => x > 1e-9).length,
    targetPct: target > 0 ? (mean / target) * 100 : null
  };
}
