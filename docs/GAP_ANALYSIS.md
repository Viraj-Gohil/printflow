# PrintFlow Cloud: Integration Gap Analysis

**Document Type:** Gap Analysis & Required Engineering Tasks  
**Target:** Windows Electron Print Agent & Backend Sync  
**Verified Source Code:** `server.ts`, `src/types/index.ts`, `src/lib/electronAgentSecurity.ts`, `src/components/shop/ShopPrintAgent.tsx`, `src/components/shop/ShopPrinters.tsx`, `supabase/migrations/001_initial_schema.sql`  

---

## 1. Verified Capabilities vs. Implementation Gaps

| Requirement | Existing Implementation | Source Evidence | Gap | Required Change |
|---|---|---|---|---|
| **Agent Registration** | UI displays pre-configured agent token; mock token rotation exists. Schema defines `public.devices`. | `ShopPrintAgent.tsx`, `001_initial_schema.sql` (lines 97–108), `electronAgentSecurity.ts` | No dynamic device pairing code in UI (e.g. entering a 6-digit shop code on desktop to auto-enroll). | Implement dynamic pairing handshake endpoint or allow copy-pasting existing `shopId` + `authToken` in desktop agent settings. |
| **Device Authentication** | M2M Bearer tokens with constant-time HMAC comparison and revocation check. | `server.ts` (lines 2330–2363), `src/lib/electronAgentSecurity.ts` (lines 120–157) | Fully implemented on backend. Desktop agent needs secure local storage. | Build Windows DPAPI wrapper via Electron `safeStorage` to encrypt tokens locally on the counter PC. |
| **Agent Heartbeat** | `POST /api/agent/heartbeat` rate-limited to 60 req/min, updates `lastHeartbeatAt` and status. | `server.ts` (lines 2330–2363) | Implemented on backend. Desktop background worker not yet built. | Implement background timer in Electron Main to call heartbeat every 15–30 seconds with printer telemetry. |
| **Job Discovery** | `GET /api/agent/jobs` filters by `shopId` and verifies tenant ownership. | `server.ts` (lines 2366–2382) | Server currently returns static `jobs: []` array placeholder; must query real queue. | Connect `GET /api/agent/jobs` to PostgreSQL `print_jobs` where `shop_id = device.shopId` and `print_status = 'QUEUED'`. |
| **Job Claiming & Assignment** | `POST /api/agent/jobs/:id/claim` checks device credentials and returns claim confirmation. | `server.ts` (lines 2385–2401) | In-memory mock response; does not update `print_jobs.print_status` to `ASSIGNED` in DB. | Add atomic SQL update: `UPDATE print_jobs SET print_status = 'ASSIGNED', assigned_printer_id = ... WHERE id = :id AND print_status = 'QUEUED'`. |
| **Secure Document Download** | `GET /api/storage/files/:shopId/:jobId/:fileId` checks HMAC signed token and M2M agent headers with tenant IDOR check. | `server.ts` (lines 1589–1650) | Fully implemented and secure. Agent simply needs to pass its headers during download. | Use `axios` or native Node.js `https` in Electron Main with `x-agent-id` and `x-agent-token` headers. |
| **Printer Capability Management** | Dashboard displays printer capabilities (paper sizes, color, duplex). Schema supports JSONB capabilities. | `ShopPrinters.tsx`, `001_initial_schema.sql` (lines 111–123) | Agent cannot currently push detected Windows printers automatically to the backend. | Create endpoint `POST /api/agent/printers/sync` to allow agent to auto-register discovered Windows printers. |
| **Job Progress Reporting** | `POST /api/agent/jobs/:id/status` validates transitions (`DOWNLOADING`, `PRINTING`, `COMPLETED`, `FAILED`). | `server.ts` (lines 2404–2425) | Server validates status string but does not yet mutate database rows or notify web socket. | Update database row `print_jobs.print_status` and update `updated_at` timestamp upon receiving status. |
| **Failure Recovery** | UI tracks `FAILED` and `PRINT_INTERRUPTED` states. | `src/types/index.ts` (lines 15–26) | Desktop agent crash or network drop could leave jobs hanging in `PRINTING` or `ASSIGNED`. | Implement local SQLite state database on Windows and a server-side 10-minute timeout to release stalled claims back to `QUEUED`. |
| **Duplicate-Print Prevention** | Order status validation prevents re-running paid jobs; atomic claim endpoint designed. | `server.ts` (lines 1076–1097, 2385–2401) | No local tracking on the Windows PC to detect if a file was already spooled before an agent restart. | Store spooled job IDs in local SQLite with Windows Spooler Job ID confirmation. |
| **Multi-Printer Support** | SaaS plan quotas define `printerLimit` (1 to 5+); `ShopPrinters.tsx` supports multi-printer management. | `ShopPrinters.tsx` (lines 24–30), `001_initial_schema.sql` (lines 34, 111) | Fully supported in data model. Desktop agent needs routing logic to map job `assignedPrinterId` to correct Windows printer name. | Implement printer mapping dictionary in Electron local config (`settings.printers: { [backendPrinterId]: "Windows Printer Name" }`). |
| **Shop-Owner Monitoring** | `ShopPrintAgent.tsx` displays device host, agent version, connected printer count, and heartbeat status. | `ShopPrintAgent.tsx` (lines 78–102) | Polling interval currently fixed in UI; needs live sync. | Ensure `electronDeviceRegistry` status is returned dynamically when shop owner views dashboard. |
| **Device Revocation** | `POST /api/agent/:agentId/revoke` sets `isRevoked: true` and blocks all future M2M requests. | `server.ts` (lines 2438–2445), `src/lib/electronAgentSecurity.ts` (lines 162–170) | Fully implemented on backend. Desktop agent needs clean disconnect handler upon receiving 403. | Handle 403 Forbidden in Electron Main: pause polling, clear local job queue, and show "Device Revoked by Admin" in tray UI. |
| **Windows Startup & Recovery** | `ShopPrintAgent.tsx` documents Windows service installation steps. | `ShopPrintAgent.tsx` (lines 175–193) | Electron app installer, system tray manager, and auto-launch on boot not yet created. | Configure `electron-builder` with NSIS installer and configure `auto-launch` npm package for Windows Registry startup. |

