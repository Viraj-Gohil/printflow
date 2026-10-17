# PrintFlow Production Readiness Guide

**Target Audience**: DevOps Engineers, Platform Administrators, and Site Reliability Engineers  
**System**: PrintFlow Cloud Print SaaS & Desktop Agent  
**Revision**: Phase 7 — Controlled Production Pilot  

---

## 1. System Architecture & Topology

PrintFlow is an enterprise SaaS platform connecting self-service customer print workflows directly to in-shop physical printers via an authenticated desktop agent.

```
                      ┌───────────────────────────────┐
                      │    Customer Mobile / Web      │
                      │  (QR Scan / Guest Checkout)   │
                      └──────────────┬────────────────┘
                                     │ HTTPS
                                     ▼
                      ┌───────────────────────────────┐
                      │       PrintFlow Cloud         │
                      │       (Node.js/Express)       │
                      └───┬──────────┬────────────┬───┘
                          │          │            │
            PostgreSQL    │          │ S3 API     │ Webhook / API
                          ▼          ▼            ▼
                    ┌──────────┐ ┌─────────┐ ┌──────────┐
                    │   Neon   │ │Supabase │ │ Razorpay │
                    │ Database │ │ Storage │ │ Gateway  │
                    └──────────┘ └─────────┘ └──────────┘
                          ▲
                          │ M2M Polling & Claim (HTTPS)
                          │ (Lease Concurrency & Auth)
                          │
                      ┌───┴───────────────────────────┐
                      │  PrintFlow Electron Agent     │
                      │  (Windows 10/11 Desktop Svc)  │
                      └──────────────┬────────────────┘
                                     │ Windows Print Spooler
                                     ▼
                      ┌───────────────────────────────┐
                      │   Physical Shop Printers      │
                      │   (Thermal / Laser / Xerox)   │
                      └───────────────────────────────┘
```

---

## 2. Environment Configuration & Secret Management

In production (`NODE_ENV=production`), the application runs strictly in **fail-closed** mode. If required secrets or database connections are absent, the server refuses to initialize or accept insecure requests.

### Required Production Environment Variables

| Variable | Description | Security Requirements |
| :--- | :--- | :--- |
| `NODE_ENV` | Must be `production`. | Enforces strict error shielding and disables in-memory fallbacks. |
| `PORT` | Listening port (default `3000`). | Bound to private reverse proxy (e.g. Caddy, Nginx). |
| `DATABASE_URL` | Neon PostgreSQL pooled connection string. | Must include `sslmode=require` or `sslmode=verify-full`. |
| `MASTER_ENCRYPTION_KEY` | 32-byte hexadecimal key (64 hex chars) or secret string. | Used for AES-256-GCM encryption of shop Razorpay secrets (aliases `PAYMENT_CREDENTIAL_ENCRYPTION_KEY`). |
| `COOKIE_SECRET` | Cryptographically random string (min 32 chars). | Used to sign session cookies. |
| `ADMIN_RAZORPAY_KEY_ID` | Central PrintFlow Razorpay Key ID (`rzp_live_...`). | Platform subscription billing. |
| `ADMIN_RAZORPAY_KEY_SECRET`| Central PrintFlow Razorpay Key Secret. | Platform subscription billing. |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured in Razorpay Webhook Dashboard. | Cryptographic HMAC-SHA256 raw-body validation. |
| `SUPABASE_URL` | Supabase Project API URL (`https://xyz.supabase.co`). | Customer document private storage. |
| `SUPABASE_SERVICE_ROLE_KEY`| Supabase Service Role Key with storage admin rights.| Kept strictly server-side; NEVER exposed to frontend. |
| `SUPABASE_STORAGE_BUCKET` | Bucket name for documents (default `print-documents`).| Private bucket with RLS enabled; public access disabled. |

> [!CAUTION]
> Never commit `.env` or paste live secrets into source control, logs, or reports. The system automatically redacts known key patterns (`keySecret`, `token`, `password`, `signature`, `encrypted_key_secret`) from server logs and diagnostics.

---

## 3. Database Migration Procedures

Database migrations are tracked in `supabase/migrations/` and executed authoritatively by `src/db/migrations.ts`.

