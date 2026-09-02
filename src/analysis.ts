/* Period/task-level analysis built on Analytics — still pure (repo passed in). */

import type { AnalyzeResult, Task } from './types';
import { analyze, EMPTY_RESULT } from './analytics';
import { isoOf, isoToDate, addDays, todayIso, monthMeta, localDateOf } from './jalali';
import type { Repo } from './storage';

function periodStartFor(task: Task, monthStartIso: string): string {
  const created = task.createdAt ? localDateOf(task.createdAt) : null;
  return (created && created > monthStartIso) ? created : monthStartIso;
}

export function taskPeriodAnalysis(repo: Repo, task: Task, startIso: string, endIso: string): AnalyzeResult {
  const s = periodStartFor(task, startIso);
  const e = endIso < todayIso() ? endIso : todayIso();
  if (s > e) return { ...EMPTY_RESULT, startIso: s, endIso: e };
  return {
    ...analyze({ startIso: s, endIso: e, entries: repo.entriesForTask(task.id), target: task.targetDailyHours }),
    startIso: s, endIso: e
  };
}

export function taskWeekAnalysis(repo: Repo, task: Task): AnalyzeResult | null {
  const endIso = todayIso();
  const startIso = periodStartFor(task, isoOf(addDays(new Date(), -6)));
  if (startIso > endIso) return null;
  return analyze({ startIso, endIso, entries: repo.entriesForTask(task.id), target: task.targetDailyHours });
}

export function overallPeriodAnalysis(repo: Repo, startIso: string, endIso: string): AnalyzeResult {
  const e = endIso < todayIso() ? endIso : todayIso();
  let s = startIso;
  const created = repo.activeTasks()
    .map(t => t.createdAt ? localDateOf(t.createdAt) : null)
    .filter((x): x is string => Boolean(x));
  if (created.length) {
    const earliest = created.reduce((a, b) => (a < b ? a : b));
    if (earliest > s) s = earliest;
  }
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

