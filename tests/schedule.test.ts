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

describe('weekly best-days analysis based on daysPerWeek', () => {
  it('evaluates the best k days per week when 0 < daysPerWeek < 7', () => {
    // User logged 5 days in a 7-day week: 4h, 3h, 2h, 1.5h, 1h, 0h, 0h
    const entries = [
      { date: '2026-09-01', hours: 4 },
      { date: '2026-09-02', hours: 3 },
      { date: '2026-09-03', hours: 2 },
      { date: '2026-09-04', hours: 1.5 },
      { date: '2026-09-05', hours: 1 },
    ];
    const r = analyze({ startIso: '2026-09-01', endIso: '2026-09-07', entries, daysPerWeek: 3 });
    
    // All 7 days in days array and total
    expect(r.n).toBe(7);
    expect(r.days.length).toBe(7);
    expect(r.total).toBe(11.5);
    expect(r.activeDays).toBe(5);
    
    // Mean and SD calculated from top 3 days: [4, 3, 2]
    // Mean = (4 + 3 + 2) / 3 = 3.0
    expect(r.mean).toBeCloseTo(3.0);
    // SD = sqrt(((4-3)^2 + (3-3)^2 + (2-3)^2) / 3) = sqrt(2/3) ≈ 0.8165
    expect(r.sd).toBeCloseTo(Math.sqrt(2 / 3));
    // sdLimit = 1.5, SD (0.8165) < sdLimit (1.5) → status: 'ok'
    expect(r.status).toBe('ok');
  });

  it('pads with zero-hour days when user logged fewer days than target', () => {
    // User target is 3 days/week, but only logged 2 days: 3h, 3h
    const entries = [
      { date: '2026-09-01', hours: 3 },
      { date: '2026-09-02', hours: 3 },
    ];
    const r = analyze({ startIso: '2026-09-01', endIso: '2026-09-07', entries, daysPerWeek: 3 });
    
    expect(r.n).toBe(7);
    expect(r.total).toBe(6);
    expect(r.activeDays).toBe(2);
    
    // Best 3 days: [3, 3, 0] (includes 1 zero day because only 2 days were worked)
    // Mean = (3 + 3 + 0) / 3 = 2.0
    expect(r.mean).toBeCloseTo(2.0);
    // Variance = ((3-2)^2 + (3-2)^2 + (0-2)^2) / 3 = 6 / 3 = 2.0 → SD = sqrt(2) ≈ 1.414
    expect(r.sd).toBeCloseTo(Math.SQRT2);
    // sdLimit = 1.0, SD (1.414) > sdLimit (1.0) → status: 'volatile'
    expect(r.status).toBe('volatile');
  });

  it('gives perfect stability when user meets exact target days consistently', () => {
    // User target is 4 days/week, logged exactly 4 days with 2h each
    const entries = [
      { date: '2026-09-01', hours: 2 },
      { date: '2026-09-02', hours: 2 },
      { date: '2026-09-03', hours: 2 },
      { date: '2026-09-04', hours: 2 },
    ];
    const r = analyze({ startIso: '2026-09-01', endIso: '2026-09-07', entries, daysPerWeek: 4 });
    
    expect(r.mean).toBeCloseTo(2.0);
    expect(r.sd).toBeCloseTo(0.0);
    expect(r.status).toBe('ok');
  });

  it('analyzes all days when daysPerWeek is 7', () => {
    // 5 days worked with 2h each in a 7-day week
    const entries = [
      { date: '2026-09-01', hours: 2 },
      { date: '2026-09-02', hours: 2 },
      { date: '2026-09-03', hours: 2 },
      { date: '2026-09-04', hours: 2 },
      { date: '2026-09-05', hours: 2 },
    ];
    const r = analyze({ startIso: '2026-09-01', endIso: '2026-09-07', entries, daysPerWeek: 7 });
    
    // All 7 days evaluated: [2, 2, 2, 2, 2, 0, 0]
    expect(r.mean).toBeCloseTo(10 / 7);
    expect(r.sd).toBeGreaterThan(0);
  });

  it('provides mean and SD over all calendar days for daysPerWeek: 0 with nodata status', () => {
    const entries = [
      { date: '2026-09-01', hours: 4 },
      { date: '2026-09-02', hours: 2 },
    ];
    const r = analyze({ startIso: '2026-09-01', endIso: '2026-09-04', entries, daysPerWeek: 0 });
    
    // 4 calendar days: [4, 2, 0, 0]
    expect(r.n).toBe(4);
    expect(r.total).toBe(6);
    expect(r.mean).toBeCloseTo(1.5);
    // Population SD of [4, 2, 0, 0] with mean 1.5: sqrt(((2.5)^2 + (0.5)^2 + (-1.5)^2 + (-1.5)^2) / 4) = sqrt(11 / 4) = 1.6583
    expect(r.sd).toBeCloseTo(Math.sqrt(11 / 4));
    expect(r.status).toBe('nodata');
  });

  it('samples best k days of each week in multi-week periods', () => {
    // 2 full weeks: Sat 2026-08-22 to Fri 2026-09-04 (14 days)
    // Week 1: 5 days logged (4, 3, 2, 1, 1, 0, 0) → best 3: [4, 3, 2]
    // Week 2: 3 days logged (3, 3, 3, 0, 0, 0, 0) → best 3: [3, 3, 3]
    const entries = [
      { date: '2026-08-22', hours: 4 },
      { date: '2026-08-23', hours: 3 },
      { date: '2026-08-24', hours: 2 },
      { date: '2026-08-25', hours: 1 },
      { date: '2026-08-26', hours: 1 },
      { date: '2026-08-29', hours: 3 },
      { date: '2026-08-30', hours: 3 },
      { date: '2026-08-31', hours: 3 },
    ];
    const r = analyze({ startIso: '2026-08-22', endIso: '2026-09-04', entries, daysPerWeek: 3 });
    
    expect(r.n).toBe(14);
    expect(r.days.length).toBe(14);
    expect(r.total).toBe(20);
    expect(r.activeDays).toBe(8);
    
    // 6 sample days: [4, 3, 2, 3, 3, 3]
    // Mean = 18 / 6 = 3.0
    expect(r.mean).toBeCloseTo(3.0);
    // SD = sqrt((1 + 0 + 1 + 0 + 0 + 0) / 6) = sqrt(2/6) = sqrt(1/3) ≈ 0.57735
    expect(r.sd).toBeCloseTo(Math.sqrt(1 / 3));
    expect(r.status).toBe('ok');
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
