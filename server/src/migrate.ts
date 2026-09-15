import { query, queryResult } from './db.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  await queryResult(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);

  const applied = await query<{ name: string }>(`SELECT name FROM schema_migrations ORDER BY name`);
  const appliedSet = new Set<string>(applied.map(r => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      await queryResult(sql);
      await queryResult(`INSERT INTO schema_migrations (name, applied_at) VALUES ($1, now())`, [file]);
    } catch (err: unknown) {
      throw new Error(`Migration ${file} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('Migrations completed');
}

if (process.argv[1].endsWith('migrate.ts')) {
  runMigrations().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
