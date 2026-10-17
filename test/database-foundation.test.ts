import assert from 'node:assert/strict';
import { applyMigrations, getVerifiedTestDatabaseUrl, loadMigrations } from '../src/db/migrations';
import { DurableCheckoutRepository } from '../src/db/durableCheckoutRepository';
import { NeonBusinessRepository } from '../src/db/neonRepositories';

const uuid = '11111111-1111-4111-8111-111111111111';

async function rejectsUnsafeDatabaseTargets() {
  assert.throws(() => getVerifiedTestDatabaseUrl({}), /PRINTFLOW_TEST_DATABASE_URL/);
  assert.throws(() => getVerifiedTestDatabaseUrl({ PRINTFLOW_TEST_DATABASE_URL: 'postgresql://localhost/test', DATABASE_URL: 'postgresql://localhost/test', PRINTFLOW_TEST_DATABASE_CONFIRM: 'ISOLATED_TEST_DATABASE' }), /Refusing/);
  assert.equal(getVerifiedTestDatabaseUrl({ PRINTFLOW_TEST_DATABASE_URL: 'postgresql://localhost/printflow_test', PRINTFLOW_TEST_DATABASE_CONFIRM: 'ISOLATED_TEST_DATABASE' }), 'postgresql://localhost/printflow_test');
}

async function validatesMigrations() {
  const migrations = await loadMigrations();
  assert.ok(migrations.some((migration) => migration.filename === '002_durable_checkout_foundation.sql'));
  assert.equal(new Set(migrations.map((migration) => migration.id)).size, migrations.length);
  assert.ok(migrations.every((migration) => /^[a-f0-9]{64}$/.test(migration.checksum)));
}

async function rollsBackRepositoryTransaction() {
  const statements: string[] = [];
  const client: any = {
    query: async (sql: string) => { statements.push(sql); if (sql.includes('INSERT INTO public.print_checkout_quotes')) throw new Error('simulated constraint violation'); return { rows: [], rowCount: 0 }; },
    release: () => undefined
  };
  const repository = new DurableCheckoutRepository({ connect: async () => client } as any);
  await assert.rejects(() => repository.createQuote({ jobId: uuid, shopId: uuid, currency: 'INR', amountMinor: 100, pricingSnapshot: { pages: 1 }, expiresAt: new Date(Date.now() + 60_000) }));
  assert.deepEqual(statements.map((statement) => statement.split(' ')[0]), ['BEGIN', 'INSERT', 'ROLLBACK']);
}

async function preventsInvalidRepositoryWrites() {
  let connected = false;
  const repository = new DurableCheckoutRepository({ connect: async () => { connected = true; throw new Error('should not connect'); } } as any);
  await assert.rejects(() => repository.createPaymentOrder({ jobId: 'not-a-uuid', shopId: uuid, providerOrderId: 'order_valid', providerAccountRef: 'shop-account', amountMinor: 100, idempotencyKey: uuid }), /jobId/);
  assert.equal(connected, false);
}

async function preventsLocalFallbackForBusinessReads() {
  let connections = 0;
  const repository = new NeonBusinessRepository({ connect: async () => { connections++; throw new Error('database unavailable'); } } as any);
  await assert.rejects(() => repository.findActiveShopBySlug('valid-shop'), /database unavailable/);
  assert.equal(connections, 1);
  await assert.rejects(() => repository.findActiveShopBySlug('../shop'), /shop slug/);
  assert.equal(connections, 1, 'invalid input must fail before a database connection or fallback');
}

async function migrationHistorySkipsAppliedRows() {
  const migrations = await loadMigrations();
  const queries: string[] = [];
  const client: any = { query: async (sql: string) => { queries.push(sql); if (sql.startsWith('SELECT id')) return { rows: migrations.map((m) => ({ id: m.id, checksum: m.checksum })) }; return { rows: [], rowCount: 1 }; }, release: () => undefined };
  const applied = await applyMigrations({ connect: async () => client } as any, migrations);
  assert.deepEqual(applied, []);
  assert.equal(queries.filter((sql) => sql === 'BEGIN').length, 0);
}

await rejectsUnsafeDatabaseTargets();
await validatesMigrations();
await rollsBackRepositoryTransaction();
await preventsInvalidRepositoryWrites();
await preventsLocalFallbackForBusinessReads();
await migrationHistorySkipsAppliedRows();
console.log('Database foundation tests passed.');
