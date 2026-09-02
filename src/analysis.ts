/* Period/task-level analysis built on Analytics — still pure (repo passed in). */

import type { AnalyzeResult, Task } from './types';
import { analyze, EMPTY_RESULT } from './analytics';
import { isoOf, isoToDate, addDays, todayIso, monthMeta, localDateOf } from './jalali';
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

export function taskPeriodAnalysis(repo: Repo, task: Task, startIso: string, endIso: string): AnalyzeResult {
  const s = periodStartFor(repo, task, startIso);
  const e = endIso < todayIso() ? endIso : todayIso();
  if (s > e) return { ...EMPTY_RESULT, startIso: s, endIso: e };
  return {
    ...analyze({ startIso: s, endIso: e, entries: repo.entriesForTask(task.id), target: task.targetDailyHours }),
    startIso: s, endIso: e
  };
}

export function taskWeekAnalysis(repo: Repo, task: Task): AnalyzeResult | null {
  const endIso = todayIso();
  const startIso = periodStartFor(repo, task, isoOf(addDays(new Date(), -6)));
  if (startIso > endIso) return null;
  return analyze({ startIso, endIso, entries: repo.entriesForTask(task.id), target: task.targetDailyHours });
}

export function overallPeriodAnalysis(repo: Repo, startIso: string, endIso: string): AnalyzeResult {
  const e = endIso < todayIso() ? endIso : todayIso();
  let s = startIso;
  /* overall window starts where the data starts: earliest entry across all
     tasks (imports backfill), falling back to earliest task creation */
  const entryStart = repo.entries.reduce<string | null>((min, e) => (!min || e.date < min ? e.date : min), null);
  let earliest: string | null = entryStart;
  if (!earliest) {
    const created = repo.activeTasks()
      .map(t => t.createdAt ? localDateOf(t.createdAt) : null)
      .filter((x): x is string => Boolean(x));
    earliest = created.length ? created.reduce((a, b) => (a < b ? a : b)) : null;
  }
  if (earliest && earliest > s) s = earliest;
  if (s > e) return { ...EMPTY_RESULT };
  return analyze({ startIso: s, endIso: e, entries: repo.entries, target: 0 });
}

export function overallMonthAnalysis(repo: Repo, ms: Date): AnalyzeResult {
  const meta = monthMeta(ms);
  return overallPeriodAnalysis(repo, meta.startIso, meta.endIso);
}

export function streakOf(repo: Repo, taskId: string, endDateIso: string): number {
  const set = new Set(repo.entriesForTask(taskId).filter(e => e.hours > 0).map(e => e.date));
  let s = 0, d = isoToDate(endDateIso), guard = 0;
  while (set.has(isoOf(d)) && guard++ < 3650) { s++; d = addDays(d, -1); }
  return s;
}

export function overallRollingMean(repo: Repo, days: number, endIso: string): number {
  return analyze({
    startIso: isoOf(addDays(isoToDate(endIso), -(days - 1))),
    endIso,
    entries: repo.entries,
    target: 0
  }).mean;
}

