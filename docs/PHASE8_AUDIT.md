# PrintFlow Phase 8 Audit: Staging Deployment & Release Validation

**Audit Date**: October 2026  
**Auditor**: Senior Full-Stack Engineering Agent (Google Antigravity)  
**Project**: PrintFlow SaaS (`C:\Users\viraj\Downloads\printflow`)  
**Scope**: Staging deployment validation, Vercel frontend environment variable handling, containerized backend requirements (Render/Railway), Supabase private storage integration, CORS preflight verification, migration runner integrity (001–005), Electron Windows Agent staging validation, and launch blocker assessment.

---

## 1. Executive Summary

Phase 8 executes the pre-flight staging deployment and release validation for the PrintFlow SaaS ecosystem. The target architecture separates the frontend (React + Vite SPA intended for Vercel) from the backend API (Node.js + Express intended for containerized hosting such as Render, Railway, or Google Cloud Run), backed by Neon PostgreSQL and Supabase Private Storage (`print-documents`).

All **17 automated test suites** pass cleanly (100% pass rate). The frontend and backend bundles build cleanly (`dist/` and `server.js`), TypeScript checks report 0 errors, and the Electron Print Agent compiles without issues.

In accordance with mandatory constraints, all staging checks strictly avoid mutating production databases, charging real money, or dispatching physical customer paper.

---

## 2. Evidence-Based Verification Matrix

