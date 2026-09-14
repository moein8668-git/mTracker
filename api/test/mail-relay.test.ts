import { describe, expect, it } from 'vitest';
import { canonicalBytes, uuidv4 } from '../src/util.js';

describe('mail relay signing primitives', () => {
  it('canonicalizes object property order identically', () => {
    expect([...canonicalBytes({ b: 2, a: 1 })]).toEqual([...canonicalBytes({ a: 1, b: 2 })]);
  });
  it('creates UUIDv4 request identities', () => {
    expect(uuidv4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
