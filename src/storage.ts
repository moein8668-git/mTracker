/* Layer 1 — storage & repository  [SEAM: swap for IndexedDB, then a sync API] */

import type { DBData, Entry, Task } from './types';
import { uid } from './utils';
import { PALETTE } from './utils';
import { normalizeDays } from './jalali';

export const SCHEMA_VERSION = 2;
export const DB_KEY = 'mtracker.db.v1';

/**
 * Upgrade path for future schema versions. Rejects unknown (newer) versions
 * so a backup from a newer build never silently clobbers current data.
 */
export function migrate(db: unknown): DBData | null {
  if (!db || typeof db !== 'object') return null;
  const d = db as Partial<DBData>;
  if (d.schemaVersion === 1) {
    /* v1 → v2: every task gains a weekday schedule; v1 tasks ran daily. */
    repairTaskDays(d.tasks);
    d.schemaVersion = 2;
  }
  if (d.schemaVersion !== SCHEMA_VERSION) return null; /* future upgrades branch here */
  if (!Array.isArray(d.tasks) || !Array.isArray(d.entries)) return null;
  if (!d.settings || typeof d.settings !== 'object') d.settings = {};
  repairTaskDays(d.tasks);
  return d as DBData;
}

/** Fill missing/invalid weekday schedules (v1 tasks, hand-edited backups). */
function repairTaskDays(tasks: unknown): void {
  if (!Array.isArray(tasks)) return;
  for (const t of tasks as Partial<Task>[]) t.days = normalizeDays(t.days);
}

function emptyDb(): DBData {
  return { schemaVersion: SCHEMA_VERSION, tasks: [], entries: [], settings: {} };
}

export const Storage = {
  load(): DBData | null {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.error('mTracker: corrupted storage', e);
      try { localStorage.setItem('mtracker.corrupt-backup', localStorage.getItem(DB_KEY) || ''); } catch { /* ignore */ }
      return null;
    }
  },
  save(db: DBData, warn: (msg: string) => void): void {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch { warn('ذخیره‌سازی ناموفق بود؛ فضای مرورگر پر است؟'); }
  }
};

export interface ToastFn { (msg: string): void; }

export class Repo {
  db: DBData;
  private warn: ToastFn;

  constructor(db: DBData | null, warn: ToastFn) {
    this.db = db ?? emptyDb();
    this.warn = warn;
    if (!Array.isArray(this.db.tasks)) this.db.tasks = [];
    if (!Array.isArray(this.db.entries)) this.db.entries = [];
    if (!this.db.settings || typeof this.db.settings !== 'object') this.db.settings = {};
  }

  adopt(db: DBData): void {
    this.db = db;
    if (!Array.isArray(this.db.tasks)) this.db.tasks = [];
    if (!Array.isArray(this.db.entries)) this.db.entries = [];
    if (!this.db.settings || typeof this.db.settings !== 'object') this.db.settings = {};
    this.persist();
  }

  persist(): void {
    Storage.save(this.db, this.warn);
  }

  reset(): void {
    this.db = emptyDb();
    this.persist();
  }

  get tasks(): Task[] { return this.db.tasks; }
  get entries(): Entry[] { return this.db.entries; }
  get settings() { return this.db.settings; }

  activeTasks(): Task[] { return this.db.tasks.filter(t => !t.archivedAt); }

  task(id: string): Task | undefined { return this.db.tasks.find(t => t.id === id); }

  createTask({ name, targetDailyHours = 0, color, days }: { name: string; targetDailyHours?: number; color?: string; days?: number[] }): Task {
    const t: Task = {
      id: uid(),
      name: String(name).trim(),
      targetDailyHours: +targetDailyHours || 0,
      color: color || PALETTE[this.db.tasks.length % PALETTE.length]!,
      days: normalizeDays(days),
      createdAt: new Date().toISOString(),
      archivedAt: null
    };
    this.db.tasks.push(t);
    this.persist();
    return t;
  }

  upsertEntry({ taskId, date, hours, note = '', pomo = false }: { taskId: string; date: string; hours: number; note?: string; pomo?: boolean }): Entry {
    let e = this.findEntry(taskId, date);
    if (e) {
      e.hours = hours;
      e.note = note;
      e.updatedAt = new Date().toISOString();
      if (pomo) e.pomo = true;
    } else {
      /* updatedAt set on create too — sync (roadmap phase 4) relies on it. */
      e = { id: uid(), taskId, date, hours, note, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...(pomo ? { pomo: true } : {}) };
      this.db.entries.push(e);
    }
    this.persist();
    return e;
  }

  updateTask(id: string, patch: Partial<Task>): Task | undefined {
    const t = this.task(id);
    if (t) Object.assign(t, patch);
    this.persist();
    return t;
  }

  removeTask(id: string): void {
    this.db.tasks = this.db.tasks.filter(t => t.id !== id);
    this.db.entries = this.db.entries.filter(e => e.taskId !== id);
    this.persist();
  }

  entriesForTask(taskId: string): Entry[] { return this.db.entries.filter(e => e.taskId === taskId); }

  findEntry(taskId: string, date: string): Entry | undefined {
    return this.db.entries.find(e => e.taskId === taskId && e.date === date);
  }

  entryById(id: string): Entry | undefined { return this.db.entries.find(e => e.id === id); }

  removeEntry(id: string): void {
    this.db.entries = this.db.entries.filter(e => e.id !== id);
    this.persist();
  }
}
