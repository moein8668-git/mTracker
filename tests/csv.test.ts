import { describe, it, expect, beforeEach } from 'vitest';
import { parseCsv, normalizeDate, buildCsv, csvEscape } from '../src/transfer';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles quoted fields with commas, newlines and escaped quotes', () => {
    const csv = 'name,note\n"x, y","line1\nline2"\n"he said ""hi""",ok';
    expect(parseCsv(csv)).toEqual([
      ['name', 'note'],
      ['x, y', 'line1\nline2'],
      ['he said "hi"', 'ok']
    ]);
  });

  it('strips BOM and tolerates CRLF', () => {
    expect(parseCsv('\uFEFFa,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('drops empty trailing lines', () => {
    expect(parseCsv('a,b\n1,2\n\n')).toHaveLength(2);
  });
});

describe('normalizeDate', () => {
  it('accepts ISO and slash formats', () => {
    expect(normalizeDate('2026-08-31')).toBe('2026-08-31');
    expect(normalizeDate('2026/8/31')).toBe('2026-08-31');
    expect(normalizeDate('2026.08.31')).toBe('2026-08-31');
  });

  it('normalizes Persian digits', () => {
    expect(normalizeDate('۱۴۰۵/۰۶/۱۱')).toBe('1405-06-11');
  });

  it('rejects impossible dates', () => {
    expect(normalizeDate('2026-13-01')).toBeNull();
    expect(normalizeDate('2026-02-30')).toBeNull();
    expect(normalizeDate('2025-02-29')).toBeNull(); // non-leap
    expect(normalizeDate('2024-02-29')).toBe('2024-02-29'); // leap
    expect(normalizeDate('garbage')).toBeNull();
  });
});

describe('buildCsv round-trip', () => {
  const tasks = [
    { id: 't1', name: 'زبان' },
    { id: 't2', name: 'کدنویسی، شب‌ها' }
  ];
  const entries = [
    { taskId: 't1', date: '2026-08-30', hours: 1.5, note: '' },
    { taskId: 't2', date: '2026-08-31', hours: 3, note: 'تمرین، تکرار' },
    { taskId: 't1', date: '2026-08-31', hours: 2, note: '' }
  ];

  it('CSV → parse → same records (nothing lost)', () => {
    const csv = buildCsv(tasks, entries);
    const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
    const [header, ...body] = rows;
    expect(header).toEqual(['date', 'task', 'hours', 'note']);
    expect(body).toHaveLength(3);
    const back = body.map(r => ({ date: r[0], task: r[1], hours: r[2], note: r[3] }));
    expect(back).toContainEqual({ date: '2026-08-31', task: 'کدنویسی، شب‌ها', hours: '3', note: 'تمرین، تکرار' });
    expect(back.some(r => r.task === 'زبان' && r.hours === '1.5')).toBe(true);
  });

  it('sorts by date', () => {
    const csv = buildCsv(tasks, entries);
    const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
    expect(rows[1]![0]).toBe('2026-08-30');
  });

  it('csvEscape quotes only when needed', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
});
