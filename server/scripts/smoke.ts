import crypto from 'crypto';

const BASE = 'http://localhost:8788/api';
let failures = 0;

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    failures++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; json: T }> {
  const res = await fetch(BASE + path, init);
  const json = (await res.json().catch(() => null)) as T;
  return { status: res.status, json };
}

async function main(): Promise<void> {
  // 1. health
  const health = await api<{ ok: boolean }>('/health');
  assert(health.status === 200 && health.json.ok, 'health check');

  // 2. request OTP (grab devCode)
  const email = `smoke-${crypto.randomBytes(4).toString('hex')}@example.com`;
  const otpRes = await api<{ ok: boolean; devCode?: string }>('/auth/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  assert(otpRes.status === 200 && otpRes.json.ok, 'otp sent');
  assert(typeof otpRes.json.devCode === 'string' && /^\d{6}$/.test(otpRes.json.devCode!), 'devCode is 6 digits');
  const code = otpRes.json.devCode!;

  // 3. verify → token
  const verifyRes = await api<{ token?: string; email?: string }>('/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  assert(verifyRes.status === 200 && typeof verifyRes.json.token === 'string', 'verify returns token');
  const token = verifyRes.json.token!;
  const auth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  // wrong code rejected
  const badVerify = await api<{ error?: string }>('/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: '000000' }),
  });
  assert(badVerify.status === 400, 'wrong code rejected');

  // 4. push 2 tasks + 1 entry + settings
  const now = new Date().toISOString();
  const tasks = [
    { id: 't1', name: 'Task 1', target_daily_hours: 2, color: '#ff0000', days_per_week: 5, created_at: now, updated_at: now },
    { id: 't2', name: 'Task 2', target_daily_hours: 1, color: '#00ff00', days_per_week: 7, created_at: now, updated_at: now },
  ];
  const entries = [
    { id: 'e1', task_id: 't1', date: '2026-09-01', hours: 3.5, note: 'hi', pomo: false, created_at: now, updated_at: now },
  ];
  const pushRes = await api<{ accepted?: number }>('/sync/push', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ tasks, entries, settings: { data: { chartDir: 'rtl' }, updated_at: now } }),
  });
  assert(pushRes.status === 200 && pushRes.json.accepted === 4, 'push accepted 4 rows');

  // 5. push same rows with OLDER updatedAt → LWW must keep existing (no seq bump)
  const oldPush = await api<{ accepted?: number }>('/sync/push', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      tasks: [{ id: 't1', name: 'HACKED', updated_at: '2020-01-01T00:00:00.000Z' }],
    }),
  });
  assert(oldPush.status === 200, 'older push accepted (silently no-op)');

  // 6. pull since 0 — server must map rows to client camelCase
  const pull1 = await api<{ cursor: number; tasks: Array<{ id: string; name: string; targetDailyHours: number; color: string; daysPerWeek: number }>; entries: Array<{ id: string; hours: number; taskId: string }>; settings: { data: { chartDir: string } } | null }>(
    '/sync/pull?since=0', { headers: auth },
  );
  assert(pull1.status === 200, 'pull ok');
  assert(pull1.json.tasks.length === 2, 'pull returns 2 tasks');
  const t1 = pull1.json.tasks.find(t => t.id === 't1');
  assert(t1?.name === 'Task 1', 'older push did NOT overwrite (LWW keeps existing)');
  assert(t1?.targetDailyHours === 2 && t1?.color === '#ff0000' && t1?.daysPerWeek === 5, 'task fields survive camelCase mapping');
  assert(pull1.json.entries[0]?.hours === 3.5 && pull1.json.entries[0]?.taskId === 't1', 'entry fields + taskId round-trip');
  assert(pull1.json.settings?.data?.chartDir === 'rtl', 'settings round-trip');
  const cursor = pull1.json.cursor;

  // 7. tombstone one entry, push, pull with old cursor → tombstone visible
  const tombRes = await api('/sync/push', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      entries: [{ id: 'e1', task_id: 't1', date: '2026-09-01', hours: 3.5, updated_at: new Date().toISOString(), deleted_at: new Date().toISOString() }],
    }),
  });
  assert(tombRes.status === 200, 'tombstone push');
  const pull2 = await api<{ entries: Array<{ id: string; deletedAt: string | null }> }>(
    '/sync/pull?since=' + cursor, { headers: auth },
  );
  assert(pull2.json.entries.length === 1, 'incremental pull returns tombstoned entry');
  assert(pull2.json.entries[0]?.deletedAt != null, 'deletedAt present after tombstone');

  // 8. logout
  const logout = await api<{ ok?: boolean }>('/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
  assert(logout.status === 200 && logout.json.ok, 'logout ok');
  const me = await api<{ email?: string }>('/me', { headers: { Authorization: 'Bearer ' + token } });
  assert(me.status === 401, 'revoked token gets 401');

  if (failures > 0) {
    console.error(failures + ' smoke failure(s)');
    process.exit(1);
  }
  console.log('All smoke tests passed');
}

main().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
