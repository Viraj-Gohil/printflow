# PrintFlow Agent (Windows Desktop Print Spooler)

The official **PrintFlow Agent** is an Electron.js desktop application for Windows that connects local and network shop printers to the PrintFlow Cloud SaaS platform.

It runs quietly in the system tray, polls for verified paid customer print orders, downloads documents securely via Machine-to-Machine (M2M) bearer authentication, sends supported print settings to the bundled SumatraPDF Windows print engine, and syncs job status back to the shop and customer tracking screens.

---

## 1. Key Capabilities

- **Automated Windows Printer Discovery:** Detects all local, network, and USB printers using PowerShell WMI (`Win32_Printer`) and Electron native device APIs.
- **Printer Inventory:** Discovers installed printers, their Windows-reported state, default status, and driver/port names when available. Color, duplex, and paper-size capabilities remain **Unknown** unless discovery can verify them.
- **Plan-Limited Printer Registration:** Shops can register available printers from the agent up to their active subscription limit. Registered printers sync to the Shop Dashboard; the server checks the plan before accepting changes.
- **M2M Device Authentication:** Backend-issued device tokens are checked during pairing and on authenticated agent requests.
- **Hardware-Backed Credential Security:** Encrypts device tokens with Electron `safeStorage` (DPAPI-backed on Windows); credentials stay in the main process after pairing.
- **Crash Recovery & Queue Resilience:** Local queue recovery data is stored in `jobs_queue.json`. Jobs interrupted before spooler submission can be recovered; jobs interrupted while printing are marked for manual review to avoid duplicate output.
- **Settings-Aware Spooling:** Uses the bundled SumatraPDF print engine for PDF and supported image formats, applying requested page ranges, copies, paper size, color mode, and duplex setting per job.
- **Live Spooling & Reporting:** Updates status in real-time (`DOWNLOADING` → `PRINTING` → `COMPLETED` / `FAILED`). Unconfirmed spooler results are reported as `REQUIRES_ATTENTION` and cannot be blindly retried.
- **Live Shop Queue:** The web dashboard refreshes registered printer inventory and server-backed print job status every three seconds while the shop dashboard is open.
- **System Tray Integration:** Minimizes cleanly to the Windows taskbar notification area with quick action context menus.

---

## 2. Directory Structure

```
print-agent/
├── package.json              # Electron & React dependencies, build & package scripts
├── index.html                # Entry point for Vite renderer
├── vite.config.ts            # Vite bundler configuration for desktop UI
├── tsconfig.json             # TypeScript configuration for Renderer (React)
├── tsconfig.node.json        # TypeScript configuration for Main & Preload (Node/Electron)
├── electron-builder.yml      # Windows NSIS installer configuration
├── src/
│   ├── main/                 # Electron Main Process (Node.js runtime)
│   │   ├── main.ts           # App lifecycle, single instance lock, tray, window management
│   │   ├── preload.ts        # Secure context bridge (contextIsolation: true, nodeIntegration: false)
│   │   ├── agent/
│   │   │   └── PrintAgentService.ts # Main controller coordinating polling, queue, spooler & sync
│   │   ├── api/
│   │   │   └── ApiClient.ts         # Axios/Fetch client with M2M headers, retry & error handling
│   │   ├── printer/
│   │   │   ├── WindowsPrinterManager.ts # PowerShell & WMI / Electron printer discovery & capabilities
│       │   │   └── PrintSettingsAdapter.ts  # Maps order settings into SumatraPDF print options
│   │   ├── queue/
│   │   │   └── JobQueueManager.ts   # Local job queue, state transitions, concurrency limiter
│   │   ├── storage/
│   │   │   ├── LocalDataVault.ts    # Resilient local JSON / SQLite store for config and job recovery
│   │   │   └── SafeStorageVault.ts  # Electron safeStorage / OS Credential Vault for agent token
│   │   ├── security/
│   │   │   └── M2MCrypto.ts         # HMAC signature generator & header sanitization
│   │   ├── recovery/
│   │   │   └── CrashRecoveryManager.ts # Recovery for power outage, paper jams, incomplete prints
│   │   └── logger/
│   │       └── AgentLogger.ts       # Structured logging with file persistence and IPC streaming
│   └── renderer/             # React Sandboxed UI Process
│       ├── main.tsx          # React DOM root
│       ├── App.tsx           # Main application view with real-time status and tabs
│       ├── index.css         # Tailwind CSS styling
│       ├── components/
│       │   ├── Header.tsx           # Status indicator, shop name, quick actions
│       │   ├── Dashboard.tsx        # Queue metrics, active jobs, printer status counters
│       │   ├── QueueView.tsx        # Live jobs table with manual reprint, cancel & progress
│       │   ├── PrintersView.tsx     # Discovered Windows printers & test print trigger
│       │   ├── LogsView.tsx         # Real-time console log viewer with filters & export
│       │   ├── SettingsModal.tsx    # Server URL, Shop ID, Agent Token, Polling interval
│       │   └── StatusBadge.tsx      # Consistent status badges (Online/Offline/Printing)
│       └── types/
│           └── agent.ts             # Shared frontend/main types
```

