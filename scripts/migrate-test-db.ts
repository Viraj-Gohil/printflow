import { Pool } from 'pg';
import { applyMigrations, getVerifiedTestDatabaseUrl, loadMigrations } from '../src/db/migrations.js';

async function main() {
  const connectionString = getVerifiedTestDatabaseUrl();
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000, ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } });
  try {
    const migrations = await loadMigrations();
    const applied = await applyMigrations(pool, migrations);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'No pending migrations.');
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(`Migration failed safely: ${error instanceof Error ? error.message : 'unknown error'}`); process.exitCode = 1; });