### Migration Ordering
1. `001_initial_schema.sql`: Base tables (`shops`, `profiles`, `printers`, `pricing_rules`, `print_jobs`).
2. `002_durable_checkout_foundation.sql`: Checkout capabilities, quotes, payment orders, uploaded files, claims.
3. `003_phase2_shop_api_support.sql`: Subscriptions, plans, agent devices, app state.
4. `004_phase3_storage_and_guest_checkout.sql`: Storage bucket defaults, retention indexes.
5. `005_phase4_payment_reliability.sql`: Reconciliation tracking, manual refunds.

### Safety Gate for Automated Testing
Automated tests will **never** connect to or execute migrations against `DATABASE_URL`. Testing requires explicit configuration of:
```bash
PRINTFLOW_TEST_DATABASE_URL=postgres://...
PRINTFLOW_TEST_DATABASE_CONFIRM=ISOLATED_TEST_DATABASE
```
When absent, test suites safely report `BLOCKED (Safe)` for live database access while running unit and mock verification.

---

## 4. Electron Print Agent Operations

### 4.1 Device Pairing
1. In the Shop Admin Dashboard (`/shop/agent`), the shop owner clicks **Generate Pairing Token**.
2. The server issues a secure, short-lived token stored as a SHA-256 hash in `print_agent_devices`.
3. The shop operator enters the backend URL, Shop ID, and token into the Electron Agent desktop interface.
4. The Agent registers its hardware identity and receives a permanent machine-to-machine authentication token (`agt_tok_...`).

### 4.2 Job Claiming & Concurrency Leases
- Multiple desktop agents within the same shop may poll `GET /api/agent/jobs`.
- When an agent claims a job via `POST /api/agent/jobs/:id/claim`, PostgreSQL executes an atomic row-level lock:
  ```sql
  UPDATE print_agent_jobs
  SET print_status = 'ASSIGNED', claimed_by = $3, claimed_at = $4
  WHERE job_id = $1 AND shop_id = $2
    AND (print_status = 'QUEUED' OR (print_status IN ('ASSIGNED', 'DOWNLOADING') AND claimed_at < NOW() - INTERVAL '5 minutes'))
  ```
- **Crash Recovery**: If an agent claims a job but terminates abruptly before completing the print, the claim lease expires after **5 minutes**, allowing backup agents to safely reclaim the job.

### 4.3 Ambiguous Print Spooler Defense
Physical printers can experience paper jams, network timeouts, or spooler desynchronization.
- If the Windows spooler accepts bytes but times out before confirming job completion (`submitted === true`, `success === false`), the agent sets `print_status = 'REQUIRES_ATTENTION'` and `retrySafe = false`.
- **Under no circumstances does the system silently re-print ambiguous jobs**, preventing double-billing and paper waste. The shop operator must physically inspect the printer tray before re-queuing.

### 4.4 Local File Cleanup
- Downloaded documents are staged in `%TEMP%\PrintFlow_Spool` with strict file permissions (`0o600`).
- The agent unlinks staged spool files in a `finally` block immediately after spooling or failure.
- On agent startup, `CrashRecoveryManager.cleanStaleSpoolFiles()` automatically purges any orphaned files older than 24 hours.

---

## 5. Payment Reliability & Reconciliation

### 5.1 Account Separation
- **Platform Subscriptions**: Processed using platform admin Razorpay credentials (`platform_payment_configs`). Funds deposit into the platform account.
- **Customer Print Orders**: Processed using each shop's configured Razorpay account (`shop_payment_integrations`). Funds deposit directly to the shop merchant account.

### 5.2 Payment Verification & Webhook Handling
- Verification requires timing-safe HMAC-SHA256 signature calculation across the exact payload (`order_id|payment_id`).
- Webhook endpoints verify signatures against the raw binary request body buffer (`req.rawBody`).
- Out-of-order webhook deliveries are defended: once an order is marked `PAID`, delayed or failed events cannot regress the order state.

### 5.3 Operator Reconciliation Runbook
If a customer claims payment was deducted but the order status is unconfirmed:
1. Navigate to Platform Admin (`/admin/payments/reconciliation`) or call `GET /api/admin/payments/unresolved`.
2. Locate the provider order ID (`order_...`).
3. Click **Reconcile Order** (`POST /api/admin/payments/:orderId/reconcile`).
4. The server queries the Razorpay API directly, verifies captured funds, transitions the order to `PAID`, queues the print job, and records an audit event.

---

