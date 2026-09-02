import { describe, it, expect } from 'vitest';
import { analyze, MAX_RANGE_DAYS } from '../src/analytics';

const days = (n: number) => ({
  startIso: '2026-07-01',
  endIso: '2026-07-' + String(n).padStart(2, '0'),
  entries: [] as { date: string; hours: number }[]
});

describe('Analytics.analyze — golden rule', () => {
  it('counts zero days in n (7h in 7 days vs 7h in 1 day differ)', () => {
    const regular = analyze({ ...days(7), entries: [{ date: '2026-07-01', hours: 1 }, { date: '2026-07-02', hours: 1 }, { date: '2026-07-03', hours: 1 }, { date: '2026-07-04', hours: 1 }, { date: '2026-07-05', hours: 1 }, { date: '2026-07-06', hours: 1 }, { date: '2026-07-07', hours: 1 }] });
    const burst = analyze({ ...days(7), entries: [{ date: '2026-07-04', hours: 7 }] });
    expect(regular.n).toBe(7);
    expect(burst.n).toBe(7);
    expect(regular.status).toBe('ok');       // sd=0 < 0.5
    expect(burst.status).toBe('volatile');   // sd≈2.3 > 0.5
    expect(regular.mean).toBeCloseTo(1);
    expect(burst.mean).toBeCloseTo(1);
  });

  it('sd < mean/2 → ok, else volatile', () => {
    const steady = analyze({ ...days(4), entries: [
      { date: '2026-07-01', hours: 2 }, { date: '2026-07-02', hours: 2 },
      { date: '2026-07-03', hours: 2 }, { date: '2026-07-04', hours: 2 }
    ] });
    expect(steady.status).toBe('ok');
    expect(steady.sd).toBe(0);
    expect(steady.sdLimit).toBeCloseTo(1);
  });

  it('population SD (divide by n, not n-1)', () => {
    const r = analyze({ ...days(2), entries: [{ date: '2026-07-01', hours: 1 }, { date: '2026-07-02', hours: 3 }] });
    expect(r.sd).toBeCloseTo(1); // population sd of [1,3] is 1
  });

  it('nodata when all zeros, empty when range empty', () => {
    expect(analyze({ ...days(3), entries: [] }).status).toBe('nodata');
    expect(analyze({ startIso: '2026-07-05', endIso: '2026-07-01', entries: [] }).status).toBe('empty');
  });

  it('targetPct only when target > 0', () => {
    const withTarget = analyze({ ...days(2), target: 2, entries: [{ date: '2026-07-01', hours: 1 }] });
    const noTarget = analyze({ ...days(2), entries: [{ date: '2026-07-01', hours: 1 }] });
    expect(withTarget.targetPct).toBeCloseTo(25); // mean 0.5 / target 2
    expect(noTarget.targetPct).toBeNull();
  });

  it('throws on ranges beyond the cap instead of silently truncating', () => {
    expect(() => analyze({ startIso: '2020-01-01', endIso: '2026-12-31', entries: [] })).toThrow();
    expect(MAX_RANGE_DAYS).toBe(500);
  });

  it('activeDays counts only days with hours > 0', () => {
    const r = analyze({ ...days(4), entries: [{ date: '2026-07-01', hours: 3 }, { date: '2026-07-03', hours: 0.5 }] });
    expect(r.activeDays).toBe(2);
    expect(r.n).toBe(4);
  });
});