```
┌───────────────────────────────────────┬───────────┬────────────────────────────────────────────────────────┐
│ Area / Subsystem                      │ Status    │ Evidence / Verification Basis                          │
├───────────────────────────────────────┼───────────┼────────────────────────────────────────────────────────┤
│ Automated Test Suites (17/17)         │ PASS      │ npm test passed 17/17 suites with 0 failures           │
│ TypeScript Typecheck                  │ PASS      │ npm run lint (tsc --noEmit) passed with 0 errors       │
│ Client SPA Production Build           │ PASS      │ vite build produced dist/index.html & assets cleanly   │
│ Node.js Server Production Bundle      │ PASS      │ esbuild produced standalone server.js (305.7kb)        │
│ Electron Windows Agent Build          │ PASS      │ npm run agent:build compiled renderer & main cleanly   │
│ Vercel Deployment Configuration       │ PASS      │ vercel.json configures SPA routing and cleanUrls       │
│ Frontend API Base URL Helper          │ PASS      │ src/lib/apiConfig.ts resolves VITE_API_BASE_URL cleanly│
│ Container PORT & 0.0.0.0 Binding      │ PASS      │ server.ts binds to process.env.PORT on 0.0.0.0         │
│ Graceful Shutdown (SIGTERM/SIGINT)    │ PASS      │ Closes HTTP server and drains pg pool via closeSharedPool│
│ Health & Readiness Observability      │ PASS      │ /health and /api/health report status, uptime, svc     │
│ Cross-Origin Resource Sharing (CORS)  │ PASS      │ Dynamic CORS_ALLOWED_ORIGINS and OPTIONS 204 preflight │
│ Supabase Storage & Signed URLs        │ PASS      │ print-documents bucket, 15-min signed URLs, direct upload│
│ Migration Runner Integrity (001–005)  │ PASS      │ 5 migrations verified in sequential order with checksums│
│ Database Safety Gate                  │ PASS      │ Safety gate strictly blocks test runs on DATABASE_URL  │
│ Electron Agent M2M Authentication     │ PASS      │ Timing-safe SHA-256 token verification & revoke lock   │
│ Electron Atomic Claim & Lease Recovery│ PASS      │ Row-level locks and 5-min lease expiration recovery    │
│ Ambiguous Spooler Outcome Policy      │ PASS      │ REQUIRES_ATTENTION flags set; auto-reprint blocked     │
│ Virtual Printer Queue Filtering       │ PASS      │ PrintSettingsAdapter.isVirtualPrinter filters PDF/Fax  │
│ Multi-Tenant Isolation                │ PASS      │ Cross-tenant document download rejected with 403       │
│ Deep Log Redaction                    │ PASS      │ Zero credentials/tokens scrubbed from stdout & logs     │
├───────────────────────────────────────┼───────────┼────────────────────────────────────────────────────────┤
│ Live Staging DB Provisioning          │ BLOCKED   │ Requires staging PostgreSQL connection string          │
│ Live Supabase Storage Bucket Setup    │ BLOCKED   │ Mock verified; live cloud bucket requires credentials  │
│ Real Customer Card/UPI Charges        │ BLOCKED   │ Synthetic HMAC verified; live charges require merchant │
│ Physical Paper Spool Output           │ BLOCKED   │ Host printers detected; physical paper needs operator  │
│ Windows Agent Code Signing            │ BLOCKED   │ signAndEditExecutable: false; requires EV/OV cert      │
└───────────────────────────────────────┴───────────┴────────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Staging Audit

### 3.1 Frontend Environment Handling & Vercel Compatibility
- **API Base URL Resolution**: Added [`src/lib/apiConfig.ts`](file:///c:/Users/viraj/Downloads/printflow/src/lib/apiConfig.ts). When the frontend is deployed to Vercel and the backend is on Render/Railway, setting `VITE_API_BASE_URL=https://printflow-api.onrender.com` directs network calls straight to the container backend. When unset (local development or unified containers), it defaults to same-origin relative URLs (`/api/...`).
- **Bypassing Vercel's 4.5 MB Limit**: Direct browser-to-backend communication ensures that uploads up to 50 MB flow directly into the container backend, completely bypassing Vercel Serverless Function 4.5 MB body size limitations.
- **SPA Rewrites**: Added [`vercel.json`](file:///c:/Users/viraj/Downloads/printflow/vercel.json) ensuring all non-asset routes rewrite to `/index.html` for client-side routing.

### 3.2 Backend Container Configuration (Render / Railway)
- **Start Script**: In `package.json`, `"start": "node server.js"`. The backend is pre-bundled by `esbuild` during `npm run build`, producing an optimized ESM bundle (`server.js`, 305.7kb) that runs on any Node 18+ runtime without TypeScript loaders.
- **PORT & Network Binding**: `server.ts` resolves `process.env.PORT` (defaulting to 3000) and explicitly listens on `0.0.0.0`, ensuring compatibility with container port mappers on Render and Railway.
- **Graceful Shutdown**: Added `SIGTERM` and `SIGINT` signal handlers in `server.ts`. When a container restart or deployment occurs:
  1. Closes HTTP listener to reject new connections.
  2. Drains active in-flight requests.
  3. Invokes `closeSharedPool()` to gracefully close the Neon PostgreSQL connection pool.
  4. Forces process exit after a 10-second timeout if connections fail to drain.
- **Health Probes**: Added unauthenticated `/health` and `/api/health` probes for Render/Railway readiness and liveness checks.

### 3.3 CORS & Webhook Configuration
- **Dynamic Allowed Origins**: `server.ts` parses `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` environment variables, supporting exact URLs and wildcard domain patterns (e.g. `*.vercel.app`).
- **Preflight `OPTIONS` Handling**: Preflight requests return HTTP 204 with `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, and `Access-Control-Allow-Credentials`.
- **Webhook Security**: The Razorpay webhook endpoint (`/api/payment/webhook`) is exempted from browser CSRF origin checks and is strictly protected by raw-body HMAC-SHA256 signature verification (`x-razorpay-signature`).

### 3.4 Supabase Storage Integration
- **Private Bucket**: Configured for private bucket `print-documents` (public access disabled).
- **Path Isolation**: Enforces tenant-isolated hierarchy: `shops/{shopId}/jobs/{jobId}/files/{fileId}.ext`.
- **Signed URLs**: Generates 15-minute expiring signed URLs (`DEFAULT_SIGNED_URL_TTL_SECONDS = 900`) for authenticated document downloads.

### 3.5 Database Migration Integrity (001–005)
- All 5 migrations loaded and verified in strict sequential order:
  1. `001_initial_schema.sql` (Base tables, shops, printers, pricing rules)
  2. `002_durable_checkout_foundation.sql` (Capabilities, quotes, payment orders, claims)
  3. `003_phase2_shop_api_support.sql` (Subscriptions, plans, agent devices)
  4. `004_phase3_storage_and_guest_checkout.sql` (Storage bucket defaults, retention indexes)
  5. `005_phase4_payment_reliability.sql` (Reconciliation columns, manual refunds)
- **Safety Gate**: Verified that `scripts/migrate-test-db.ts` refuses to touch `DATABASE_URL` without `PRINTFLOW_TEST_DATABASE_URL` and `PRINTFLOW_TEST_DATABASE_CONFIRM=ISOLATED_TEST_DATABASE`.

---

## 4. Electron Windows Agent Staging Validation

- **M2M Authentication**: Desktop agent authenticates via timing-safe SHA-256 token hashing; revoked agents are locked immediately.
- **Atomic Claiming**: Row-level lock updates ensure single-winner claiming across competing shop agents.
- **5-Minute Lease Recovery**: Crashed or disconnected agents release claimed jobs after 5 minutes (`NOW() - INTERVAL '5 minutes'`).
- **Ambiguous Spooler Defense**: If the Windows spooler accepts bytes but times out before confirmation (`submitted === true`, `success === false`), the agent sets `print_status = 'REQUIRES_ATTENTION'` and `retrySafe = false`. Automatic re-printing is strictly blocked.
- **Virtual Printer Filtering**: `PrintSettingsAdapter.isVirtualPrinter` regex excludes software PDF/XPS/Fax queues from shop hardware registration.
- **Temporary File Purge**: Downloaded spool files in `%TEMP%\PrintFlow_Spool` are unlinked in `finally` blocks immediately after spooling.

---

## 5. Exact Manual Runbook for First Controlled Shop Pilot

Follow this step-by-step procedure to execute the first live pilot in a staging environment:

### Step 1: Staging PostgreSQL Database Setup
1. Create a dedicated, disposable staging database in Neon (e.g. `printflow-staging`).
2. Run the migration script against the staging database:
   ```bash
   PRINTFLOW_TEST_DATABASE_URL="postgresql://user:pass@ep-staging.neon.tech/printflow-staging?sslmode=require" \
   PRINTFLOW_TEST_DATABASE_CONFIRM=ISOLATED_TEST_DATABASE \
   npm run db:migrate:test
   ```
3. Confirm output: `Applied: 001_initial_schema.sql, 002_durable_checkout_foundation.sql, ...`

### Step 2: Supabase Private Storage Provisioning
1. In Supabase Dashboard, create a new private bucket named `print-documents`.
2. Disable "Public bucket".
3. Add storage policy allowing service-role read/write.
4. Obtain `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### Step 3: Backend Deployment (Render or Railway)
1. Create a new Web Service on Render or Railway connected to the repository.
2. Build command: `npm run build` (or `npm install && npm run build`).
3. Start command: `npm start` (runs `node server.js`).
4. Configure Environment Variables:
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://user:pass@ep-staging.neon.tech/printflow-staging?sslmode=require`
   - `MASTER_ENCRYPTION_KEY=<32-byte-hex-string>`
   - `COOKIE_SECRET=<32-char-random-string>`
   - `CORS_ALLOWED_ORIGINS=https://printflow-staging.vercel.app`
   - `SUPABASE_URL=https://xyz.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`
   - `ADMIN_RAZORPAY_KEY_ID=rzp_test_...`
   - `ADMIN_RAZORPAY_KEY_SECRET=<secret>`
   - `RAZORPAY_WEBHOOK_SECRET=<webhook-secret>`
5. Deploy and verify readiness probe: `curl https://printflow-api.onrender.com/health` returns `status: ok`.

### Step 4: Frontend Deployment (Vercel)
1. Import repository into Vercel.
2. Framework: Vite.
3. Build command: `npm run build:client` (output directory: `dist`).
4. Configure Environment Variable:
   - `VITE_API_BASE_URL=https://printflow-api.onrender.com`
   - `VITE_RAZORPAY_KEY_ID=rzp_test_...`
5. Deploy and verify that the application loads at `https://printflow-staging.vercel.app`.

### Step 5: Shop Dashboard Onboarding & Razorpay Test Keys
1. Log in to the Shop Dashboard at `/shop/settings`.
2. Enter the shop's Razorpay Test `Key Id` (`rzp_test_...`) and `Key Secret`.
3. Verify that the secret is encrypted and only the masked key is displayed.

### Step 6: Electron Print Agent Installation & Pairing
1. On the shop counter Windows PC, launch the PrintFlow Agent (`npm run agent:start` or installer).
2. Generate a pairing token from `/shop/agent`.
3. Enter Backend URL (`https://printflow-api.onrender.com`), Shop ID, and Pairing Token into the agent desktop UI.
4. Confirm agent status changes to `ONLINE` in the Shop Dashboard.
5. In the desktop app, click **Run Diagnostic Print Test** to confirm physical printer alignment.

### Step 7: End-to-End Pilot Test Order
1. Open the shop print portal: `https://printflow-staging.vercel.app/shop/<shopSlug>/print`.
2. Upload a test 2-page PDF. Confirm quote calculation.
3. Click **Proceed to Payment**. Complete payment using Razorpay Test Card credentials (`4111 1111 1111 1111`, OTP `123456`).
4. Confirm payment verification transitions job to `QUEUED`.
5. Observe desktop agent claim: `ASSIGNED` → `DOWNLOADING` → `SPOOLING` → `PRINTED`.
6. Confirm physical paper feeds and prints cleanly.
7. Confirm status updates in Shop Dashboard to `COMPLETED` and staged temporary spool files are deleted.

---

## 6. Remaining Launch Blockers

1. **Staging Cloud Infrastructure Provisioning**: Deploying the backend container and configuring the staging database requires cloud provider account access (Render/Railway/Vercel).
2. **Windows Code Signing Certificate**: Code signing (`signAndEditExecutable: false`) must be enabled with an EV/OV certificate before public release to eliminate Windows SmartScreen prompts.
3. **Physical Counter PC Hardware Execution**: The diagnostic test print and physical spool verification must be executed by the shop operator on the actual counter hardware.

