import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, queryOne } from '../db.js';
import { safeTs } from '../util.js';
import { requireAuth } from './auth.js';

const TaskRow = z.object({
  id: z.string().min(1),
  name: z.string(),
  target_daily_hours: z.number().optional(),
  color: z.string().optional(),
  days_per_week: z.number().int().optional(),
  created_at: z.string().nullable().optional(),
  archived_at: z.string().nullable().optional(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});
const EntryRow = z.object({
  id: z.string().min(1),
  task_id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number(),
  note: z.string().optional(),
  pomo: z.boolean().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});

const PushBody = z.object({
  tasks: z.array(TaskRow).max(50000).optional(),
  entries: z.array(EntryRow).max(50000).optional(),
  settings: z.object({ data: z.unknown(), updated_at: z.string() }).optional(),
});

export function registerSyncRoutes(fastify: FastifyInstance): void {
  fastify.post('/api/sync/push', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = PushBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'body', detail: parsed.error.issues[0]?.message });
    }
    const { tasks, entries, settings } = parsed.data;
    const userId = req.session!.user_id;
    let accepted = 0;

    for (const t of tasks ?? []) {
      await query(
        `INSERT INTO tasks (user_id,id,name,target_daily_hours,color,days_per_week,created_at,archived_at,updated_at,deleted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (user_id,id) DO UPDATE SET
           name=excluded.name, target_daily_hours=excluded.target_daily_hours, color=excluded.color,
           days_per_week=excluded.days_per_week, created_at=excluded.created_at, archived_at=excluded.archived_at,
           updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, seq=nextval('sync_seq')
         WHERE excluded.updated_at > tasks.updated_at`,
        [
          userId, t.id, t.name,
          Math.min(99, Math.max(0, t.target_daily_hours ?? 0)),
          t.color ?? '#4f46e5',
          t.days_per_week ?? 7,
          t.created_at ? safeTs(t.created_at) : null,
          t.archived_at ? safeTs(t.archived_at) : null,
          safeTs(t.updated_at),
          t.deleted_at ? safeTs(t.deleted_at) : null,
        ],
      );
      accepted++;
    }

    for (const e of entries ?? []) {
      await query(
        `INSERT INTO entries (user_id,id,task_id,date,hours,note,pomo,created_at,updated_at,deleted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (user_id,id) DO UPDATE SET
           task_id=excluded.task_id, date=excluded.date, hours=excluded.hours, note=excluded.note,
           pomo=excluded.pomo, created_at=excluded.created_at,
           updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, seq=nextval('sync_seq')
         WHERE excluded.updated_at > entries.updated_at`,
        [
          userId, e.id, e.task_id, e.date,
          Math.min(24, Math.max(0, e.hours)),
          e.note ?? '', e.pomo ?? false,
          e.created_at ? safeTs(e.created_at) : null,
          safeTs(e.updated_at),
          e.deleted_at ? safeTs(e.deleted_at) : null,
        ],
      );
      accepted++;
    }

    if (settings) {
      await query(
        `INSERT INTO user_settings (user_id,data,updated_at)
         VALUES ($1,$2,$3)
         ON CONFLICT (user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, seq=nextval('sync_seq')
         WHERE excluded.updated_at > user_settings.updated_at`,
        [userId, JSON.stringify(settings.data), safeTs(settings.updated_at)],
      );
      accepted++;
    }

    return { serverTime: new Date().toISOString(), accepted };
  });

  fastify.get('/api/sync/pull', { preHandler: requireAuth }, async (req) => {
    const userId = req.session!.user_id;
    const sinceRaw = (req.query as { since?: string }).since ?? '0';
    const since = /^\d+$/.test(sinceRaw) ? parseInt(sinceRaw, 10) : 0;

    const tasks = await query<Record<string, unknown>>(
      `SELECT id,name,target_daily_hours,color,days_per_week,created_at,archived_at,updated_at,deleted_at,seq
       FROM tasks WHERE user_id=$1 AND seq > $2 ORDER BY seq LIMIT 5000`,
      [userId, since],
    );
    const entries = await query<Record<string, unknown>>(
      `SELECT id,task_id,date,hours,note,pomo,created_at,updated_at,deleted_at,seq
       FROM entries WHERE user_id=$1 AND seq > $2 ORDER BY seq LIMIT 5000`,
      [userId, since],
    );
    const settings = await queryOne<{ data: unknown; updated_at: string | null; seq: number }>(
      `SELECT data,updated_at,seq FROM user_settings WHERE user_id=$1 AND seq > $2`,
      [userId, since],
    );

    const toIso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : (v as string) ?? null);
    const maxSeq = Math.max(
      since,
      ...tasks.map(t => Number(t.seq)),
      ...entries.map(e => Number(e.seq)),
      settings ? Number(settings.seq) : since,
    );

    return {
      cursor: maxSeq,
      tasks: tasks.map(t => ({
        id: t.id, name: t.name,
        targetDailyHours: Number(t.target_daily_hours),
        color: t.color, daysPerWeek: Number(t.days_per_week),
        createdAt: toIso(t.created_at), archivedAt: toIso(t.archived_at),
        updatedAt: toIso(t.updated_at), deletedAt: toIso(t.deleted_at),
      })),
      entries: entries.map(e => ({
        id: e.id, taskId: e.task_id, date: e.date,
        hours: Number(e.hours), note: e.note, pomo: e.pomo,
        createdAt: toIso(e.created_at),
        updatedAt: toIso(e.updated_at), deletedAt: toIso(e.deleted_at),
      })),
      settings: settings ? { data: settings.data, updated_at: settings.updated_at ? toIso(settings.updated_at) : null } : null,
      serverTime: new Date().toISOString(),
    };
  });
}