## 6. Document Inspection & Storage

- **PDF 1.5+ Support**: `inspectPdf` parses both uncompressed page trees and compressed FlateDecode object streams (`/ObjStm`), preventing false rejections on modern PDFs.
- **Security Bounds**: Uploads are capped at 50 MB and 500 pages. Encrypted/password-protected PDFs are rejected fail-closed with user-facing guidance.
- **Retention Lifecycle**: Uploaded files in `public.uploaded_files` have a default retention of 7 days (`retention_expires_at`). The scheduled purge worker marks expired files as `DELETED` and removes objects from Supabase Storage.

---

## 7. Manual Runbook: Real Razorpay Live/Test Gateway & Webhook Validation

Follow this step-by-step procedure to validate live or test Razorpay integration without triggering unauthorized charges.

### Step 1: Shop Merchant Account Setup & API Key Generation
1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Switch to **Test Mode** (or Live Mode if deploying to production).
3. Navigate to **Account & Settings** → **API Keys** → **Generate Key**.
4. Note down the `Key Id` (`rzp_test_...` or `rzp_live_...`) and `Key Secret`.

### Step 2: Key Encryption & Secure Storage in Shop Admin
1. Open the PrintFlow Shop Dashboard at `/shop/settings` (or via API `PUT /api/shop/payment-settings`).
2. Provide the `Key Id` and `Key Secret`.
3. Verify that the server encrypts the secret using AES-256-GCM via `MASTER_ENCRYPTION_KEY` before persisting to `shop_payment_integrations`.
4. Check that the UI only displays the masked key (e.g. `rzp_test_...abcd`) and never exposes the secret.

### Step 3: Test Payment Checkout Verification
1. Access the shop's public print portal: `/shop/<shopId>/print`.
2. Upload a valid test PDF document.
3. Verify that the server calculates the quote accurately based on the shop's active pricing rules.
4. Click **Proceed to Payment**. Confirm the Razorpay Checkout modal launches with the shop's Key ID.
5. In Test Mode, use Razorpay test credentials (e.g. Test Card `4111 1111 1111 1111`, any future expiry, OTP `123456`).
6. Confirm that on successful payment, the frontend sends `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to `POST /api/payment/verify`.
7. Verify that the response returns HTTP 200, transitions `payment_orders` to `PAID`, and enqueues the job into `print_agent_jobs`.

### Step 4: Webhook Configuration & Testing
1. In Razorpay Dashboard, go to **Account & Settings** → **Webhooks** → **Add New Webhook**.
2. Webhook URL: `https://<your-printflow-domain>/api/payment/webhook`.
3. Secret: Enter a strong random secret and copy it to `RAZORPAY_WEBHOOK_SECRET` in `.env`.
4. Active Events: Select `payment.captured`, `order.paid`, `payment.failed`.
5. Trigger a test event from the Razorpay dashboard or use the Razorpay CLI:
   ```bash
   curl -X POST https://<your-printflow-domain>/api/payment/webhook \
     -H "Content-Type: application/json" \
     -H "x-razorpay-signature: <computed-hmac-sha256>" \
     -d '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test_123","order_id":"order_test_123","status":"captured"}}}}'
   ```
6. Verify the server logs report `Webhook event processed: payment.captured` and HTTP 200 is returned.

### Step 5: Duplicate Event & Out-of-Order Defense Verification
1. Re-send the exact same webhook payload.
2. Confirm the server returns HTTP 200 with `{ deduplicated: true }` or ignores the replay without duplicating jobs.
3. Send a simulated `payment.failed` event for an already `PAID` order. Verify that the server logs a warning and does not regress the order status.

---

## 8. Manual Runbook: Physical Windows Printer Installation, Pairing & Diagnostic Validation

Follow this procedure to configure real Windows print hardware for shop deployment.

### Step 1: Physical Printer Installation & Driver Setup
1. Connect the printer to the Windows counter PC via USB or local network (Ethernet/Wi-Fi).
2. Install the manufacturer's official Windows 10/11 64-bit drivers (e.g. HP, Canon, Epson, Brother, TVS).
3. In Windows **Settings** → **Bluetooth & devices** → **Printers & scanners**, verify the printer appears as **Online** and **Ready**.
4. Print a Windows Test Page from the printer properties dialog to confirm physical paper feed and ink/toner.

