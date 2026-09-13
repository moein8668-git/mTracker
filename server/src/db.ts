import pg from 'pg';

const { Pool } = pg;
// Set type parsers to match expected types
pg.types.setTypeParser(1082, (v: string) => v); // DATE → string
pg.types.setTypeParser(1700, (v: string) => parseFloat(v)); // NUMERIC → number
pg.types.setTypeParser(20, (v: string) => parseInt(v, 10)); // int8 → number;

// TLS to managed providers (Aiven/Neon/RDS) is configured in DATABASE_URL itself:
// `sslmode=require&sslrootcert=ca.pem` — the driver reads the CA file (relative
// to the server dir) into ssl.ca and verifies the full chain. No custom code here.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T[]>(sql, params);
  return (rows[0] as T | undefined) ?? null;
}

export async function queryResult(sql: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

export async function queryMany<T = unknown>(sql: string, params?: unknown[]): Promise<T[][]> {
  const client = await pool.connect();
  try {
    const results: T[][] = [];
    for (const q of sql.split(';').filter(s => s.trim())) {
      results.push((await client.query(q, params)).rows);
    }
    return results;
  } finally {
    client.release();
  }
}

export async function queryTransact(sql: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
