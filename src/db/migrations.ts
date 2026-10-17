import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export interface Migration { id: string; filename: string; sql: string; checksum: string; }
export interface MigrationPool { connect(): Promise<PoolClient>; }

const migrationDirectory = path.resolve(process.cwd(), 'supabase', 'migrations');

export async function loadMigrations(directory = migrationDirectory): Promise<Migration[]> {
  const files = (await fs.readdir(directory))
    .filter((file) => /^\d{3,}_[a-z0-9_]+\.sql$/i.test(file))
    .sort((a, b) => a.localeCompare(b));
  const migrations = await Promise.all(files.map(async (filename) => {
    const sql = await fs.readFile(path.join(directory, filename), 'utf8');
    if (!sql.trim()) throw new Error(`Migration ${filename} is empty.`);
    return { id: filename.slice(0, filename.indexOf('_')), filename, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
  }));
  const ids = new Set<string>();
  for (const migration of migrations) {
    if (ids.has(migration.id)) throw new Error(`Duplicate migration id ${migration.id}.`);
    ids.add(migration.id);
  }
  return migrations;
}

export async function applyMigrations(pool: MigrationPool, migrations: Migration[]): Promise<string[]> {
  const client = await pool.connect();
  let lockHeld = false;
  try {
    // Serializes migration runners that target the same database.
    await client.query('SELECT pg_advisory_lock($1)', [7_201_260_017]);
    lockHeld = true;
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id TEXT PRIMARY KEY, filename TEXT NOT NULL UNIQUE, checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const applied = await client.query<{ id: string; checksum: string }>('SELECT id, checksum FROM public.schema_migrations');
    const known = new Map(applied.rows.map((row) => [row.id, row.checksum]));
    const newlyApplied: string[] = [];
    for (const migration of migrations) {
      const prior = known.get(migration.id);
      if (prior) {
        if (prior !== migration.checksum) throw new Error(`Migration checksum mismatch for ${migration.filename}; do not edit an applied migration.`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO public.schema_migrations (id, filename, checksum) VALUES ($1, $2, $3)', [migration.id, migration.filename, migration.checksum]);
        await client.query('COMMIT');
        newlyApplied.push(migration.filename);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return newlyApplied;
  } finally {
    if (lockHeld) await client.query('SELECT pg_advisory_unlock($1)', [7_201_260_017]);
    client.release();
  }
}

/** Only permits a separately named, explicitly confirmed isolated test target. */
export function getVerifiedTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.PRINTFLOW_TEST_DATABASE_URL;
  if (!url) throw new Error('PRINTFLOW_TEST_DATABASE_URL is required; DATABASE_URL is intentionally never used by the migration test runner.');
  if (env.PRINTFLOW_TEST_DATABASE_CONFIRM !== 'ISOLATED_TEST_DATABASE') throw new Error('Set PRINTFLOW_TEST_DATABASE_CONFIRM=ISOLATED_TEST_DATABASE after verifying the target is disposable.');
  if (env.DATABASE_URL && url === env.DATABASE_URL) throw new Error('Refusing to use DATABASE_URL as a test database target.');
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('PRINTFLOW_TEST_DATABASE_URL must be a PostgreSQL URL.');
  return url;
}

export type PgPoolFactory = (connectionString: string) => Pool;
