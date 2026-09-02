import { describe, it, expect, beforeEach } from 'vitest';
import { Repo } from '../src/storage';
import { taskPeriodAnalysis, overallPeriodAnalysis, taskWeekAnalysis } from '../src/analysis';
import { isoOf, addDays } from '../src/jalali';

interface MemStorageLike {
  map: Map<string, string>;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function installLocalStorage(): void {
  const mem: MemStorageLike = {
    map: new Map<string, string>(),
    getItem(k) { return this.map.has(k) ? this.map.get(k)! : null; },
    setItem(k, v) { this.map.set(k, v); }
  };
  (globalThis as Record<string, unknown>).localStorage = mem;
}

const today = () => isoOf(new Date());
const daysAgo = (n: number) => isoOf(addDays(new Date(), -n));

describe('imported (back-dated) task records', () => {
  let repo: Repo;
  beforeEach(() => { installLocalStorage(); repo = new Repo(null, () => {}); });

  it('task created today with imported past entries: period window starts at first entry', () => {
    const t = repo.createTask({ name: 'وایب کد' }); // createdAt = now
    // import-like: entries on 8 of the last 10 days
    for (let i = 0; i < 10; i++) {
      if (i % 5 !== 4) repo.upsertEntry({ taskId: t.id, date: daysAgo(i), hours: 2 });
    }
    const r = taskPeriodAnalysis(repo, t, daysAgo(29), today());
    expect(r.startIso).toBe(daysAgo(8));   // i=9 skipped (i%5==4) → first entry is daysAgo(8)
    expect(r.n).toBe(9);
    expect(r.activeDays).toBe(8);
    expect(r.total).toBeCloseTo(16);
  });

  it('overall 30-day window uses earliest entry across tasks, not createdAt', () => {
    const a = repo.createTask({ name: 'A' }); // created today
    const b = repo.createTask({ name: 'B' }); // created today
    repo.upsertEntry({ taskId: a.id, date: daysAgo(20), hours: 1 });
    for (let i = 0; i < 5; i++) repo.upsertEntry({ taskId: b.id, date: daysAgo(i), hours: 3 });
    const r = overallPeriodAnalysis(repo, daysAgo(29), today());
    expect(r.n).toBe(21); // window starts daysAgo(20); zeros in between counted (SD method)
    expect(r.activeDays).toBe(6);
    expect(r.total).toBeCloseTo(16);
  });

  it('historical month before import is no longer empty', () => {
    const t = repo.createTask({ name: 'X' }); // created today
    repo.upsertEntry({ taskId: t.id, date: daysAgo(45), hours: 5 });
    const r = overallPeriodAnalysis(repo, daysAgo(50), daysAgo(40));
    expect(r.status).not.toBe('empty');
    expect(r.n).toBe(6);  // clamp shortens to daysAgo(45)..daysAgo(40)
    expect(r.total).toBeCloseTo(5);
  });



  it('task created earlier than first log still counts idle days as zeros', () => {
    const t = repo.createTask({ name: 'manual' });
    t.createdAt = new Date(daysAgo(10) + 'T12:00:00').toISOString();
    repo.upsertEntry({ taskId: t.id, date: daysAgo(2), hours: 1 }); // first log 8 days later
    const r = taskPeriodAnalysis(repo, t, daysAgo(29), today());
    expect(r.startIso).toBe(daysAgo(10)); // creation date wins → idle zeros counted
    expect(r.n).toBe(11);
    expect(r.activeDays).toBe(1);
    expect(r.total).toBeCloseTo(1);
  });

  it('7-day chip on Today view sees imported history', () => {
    const t = repo.createTask({ name: 'y' }); // createdAt = now
    repo.upsertEntry({ taskId: t.id, date: daysAgo(5), hours: 4 });
    const wk = taskWeekAnalysis(repo, t);
    expect(wk).not.toBeNull();
    expect(wk!.n).toBe(6); // daysAgo(5) … today
    expect(wk!.total).toBeCloseTo(4);
  });
});
