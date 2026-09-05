import { describe, it, expect, beforeEach } from 'vitest';
import { analyze } from '../src/analytics';
import { normalizeDays, WEEKDAY_PICK, ALL_DAYS, isScheduledDay } from '../src/jalali';
import { migrate, Repo } from '../src/storage';
import { taskPeriodAnalysis, streakOf, isDaily, scheduleSummary } from '../src/analysis';

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

describe('normalizeDays', () => {
  it('defaults missing input to every day', () => {
    expect(normalizeDays(undefined)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(normalizeDays([])).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it('keeps only valid weekdays, deduped and sorted', () => {
    expect(normalizeDays([5, 1, 9, -1, 1, 'x'])).toEqual([1, 5]);
  });
});

describe('weekday picker order', () => {
  it('starts Saturday (Iranian week) and covers all days', () => {
    expect(WEEKDAY_PICK).toHaveLength(7);
    expect(WEEKDAY_PICK[0]).toEqual({ day: 6, label: 'شنبه' });
    expect(WEEKDAY_PICK.map(w => w.day).sort()).toEqual(ALL_DAYS);
  });
  it('matches getDay() convention (2024-01-01 was a Monday)', () => {
    expect(isScheduledDay([1], '2024-01-01')).toBe(true);
    expect(isScheduledDay([0], '2024-01-01')).toBe(false);
  });
});

describe('analyze with schedule filter', () => {
  // Mon 2024-01-01 .. Sun 2024-01-07, 2h every day
  const entries = [1, 2, 3, 4, 5, 6, 7].map(i => ({
    date: '2024-01-0' + i, hours: 2
  }));
  const monWedFri = (iso: string) => [1, 3, 5].includes(new Date(iso + 'T12:00:00').getDay());

  it('excludes off-days from the population instead of zeroing them', () => {
    const r = analyze({ startIso: '2024-01-01', endIso: '2024-01-07', entries, includeDay: monWedFri });
    expect(r.n).toBe(3);
    expect(r.total).toBe(6);
    expect(r.mean).toBe(2);
    expect(r.status).toBe('ok');
  });

  it('counts every day without a filter (daily-task behavior unchanged)', () => {
    const r = analyze({ startIso: '2024-01-01', endIso: '2024-01-07', entries });
    expect(r.n).toBe(7);
  });
});

describe('schema v1 → v2 migration', () => {
  it('upgrades old tasks to a daily schedule', () => {
    const out = migrate({
      schemaVersion: 1,
      tasks: [{ id: 't', name: 'زبان', targetDailyHours: 2, color: '#fff', createdAt: 'x', archivedAt: null }],
      entries: [], settings: {}
    });
    expect(out?.schemaVersion).toBe(2);
    expect(out?.tasks[0]?.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('repairs invalid schedules and rejects newer versions', () => {
    const out = migrate({
      schemaVersion: 2,
      tasks: [{ id: 't', name: 'x', targetDailyHours: 0, color: '#fff', days: [9, 1, 1], createdAt: 'x', archivedAt: null }],
      entries: [], settings: {}
    });
    expect(out?.tasks[0]?.days).toEqual([1]);
    expect(migrate({ schemaVersion: 99, tasks: [], entries: [], settings: {} })).toBeNull();
  });
});

describe('schedule-aware analysis', () => {
  beforeEach(() => { installLocalStorage(); });

  it('task verdict uses scheduled days only (Sat/Mon/Wed steady = ok)', () => {
    const repo = new Repo(null, noop);
    const t = repo.createTask({ name: 'باشگاه', days: [6, 1, 3] });
    repo.updateTask(t.id, { createdAt: '2023-12-01T00:00:00' });
    // Sat/Mon/Wed of both weeks — steady 2h
    for (const d of ['2024-01-01', '2024-01-03', '2024-01-06', '2024-01-08', '2024-01-10', '2024-01-13']) {
      repo.upsertEntry({ taskId: t.id, date: d, hours: 2 });
    }
    const r = taskPeriodAnalysis(repo, t, '2024-01-01', '2024-01-14');
    expect(r.n).toBe(6); // 2 weeks × 3 scheduled days
    expect(r.status).toBe('ok');
  });

  it('streak crosses off-days but breaks on a missed scheduled day', () => {
    const repo = new Repo(null, noop);
    const t = repo.createTask({ name: 'باشگاه', days: [6, 1, 3] });
    for (const d of ['2023-12-30', '2024-01-01', '2024-01-03', '2024-01-06', '2024-01-08', '2024-01-10']) {
      repo.upsertEntry({ taskId: t.id, date: d, hours: 1 });
    }
    expect(streakOf(repo, t.id, '2024-01-10')).toBe(6);
    // drop the Monday session → streak restarts at Wednesday
    const mon = repo.findEntry(t.id, '2024-01-08')!;
    repo.removeEntry(mon.id);
    expect(streakOf(repo, t.id, '2024-01-10')).toBe(1);
  });

  it('daily tasks keep calendar-day streaks', () => {
    const repo = new Repo(null, noop);
    const t = repo.createTask({ name: 'زبان' });
    expect(t.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    repo.upsertEntry({ taskId: t.id, date: '2024-01-09', hours: 1 });
    repo.upsertEntry({ taskId: t.id, date: '2024-01-10', hours: 1 });
    expect(streakOf(repo, t.id, '2024-01-10')).toBe(2);
  });
});

describe('schedule summaries', () => {
  it('labels daily vs partial schedules', () => {
    expect(isDaily({ days: [0, 1, 2, 3, 4, 5, 6] } as never)).toBe(true);
    expect(isDaily({ days: [6, 1, 3] } as never)).toBe(false);
    expect(scheduleSummary({ days: [0, 1, 2, 3, 4, 5, 6] } as never)).toBe('هر روز');
    expect(scheduleSummary({ days: [6, 1, 3] } as never)).toContain('۳');
  });
});
