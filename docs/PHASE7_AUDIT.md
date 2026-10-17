# PrintFlow Phase 7 Audit: Controlled Production Pilot

**Audit Date**: October 2026  
**Auditor**: Senior Full-Stack Engineering Agent (Google Antigravity)  
**Project**: PrintFlow SaaS (`C:\Users\viraj\Downloads\printflow`)  
**Scope**: Controlled production pilot audit, deployment configuration validation, hosting topology analysis (Container vs Vercel), Electron agent packaging & code signing, payment-to-print workflow durability, Windows printer hardware boundaries, and launch blocker classification.

---

## 1. Executive Summary

Phase 7 executes a controlled production pilot assessment of PrintFlow prior to public traffic launch. Rather than making speculative claims or bypassing safety guard rails, this audit rigorously distinguishes between **automated test evidence** (code, state machines, and cryptographic invariants verified locally) and **unverified real-world dependencies** (live third-party cloud services, merchant accounts, and physical hardware).

The core platform architecture is solid: all 16 test suites pass cleanly, both frontend client and backend Node server bundles build cleanly, and the Electron Desktop Agent compiles without errors. However, deployment requires strict attention to hosting topologies (due to Vercel's 4.5 MB serverless payload ceiling) and code signing for Windows installers.

---

## 2. Evidence Separation: Automated Proof vs External Dependencies

To maintain absolute engineering integrity, the platform status is partitioned into verified code evidence and unverified external services:

```
┌─────────────────────────────────┬───────────┬────────────────────────────────────────────────────────┐
│ Area                            │ Status    │ Evidence / Verification Basis                          │
├─────────────────────────────────┼───────────┼────────────────────────────────────────────────────────┤
│ Automated Test Suites (16/16)   │ PASS      │ Verified via npm test (0 failures, 100% pass rate)     │
│ TypeScript Typecheck            │ PASS      │ Verified via npm run lint (tsc --noEmit, 0 errors)     │
│ Client SPA Bundle               │ PASS      │ Verified via npm run build (dist/index.html & assets)  │
│ Node.js Server Bundle           │ PASS      │ Verified via esbuild (server.js, 303.9kb bundle)       │
│ Electron Desktop Agent          │ PASS      │ Verified via npm run agent:build (renderer + main)     │
│ Health & Readiness Probes       │ PASS      │ /health and /api/health report status, uptime, svc     │
│ PDF Compressed Object Streams   │ PASS      │ Method C FlateDecode decompresses /ObjStm in PDF 1.5+  │
│ 50MB & 500-Page Limits          │ PASS      │ inspectDocument rejects oversized/corrupted files      │
│ Webhook HMAC Signature Check    │ PASS      │ Verified against raw binary req.rawBody buffer         │
│ Webhook Deduplication           │ PASS      │ Idempotent event ID deduplication in postgres table    │
│ Atomic Job Claims & Collision   │ PASS      │ Row-level locking ensures single-winner lease          │
│ 5-Minute Crash Lease Expiry     │ PASS      │ Expired claims reclaimed after NOW() - INTERVAL 5m     │
│ Ambiguous Spooler Defense       │ PASS      │ REQUIRES_ATTENTION flags set; auto-reprint blocked     │
│ Virtual Printer Filtering       │ PASS      │ PrintSettingsAdapter.isVirtualPrinter filters PDF/Fax  │
│ Multi-Tenant Isolation          │ PASS      │ Cross-tenant document download strictly rejected       │
│ Deep Log Redaction              │ PASS      │ All credentials/tokens scrubbed from stdout & logs     │
├─────────────────────────────────┼───────────┼────────────────────────────────────────────────────────┤
│ Live Neon DB Integration Test   │ BLOCKED   │ DATABASE_URL intentionally protected by safety gate    │
│ Live Supabase Storage Bucket    │ BLOCKED   │ Mock verified; live cloud S3 bucket needs credentials  │
│ Real Customer Card/UPI Charges  │ BLOCKED   │ Synthetic HMAC verified; live charges need sandbox card│
│ Physical Paper Spool Output     │ BLOCKED   │ Host printers detected; physical paper needs operator  │
│ Windows Agent Code Signing      │ BLOCKED   │ signAndEditExecutable: false; needs EV/OV certificate  │
└─────────────────────────────────┴───────────┴────────────────────────────────────────────────────────┘
```

---

## 3. Deployment Configuration & Hosting Topology Audit

### 3.1 The Vercel Serverless Function Payload Constraint
A critical finding during this audit is the limitation of deploying PrintFlow entirely on Vercel:
- **Vercel Serverless Function Limit**: Vercel enforces a strict **4.5 MB maximum payload size** on request bodies passed to serverless functions.
- **PrintFlow Requirement**: Customer print documents can be up to **50 MB** (`MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024`).
- **Conflict**: If customer uploads at `/api/guest/checkout/:jobId/upload` are dispatched to an Express handler running as a Vercel Serverless Function, any PDF larger than 4.5 MB will fail with `413 Payload Too Large`.
- **Additional Serverless Challenges**:
  - Ephemeral serverless invocations create and destroy database connections rapidly, stressing Neon PostgreSQL connection limits.
  - Desktop agents poll `GET /api/agent/jobs` every 3–5 seconds; running this through serverless functions produces high invocation volume and cold starts.
  - In-memory background lease recovery timers cannot run on frozen serverless containers.

### 3.2 Recommended Production Topology
1. **Cloud Backend**: Deploy containerized Node.js/Express service (via Google Cloud Run, AWS ECS/Fargate, Render, or Railway) where `server.js` runs with a persistent `pg` connection pool (`max: 10`) and 70 MB request body limit.
2. **Frontend Client**: Deploy `dist/` either statically from the Node container (`express.static`) or as a static SPA on Vercel/Cloudflare Pages with API rewrites pointing to the Cloud Run/Render backend.

### 3.3 Electron Windows Agent Distribution Audit
- In `print-agent/electron-builder.yml`:
  - `target: nsis (x64)` produces a standard Windows installer (`PrintFlow Agent-Setup-<version>.exe`).
  - `publish.url: https://printflow.cloud/downloads/agent/` configures generic HTTP auto-updates.
  - `signAndEditExecutable: false`: Code signing is currently disabled.
  - **Risk**: Without code signing, Windows SmartScreen will display an "Unknown Publisher / Untrusted App" prompt during shop operator installation.

---

## 4. End-to-End Payment-to-Print Workflow Audit

The 10-stage payment-to-print workflow was audited against source code and regression tests:

1. **Document Upload**:
   - Client sends base64 payload to `POST /api/guest/checkout/:jobId/upload`.
   - Server checks guest tracking token via `getGuestCheckoutRepository().verifyGuestToken()`.
   - `inspectDocument` validates magic bytes, checks for `/Encrypt`, parses page tree or `/ObjStm` FlateDecode streams, and rejects uploads > 50 MB or > 500 pages.
   - File is staged to Supabase Storage at `shops/{shopId}/jobs/{jobId}/files/{fileId}.ext` and recorded in `public.uploaded_files`.
2. **Authoritative Quote**:
   - `POST /api/guest/checkout/:jobId/quote` loads verified file records and shop's active pricing rules.
   - Computes subtotal: copies * (pages * per_page_rate), color modifier, duplex rate.
   - Enforces `shop.min_order_amount`.
   - Writes immutable quote snapshot with expiration timestamp in `public.quote_snapshots`.
3. **Razorpay Order Creation**:
   - `POST /api/payment/create-order` retrieves active quote snapshot.
   - Decrypts shop's Razorpay credentials using `MASTER_ENCRYPTION_KEY`.
   - Creates Razorpay order with purpose `CUSTOMER_PRINT` and returns order ID to client.
4. **Payment Verification**:
   - Client submits payment signature to `POST /api/payment/verify`.
   - Server verifies timing-safe HMAC-SHA256 across `order_id|payment_id`.
   - Enters single PostgreSQL transaction:
     - Updates `payment_orders` to `PAID`.
     - Transitions `public.print_jobs` from `PAYMENT_PENDING` to `QUEUED`.
     - Enqueues record into `print_agent_jobs`.
   - Re-verification of already `PAID` order returns success idempotently without re-queuing.
5. **Webhook Integrity**:
   - `POST /api/payment/webhook` strictly validates `x-razorpay-signature` against `req.rawBody`.
   - Checks `public.razorpay_webhook_events` to deduplicate replayed events.
   - Rejects out-of-order `payment.failed` transitions on already `PAID` orders.
6. **Agent M2M Claim**:
   - Desktop agent authenticates via Bearer token (`agt_tok_...`).
   - `POST /api/agent/jobs/:id/claim` executes row-level update:
     `WHERE print_status = 'QUEUED' OR (print_status IN ('ASSIGNED', 'DOWNLOADING') AND claimed_at < NOW() - INTERVAL '5 minutes')`.
   - Competing agents receive 409 Conflict.
7. **Document Download**:
   - `GET /api/agent/jobs/:id/file` streams document from Supabase Storage.
   - Verifies agent belongs to the job's shop; cross-tenant requests return 403 Forbidden.
8. **Spooling to Printer**:
   - Agent validates printer online status and capability match (color, duplex, paper size).
   - Spools document via SumatraPDF engine.
   - Unlinks staged temporary spool files in a `finally` block immediately after spooling.
9. **Ambiguous Spooler Outcome Protection**:
   - If spooler accepts bytes (`submitted === true`) but Windows times out:
   - Sets `print_status = 'REQUIRES_ATTENTION'` and `retrySafe = false`.
   - Automatic re-print is strictly blocked to prevent double-billing and paper waste.
10. **Reconciliation & Refunds**:
    - Disputed payments can be manually reconciled via `POST /api/admin/payments/:orderId/reconcile`.
    - Manual refunds are recorded in `public.refund_records` with audit lifecycle tracking.

---

## 5. Security & Observability Audit

- **Observability**: Added `/health` and `/api/health` probes reporting server status, uptime, database configuration state, and storage configuration state. Zero sensitive credentials or URLs are exposed.
- **Structured Redaction**: Verified that `deepRedact` cleans all sensitive fields (`keySecret`, `webhookSecret`, `token`, `password`, `signature`, `encrypted_key_secret`) from server logs and diagnostics.
- **Tenant Isolation**: Guest capability tokens are cryptographically hashed with SHA-256 and checked against the session shop ID. Agent tokens are hashed and validated with timing-safe comparison.

---

## 6. Prioritized Launch Blockers

Before initiating the public production launch, the following operational blockers must be resolved in order:

### Blocker 1: Live Neon PostgreSQL Migrations
- **Status**: Migration scripts 001 through 005 are tested and verified via mock clients.
- **Requirement**: Platform DevOps must execute migrations against the live Neon database using the administrative migration runner or Neon console.

### Blocker 2: Supabase Private Storage Bucket Configuration
- **Status**: Code implementation and mock tests are complete.
- **Requirement**: Create the private `print-documents` bucket in the Supabase Dashboard, enable Row Level Security (RLS), disable public read access, and configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the production environment.

### Blocker 3: Live Razorpay Merchant Credentials & Webhooks
- **Status**: Gateway integration, encryption, and raw-body HMAC signature validation are verified.
- **Requirement**: Shop owners must input their merchant `Key Id` and `Key Secret` via `/shop/settings`, and configure the webhook endpoint (`https://<domain>/api/payment/webhook`) with secret in the Razorpay Dashboard.

### Blocker 4: Windows Electron Agent Code Signing
- **Status**: Electron package builds cleanly.
- **Requirement**: Configure an EV/OV code signing certificate (`CSC_LINK` / `CSC_KEY_PASSWORD`) in the build pipeline to prevent Windows SmartScreen security warnings during shop onboarding.

### Blocker 5: Counter PC Hardware Pairing & Alignment Test
- **Status**: Agent pairing, queue recovery, and virtual printer filtering are verified.
- **Requirement**: Shop counter operators must install the agent on the physical counter PC, pair with their shop token, and run the Diagnostic Alignment Print Test.