---

## 2. Priority Checklist for Electron Agent Implementation

### Priority 1: Backend Sync Hardening (Minor Enhancements to `server.ts`)
1. Connect `GET /api/agent/jobs` to real database rows (`public.print_jobs`) filtered by `shop_id` and `print_status = 'QUEUED'`.
2. Connect `POST /api/agent/jobs/:id/claim` to atomically set `print_status = 'ASSIGNED'`.
3. Connect `POST /api/agent/jobs/:id/status` to update `print_jobs.print_status` and `print_jobs.updated_at`.
4. Add `POST /api/agent/printers/sync` to accept discovered printers from the desktop agent.

### Priority 2: Windows Electron Application (`printflow-agent`)
1. **Core Electron Setup:** Electron 34+ with TypeScript, Vite/React desktop UI, secure preload bridge (`contextIsolation: true`, `nodeIntegration: false`).
2. **Local Credential Storage:** Encrypt shop ID and bearer token using Windows DPAPI (`safeStorage`).
3. **Printer Discovery:** Detect installed Windows printers via `webContents.getPrintersAsync()` and report to backend.
4. **Resilient Polling Engine:** Background timer polling `/api/agent/jobs` every 3–5 seconds with exponential backoff on network errors.
5. **Safe Download & Silent Print:** Download document via authenticated stream, verify checksum, execute silent print via `pdf-to-printer`, and securely wipe local temp file immediately.
6. **Local SQLite Persistence:** Use `better-sqlite3` to track spooling state and prevent duplicate printing across PC reboots.
7. **Packaging & Windows Installer:** Configure `electron-builder` for NSIS 64-bit installer (`PrintFlow-Agent-Setup.exe`) with auto-start on Windows boot.
