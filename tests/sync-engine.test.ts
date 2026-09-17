import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('../src/sync/api.js', () => ({ apiFetch: mocks.apiFetch, ApiError: class ApiError extends Error { status = 0; } }));

import { Repo, Storage, accountScope, syncCursorKey } from '../src/storage';
import { SyncEngine } from '../src/sync/engine';

let values: Map<string, string>;
const noop = () => {};

beforeEach(() => {
  values = new Map();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };
  mocks.apiFetch.mockReset();
});

describe('SyncEngine storage-mode transition', () => {
  it('does not upload or clear local data until explicit confirmation', async () => {
    const repo = new Repo(Storage.load(), noop);
    const task = repo.createTask({ name: 'local task' });
    repo.upsertEntry({ taskId: task.id, date: '2026-09-17', hours: 2 });
    const engine = new SyncEngine(repo);
    mocks.apiFetch.mockResolvedValueOnce({ token: 'token', email: 'me@example.com', serverTime: 'now' });

    const result = await engine.verifyOtp('me@example.com', '123456');

    expect(result.transitionRequired).toBe(true);
    expect(engine.getAuth()).toBeNull();
    expect(repo.tasks).toHaveLength(1);
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });

  it('clears local data only after account pull succeeds, then signs out to local mode', async () => {
    const repo = new Repo(Storage.load(), noop);
    repo.createTask({ name: 'local task' });
    const engine = new SyncEngine(repo);
    mocks.apiFetch.mockResolvedValueOnce({ token: 'token', email: 'me@example.com', serverTime: 'now' });
    await engine.verifyOtp('me@example.com', '123456');
    mocks.apiFetch.mockResolvedValueOnce({ tasks: [], entries: [], settings: null, cursor: 0, serverTime: 'now' });

    await expect(engine.confirmAccountTransition()).resolves.toBe(true);
    expect(repo.tasks).toEqual([]);
    expect(values.has('mtracker.db.v1')).toBe(false);
    mocks.apiFetch.mockResolvedValueOnce({ ok: true });
    await engine.signOut();
    expect(repo.getScope()).toBe('local');
    expect(repo.tasks).toEqual([]);
  });

  it('deletes the departing account cache, dirty queue, cursor, and auth on sign-out', async () => {
    const email = 'me@example.com';
    const scope = accountScope(email);
    const repo = new Repo(null, noop, scope);
    repo.createTask({ name: 'cloud task' });
    values.set(syncCursorKey(email), '42');
    values.set('mtracker.auth', JSON.stringify({ email, token: 'token' }));
    const engine = new SyncEngine(repo);
    mocks.apiFetch.mockResolvedValueOnce({ ok: true });

    await expect(engine.signOut()).resolves.toBe(true);
    expect(values.has('mtracker.account.v1:me@example.com')).toBe(false);
    expect(values.has('mtracker.account.v1:me@example.com.dirty')).toBe(false);
    expect(values.has(syncCursorKey(email))).toBe(false);
    expect(values.has('mtracker.auth')).toBe(false);
    expect(repo.getScope()).toBe('local');
  });
});
