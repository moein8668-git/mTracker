/* Pomodorus (pomodorus.yazdan.me) profile import.
   Upstream shape (probed 2026-09-02):
   { handle, days: [{ day: "YYYY-MM-DD", totalMs, tasks: [{ name, totalMs }] }], owner, everFocused, serverNow }
   Conversion: ms → hours (1h = 3_600_000ms), rounded to 2dp, clamped to app limits. */

import type { Repo } from './storage';
import { clampHours } from './utils';

const MS_PER_HOUR = 3_600_000;

export interface PomodorusTask { name: string; totalMs: number; }
export interface PomodorusDay { day: string; totalMs: number; tasks: PomodorusTask[]; }
export interface PomodorusProfile { handle: string; days: PomodorusDay[]; }

export interface PomoImportOutcome {
  tasksCreated: number;
  entriesAdded: number;
  entriesSkippedExisting: number;
  daysWithFocus: number;
  totalHours: number;
}

export function normalizePomodorusProfile(data: unknown): PomodorusProfile | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<PomodorusProfile>;
  if (typeof d.handle !== 'string' || !Array.isArray(d.days)) return null;
  for (const day of d.days) {
    if (!day || typeof day.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.day)) return null;
    if (typeof day.totalMs !== 'number' || !isFinite(day.totalMs)) return null;
    if (!Array.isArray(day.tasks)) return null;
  }
  return { handle: d.handle, days: d.days };
}

const msToHours = (ms: number): number => Math.round((ms / MS_PER_HOUR) * 100) / 100;

/**
 * Import focus sessions into local entries.
 * Non-destructive: days where the user already logged hours locally are left
 * untouched (counted as skipped) — local manual data always wins.
 * Tasks are matched by exact name; new names create tasks with palette colors.
 */
export function importPomodorusProfile(repo: Repo, profile: PomodorusProfile): PomoImportOutcome {
  const taskCache = new Map<string, { id: string }>();
  const outcome: PomoImportOutcome = {
    tasksCreated: 0, entriesAdded: 0, entriesSkippedExisting: 0, daysWithFocus: 0, totalHours: 0
  };

  for (const day of profile.days) {
    if (day.totalMs <= 0) continue;
    outcome.daysWithFocus++;

    /* day-level: only the aggregate, unless there is no task breakdown */
    if (!day.tasks.length) {
      applyDay(repo, taskCache, profile.handle, day.day, msToHours(day.totalMs), outcome, '');
      continue;
    }

    for (const t of day.tasks) {
      if (t.totalMs <= 0) continue;
      const hours = msToHours(t.totalMs);
      applyDay(repo, taskCache, t.name, day.day, hours, outcome, '');
    }
  }
  repo.persist();
  return outcome;
}

function applyDay(
  repo: Repo,
  taskCache: Map<string, { id: string }>,
  taskName: string,
  date: string,
  hours: number,
  outcome: PomoImportOutcome,
  fallbackName: string
): boolean {
  const name = taskName.trim() || fallbackName;
  if (!name || hours <= 0) return false;
  let task = taskCache.get(name);
  if (!task) {
    const existing = repo.tasks.find(t => t.name === name);
    if (existing) task = existing;
    else { task = repo.createTask({ name }); outcome.tasksCreated++; }
    taskCache.set(name, task);
  }
  const local = repo.findEntry(task.id, date);
  if (local) { outcome.entriesSkippedExisting++; return false; }
  repo.upsertEntry({ taskId: task.id, date, hours: clampHours(hours), note: '' });
  outcome.entriesAdded++;
  outcome.totalHours += hours;
  return true;
}

