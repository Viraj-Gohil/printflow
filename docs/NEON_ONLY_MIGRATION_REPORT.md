# PrintFlow — Neon PostgreSQL Authoritative Database Migration Report

**Date:** October 18, 2026  
**Status:** Complete & Authoritative  
**Target:** Neon PostgreSQL as the sole authoritative database; Supabase Storage for private customer print files; zero local JSON, zero in-memory business maps, and zero browser localStorage business persistence.

---

## 1. Executive Summary

This refactoring ensures that **Neon PostgreSQL is the sole authoritative database for all PrintFlow SaaS business and application data**. All local fallback stores, JSON persistence mechanisms, in-memory authoritative Maps, browser `localStorage` persistence, and Electron local database authority have been eliminated.

Customer print documents continue to be stored in the private cloud Supabase Storage bucket (`print-documents`), with all file metadata, page counts, hashes, and ownership tracked authoritatively in Neon (`public.uploaded_files`).

---

## 2. Comprehensive Persistence Audit & Migration Matrix

| Layer / Component | Previous Mechanism | New Authoritative Architecture | Fail-Closed Policy |
| :--- | :--- | :--- | :--- |
| **Shop Integrations** | `.data/payment_integrations.json` & local fallback | Neon PostgreSQL `public.shop_payment_integrations` via `requirePostgresPool()` | HTTP 503 if Neon pool unconfigured |
| **Agent Registrations & Pairing** | `.data/payment_integrations.json` & local file fallback | Neon PostgreSQL `public.print_agents` & `public.printflow_app_state` | HTTP 503 if Neon pool unconfigured |
| **Payment Orders** | In-memory `trackedPaymentOrders` Map | Neon PostgreSQL `public.payment_orders` | HTTP 503 fail-closed |
| **Verified Payments** | In-memory `verifiedPayments` & `orderIdToPaymentId` Maps | Atomic verification in Neon `public.payment_orders` & `public.payment_transactions` | Atomic verification; HTTP 503 if unreachable |
| **Print Jobs Queue** | In-memory `backendPrintJobs` & `backendPrintJobsByOrder` Maps | Neon PostgreSQL `public.print_agent_jobs` & `public.print_jobs` | HTTP 503 fail-closed |
| **Private Files Buffer** | In-memory `inMemoryPrivateFiles` Buffer Map | Private Supabase Storage bucket (`print-documents`) + Neon `uploaded_files` metadata | HTTP 503 if storage or DB unreachable |
| **Browser Frontend State** | Browser `localStorage` (`shops`, `pricing_rules`, `plans`, `printers`, `agents`, `jobs`, `tickets`, etc.) | Ephemeral React state synced from Neon via `/api/app-data` and `/api/auth/session` | Purges legacy `localStorage` keys; renders error/loading states |
| **Electron Print Agent** | `jobs_queue.json` in user data folder | Ephemeral runtime memory buffer; reconciles pending jobs from Neon on boot via `/api/agent/jobs` | Purges legacy `jobs_queue.json` on boot; never acts as offline authority |

---

## 3. Detailed Component Refactoring

### 3.1. Elimination of Backend File Persistence (`.data/`)
- Permanently deleted `.data/payment_integrations.json` and `.data/` directory.
- Removed `DATA_DIR`, `BACKUP_FILE`, `loadLocalFile()`, `saveLocalFile()`, `requireLocalAgentStorage()`, and dual-write logic from `src/db/paymentStorage.ts`.
- Exported `requirePostgresPool()` which enforces mandatory database connectivity and throws a structured HTTP 503 error when `pgPool` is unconfigured.
- `savePlatformPaymentConfig`, `getPlatformPaymentConfig`, `saveShopPaymentIntegration`, `getShopPaymentIntegration`, and `deleteShopPaymentIntegration` query Neon directly.

### 3.2. Elimination of Backend In-Memory Maps (`server.ts`)
- Removed all declarations of `trackedPaymentOrders`, `verifiedPayments`, `orderIdToPaymentId`, `inMemoryPrivateFiles`, `backendPrintJobs`, and `backendPrintJobsByOrder`.
- `/api/create-order`: Fails closed with HTTP 503 if Neon is unconfigured. Persists payment orders directly to Neon `payment_orders`.
- `/api/verify-payment`: Executes atomic cryptographic verification directly against Neon.
- `/api/payment/check-status` & `/api/payment/order-status/:orderId`: Look up order status directly from Neon `getPaymentRepository()`.
- `/api/payment/reconcile`: Reconciles live payment state from Razorpay into Neon atomically.
- `/api/customer/print-jobs`: Requires Neon database configuration (HTTP 503 if unconfigured). Confirms payment status from Neon `payment_orders` before accepting jobs. Saves jobs directly to Neon `print_agent_jobs` and `print_jobs`.
- `/api/shops/:shopId/live`: Queries live printers and print jobs directly from Neon via `getShopPrintAgentPrinters` and `listPrintAgentJobs`.
- `/api/agent/jobs`, `/api/agent/jobs/:id/claim`, `/api/agent/jobs/:id/status`, and `/api/agent/jobs/:id/file`: Strictly Neon-backed endpoints without in-memory map fallbacks.
- `/health` & `/api/health`: Executes a live `SELECT 1` ping against Neon and returns HTTP 503 if the database is unreachable or unconfigured.

