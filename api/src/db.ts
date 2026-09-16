import postgres, { type Sql } from 'postgres';
import type { Env } from './util.js';

/**
 * Hyperdrive owns origin connection pooling. Create this client inside each Worker
 * invocation and let the runtime release it; never cache it globally or call end().
 */
export function createSql(env: Env): Sql {
  if (!env.HYPERDRIVE) throw new Error('Hyperdrive binding is missing');
  return postgres(env.HYPERDRIVE.connectionString);
}
