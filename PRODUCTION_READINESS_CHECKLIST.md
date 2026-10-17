# PrintFlow production-readiness checklist

**Audit date:** 2026-10-17  
**Scope:** Read-only Phase 0 audit. No production services, database migrations, payments, webhooks, or printers were contacted.

## Current architecture evidence

| Area | Current behavior and evidence | Risk | Required acceptance test |
|---|---|---|---|
| Web application | React/Vite SPA in `src/`, served by Express in `server.ts`. `src/lib/store.tsx` still seeds and persists business entities in browser localStorage. | **Critical**: clearing browser state can alter the dashboard's apparent business state. | Refresh/clear browser storage must not affect shops, jobs, payments, subscriptions, or reports. |
| Server persistence | `src/db/paymentStorage.ts` creates a `pg` pool only when `DATABASE_URL` is present. It creates tables imperatively in `initializePaymentTables()` instead of a versioned migration runner. | **Critical**: schema history, rollback, and startup guarantees are absent. | Fresh isolated PostgreSQL migration test plus repeat/migration-history test. |
| Fallback persistence | `src/db/paymentStorage.ts` uses `.data/payment_integrations.json` without `DATABASE_URL`; agent credentials can use the same fallback. | **Critical**: local JSON can become authoritative. | Production startup must fail closed without database configuration; no payment/agent data may be read from JSON. |
| Payments | `server.ts` maintains `trackedPaymentOrders`, `verifiedPayments`, and order/payment lookup Maps. Payment verification and customer job dispatch rely on those Maps. | **Critical**: server restart loses payment authority and can orphan/duplicate workflow decisions. | Restart-safe provider-order/payment/webhook reconciliation in isolated PostgreSQL. |
| Customer jobs | `POST /api/customer/print-jobs` has a Neon path (`print_agent_jobs`) but retains `backendPrintJobs` Maps and accepts client-supplied file settings/total guarded only by transient payment state. | **Critical**: not a durable, server-authoritative checkout lifecycle. | Server-created quote, durable job, atomic payment-success-to-queue transition. |
| Upload/file storage | `server.ts` keeps validated uploads in `inMemoryPrivateFiles`. The Supabase client dependency exists but no private Supabase Storage integration is used for these files. | **Critical**: files vanish on restart and cannot meet private durable storage requirements. | Private bucket upload, metadata persistence, signed/authorized retrieval, checksum, orphan recovery. |
| Tenant isolation | Agent routes authenticate tokens against PostgreSQL when configured and scope most operations by shop. Browser app-state synchronization (`/api/app-data`) is shop-owner-gated. | **High**: no dedicated negative cross-shop integration tests for all jobs/files/payments yet. | Shop A read/write attempts on every tenant-owned API return denial. |
| Authentication | Cookie/session and role middleware exists, plus CSRF endpoints/rate limiting. The frontend still defaults to an in-memory initial shop owner in `src/lib/store.tsx`. | **Critical**: demo identity is not production authentication. | Production mode rejects demo/bypass identities and all state-changing cookie requests need CSRF. |
| Credentials | Environment keys include database, session/CSRF/JWT, storage signing, credential encryption, and Razorpay settings. `VITE_RAZORPAY_KEY_ID` is intentionally a public key category; server secrets must remain server-only. | **High**: audit of committed/live values and rotation must be performed by operator; this audit did not display values. | Startup validates required production config and no secret appears in frontend bundle/logs. |
| Razorpay webhooks | Webhook route exists in `server.ts`, but payment success state is still held in Maps and webhook dedupe is process-local. | **Critical**: duplicates/out-of-order events are not durably idempotent. | Persisted webhook event ID with transactionally verified payment/job state transition. |
| Electron agent | `print-agent/` is a separate Electron 34 app with a restricted preload bridge, `safeStorage` token encryption, API client, printer discovery, `pdf-to-printer`, and packaged installer artifacts. | **High**: `LocalDataVault` persists `jobs_queue.json`; it must be reduced to bounded crash markers subordinate to server truth. | Agent restart/revocation/wrong-shop/uncertain-spool tests against a staging backend. |
| Printing | Agent exposes polling, claims, status updates, capability checking, and manual-attention recovery pathways. | **High**: physical outcome cannot be guaranteed from spooler submission; no controlled real-printer staging evidence. | Mock printer tests and an operator-authorized staging printer test with a harmless document. |
| Observability | Structured logger/redaction helpers and request-oriented server logging exist. | **Medium**: readiness/health, durable event correlation, database telemetry, retention alerts need verification/extension. | Database outage/readiness and redaction regression tests. |
| Deployment | Root has Vite/Express scripts and agent packaging scripts. No verified hosting/deployment configuration or staging database is present. | **Critical**: deployment target and rollback process are unknown. | Documented staging deployment, migration, rollback, backup/restore, HTTPS/CORS/webhook configuration. |

## Source inventory

- Frontend: `src/App.tsx`, components under `src/components/`, client state in `src/lib/store.tsx`.
- API server: `server.ts`.
- Database/persistence: `src/db/paymentStorage.ts`; baseline SQL in `supabase/migrations/001_initial_schema.sql`.
- Desktop agent: `print-agent/`, including `src/main/agent/PrintAgentService.ts`, `api/ApiClient.ts`, `storage/LocalDataVault.ts`, printer/queue/recovery modules, and renderer.
- Existing tests: root `test/*.test.ts`, including payment, security, logging, printer settings, and agent credential tests.
- Builds: `npm run build`, `npm run lint`, `npm run test`, `npm run agent:build`, and `npm run agent:dist`.

## Confirmed critical blockers

1. No isolated PostgreSQL/Neon connection or schema state was provided; no migration verification can be performed safely.
2. Payments, webhook deduplication, jobs, and uploads still have non-durable process-memory paths.
3. Supabase private storage is not wired for uploaded customer documents.
4. Browser localStorage and seeded demo state remain business-data sources.
5. The existing `001_initial_schema.sql` differs from the imperative tables created by `paymentStorage.ts`; there is no ordered migration history.
6. The requested durable guest checkout, quote snapshot, verified server page count, and atomic payment/job transition do not exist as an integrated path.
7. No staging Razorpay, Supabase, PostgreSQL, or Windows printer test environment is configured in the repository.

## Safe next phase prerequisites

Before Phase 1 implementation, provide or approve an **isolated non-production PostgreSQL database** and the desired migration command/CI environment. No production `DATABASE_URL`, Supabase service-role key, Razorpay live credential, printer, DNS, webhook, or data migration should be used.

## Current recommendation

**NO-GO for production.** The application has useful building blocks, but it does not currently meet database durability, private document storage, payment idempotency, or authoritative checkout requirements.
