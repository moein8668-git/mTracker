import { describe, it, expect, beforeEach } from 'vitest';
import { analyze } from '../src/analytics';
import { normalizeDaysPerWeek } from '../src/utils';
import { migrate, Repo, SCHEMA_VERSION } from '../src/storage';
import { taskPeriodAnalysis, streakOf, isDaily, isTrackedForStability, scheduleSummary } from '../src/analysis';

function installLocalStorage(): void {
  const mem = {
    map: new Map<string, string>(),
    getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; },
    setItem(k: string, v: string) { this.map.set(k, v); },
    removeItem(k: string) { this.map.delete(k); },
    clear() { this.map.clear(); }
  };
  (globalThis as Record<string, unknown>).localStorage = mem;
}

const noop = () => {};

describe('normalizeDaysPerWeek', () => {
  it('defaults missing or non-numeric input to 7 (every day)', () => {
    expect(normalizeDaysPerWeek(undefined)).toBe(7);
    expect(normalizeDaysPerWeek(null)).toBe(7);
    expect(normalizeDaysPerWeek('invalid')).toBe(7);
  });

  it('clamps values between 0 and 7', () => {
    expect(normalizeDaysPerWeek(0)).toBe(0);
    expect(normalizeDaysPerWeek('0')).toBe(0);
    expect(normalizeDaysPerWeek(3)).toBe(3);
    expect(normalizeDaysPerWeek(7)).toBe(7);
    expect(normalizeDaysPerWeek(10)).toBe(7);
    expect(normalizeDaysPerWeek(-2)).toBe(0);
  });

  it('converts legacy v2 weekday array to length', () => {
    expect(normalizeDaysPerWeek([6, 1, 3])).toBe(3);
    expect(normalizeDaysPerWeek([0, 1, 2, 3, 4, 5, 6])).toBe(7);
    expect(normalizeDaysPerWeek([])).toBe(0);
  });
});

describe('schema migrations (v1/v2 → v3)', () => {
  it('upgrades v1 task without schedule to daysPerWeek: 7', () => {
    const out = migrate({
      schemaVersion: 1,
      tasks: [{ id: 't1', name: 'زبان', targetDailyHours: 2, color: '#fff', createdAt: '2026-09-01T00:00:00Z', archivedAt: null }],
      entries: [],
      settings: {}
    });
    expect(out?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out?.tasks[0]?.daysPerWeek).toBe(7);
  });

  it('upgrades v2 task with weekday array to daysPerWeek number and cleans up days array', () => {
    const out = migrate({
      schemaVersion: 2,
      tasks: [{ id: 't2', name: 'باشگاه', targetDailyHours: 1, color: '#fff', days: [6, 1, 3], createdAt: '2026-09-01T00:00:00Z', archivedAt: null }],
      entries: [],
      settings: {}
    });
    expect(out?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out?.tasks[0]?.daysPerWeek).toBe(3);
    expect((out?.tasks[0] as unknown as { days?: unknown }).days).toBeUndefined();
  });

  it('preserves daysPerWeek: 0 in v3', () => {
    const out = migrate({
      schemaVersion: 3,
      tasks: [{ id: 't3', name: 'پروژه آزاد', targetDailyHours: 0, color: '#fff', daysPerWeek: 0, createdAt: '2026-09-01T00:00:00Z', archivedAt: null }],
      entries: [],
      settings: {}
    });
    expect(out?.tasks[0]?.daysPerWeek).toBe(0);
  });
});

describe('analyze includes all calendar days and logged hours', () => {
  it('counts hours worked on any day and calculates mean over all days in period', () => {
    const entries = [
      { date: '2026-09-01', hours: 2 },
      { date: '2026-09-03', hours: 4 },
      { date: '2026-09-05', hours: 1 }
    ];
    const r = analyze({ startIso: '2026-09-01', endIso: '2026-09-05', entries });
    expect(r.n).toBe(5); // 5 days: Sep 1..5
    expect(r.total).toBe(7);
    expect(r.mean).toBeCloseTo(1.4);
    expect(r.activeDays).toBe(3);
  });
});

describe('tasks with daysPerWeek === 0 vs > 0', () => {
  beforeEach(() => { installLocalStorage(); });

  it('provides complete analytics for daysPerWeek: 0 tasks', () => {
    const repo = new Repo(null, noop);
    const t = repo.createTask({ name: 'کار آزاد', daysPerWeek: 0 });
    repo.updateTask(t.id, { createdAt: '2026-09-01T00:00:00Z' });
    repo.upsertEntry({ taskId: t.id, date: '2026-09-01', hours: 3 });
    repo.upsertEntry({ taskId: t.id, date: '2026-09-02', hours: 2 });

    const r = taskPeriodAnalysis(repo, t, '2026-09-01', '2026-09-04');
    expect(r.n).toBe(4);
    expect(r.total).toBe(5);
    expect(r.mean).toBeCloseTo(1.25);
    expect(r.activeDays).toBe(2);
    expect(isTrackedForStability(t)).toBe(false);
    expect(isDaily(t)).toBe(false);
    expect(scheduleSummary(t)).toBe('بدون برنامه پایداری');
  });

  it('correctly reports stability tracking and schedule summary for target days', () => {
    const repo = new Repo(null, noop);
    const tDaily = repo.createTask({ name: 'زبان', daysPerWeek: 7 });
    const tPartial = repo.createTask({ name: 'ورزش', daysPerWeek: 3 });

    expect(isTrackedForStability(tDaily)).toBe(true);
    expect(isDaily(tDaily)).toBe(true);
    expect(scheduleSummary(tDaily)).toBe('هر روز');

    expect(isTrackedForStability(tPartial)).toBe(true);
    expect(isDaily(tPartial)).toBe(false);
    expect(scheduleSummary(tPartial)).toBe('۳ روز در هفته');
  });

  it('streak counts consecutive active days', () => {
    const repo = new Repo(null, noop);
    const t = repo.createTask({ name: 'کتاب', daysPerWeek: 5 });
    repo.upsertEntry({ taskId: t.id, date: '2026-09-03', hours: 1 });
    repo.upsertEntry({ taskId: t.id, date: '2026-09-04', hours: 1 });
    repo.upsertEntry({ taskId: t.id, date: '2026-09-05', hours: 2 });

    expect(streakOf(repo, t.id, '2026-09-05')).toBe(3);
    expect(streakOf(repo, t.id, '2026-09-04')).toBe(2);
    expect(streakOf(repo, t.id, '2026-09-02')).toBe(0);
  });
});
