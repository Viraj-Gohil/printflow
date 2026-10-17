# PrintFlow Agent: Integration & Architecture Plan

**Document:** `PRINT_AGENT_INTEGRATION_PLAN.md`  
**Target Application:** PrintFlow Windows Electron Print Agent (`print-agent/`)  
**Host Application:** PrintFlow Cloud Multi-Tenant SaaS Web Platform  
**Target OS:** Windows 10 / Windows 11 (64-bit)  

---

## 1. Executive Summary & Existing Architecture

The repository contains a PrintFlow web application and Electron agent scaffold. Important operational backend flows remain mocked and are not yet a production print-service integration:
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS.
- **Backend:** Node.js Express server (`server.ts`) running at port 3000.
- **Database:** PostgreSQL via `DATABASE_URL` for payment configuration and PrintFlow Agent device credentials, heartbeat status, and printer inventory; the Supabase schema remains separate.
- **Storage:** Supabase client and storage routes exist, but the agent job-download route is not connected to persistent customer document storage.
- **Payment Verification:** Razorpay payment orders with HMAC-SHA256 signature verification and order tracking.
- **Security & Device M2M:** OS-backed credential storage abstraction, rate limiting, BOLA/IDOR protection, and M2M device authentication tokens (`src/lib/electronAgentSecurity.ts`).

### Order & Print Lifecycle
1. The web UI currently keeps most shop/order data in browser state; its payment APIs are not wired to an agent-readable persistent print queue.
2. Agent credentials, revocation, heartbeat status, and printer inventory are stored in PostgreSQL; print-job routes still use in-process memory and are lost on backend restart.
3. The token issuance and pairing path stores only a token hash in PostgreSQL, validates the issued credential, and requires an authenticated heartbeat before showing the desktop dashboard.
4. Physical print completion, real paid-order retrieval, and authorized document downloads remain unimplemented end-to-end. Do not treat the existing path as production printing.

---

## 2. Reusable APIs, Database Tables & Types

### 2.1 Reusable Backend APIs (`server.ts`)
- **Heartbeat:** `POST /api/agent/heartbeat` (Validates `x-agent-token`, `x-agent-id`, updates `lastSeen` timestamp, returns online status).
- **Pairing:** `POST /api/agent/pair` checks the shop ID and token against the PostgreSQL device registry; arbitrary client tokens cannot self-register.
- **Heartbeat:** `POST /api/agent/heartbeat` validates `x-agent-token` and `x-agent-id`.
- **Fetch/claim/status:** Routes exist but currently operate only on an in-memory job map, which is empty by default and not connected to paid database orders.
- **File download:** The agent download route explicitly fails until persistent authorized document storage is wired.
- **Token management:** Owner-authenticated `POST /api/agent/:agentId/rotate-token` issues/replaces a credential in PostgreSQL; only the hash is persisted.

### 2.2 Reusable Types (`src/types/index.ts`)
- `PrintJob`, `PrintFile`, `PrintStatus`: `'QUEUED' | 'ASSIGNED' | 'DOWNLOADING' | 'PRINTING' | 'COMPLETED' | 'FAILED'`.
- `PrinterDevice`, `PaperSize`: `'A4' | 'A3' | 'A5' | 'Letter' | 'Legal'`.
- `ElectronAgent`: Agent metadata (`id`, `shopId`, `deviceName`, `status`, `version`, `connectedPrintersCount`, `lastSeen`).

---

## 3. Minimal Backward-Compatible Backend Enhancements

The token-to-dashboard flow is implemented. Production integration still requires persistent device credentials/revocation, linking backend print jobs to the actual paid orders, persistent atomic claiming, shop-authorized storage downloads, truthful printer capability discovery, spooler job reconciliation, and Windows hardware tests.

---

## 4. Electron Print Agent Structure (`print-agent/`)

```
print-agent/
├── package.json              # Electron & React dependencies, build & package scripts
├── index.html                # Entry point for Vite renderer
├── vite.config.ts            # Vite bundler configuration for desktop UI
├── tsconfig.json             # TypeScript configuration for Renderer (React)
├── tsconfig.node.json        # TypeScript configuration for Main & Preload (Node/Electron)
├── electron-builder.yml      # Windows installer (NSIS, portable, icon, metadata)
├── README.md                 # Setup, run, and packaging instructions
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
│   │   │   └── PrintSettingsAdapter.ts  # Settings mapper (A4/A3, Color, Duplex, Copies, Orientation)
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
│   ├── renderer/             # React Sandboxed UI Process
│   │   ├── main.tsx          # React DOM root
│   │   ├── App.tsx           # Main application view with real-time status and tabs
│   │   ├── index.css         # Tailwind CSS styling
│   │   ├── components/
│   │   │   ├── Header.tsx           # Status indicator, shop name, quick actions
│   │   │   ├── Dashboard.tsx        # Queue metrics, active jobs, printer status counters
│   │   │   ├── QueueView.tsx        # Live jobs table with manual reprint, cancel & progress
│   │   │   ├── PrintersView.tsx     # Discovered Windows printers & test print trigger
│   │   │   ├── LogsView.tsx         # Real-time console log viewer with filters & export
│   │   │   ├── SettingsModal.tsx    # Server URL, Shop ID, Agent Token, Polling interval
│   │   │   └── StatusBadge.tsx      # Consistent status badges (Online/Offline/Printing)
│   │   └── types/
│   │       └── agent.ts             # Shared frontend/main types
```

---

## 5. Spooling & Physical Printing Execution Strategy

On Windows:
1. **Discovery:** Discovered via `webContents.getPrintersAsync()` and Windows PowerShell command:
   ```powershell
   Get-CimInstance Win32_Printer | Select-Object Name, DriverName, Default, PrinterStatus, PortName
   ```
2. **Spooling:**
   - Primary: `pdf-to-printer` command-line utility or silent PDF spooling.
   - Secondary / Built-in Fallback: Windows PowerShell Spooler invoking `Start-Process -FilePath <tempPdfPath> -Verb PrintTo -ArgumentList "<printerName>"` or hidden headless BrowserWindow `print({ silent: true, deviceName: printerName, ... })`.
3. **Paper & Color Settings:** Mapped to spooler printer options (`color: true/false`, `duplex: 'simplex' | 'long' | 'short'`, `copies: N`, `pageSize: 'A4' | 'A3'`).

---

## 6. Execution Steps

1. Create `PRINT_AGENT_INTEGRATION_PLAN.md` (this document).
2. Enhance `server.ts` with backward-compatible agent pairing, printer sync, and real-time job store.
3. Build `print-agent/` application structure with all core modules (main, preload, services, adapters, vaults).
4. Implement the sleek, modern React renderer UI in `print-agent/src/renderer/`.
5. Add build, packaging, and execution configs (`package.json`, `vite.config.ts`, `electron-builder.yml`, `tsconfig.json`).
6. Validate build and linting to ensure zero regressions across both the main web application and the print agent.
