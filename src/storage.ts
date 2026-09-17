/* Layer 1 — storage & repository  [SEAM: swap for IndexedDB, then a sync API] */

import type { DBData, Entry, Settings, Task } from './types';
import { uid, PALETTE, normalizeDaysPerWeek } from './utils';

export const SCHEMA_VERSION = 4;
export const DB_KEY = 'mtracker.db.v1';
export const ACCOUNT_KEY_PREFIX = 'mtracker.account.v1:';

export type StorageScope = 'local' | `account:${string}`;

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function accountScope(email: string): StorageScope {
  return `account:${normalizeAccountEmail(email)}`;
}

function dbKey(scope: StorageScope): string {
  return scope === 'local' ? DB_KEY : ACCOUNT_KEY_PREFIX + scope.slice('account:'.length);
}

function dirtyKey(scope: StorageScope): string {
  return `${dbKey(scope)}.dirty`;
}

/**
 * Upgrade path for future schema versions. Rejects unknown (newer) versions
 * so a backup from a newer build never silently clobbers current data.
 */
export function migrate(db: unknown): DBData | null {
  if (!db || typeof db !== 'object') return null;
  const d = db as Partial<DBData>;
  if (d.schemaVersion === 1 || d.schemaVersion === 2) {
    /* v1/v2 → v3: convert to daysPerWeek integer (0..7). */
    repairTaskDays(d.tasks);
    d.schemaVersion = 3;
  }
  if (d.schemaVersion === 3) {
    /* v3 → v4: add optional tombstone and updatedAt fields (no transform needed) */
    d.schemaVersion = 4;
  }
  if (d.schemaVersion !== SCHEMA_VERSION) return null;
  if (!Array.isArray(d.tasks) || !Array.isArray(d.entries)) return null;
  if (!d.settings || typeof d.settings !== 'object') d.settings = {};
  repairTaskDays(d.tasks);
  return d as DBData;
}

/** Fill missing/invalid daysPerWeek (v1/v2 tasks, hand-edited backups). */
function repairTaskDays(tasks: unknown): void {
  if (!Array.isArray(tasks)) return;
  for (const t of tasks as Partial<Task & { days?: unknown }>[]) {
    t.daysPerWeek = normalizeDaysPerWeek(t.daysPerWeek ?? t.days);
    delete t.days;
  }
}

function emptyDb(): DBData {
  return { schemaVersion: SCHEMA_VERSION, tasks: [], entries: [], settings: {} };
}

export const Storage = {
  load(scope: StorageScope = 'local'): DBData | null {
    try {
      const key = dbKey(scope);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.error('mTracker: corrupted storage', e);
      try { localStorage.setItem('mtracker.corrupt-backup', localStorage.getItem(dbKey(scope)) || ''); } catch { /* ignore */ }
      return null;
    }
  },
  save(scope: StorageScope, db: DBData, warn: (msg: string) => void): void {
    try { localStorage.setItem(dbKey(scope), JSON.stringify(db)); }
    catch { warn('ذخیره‌سازی ناموفق بود؛ فضای مرورگر پر است؟'); }
  },
  clear(scope: StorageScope): void {
    localStorage.removeItem(dbKey(scope));
    localStorage.removeItem(dirtyKey(scope));
  },
};

export interface ToastFn { (msg: string): void; }

export class Repo {
  db: DBData;
  private warn: ToastFn;
  private scope: StorageScope;
  version = 0;
  private listeners = new Set<() => void>();