### 3.3. Elimination of Browser `localStorage` Business Persistence (`src/lib/store.tsx`)
- Purged all business keys on frontend load:
  `['current_user', 'users', 'auth_token', 'jwt', 'api_token', 'session_id', 'shops', 'active_shop_id', 'pricing_rules', 'saas_plans', 'saas_subscriptions', 'platform_policies', 'printers', 'agents', 'print_jobs', 'transactions', 'audit_logs', 'support_settings', 'support_tickets', 'admin_razorpay', 'app_data', 'cloud_state']`.
- Redefined `setStoredItem` to sync business data strictly to Neon via `cloudStateWriter` (PUT `/api/app-data/:key`), eliminating all `localStorage.setItem` writes for business entities.
- Redefined `getStoredItem` to return fallback values rather than reading stale `localStorage` entries.
- Added observable UI states to `AppContextType`:
  - `isLoadingData`: Tracks active synchronization from Neon.
  - `dataLoadError`: Surfaces database connection or query errors.
  - `isCloudSynced`: Confirms authoritative alignment with Neon.
- Restored authenticated user sessions on mount via `GET /api/auth/session` without exposing tokens to browser storage.
- Updated `registerShop` to require server confirmation (POST `/api/auth/register`) before updating state, eliminating offline mode fallbacks.
- Updated `syncFromNeon` to remove `saveLocal` writes and prevent writing fake initial client data into Neon when a shop's database state is empty.

### 3.4. Elimination of Electron Agent Database Authority (`print-agent/`)
- Updated `LocalDataVault.ts` to purge any legacy `jobs_queue.json` file from disk during initialization.
- Made `persistJobs()` a no-op so the agent's queue remains an ephemeral runtime execution buffer in process memory.
- Updated `JobQueueManager.ts` to initialize an empty queue upon boot, relying on server reconciliation via `pollPendingJobs()` (`/api/agent/jobs`) to retrieve authoritative pending work.

### 3.5. Supabase Storage for Customer Documents
- Customer print documents are uploaded directly to the private Supabase Storage bucket (`print-documents`) using the tenant isolation format `shops/:shopId/jobs/:jobId/files/:fileId.pdf`.
- File metadata (filename, byte size, detected MIME type, SHA-256 hash, verified page count, upload state) is stored in Neon `public.uploaded_files`.
- Print agent file downloads stream authenticated files from Supabase Storage or Neon BYTEA storage without in-memory buffer fallbacks.

---

## 4. Automated Test Validation

The following test suites confirm that Neon is the sole authoritative database and all local persistence fallbacks are eliminated:

1. `test/neon-only-authoritative.test.ts` (8 Tests — 100% Passing):
   - `requirePostgresPool()` throws HTTP 503 when pool is unconfigured.
   - `server.ts` contains zero in-memory Map declarations.
   - No `.data/` directory or `payment_integrations.json` exists on disk.
   - Payment integrations execute strictly against Neon PostgreSQL tables.
   - Electron Print Agent vault eliminates `jobs_queue.json` disk writes.
   - `JobQueueManager` runtime queue starts empty and reconciles from Neon.
   - Supabase Storage private bucket adheres to tenant isolation contract.
   - Frontend `store.tsx` does not write business entities to `localStorage`.

2. `test/payment-integration-security.test.ts` (41 Tests — 100% Passing):
   - Confirms zero local JSON backup file or `.data/` directory creation during payment operations.
   - Confirms shop payment integrations are retrieved directly from the authoritative database.

3. Complete Project Test Suite (All 18 Suites Passing Cleanly):
   - `saas-pricing.test.ts`
   - `support-tickets.test.ts`
   - `admin-navigation.test.ts`
   - `razorpay-checkout.test.ts`
   - `security-audit.test.ts`
   - `advanced-security-hardening.test.ts`
   - `ssrf-protection.test.ts`
   - `logging-redaction.test.ts`
   - `payment-integration-security.test.ts`
   - `database-foundation.test.ts`
   - `phase2-neon-integration.test.ts`
   - `phase3-storage-guest-checkout.test.ts`
   - `phase4-payment-reliability.test.ts`
   - `phase5-e2e-integration.test.ts`
   - `phase6-environment-validation.test.ts`
   - `phase7-pilot-validation.test.ts`
   - `phase8-staging-smoke.test.ts`
   - `neon-only-authoritative.test.ts`

4. Clean Compilation & Builds:
   - `npx tsc --noEmit`: 0 errors.
   - `npm run build`: Successfully generated production client and bundled `server.js`.
   - `npm run agent:build`: Successfully built Electron agent renderer and main processes.