---

## 3. Quick Start & Development

### Step 1: Install Dependencies
```bash
cd print-agent
npm install
```

### Step 2: Run in Development Mode
To preview the UI in Vite:
```bash
npm run dev
```

### Step 3: Run Full Electron Application
```bash
npm run build
npm start
```

### Step 4: Build Windows Installer (.exe)
```bash
npm run dist
```
The versioned NSIS installer will be generated in `print-agent/release/`.

---

## Legacy pairing example (do not use)

1. Configure `DATABASE_URL` for the web backend, then navigate to **Settings → Print Agent** in the signed-in dashboard.
2. Copy the **Device Authentication Bearer Token** (e.g., `agt_tok_sgx_live_99482`).
3. Open the PrintFlow Agent window on your counter PC.
4. Click the gear icon (**Settings**) in the top right.
5. Enter:
   - **Host URL:** `http://localhost:3000` (or your production cloud URL)
   - **Shop ID:** `shop_shree_ganesh` (or your shop slug)
   - **Auth Token:** Paste your bearer token
   - **Device Name:** `COUNTER-PC01`
6. Click **Pair & Save**. The dashboard appears only after the token validates and an authenticated heartbeat succeeds.

## Current pairing behavior and limitations

1. Configure `DATABASE_URL` for the web backend. Agent credentials are stored in PostgreSQL; the server creates the `print_agent_devices` table during startup.
2. In **Settings → Print Agent** in the signed-in web dashboard, select **Generate / Regenerate Token**. The backend stores a hash in PostgreSQL and invalidates the previous token. The plaintext token is only shown for copying at issuance.
3. In the main web app, open **Shop Dashboard → Settings → Print Agent** and generate/copy the device token there. Paste that existing token together with the exact Shop ID and backend URL into PrintFlow Agent. The desktop app does not issue or rotate tokens.
4. Select **Pair & Save**. The agent validates the token through `/api/agent/pair`, stores it with Electron `safeStorage`, and does not reveal the dashboard until an authenticated heartbeat succeeds. Invalid, revoked, and cross-shop tokens are rejected.
5. HTTP is accepted only for a localhost development backend.

Device credentials, revocation, heartbeat timestamps, and printer inventory are stored in PostgreSQL and survive backend restarts. After a server-verified customer payment, the customer flow now uploads the original PDF/image files and creates a queue entry through `/api/customer/print-jobs`; the endpoint checks the verified order, shop, and paid amount. The agent polls that queue, claims jobs, downloads every file using M2M authentication, and reports status.

With `DATABASE_URL` configured, the existing PostgreSQL `print_agent_jobs` and `print_agent_job_files` tables persist paid jobs and documents transactionally. The in-memory backend fallback is development-only; production paid-order dispatch returns an error when durable queue storage is unavailable. Customer tracking reads backend status using the order's capability token. Physical printer acceptance still depends on the installed driver and hardware; validate an actual printer and its supported options before enabling a new printer in production.

## Desktop application UI and local settings

The desktop UI includes Dashboard, Print Queue, Printers, Live Logs, Profile & Device, Settings, and About pages. Queue search/filter/sort and job details use the local job records; a failed job is retryable only when the agent knows printing did not start. An interrupted or uncertain print must be checked at the physical printer before an operator makes a new print attempt.

Configuration and the encrypted device credential are kept under Electron's application `userData` directory. Non-secret configuration uses a versioned JSON file; heartbeat/sync timestamps and print recovery records are separate local files. The Settings page can reset configuration and credentials without removing recovered jobs. The printer enable/disable action controls use by the PrintFlow Agent only; it does not change the printer's Windows-wide availability. Log export writes a sanitized export of recent in-memory events and does not remove the persistent application log.

Configuration is loaded after Electron is ready so OS-backed credential decryption is available on startup; the agent refreshes the authenticated heartbeat and queue sync after restart.

The desktop package version is taken from `print-agent/package.json`; update that package metadata when cutting a release so the About page and installer identify the same version.

Windows-default-printer changes and server-side device revocation are not exposed by the current backend/agent contract. The agent can select its own target printer and pair again; it does not claim to change the Windows-wide default or revoke a cloud device.