  constructor(db: DBData | null, warn: ToastFn, scope: StorageScope = 'local') {
    this.db = db ?? emptyDb();
    this.warn = warn;
    this.scope = scope;
    if (!Array.isArray(this.db.tasks)) this.db.tasks = [];
    if (!Array.isArray(this.db.entries)) this.db.entries = [];
    if (!this.db.settings || typeof this.db.settings !== 'object') this.db.settings = {};
    this.loadDirty();
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  adopt(db: DBData): void {
    this.db = db;
    if (!Array.isArray(this.db.tasks)) this.db.tasks = [];
    if (!Array.isArray(this.db.entries)) this.db.entries = [];
    if (!this.db.settings || typeof this.db.settings !== 'object') this.db.settings = {};
    this.loadDirty();
    this.persist();
  }

  persist(): void {
    this.version++;
    Storage.save(this.scope, this.db, this.warn);
    this.listeners.forEach(l => l());
  }

  getScope(): StorageScope { return this.scope; }
  isAccountMode(): boolean { return this.scope !== 'local'; }

  /** Switch the visible dataset without merging it with the previous one. */
  switchScope(scope: StorageScope): void {
    if (scope === this.scope) return;
    this.persist();
    this.scope = scope;
    this.db = Storage.load(scope) ?? emptyDb();
    if (!Array.isArray(this.db.tasks)) this.db.tasks = [];
    if (!Array.isArray(this.db.entries)) this.db.entries = [];
    if (!this.db.settings || typeof this.db.settings !== 'object') this.db.settings = {};
    this.loadDirty();
    this.version++;
    this.listeners.forEach(l => l());
  }

  reset(): void {
    this.db = emptyDb();
    if (this.isAccountMode()) this.markAllDirty();
    this.persist();
  }

  private dirty: { t: string[]; e: string[]; s: boolean } = { t: [], e: [], s: false };

  loadDirty(): void {
    if (!this.isAccountMode()) { this.dirty = { t: [], e: [], s: false }; return; }
    try {
      const raw = localStorage.getItem(dirtyKey(this.scope));
      if (raw) this.dirty = JSON.parse(raw);
    } catch {
      this.dirty = { t: [], e: [], s: false };
    }
  }

  markDirty({ tasks: taskIds, entries: entryIds, settings }: { tasks?: string[]; entries?: string[]; settings?: boolean }): void {
    if (!this.isAccountMode()) return;
    if (taskIds) this.dirty.t = [...new Set([...this.dirty.t, ...taskIds])];
    if (entryIds) this.dirty.e = [...new Set([...this.dirty.e, ...entryIds])];
    if (settings) this.dirty.s = true;
    localStorage.setItem(dirtyKey(this.scope), JSON.stringify(this.dirty));
  }

  updateSettings(patch: Partial<Settings>): void {
    this.db.settings = { ...this.db.settings, ...patch };
    this.db.settings.updatedAt = new Date().toISOString();
    this.markDirty({ settings: true });
    this.persist();
  }

  peekDirty(): { tasks: Task[]; entries: Entry[]; settings: Settings | null; ids: { t: string[]; e: string[]; s: boolean } } {
    return {
      tasks: this.db.tasks.filter(t => this.dirty.t.includes(t.id)),
      entries: this.db.entries.filter(e => this.dirty.e.includes(e.id)),
      settings: this.dirty.s ? this.db.settings : null,
      ids: { ...this.dirty },
    };
  }

  clearDirty(ids: { t: string[]; e: string[]; s: boolean }): void {
    this.dirty.t = this.dirty.t.filter(id => !ids.t.includes(id));
    this.dirty.e = this.dirty.e.filter(id => !ids.e.includes(id));
    this.dirty.s = this.dirty.s && !ids.s;
    localStorage.setItem(dirtyKey(this.scope), JSON.stringify(this.dirty));
  }

  markAllDirty(): void {
    if (!this.isAccountMode()) return;
    this.dirty = { t: this.db.tasks.map(t => t.id), e: this.db.entries.map(e => e.id), s: true };
    localStorage.setItem(dirtyKey(this.scope), JSON.stringify(this.dirty));
  }

  applySync(data: { tasks?: Task[]; entries?: Entry[]; settings?: Settings }): void {
    for (const t of data.tasks ?? []) {
      const existing = this.db.tasks.find(e => e.id === t.id);
      if (existing) {
        const localUpd = existing.updatedAt ?? '';
        const remoteUpd = t.updatedAt ?? '';
        if (remoteUpd > localUpd) {
          Object.assign(existing, t);
        }
      } else {
        this.db.tasks.push(t);
      }
    }
    for (const e of data.entries ?? []) {
      const existing = this.db.entries.find(x => x.id === e.id);
      if (existing) {
        const localUpd = existing.updatedAt ?? '';
        const remoteUpd = e.updatedAt ?? '';
        if (remoteUpd > localUpd) {
          Object.assign(existing, e);
        }
      } else {
        this.db.entries.push(e);
      }
    }
    if (data.settings) {
      const existing = this.db.settings;
      const localUpd = existing.updatedAt ?? '';
      const remoteUpd = data.settings.updatedAt ?? '';
      if (remoteUpd > localUpd) {
        Object.assign(existing, data.settings);
      }
    }
    this.persist();
  }

  /** Live (non-tombstoned) rows only — UI reads these. Raw arrays stay on this.db for sync. */
  get tasks(): Task[] { return this.db.tasks.filter(t => !t.deletedAt); }
  get entries(): Entry[] { return this.db.entries.filter(e => !e.deletedAt); }
  get settings() { return this.db.settings; }

  activeTasks(): Task[] { return this.db.tasks.filter(t => !t.archivedAt && !t.deletedAt); }
  task(id: string): Task | undefined { return this.db.tasks.find(t => t.id === id && !t.deletedAt); }

  createTask({ name, targetDailyHours = 0, color, daysPerWeek }: { name: string; targetDailyHours?: number; color?: string; daysPerWeek?: number }): Task {
    const t: Task = {
      id: uid(),
      name: String(name).trim(),
      targetDailyHours: +targetDailyHours || 0,
      color: color || PALETTE[this.db.tasks.length % PALETTE.length]!,
      daysPerWeek: normalizeDaysPerWeek(daysPerWeek),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: null
    };
    this.db.tasks.push(t);
    this.markDirty({ tasks: [t.id], settings: false });
    this.persist();
    return t;
  }

  upsertEntry({ taskId, date, hours, note = '', pomo = false }: { taskId: string; date: string; hours: number; note?: string; pomo?: boolean }): Entry {
    /* raw find including tombstones — re-logging hours for a deleted entry revives it */
    let e = this.db.entries.find(x => x.taskId === taskId && x.date === date);
    if (e) {
      e.hours = hours;
      e.note = note;
      e.updatedAt = new Date().toISOString();
      e.deletedAt = null;
      if (pomo) e.pomo = true;
    } else {
      e = { id: uid(), taskId, date, hours, note, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...(pomo ? { pomo: true } : {}) };
      this.db.entries.push(e);
    }
    this.markDirty({ entries: [e.id], settings: false });
    this.persist();
    return e;
  }

  updateTask(id: string, patch: Partial<Task>): Task | undefined {
    const t = this.task(id);
    if (t) {
      Object.assign(t, patch);
      t.updatedAt = new Date().toISOString();
    }
    this.markDirty({ tasks: [id], settings: false });
    this.persist();
    return t;
  }

  removeTask(id: string): void {
    const task = this.task(id);
    if (task) {
      task.deletedAt = new Date().toISOString();
      task.updatedAt = new Date().toISOString();
    }
    const entriesToRemove = this.db.entries.filter(e => e.taskId === id);
    for (const e of entriesToRemove) {
      e.deletedAt = new Date().toISOString();
      e.updatedAt = new Date().toISOString();
    }
    this.markDirty({ tasks: [id], entries: entriesToRemove.map(e => e.id), settings: false });
    this.persist();
  }

  entriesForTask(taskId: string): Entry[] { return this.db.entries.filter(e => e.taskId === taskId && !e.deletedAt); }
  findEntry(taskId: string, date: string): Entry | undefined {
    return this.db.entries.find(e => e.taskId === taskId && e.date === date && !e.deletedAt);
  }
  entryById(id: string): Entry | undefined { return this.db.entries.find(e => e.id === id && !e.deletedAt); }

  removeEntry(id: string): void {
    const e = this.entryById(id);
    if (e) {
      e.deletedAt = new Date().toISOString();
      e.updatedAt = new Date().toISOString();
    }
    this.markDirty({ entries: [id], tasks: [], settings: false });
    this.persist();
  }
}