### Step 2: Virtual Queue Filtering Verification
1. Open PowerShell and run:
   ```powershell
   Get-Printer | Select-Object Name, PortName, DriverName
   ```
2. Note all listed printers. Software virtual printers (e.g., `Microsoft Print to PDF`, `OneNote (Desktop)`, `Fax`) must NOT be designated as shop physical printers.
3. The PrintFlow Agent automatically applies `PrintSettingsAdapter.isVirtualPrinter` regex to filter out virtual queues.

### Step 3: Electron Agent Pairing
1. On the counter PC, launch the PrintFlow Electron Agent (`printflow-agent.exe` or `npm run agent:start`).
2. From the Shop Web Dashboard (`/shop/agent`), generate a new pairing token.
3. Enter the Backend Server URL, Shop ID, and Pairing Token into the desktop agent setup screen.
4. Click **Connect & Register**.
5. Verify in the Shop Dashboard that the agent appears as **Online** with its hardware hostname and device ID.

### Step 4: Printer Capability Mapping
1. In the Agent UI or Shop Dashboard Printer Management, select the connected physical printer.
2. Verify detected capabilities:
   - Paper sizes: `A4`, `Letter`, `Legal`.
   - Color capability: `Monochrome` or `Color`.
   - Duplex capability: `Simplex` or `Duplex` (Long-edge / Short-edge).
3. Save printer settings.

### Step 5: End-to-End Diagnostic Print Test
1. In the PrintFlow Agent desktop app, click **Run Diagnostic Print Test**.
2. The agent generates a 1-page alignment diagnostic document and dispatches it to the printer spooler.
3. Verify that:
   - Paper feeds and prints cleanly without clipping margins.
   - The agent status transitions: `IDLE` → `CLAIMED` → `DOWNLOADING` → `SPOOLING` → `PRINTED` → `IDLE`.
   - Staged temporary files in `%TEMP%\PrintFlow_Spool` are unlinked immediately after spooling.

### Step 6: Spooler Hardware Failure Diagnostics
1. **Paper Out / Disconnected Cable Simulation**:
   - Disconnect the USB cable or empty the paper tray.
   - Dispatch a test job.
   - Confirm the agent logs spooler error and updates job status to `FAILED` with retry capability.
2. **Ambiguous Spooler Timeout Simulation**:
   - If the Windows spooler accepts the file but hangs:
   - Confirm the agent flags `print_status = 'REQUIRES_ATTENTION'` and marks `retrySafe = false`.
   - Verify that no duplicate print is triggered until the operator clears the queue manually.

---

## 9. Hosting & Deployment Topology Comparison (Container vs Vercel Serverless)

Selecting the correct production hosting environment is critical for PrintFlow's architectural requirements.

### Architecture Comparison

| Requirement | Dedicated Container / VM (Recommended) | Vercel Serverless |
| :--- | :--- | :--- |
| **Target Platform** | Google Cloud Run, AWS ECS/Fargate, Render, Railway, Docker | Vercel Serverless Functions |
| **Max Upload Body** | Configurable (configured for 70 MB limit in `server.ts`) | **Hard Limit: 4.5 MB** on Serverless Functions |
| **Customer PDF Uploads** | Up to 50 MB PDFs handled directly | **BLOCKED**: Uploads > 4.5 MB return 413 Payload Too Large unless presigned URLs are used |
| **Database Connection** | Persistent `pg` Pool (`max: 10`) | Ephemeral serverless connections (can exhaust Neon pool) |
| **Agent Long Polling** | Continuous HTTP polling supported without cost penalty | High serverless execution count and duration limits |
| **Background Leases** | 5-minute lease cleanup loops run smoothly | Invocations freeze when idle; background timers cannot run |

> [!IMPORTANT]
> **Recommended Production Topology**:  
> - **Backend API & Webhook Service**: Deploy on a containerized service (Google Cloud Run or Render/Railway/AWS ECS) where the full Express server runs with connection pooling and 70 MB body parsing.  
> - **Frontend Web App**: Can either be served statically by the backend container (`express.static('dist')`) or deployed to Vercel/Cloudflare Pages as a static SPA routing `/api/*` to the container backend.

---

## 10. Electron Windows Agent Distribution & Code Signing

