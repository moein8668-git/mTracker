/* Layer 2 — analytics (pure, DOM-free)  [SEAM: lift to TS module]
   Rule: SD < Mean/2  →  consistent */

import type { AnalyzeResult, DayPoint, StabilityStatus } from './types';
import { isoOf, isoToDate, addDays } from './jalali';
import { normalizeDaysPerWeek } from './utils';
export const EMPTY_RESULT: AnalyzeResult = { status: 'empty', days: [], n: 0, total: 0, mean: 0, sd: 0, cv: 0, sdLimit: 0, activeDays: 0, targetPct: null };

/** Max days in one analyze window — 500 covers any Jalali year + margin. */
export const MAX_RANGE_DAYS = 500;

export function analyze({
  startIso,
  endIso,
  entries,
  target = 0,
  daysPerWeek = 7
}: {
  startIso: string;
  endIso: string;
  entries: { date: string; hours: number }[];
  target?: number;
  daysPerWeek?: number;
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
  const total = days.reduce((sum, x) => sum + x.hours, 0);
  const activeDays = days.filter(x => x.hours > 1e-9).length;

  const dpw = normalizeDaysPerWeek(daysPerWeek);

  let sampleHours: number[];

  if (dpw === 7 || dpw === 0) {
    sampleHours = days.map(x => x.hours);
  } else {
    if (days.length <= 7) {
      const sorted = days.map(x => x.hours).sort((a, b) => b - a);
      const targetDays = Math.min(days.length, dpw);
      sampleHours = sorted.slice(0, targetDays);
    } else {
      const weeks: DayPoint[][] = [];
      let currentWeek: DayPoint[] = [];
      let currentSat = '';

      for (const day of days) {
        const dt = isoToDate(day.date);
        const offset = (dt.getDay() - 6 + 7) % 7;
        const satIso = isoOf(addDays(dt, -offset));
        if (satIso !== currentSat) {
          if (currentWeek.length) weeks.push(currentWeek);
          currentWeek = [day];
          currentSat = satIso;
        } else {
          currentWeek.push(day);
        }
      }
      if (currentWeek.length) weeks.push(currentWeek);

      sampleHours = [];
      for (const week of weeks) {
        const m = week.length;
        const targetDays = m === 7 ? dpw : Math.min(m, Math.round(dpw * m / 7));
        if (targetDays > 0) {
          const sorted = week.map(x => x.hours).sort((a, b) => b - a);
          sampleHours.push(...sorted.slice(0, targetDays));
        }
      }
    }
  }

  const sampleN = sampleHours.length || 1;
  const sampleTotal = sampleHours.reduce((a, b) => a + b, 0);
  const mean = sampleTotal / sampleN;
  const sd = Math.sqrt(sampleHours.reduce((a, x) => a + (x - mean) * (x - mean), 0) / sampleN);

  let status: StabilityStatus;
  if (dpw === 0) {
    status = 'nodata';
  } else {
    status = total <= 1e-9 ? 'nodata' : (sd < mean / 2 - 1e-9 ? 'ok' : 'volatile');
  }

  return {
    status,
    days,
    n,
    total,
    mean,
    sd,
    cv: mean > 0 ? sd / mean : 0,
    sdLimit: mean / 2,
    activeDays,
    targetPct: target > 0 ? (mean / target) * 100 : null
  };
}
