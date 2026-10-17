# Database migrations

## Scope and safety

`supabase/migrations/001_initial_schema.sql` is the reviewed baseline schema. `002_durable_checkout_foundation.sql` is an additive Phase 1 migration; it assumes the baseline tables exist. Migrations are applied by `src/db/migrations.ts`, which creates `public.schema_migrations` and records a SHA-256 checksum for every file.

Never edit a migration after it has been applied. The runner stops on a checksum mismatch.

## Isolated test execution

The only repository command for database migration testing is:

```powershell
$env:PRINTFLOW_TEST_DATABASE_URL = 'postgresql://.../printflow_test'
$env:PRINTFLOW_TEST_DATABASE_CONFIRM = 'ISOLATED_TEST_DATABASE'
npm.cmd run db:migrate:test
```

The command refuses to use `DATABASE_URL`, requires the explicit confirmation value, and only accepts PostgreSQL URLs. Verify the database name, owner, and host are disposable before setting these variables. It does not use the application's ordinary server configuration.

## Transaction behavior

- The migration-history table is created before migration application.
- The runner holds a PostgreSQL advisory lock for its full execution, so concurrent runners cannot apply the same migration.
- Every unapplied migration executes inside its own `BEGIN`/`COMMIT` transaction.
- On SQL or history-insert failure the migration is rolled back and is not marked applied.
- The runner is retry-safe for a successfully recorded migration and rejects altered content.

## Rollback plan

Do not delete or modify an applied migration. Before applying to staging, take a verified database backup/snapshot. If `002` must be reverted before Phase 2 uses it, apply a separately reviewed forward migration that drops only unused Phase 1 tables and indexes in dependency order. Once payment or checkout data exists, use a restoration plan from a verified backup instead of destructive schema rollback.

## Phase 1 schema

`002` adds guest capability-token hashes, quote snapshots, uploaded-file metadata, provider payment orders/transactions, webhook deduplication, print-job events, and agent claim leases. Razorpay provider IDs are `TEXT`; internal relationships use UUID foreign keys. It does not migrate application traffic or enable Supabase file uploads. Those are later phases.
