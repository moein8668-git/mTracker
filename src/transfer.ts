/* Layer 4 — data transfer (CSV / JSON). DOM-adjacent but logic-testable parts are pure. */

import type { DBData } from './types';
import { normDigits, toNumber, clampHours } from './utils';
import { todayIso } from './jalali';
import type { Repo } from './storage';

export function download(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

export function buildCsv(tasks: { id: string; name: string }[], entries: { taskId: string; date: string; hours: number; note?: string }[]): string {
  const rows: string[][] = [['date', 'task', 'hours', 'note']];
  const tmap = new Map(tasks.map(t => [t.id, t.name]));
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const e of sorted) rows.push([e.date, tmap.get(e.taskId) || '', String(e.hours), e.note || '']);
  return '\uFEFF' + rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
}

export function exportCsv(repo: Repo): { csv: string; count: number } {
  const csv = buildCsv(repo.tasks, repo.entries);
  download('mtracker-entries-' + todayIso() + '.csv', csv, 'text/csv;charset=utf-8');
  return { csv, count: repo.entries.length };
}

export function exportJson(repo: Repo): void {
  download('mtracker-backup-' + todayIso() + '.json', JSON.stringify(repo.db, null, 2), 'application/json');
}

export function parseCsv(text: string): string[][] {
  const t = String(text).replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQ = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (inQ) {
      if (c === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 0 && !(r.length === 1 && (r[0] ?? '').trim() === ''));
}

export function normalizeDate(s: string): string | null {
  s = normDigits(s).trim().replace(/[\/.]/g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const y = +m[1]!, mo = +m[2]!, da = +m[3]!;
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  const d = new Date(y, mo - 1, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null;
  return [
    String(y).padStart(4, '0'),
    String(mo).padStart(2, '0'),
    String(da).padStart(2, '0')
  ].join('-');
}

export interface ImportOutcome { created: number; added: number; skipped: number; }

export function importCsvRows(repo: Repo, text: string): ImportOutcome {
  const rows = parseCsv(text);
  if (!rows.length) return { created: 0, added: 0, skipped: 0 };
  const header = rows[0]!.map(h => normDigits(h).trim().toLowerCase());
  const hasHeader = header.includes('date') && header.includes('task') && header.includes('hours');
  const idx = hasHeader
    ? { d: header.indexOf('date'), t: header.indexOf('task'), h: header.indexOf('hours'), n: header.indexOf('note') }
    : { d: 0, t: 1, h: 2, n: 3 };
  const body = hasHeader ? rows.slice(1) : rows;
  let created = 0, added = 0, skipped = 0;
  const cache = new Map<string, { id: string }>();
  for (const r of body) {
    if (!r || r.length < 3) { skipped++; continue; }
    const date = normalizeDate(r[idx.d] || '');
    const tname = (r[idx.t] || '').trim();
    const hours = toNumber(r[idx.h]);
    if (!date || !tname || !(hours > 0 && hours <= 24)) { skipped++; continue; }
    let t = cache.get(tname);
    if (!t) {
      const found = repo.tasks.find(x => x.name === tname);
      if (found) t = found;
      else { t = repo.createTask({ name: tname, targetDailyHours: 0 }); created++; }
      cache.set(tname, t);
    }
    repo.upsertEntry({ taskId: t.id, date, hours: clampHours(hours), note: idx.n >= 0 ? (r[idx.n] || '').trim() : '' });
    added++;
  }
  return { created, added, skipped };
}

export function validateBackup(text: string): DBData | null {
  try {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || !Array.isArray((data as DBData).tasks) || !Array.isArray((data as DBData).entries)) return null;
    return data as DBData;
  } catch {
    return null;
  }
}
