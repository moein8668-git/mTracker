import { describe, it, expect } from 'vitest';
import { toJ, monthStartOf, prevMonthStart, nextMonthStart, monthMeta, isoOf, isoToDate, addDays } from '../src/jalali';

describe('Jalali calendar', () => {
  it('converts a known Gregorian date to Jalali', () => {
    expect(toJ(isoToDate('2026-03-21'))).toEqual({ jy: 1405, jm: 1, jd: 1 });
    expect(toJ(isoToDate('2026-08-22'))).toEqual({ jy: 1405, jm: 5, jd: 31 });
  });

  it('month boundaries: 31-day and 30-day months', () => {
    // Farvardin 1405 = Mar 21 – Apr 20 (31 days)
    expect(monthMeta(isoToDate('2026-03-21')).length).toBe(31);
    // Mordad 1405 = Jul 23 – Aug 22 (31 days)
    expect(monthMeta(isoToDate('2026-07-23')).length).toBe(31);
    // Mehr 1405 = Sep 23 – Oct 22 (30 days)
    expect(monthMeta(isoToDate('2026-09-23')).length).toBe(30);
  });

  it('Esfand length: 30 in leap 1403, 29 in 1404', () => {
    expect(monthMeta(isoToDate('2025-02-20')).length).toBe(30); // Esfand 1403 (leap)
    expect(monthMeta(isoToDate('2026-02-20')).length).toBe(29); // Esfand 1404
  });

  it('prev/next month starts traverse correctly across Esfand → Farvardin', () => {
    const esfand = isoToDate('2026-02-20'); // 1 Esfand 1404
    const next = nextMonthStart(esfand);
    expect(toJ(next)).toMatchObject({ jm: 1, jd: 1 });
    const prev = prevMonthStart(esfand);
    expect(toJ(prev)).toMatchObject({ jm: 11, jd: 1 }); // Bahman
  });

  it('monthStartOf snaps any day to the 1st', () => {
    const s = monthStartOf(isoToDate('2026-08-22'));
    expect(toJ(s)).toMatchObject({ jm: 5, jd: 1 });
  });

  it('isoOf/addDays round-trip across month end', () => {
    expect(isoOf(addDays(isoToDate('2026-07-31'), 1))).toBe('2026-08-01');
    expect(isoOf(addDays(isoToDate('2024-02-28'), 1))).toBe('2024-02-29'); // Gregorian leap
  });
});
