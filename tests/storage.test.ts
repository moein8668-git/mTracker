import { describe, it, expect, beforeEach } from 'vitest';
import { migrate, Repo, SCHEMA_VERSION, Storage, DB_KEY } from '../src/storage';

interface MemStorageLike {
  map: Map<string, string>;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  clear(): void;
}

let mem: MemStorageLike;

function installLocalStorage(): void {
  mem = {
    map: new Map<string, string>(),
    getItem(k) { return this.map.has(k) ? this.map.get(k)! : null; },
    setItem(k, v) { this.map.set(k, v); },
    removeItem(k) { this.map.delete(k); },
    clear() { this.map.clear(); }
  };
  (globalThis as Record<string, unknown>).localStorage = mem;
}

const noop = () => {};

describe('migrate', () => {
  it('passes a valid v1 backup through', () => {
    const db = { schemaVersion: SCHEMA_VERSION, tasks: [], entries: [], settings: {} };
    expect(migrate(db)).toBe(db);
  });

  it('rejects non-object and version-less payloads', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('x')).toBeNull();
    expect(migrate({})).toBeNull();
  });

  it('rejects backups from a newer schema version (no silent clobber)', () => {
    expect(migrate({ schemaVersion: SCHEMA_VERSION + 1, tasks: [], entries: [], settings: {} })).toBeNull();
  });

  it('fills missing settings', () => {
    const out = migrate({ schemaVersion: SCHEMA_VERSION, tasks: [], entries: [] });
    expect(out?.settings).toEqual({});
  });
});

describe('Repo', () => {

  beforeEach(() => { installLocalStorage(); });
  it('creates a task with palette color and persists', () => {
    const repo = new Repo(null, noop);
    const t = repo.createTask({ name: 'زبان' });
    expect(t.name).toBe('زبان');
    expect(t.color).toBe('#4f46e5');
    expect(JSON.parse(mem.getItem(DB_KEY)!).tasks).toHaveLength(1);
  });

  it('upsert sets updatedAt on create AND update', () => {
    const repo = new Repo(null, noop);
    const t = repo.createTask({ name: 'x' });
    const e1 = repo.upsertEntry({ taskId: t.id, date: '2026-09-01', hours: 2 });
    expect(e1.updatedAt).toBeTruthy();
    const e2 = repo.upsertEntry({ taskId: t.id, date: '2026-09-01', hours: 3, note: 'n' });
    expect(e2.id).toBe(e1.id);
    expect(e2.hours).toBe(3);
    expect(e2.updatedAt!.length).toBeGreaterThan(0);
  });

  it('one entry per task per date (upsert semantics)', () => {
    const repo = new Repo(null, noop);
    const t = repo.createTask({ name: 'x' });
    repo.upsertEntry({ taskId: t.id, date: '2026-09-01', hours: 1 });
    repo.upsertEntry({ taskId: t.id, date: '2026-09-01', hours: 2 });
    expect(repo.entries).toHaveLength(1);
    expect(repo.entries[0]!.hours).toBe(2);
  });

  it('removing a task cascades its entries', () => {
    const repo = new Repo(null, noop);
    const t = repo.createTask({ name: 'x' });
    repo.upsertEntry({ taskId: t.id, date: '2026-09-01', hours: 1 });
    repo.removeTask(t.id);
    expect(repo.tasks).toHaveLength(0);
    expect(repo.entries).toHaveLength(0);
  });
  it('Storage.load returns null on corrupted JSON and keeps a rescue copy', () => {
    mem.setItem(DB_KEY, '{broken json');
    expect(Storage.load()).toBeNull();
    expect(mem.getItem('mtracker.corrupt-backup')).toBe('{broken json');
  });
});
