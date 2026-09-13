import { describe, it, expect } from 'vitest';
import { newerWins, isoOrNull } from '../src/sync/merge';

type Row = { id: string; name: string; updatedAt?: string; deletedAt?: string | null };

describe('newerWins', () => {
  it('remote wins when strictly newer', () => {
    const local: Row = { id: 'x', name: 'local', updatedAt: '2026-01-01T00:00:00Z' };
    const remote: Row = { id: 'x', name: 'remote', updatedAt: '2026-01-02T00:00:00Z' };
    expect(newerWins(local, remote)).toBe(remote);
  });

  it('local wins when remote older (tie on updatedAt keeps local — deterministic)', () => {
    const local: Row = { id: 'x', name: 'local', updatedAt: '2026-01-02T00:00:00Z' };
    const remote: Row = { id: 'x', name: 'remote', updatedAt: '2026-01-01T00:00:00Z' };
    expect(newerWins(local, remote)).toBe(local);
  });

  it('exact tie keeps local', () => {
    const local: Row = { id: 'x', name: 'local', updatedAt: '2026-01-02T00:00:00Z' };
    const remote: Row = { id: 'x', name: 'remote', updatedAt: '2026-01-02T00:00:00Z' };
    expect(newerWins(local, remote)).toBe(local);
  });

  it('missing updatedAt loses against a timestamped row', () => {
    const local: Row = { id: 'x', name: 'local' };
    const remote: Row = { id: 'x', name: 'remote', updatedAt: '2026-01-01T00:00:00Z' };
    expect(newerWins(local, remote)).toBe(remote);
    const local2: Row = { id: 'x', name: 'local', updatedAt: '2026-01-01T00:00:00Z' };
    const remote2: Row = { id: 'x', name: 'remote' };
    expect(newerWins(local2, remote2)).toBe(local2);
  });

  it('both missing updatedAt keeps local', () => {
    const local: Row = { id: 'x', name: 'local' };
    const remote: Row = { id: 'x', name: 'remote' };
    expect(newerWins(local, remote)).toBe(local);
  });

  it('tombstone (deletedAt set) wins when newer — deletions propagate', () => {
    const live: Row = { id: 'x', name: 'live', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null };
    const tomb: Row = { id: 'x', name: 'live', updatedAt: '2026-01-02T00:00:00Z', deletedAt: '2026-01-02T00:00:00Z' };
    expect(newerWins(live, tomb)).toBe(tomb);
    expect(newerWins(tomb, live)).toBe(tomb);
  });

  it('older tombstone does NOT resurrect over newer live row', () => {
    const live: Row = { id: 'x', name: 'live', updatedAt: '2026-01-03T00:00:00Z', deletedAt: null };
    const tomb: Row = { id: 'x', name: 'live', updatedAt: '2026-01-02T00:00:00Z', deletedAt: '2026-01-02T00:00:00Z' };
    expect(newerWins(live, tomb)).toBe(live);
  });
});

describe('isoOrNull', () => {
  it('normalizes valid date strings to ISO', () => {
    expect(isoOrNull('2026-01-02T03:04:05.000Z')).toBe('2026-01-02T03:04:05.000Z');
    expect(isoOrNull('2026-01-02')).toBe('2026-01-02T00:00:00.000Z');
  });

  it('returns null on garbage or non-strings', () => {
    expect(isoOrNull('not a date')).toBeNull();
    expect(isoOrNull(123)).toBeNull();
    expect(isoOrNull(null)).toBeNull();
    expect(isoOrNull(undefined)).toBeNull();
  });
});
