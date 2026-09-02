import { describe, it, expect, beforeEach } from 'vitest';
import { normalizePomodorusProfile, importPomodorusProfile } from '../src/pomodorus';
import { Repo } from '../src/storage';

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

/* Shape mirrors the real API response (probed 2026-09-02). */
const SAMPLE = {
  handle: 'moein8668',
  days: [
    { day: '2026-08-25', totalMs: 0, tasks: [] },
    { day: '2026-08-26', totalMs: 4500000, tasks: [
      { name: 'وایب کد', totalMs: 1800000 },
      { name: 'Test', totalMs: 1500000 },
      { name: 'تحقیق و بررسی', totalMs: 1200000 }
    ] },
    { day: '2026-08-27', totalMs: 3600000, tasks: [] }
  ]
};

describe('normalizePomodorusProfile', () => {
  it('accepts the real API shape', () => {
    const p = normalizePomodorusProfile(SAMPLE);
    expect(p).not.toBeNull();
    expect(p!.handle).toBe('moein8668');
    expect(p!.days).toHaveLength(3);
  });

  it('rejects garbage, wrong shapes, bad dates', () => {
    expect(normalizePomodorusProfile(null)).toBeNull();
    expect(normalizePomodorusProfile('x')).toBeNull();
    expect(normalizePomodorusProfile({})).toBeNull();
    expect(normalizePomodorusProfile({ handle: 'x' })).toBeNull();
    expect(normalizePomodorusProfile({ handle: 'x', days: [{ day: 'bad', totalMs: 0, tasks: [] }] })).toBeNull();
    expect(normalizePomodorusProfile({ handle: 'x', days: [{ day: '2026-08-26', totalMs: '5', tasks: [] }] })).toBeNull();
  });
});

describe('importPomodorusProfile', () => {
  let repo: Repo;
  beforeEach(() => { installLocalStorage(); repo = new Repo(null, () => {}); });
  it('converts ms→hours and creates tasks by name', () => {
    const r = importPomodorusProfile(repo, normalizePomodorusProfile(SAMPLE)!);
    expect(r.tasksCreated).toBe(4); // 3 named tasks + 1 aggregate task named after the handle
  });

  it('computes hours correctly (1h = 3,600,000ms)', () => {
    importPomodorusProfile(repo, normalizePomodorusProfile(SAMPLE)!);
    const vyb = repo.tasks.find(t => t.name === 'وایب کد')!;
    expect(repo.findEntry(vyb.id, '2026-08-26')!.hours).toBe(0.5); // 1,800,000ms
    const agg = repo.tasks.find(t => t.name === 'moein8668')!;
    expect(repo.findEntry(agg.id, '2026-08-27')!.hours).toBe(1);   // 3,600,000ms
  });

  it('skips zero days and does not create entries for them', () => {
    const r = importPomodorusProfile(repo, normalizePomodorusProfile(SAMPLE)!);
    expect(r.daysWithFocus).toBe(2);
    expect(repo.entries.filter(e => e.date === '2026-08-25')).toHaveLength(0);
  });

  it('is idempotent: re-import skips existing local entries', () => {
    importPomodorusProfile(repo, normalizePomodorusProfile(SAMPLE)!);
    const before = repo.entries.length;
    const r2 = importPomodorusProfile(repo, normalizePomodorusProfile(SAMPLE)!);
    expect(r2.entriesAdded).toBe(0);
    expect(r2.entriesSkippedExisting).toBeGreaterThan(0);
    expect(repo.entries.length).toBe(before);
  });

  it('never overwrites manually logged local data', () => {
    const p = normalizePomodorusProfile(SAMPLE)!;
    const t = repo.createTask({ name: 'وایب کد' });
    repo.upsertEntry({ taskId: t.id, date: '2026-08-26', hours: 9 });
    const r = importPomodorusProfile(repo, p);
    expect(repo.findEntry(t.id, '2026-08-26')!.hours).toBe(9); // local wins
    expect(r.entriesSkippedExisting).toBe(1);
  });

  it('reuses existing task with same name instead of duplicating', () => {
    repo.createTask({ name: 'Test' });
    const r = importPomodorusProfile(repo, normalizePomodorusProfile(SAMPLE)!);
    expect(repo.tasks.filter(t => t.name === 'Test')).toHaveLength(1);
    expect(r.tasksCreated).toBe(3);
  });

  it('trims task names and skips empty/zero task rows', () => {
    const p = normalizePomodorusProfile({
      handle: 'u',
      days: [{ day: '2026-08-26', totalMs: 3600000, tasks: [
        { name: '  padded  ', totalMs: 1800000 },
        { name: '', totalMs: 1800000 },
        { name: 'zero', totalMs: 0 }
      ] }]
    })!;
    importPomodorusProfile(repo, p);
    expect(repo.tasks.find(t => t.name === 'padded')).toBeTruthy();
    expect(repo.entries).toHaveLength(1);
    expect(repo.tasks.find(t => t.name === 'zero')).toBeUndefined();
  });
});
