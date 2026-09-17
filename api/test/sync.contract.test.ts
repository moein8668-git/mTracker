import { describe, expect, it } from 'vitest';
import { dateOnly } from '../src/sync.js';

describe('sync pull date contract', () => {
  it('serializes PostgreSQL DATE values as date-only strings', () => {
    expect(dateOnly(new Date('2026-09-17T18:30:00.000Z'))).toBe('2026-09-17');
    expect(dateOnly('2026-09-17T00:00:00.000Z')).toBe('2026-09-17');
    expect(dateOnly('2026-09-17')).toBe('2026-09-17');
  });

  it('rejects invalid dates rather than returning a timestamp-shaped entry date', () => {
    expect(dateOnly('not-a-date')).toBeNull();
  });
});
