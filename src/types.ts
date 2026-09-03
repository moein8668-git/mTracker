/* Shared data model — mirrors mtracker.db.v1 (schemaVersion 1). */

export interface Task {
  id: string;
  name: string;
  targetDailyHours: number;
  color: string;
  createdAt: string;
  archivedAt: string | null;
}

export interface Entry {
  id: string;
  taskId: string;
  date: string; /* Gregorian ISO yyyy-mm-dd */
  hours: number;
  note: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Settings {
  chartDir?: 'ltr' | 'rtl';
  timeFormat?: 'hm' | 'decimal';
  /** Base URL of the user's Pomodorus proxy worker (workers.dev only). */
  pomoProxyUrl?: string;
}

export interface DBData {
  schemaVersion: number;
  tasks: Task[];
  entries: Entry[];
  settings: Settings;
}

export interface DayPoint {
  date: string;
  hours: number;
}

export type StabilityStatus = 'ok' | 'volatile' | 'nodata' | 'empty';

export interface AnalyzeResult {
  status: StabilityStatus;
  days: DayPoint[];
  n: number;
  total: number;
  mean: number;
  sd: number;
  cv: number;
  sdLimit: number;
  activeDays: number;
  targetPct: number | null;
  startIso?: string;
  endIso?: string;
}
