/* Resolved period: the shared "what range are we looking at" contract.
   Owned here because month/rolling/custom resolution is analysis, not UI. */
import { isoOf, isoToDate, addDays, todayIso, monthStartOf, monthMeta, toJ, jLabel, jShortLabel } from './jalali';
import type { MonthMeta } from './jalali';
import { faNum } from './settings';
import type { Repo } from './storage';
import type { PeriodState } from './ui/state';

export interface ResolvedPeriod {
  startIso: string;
  endIso: string;
  isCurrent?: boolean;
  elapsed?: number;
  meta?: MonthMeta;
  title: string;
  sub: string;
}

export function resolvePeriod(repo: Repo, p: PeriodState): ResolvedPeriod {
  const t0 = todayIso();
  if (p.kind === 'rolling') {
    const days = p.rollingDays || 30;
    const s = isoOf(addDays(new Date(), -(days - 1)));
    return { startIso: s, endIso: t0, title: faNum(days) + ' روز اخیر', sub: 'از ' + jShortLabel(s) + ' تا امروز' };
  }
  if (p.kind === 'custom') {
    let a = p.from || isoOf(addDays(new Date(), -13));
    let b = p.to || t0;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (b > t0) b = t0;
    if (a > t0) a = t0;
    if (a > b) a = b;
    return { startIso: a, endIso: b, title: 'بازه دلخواه', sub: 'از ' + jShortLabel(a) + ' تا ' + jShortLabel(b) };
  }
  const ms = p.monthStart ? isoToDate(p.monthStart) : monthStartOf(new Date());
  const meta = monthMeta(ms);
  const nowJ = toJ(new Date()), curJ = toJ(ms);
  const isCurrent = nowJ.jy === curJ.jy && nowJ.jm === curJ.jm;
  const elapsed = isCurrent ? Math.round((isoToDate(t0).getTime() - isoToDate(meta.startIso).getTime()) / 864e5) + 1 : meta.length;
  return {
    startIso: meta.startIso,
    endIso: meta.endIso < t0 ? meta.endIso : t0,
    isCurrent, elapsed, meta,
    title: jLabel(ms),
    sub: isCurrent ? faNum(elapsed) + ' روز از ' + faNum(meta.length) + ' روز گذشته' : faNum(meta.length) + ' روز'
  };
}
