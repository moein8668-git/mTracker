/* Shared data model — mirrors mtracker.db.v1 (schemaVersion 1). */

export interface Task {
  id: string;
  name: string;
  targetDailyHours: number;
  color: string;
  /** Days per week goal (0–7). 0 = no stability tracking & hidden from today tab. */
  daysPerWeek: number;
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
  /** true when this entry was created/last-updated by a Pomodorus import. */
  pomo?: boolean;
}

export interface Settings {
  chartDir?: 'ltr' | 'rtl';
  timeFormat?: 'hm' | 'decimal';
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
