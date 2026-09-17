import type { Sql } from 'postgres';
import { authSession } from './auth.js';
import { json, readJson, type Env } from './util.js';

type TaskInput = { id:string; name:string; target_daily_hours?:number; color?:string; days_per_week?:number; created_at?:string|null; archived_at?:string|null; updated_at:string; deleted_at?:string|null };
type EntryInput = { id:string; task_id:string; date:string; hours:number; note?:string; pomo?:boolean; created_at?:string|null; updated_at:string; deleted_at?:string|null };
type PushInput = { tasks?:TaskInput[]; entries?:EntryInput[]; settings?:{data:unknown;updated_at:string} };
const MAX_ROWS = 50_000;
const ISO = /^\d{4}-\d{2}-\d{2}T/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const timestamp = (value: unknown, nullable = false): string | null | undefined => {
  if (value === undefined) return undefined;
  if (nullable && value === null) return null;
  return typeof value === 'string' && ISO.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
};
function task(value: unknown): TaskInput | null {
  if (!object(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || typeof value.updated_at !== 'string' || !timestamp(value.updated_at)) return null;
  if (value.target_daily_hours !== undefined && typeof value.target_daily_hours !== 'number') return null;
  if (value.color !== undefined && typeof value.color !== 'string') return null;
  if (value.days_per_week !== undefined && (!Number.isInteger(value.days_per_week) || typeof value.days_per_week !== 'number')) return null;
  const created = timestamp(value.created_at, true), archived = timestamp(value.archived_at, true), deleted = timestamp(value.deleted_at, true);
  if ((value.created_at !== undefined && created === undefined) || (value.archived_at !== undefined && archived === undefined) || (value.deleted_at !== undefined && deleted === undefined)) return null;
  return { id:value.id,name:value.name,target_daily_hours:value.target_daily_hours as number|undefined,color:value.color as string|undefined,days_per_week:value.days_per_week as number|undefined,created_at:created,archived_at:archived,updated_at:value.updated_at,deleted_at:deleted };
}
function entry(value: unknown): EntryInput | null {
  if (!object(value) || typeof value.id !== 'string' || !value.id || typeof value.task_id !== 'string' || !value.task_id || typeof value.date !== 'string' || !DATE.test(value.date) || typeof value.hours !== 'number' || typeof value.updated_at !== 'string' || !timestamp(value.updated_at)) return null;
  if (value.note !== undefined && typeof value.note !== 'string') return null;
  if (value.pomo !== undefined && typeof value.pomo !== 'boolean') return null;
  const created = timestamp(value.created_at, true), deleted = timestamp(value.deleted_at, true);
  if ((value.created_at !== undefined && created === undefined) || (value.deleted_at !== undefined && deleted === undefined)) return null;
  return { id:value.id,task_id:value.task_id,date:value.date,hours:value.hours,note:value.note as string|undefined,pomo:value.pomo as boolean|undefined,created_at:created,updated_at:value.updated_at,deleted_at:deleted };
}
function push(value: unknown): PushInput | null {
  if (!object(value)) return null;
  if (value.tasks !== undefined && (!Array.isArray(value.tasks) || value.tasks.length > MAX_ROWS)) return null;
  if (value.entries !== undefined && (!Array.isArray(value.entries) || value.entries.length > MAX_ROWS)) return null;
  const tasks = value.tasks?.map(task), entries = value.entries?.map(entry);
  if (tasks?.some(x => !x) || entries?.some(x => !x)) return null;
  let settings: PushInput['settings'];
  if (value.settings !== undefined) {
    if (!object(value.settings) || !('data' in value.settings) || typeof value.settings.updated_at !== 'string' || !timestamp(value.settings.updated_at)) return null;
    settings = { data:value.settings.data, updated_at:value.settings.updated_at };
  }
  return { tasks:tasks as TaskInput[]|undefined, entries:entries as EntryInput[]|undefined, settings };
}
const safeTime = (value: string | null | undefined): string | null => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
const iso = (value: unknown): string | null => value instanceof Date ? value.toISOString() : typeof value === 'string' ? safeTime(value) : null;
/** postgres.js may deserialize DATE as Date; the browser contract is always date-only. */
export const dateOnly = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === 'string' && DATE.test(value.slice(0, 10)) ? value.slice(0, 10) : null;
};