The Windows Print Agent is packaged using `electron-builder`:
- **Configuration File**: `print-agent/electron-builder.yml`
- **Output Target**: NSIS Windows 64-bit installer (`PrintFlow Agent-Setup-<version>.exe`)
- **Distribution Directory**: `print-agent/release/`
- **Auto-Update Endpoint**: Configured for `https://printflow.cloud/downloads/agent/`

### Code Signing Requirement for Public Release
In `print-agent/electron-builder.yml`:
```yaml
win:
  signAndEditExecutable: false
```
Code signing is currently unconfigured (`false`).  
**Operational Impact**: When shop operators download the installer, Windows SmartScreen will display an "Unknown Publisher / Untrusted App" prompt.  
**To Enable Code Signing Prior to Public Launch**:
1. Obtain an EV (Extended Validation) or OV code signing certificate.
2. Configure environment variables in the CI/CD build pipeline:
   ```bash
   CSC_LINK="path/to/certificate.p12"
   CSC_KEY_PASSWORD="certificate_password"
   ```
3. Set `signAndEditExecutable: true` in `electron-builder.yml`.

---

## 11. Disaster Recovery & Operational Rollback Procedures

### 11.1 Web Application & Backend Rollback
If a deployment defect is detected in the cloud backend:
1. **Container Image Rollback**:
   - Revert traffic to the previous healthy container revision in Cloud Run / ECS / Render dashboard.
   - Traffic shift is instantaneous (0 downtime).
2. **Static Asset Rollback**:
   - Re-deploy the previously verified build artifacts from `dist/` and `server.js`.
3. **Health Check Validation**:
   - Query `GET /api/health` to confirm `status: 'ok'`, `database: 'configured'`, and `storage: 'configured'`.

### 11.2 Database Migration Rollback Policy
PrintFlow uses authoritative forward-only migrations tracked in `public.schema_migrations`:
- **DDL Safety**: All migrations execute inside explicit transactions with advisory locking (`pg_advisory_lock(7_201_260_017)`).
- **Never Drop Applied Tables in Production**: If a schema change requires alteration, author a new forward migration (e.g. `006_fix_...sql`) rather than editing or deleting applied migrations. Checksum mismatches cause `src/db/migrations.ts` to abort startup.
- **Point-In-Time Recovery (PITR)**: Neon provides instant branching and point-in-time recovery. In the event of catastrophic data corruption:
  1. Go to Neon Console → Branches → Create Branch from Point in Time (prior to incident).
  2. Test and verify the recovered branch.
  3. Update `DATABASE_URL` to point to the recovered branch.

### 11.3 Windows Desktop Agent Rollback
If a new agent version introduces print spooling errors:
1. Re-upload the previous stable installer (`PrintFlow Agent-Setup-1.4.1.exe`) and `latest.yml` to the update server (`https://printflow.cloud/downloads/agent/`).
2. Have affected shop operators run the installer over the existing installation.
3. Local configuration in `%APPDATA%\PrintFlow_Agent\config.json` is preserved across reinstalls, so re-pairing is not required.

### 11.4 Emergency Circuit Breakers
If an active security threat or external provider outage occurs:
1. **Payment Gateway Outage**:
   - Update `shop_payment_integrations.is_active = false` via Shop Dashboard.
   - PrintFlow immediately rejects new orders with informative error messaging without charging customers.
2. **Print Agent Revocation**:
   - Click **Revoke Agent** in Shop Admin Dashboard (`POST /api/shops/:shopId/agent/:agentId/revoke`).
   - The server instantly marks `status = 'REVOKED'`, invalidates token hashes, and rejects all subsequent claim and document download requests.

---

## 12. Production Verification Checklist

Before opening the platform to public customer traffic, verify:
- [x] All 16 test suites pass cleanly (`npm test`).
- [x] TypeScript typechecks with 0 errors (`npm run lint`).
- [x] Production build produces valid client `dist/` and server `server.js` (`npm run build`).
- [x] Electron Windows Print Agent builds cleanly (`npm run agent:build`).
- [x] Observability probes (`/health`, `/api/health`) active and reporting service states.
- [x] Database Safety Gate validated for live environments.
- [x] Webhook signature and replay defenses verified.
- [x] Windows spooler ambiguous outcome and lease recovery verified.
- [x] Virtual printer queues excluded from customer dispatch.
- [x] Rollback and emergency circuit breaker procedures documented.



