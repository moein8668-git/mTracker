import { beforeEach, describe, expect, it } from 'vitest';
import { ACCOUNT_KEY_PREFIX, DB_KEY, Repo, Storage, accountScope } from '../src/storage';

const noop = () => {};
let values: Map<string, string>;

beforeEach(() => {
  values = new Map();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };
});

describe('storage modes', () => {
  it('keeps signed-out mutations local and creates no sync metadata', () => {
    const repo = new Repo(Storage.load(), noop);
    repo.createTask({ name: 'local' });
    expect(JSON.parse(values.get(DB_KEY)!).tasks).toHaveLength(1);
    expect(values.has(`${DB_KEY}.dirty`)).toBe(false);
    expect(repo.peekDirty().ids).toEqual({ t: [], e: [], s: false });
  });

  it('uses a separate dirty account cache for each normalized email', () => {
    const one = accountScope('ONE@example.com');
    const first = new Repo(Storage.load(one), noop, one);
    first.createTask({ name: 'first' });
    const two = accountScope('two@example.com');
    const second = new Repo(Storage.load(two), noop, two);
    expect(second.tasks).toEqual([]);
    expect(values.has(`${ACCOUNT_KEY_PREFIX}one@example.com.dirty`)).toBe(true);
    expect(values.has(`${ACCOUNT_KEY_PREFIX}two@example.com.dirty`)).toBe(false);
  });

  it('hides account cache after switching back to an empty local dataset', () => {
    const account = accountScope('a@example.com');
    const repo = new Repo(null, noop);
    repo.switchScope(account);
    repo.createTask({ name: 'cloud' });
    repo.switchScope('local');
    expect(repo.tasks).toEqual([]);
    repo.switchScope(account);
    expect(repo.tasks.map(task => task.name)).toEqual(['cloud']);
  });
});