export async function handlePush(req: Request, env: Env, sql: Sql): Promise<Response> {
  const session = await authSession(req, sql); if (!session) return json(req, env, { error:'unauthorized' }, 401);
  const body = push(await readJson(req)); if (!body) return json(req, env, { error:'body', detail:'invalid synchronization payload' }, 400);
  const accepted = (body.tasks?.length ?? 0) + (body.entries?.length ?? 0) + (body.settings ? 1 : 0);
  await sql.begin(async tx => {
    for (const t of body.tasks ?? []) await tx`
      INSERT INTO tasks (user_id,id,name,target_daily_hours,color,days_per_week,created_at,archived_at,updated_at,deleted_at)
      VALUES (${session.user_id},${t.id},${t.name},${Math.min(99,Math.max(0,t.target_daily_hours ?? 0))},${t.color ?? '#4f46e5'},${t.days_per_week ?? 7},${safeTime(t.created_at)},${safeTime(t.archived_at)},${safeTime(t.updated_at)!},${safeTime(t.deleted_at)})
      ON CONFLICT (user_id,id) DO UPDATE SET name=excluded.name,target_daily_hours=excluded.target_daily_hours,color=excluded.color,days_per_week=excluded.days_per_week,created_at=excluded.created_at,archived_at=excluded.archived_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at,seq=nextval('sync_seq') WHERE excluded.updated_at > tasks.updated_at`;
    for (const e of body.entries ?? []) await tx`
      INSERT INTO entries (user_id,id,task_id,date,hours,note,pomo,created_at,updated_at,deleted_at)
      VALUES (${session.user_id},${e.id},${e.task_id},${e.date},${Math.min(24,Math.max(0,e.hours))},${e.note ?? ''},${e.pomo ?? false},${safeTime(e.created_at)},${safeTime(e.updated_at)!},${safeTime(e.deleted_at)})
      ON CONFLICT (user_id,id) DO UPDATE SET task_id=excluded.task_id,date=excluded.date,hours=excluded.hours,note=excluded.note,pomo=excluded.pomo,created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at,seq=nextval('sync_seq') WHERE excluded.updated_at > entries.updated_at`;
    if (body.settings) await tx`INSERT INTO user_settings (user_id,data,updated_at) VALUES (${session.user_id},${JSON.stringify(body.settings.data)},${safeTime(body.settings.updated_at)!}) ON CONFLICT (user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,seq=nextval('sync_seq') WHERE excluded.updated_at > user_settings.updated_at`;
  });
  return json(req, env, { serverTime:new Date().toISOString(), accepted });
}

export async function handlePull(req: Request, env: Env, sql: Sql): Promise<Response> {
  const session = await authSession(req, sql); if (!session) return json(req, env, { error:'unauthorized' }, 401);
  const raw = new URL(req.url).searchParams.get('since') ?? '0'; const since = /^\d+$/.test(raw) ? Number.parseInt(raw,10) : 0;
  const [tasks, entries, setting] = await Promise.all([
    sql`SELECT id,name,target_daily_hours,color,days_per_week,created_at,archived_at,updated_at,deleted_at,seq FROM tasks WHERE user_id=${session.user_id} AND seq>${since} ORDER BY seq LIMIT 5000`,
    sql`SELECT id,task_id,date,hours,note,pomo,created_at,updated_at,deleted_at,seq FROM entries WHERE user_id=${session.user_id} AND seq>${since} ORDER BY seq LIMIT 5000`,
    sql`SELECT data,updated_at,seq FROM user_settings WHERE user_id=${session.user_id} AND seq>${since}`,
  ]);
  const max = Math.max(since,...tasks.map(x=>Number(x.seq)),...entries.map(x=>Number(x.seq)),...setting.map(x=>Number(x.seq)));
  return json(req, env, { cursor:max, tasks:tasks.map(t=>({id:t.id,name:t.name,targetDailyHours:Number(t.target_daily_hours),color:t.color,daysPerWeek:Number(t.days_per_week),createdAt:iso(t.created_at),archivedAt:iso(t.archived_at),updatedAt:iso(t.updated_at),deletedAt:iso(t.deleted_at)})), entries:entries.map(e=>({id:e.id,taskId:e.task_id,date:dateOnly(e.date) ?? '',hours:Number(e.hours),note:e.note,pomo:e.pomo,createdAt:iso(e.created_at),updatedAt:iso(e.updated_at),deletedAt:iso(e.deleted_at)})), settings:setting[0] ? {data:setting[0].data,updated_at:iso(setting[0].updated_at)} : null, serverTime:new Date().toISOString() });
}
