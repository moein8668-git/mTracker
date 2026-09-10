/* Period/task-level analysis built on Analytics — still pure (repo passed in). */

import type { AnalyzeResult, Task } from './types';
import { analyze, EMPTY_RESULT } from './analytics';
import { isoOf, isoToDate, addDays, todayIso, monthMeta, localDateOf } from './jalali';
import { normalizeDaysPerWeek } from './utils';
import { faNum } from './settings';
import type { Repo } from './storage';

/* A task's history may begin before its record was created (imports backfill
   days), so the effective start is the earlier of createdAt / first entry. */
export function taskEffectiveStart(repo: Repo, task: Task): string | null {
  let start: string | null = task.createdAt ? localDateOf(task.createdAt) : null;
  for (const e of repo.entriesForTask(task.id)) {
    if (!start || e.date < start) start = e.date;
  }
  return start;
}

function periodStartFor(repo: Repo, task: Task, rangeStartIso: string): string {
  const taskStart = taskEffectiveStart(repo, task);
  if (!taskStart || taskStart <= rangeStartIso) return rangeStartIso;
  return taskStart;
}
export function isDaily(task: Task): boolean {
  return normalizeDaysPerWeek(task.daysPerWeek) === 7;
}

export function isTrackedForStability(task: Task): boolean {
  return normalizeDaysPerWeek(task.daysPerWeek) > 0;
}

/** Short schedule label for task rows, e.g. «هر روز», «۳ روز در هفته», «بدون برنامه پایداری». */
export function scheduleSummary(task: Task): string {
  const d = normalizeDaysPerWeek(task.daysPerWeek);
  if (d === 0) return 'بدون برنامه پایداری';
  if (d === 7) return 'هر روز';
  return faNum(d) + ' روز در هفته';
}

const ANALYSIS_CACHE = new Map<string, AnalyzeResult>();
const NUM_CACHE = new Map<string, number>();

export function taskPeriodAnalysis(repo: Repo, task: Task, startIso: string, endIso: string): AnalyzeResult {
  const s = periodStartFor(repo, task, startIso);
  const e = endIso < todayIso() ? endIso : todayIso();
  const key = `tpa_${repo.version}_${task.id}_${s}_${e}`;
  const hit = ANALYSIS_CACHE.get(key);
  if (hit) return hit;

  let res: AnalyzeResult;
  if (s > e) res = { ...EMPTY_RESULT, startIso: s, endIso: e };
  else res = {
    ...analyze({ startIso: s, endIso: e, entries: repo.entriesForTask(task.id), target: task.targetDailyHours, daysPerWeek: task.daysPerWeek }),
    startIso: s, endIso: e
  };
  if (ANALYSIS_CACHE.size > 800) ANALYSIS_CACHE.clear();
  ANALYSIS_CACHE.set(key, res);
  return res;
}

export function taskWeekAnalysis(repo: Repo, task: Task): AnalyzeResult | null {
  const endIso = todayIso();
  const startIso = periodStartFor(repo, task, isoOf(addDays(new Date(), -6)));
  if (startIso > endIso) return null;
  const key = `twa_${repo.version}_${task.id}_${startIso}_${endIso}`;
  const hit = ANALYSIS_CACHE.get(key);
  if (hit) return hit;

  const res = analyze({ startIso, endIso, entries: repo.entriesForTask(task.id), target: task.targetDailyHours, daysPerWeek: task.daysPerWeek });
  if (ANALYSIS_CACHE.size > 800) ANALYSIS_CACHE.clear();
  ANALYSIS_CACHE.set(key, res);
  return res;
}

export function overallPeriodAnalysis(repo: Repo, startIso: string, endIso: string): AnalyzeResult {
  const e = endIso < todayIso() ? endIso : todayIso();
  const key = `opa_${repo.version}_${startIso}_${e}`;
  const hit = ANALYSIS_CACHE.get(key);
  if (hit) return hit;

  let s = startIso;
  const entryStart = repo.entries.reduce<string | null>((min, e) => (!min || e.date < min ? e.date : min), null);
  let earliest: string | null = entryStart;
  if (!earliest) {
    const created = repo.activeTasks()
      .map(t => t.createdAt ? localDateOf(t.createdAt) : null)
      .filter((x): x is string => Boolean(x));
    earliest = created.length ? created.reduce((a, b) => (a < b ? a : b)) : null;
  }
  if (earliest && earliest > s) s = earliest;
  let res: AnalyzeResult;
  if (s > e) res = { ...EMPTY_RESULT };
  else res = analyze({ startIso: s, endIso: e, entries: repo.entries, target: 0 });

  if (ANALYSIS_CACHE.size > 800) ANALYSIS_CACHE.clear();
  ANALYSIS_CACHE.set(key, res);
  return res;
}

export function overallMonthAnalysis(repo: Repo, ms: Date): AnalyzeResult {
  const meta = monthMeta(ms);
  return overallPeriodAnalysis(repo, meta.startIso, meta.endIso);
}

export function streakOf(repo: Repo, taskId: string, endDateIso: string): number {
  const key = `str_${repo.version}_${taskId}_${endDateIso}`;
  const hit = NUM_CACHE.get(key);
  if (hit !== undefined) return hit;

  const set = new Set(repo.entriesForTask(taskId).filter(e => e.hours > 0).map(e => e.date));
  let s = 0, d = isoToDate(endDateIso), guard = 0;
  while (set.has(isoOf(d)) && guard++ < 3650) {
    s++;
    d = addDays(d, -1);
  }
  if (NUM_CACHE.size > 800) NUM_CACHE.clear();
  NUM_CACHE.set(key, s);
  return s;
}

export function overallRollingMean(repo: Repo, days: number, endIso: string): number {
  const key = `orm_${repo.version}_${days}_${endIso}`;
  const hit = NUM_CACHE.get(key);
  if (hit !== undefined) return hit;

  const res = analyze({
    startIso: isoOf(addDays(isoToDate(endIso), -(days - 1))),
    endIso,
    entries: repo.entries,
    target: 0
  }).mean;
  if (NUM_CACHE.size > 800) NUM_CACHE.clear();
  NUM_CACHE.set(key, res);
  return res;
}

