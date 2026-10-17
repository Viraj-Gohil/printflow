# PrintFlow Cloud: System Architecture & Component Interactions

**Document Type:** System Architecture Specification  
**Application:** PrintFlow Cloud Multi-Tenant Xerox Platform  
**Target:** Windows Electron Print Agent Integration  

---

## 1. Verified Component Architecture

The current architecture consists of a full-stack Node.js/React application with clear boundaries between the Customer Portal, the Shop Owner Dashboard, the Super Admin Platform, the Backend API layer, and the external Payment Gateway.

### Architecture Component Diagram

```mermaid
flowchart TB
    subgraph Clients ["Web Client Applications (Vite SPA)"]
        CustomerUI["Customer Counter Flow<br/>(/s/:shopSlug)<br/>- File Upload<br/>- Print Settings<br/>- Razorpay Checkout<br/>- Live Order Tracker"]
        ShopUI["Shop Owner Dashboard<br/>(/shop/*)<br/>- Live Jobs Queue<br/>- Printer Hardware Manager<br/>- Print Agent Token & Status<br/>- Rate Card & Earnings"]
        AdminUI["Platform Super Admin<br/>(/admin/*)<br/>- Global Metrics<br/>- Shop Approvals<br/>- SaaS Plans & Quotas<br/>- Device Revocation"]
    end

    subgraph BackendGateway ["Express Backend Server (server.ts - Port 3000)"]
        AuthMiddleware["Auth & Session Middleware<br/>- HttpOnly Cookies<br/>- JWT Bearer<br/>- M2M Device Token Validator"]
        PaymentEngine["Razorpay Payment Engine<br/>- Order Creation (/api/create-order)<br/>- HMAC Verification (/api/verify-payment)<br/>- Reconcile & Webhook"]
        FileVault["Private Storage Vault<br/>- Magic-Bytes Validation<br/>- HMAC Signed Tokens<br/>- In-Memory & S3/Disk Adapter"]
        AgentGateway["Electron Agent M2M Gateway<br/>- Heartbeat (/api/agent/heartbeat)<br/>- Job Discovery (/api/agent/jobs)<br/>- Atomic Claiming<br/>- Status Reporting"]
    end

    subgraph Persistence ["Data & Storage Layer"]
        PostgresDB["PostgreSQL / Supabase Database<br/>- Profiles, Shops, Devices<br/>- Printers, Print Jobs, Payments<br/>- RLS Security Policies"]
        LocalSecretStore[".data/payment_integrations.json<br/>- Encrypted Gateway Keys<br/>- AES-256-GCM Backup Store"]
    end

    subgraph External ["External Services"]
        RazorpayGateway["Razorpay Payments Cloud<br/>- UPI QR Code<br/>- Card / NetBanking<br/>- Webhook Notifications"]
    end

    subgraph ProposedAgent ["Windows Desktop Agent (To Be Built)"]
        ElectronMain["Electron Main Process<br/>- Node.js Runtime<br/>- OS Credential Manager (safeStorage)<br/>- SQLite Local State<br/>- System Tray Controller"]
        PreloadBridge["Context-Isolated Preload Bridge<br/>- contextIsolation: true<br/>- nodeIntegration: false<br/>- Sanitized IPC Handlers"]
        RendererUI["Desktop Dashboard (React)<br/>- Device Registration<br/>- Local Printer Status<br/>- Real-time Spooler Log"]
        WinSpooler["Windows Print Spooler<br/>- pdf-to-printer / PowerShell<br/>- Native Driver Commands<br/>- Paper / Duplex / Color Options"]
    end

    %% Verified Connections
    CustomerUI -->|POST /api/upload| FileVault
    CustomerUI -->|POST /api/create-order| PaymentEngine
    CustomerUI -->|Standard Checkout Modal| RazorpayGateway
    RazorpayGateway -->|Success Response| CustomerUI
    CustomerUI -->|POST /api/verify-payment| PaymentEngine
    PaymentEngine -->|Persist Verified Payment| PostgresDB
    PaymentEngine <-->|Dual-Mode Fallback| LocalSecretStore

    ShopUI -->|Manage Hardware & Rate Card| PostgresDB
    ShopUI -->|POST /api/agent/:id/rotate-token| AgentGateway
    AdminUI -->|POST /api/agent/:id/revoke| AgentGateway

    %% Proposed Agent Connections
    ElectronMain -->|POST /api/agent/heartbeat| AgentGateway
    ElectronMain -->|GET /api/agent/jobs (Polling)| AgentGateway
    ElectronMain -->|POST /api/agent/jobs/:id/claim| AgentGateway
    ElectronMain -->|GET /api/storage/files/:shop/:job/:file (with M2M Token)| FileVault
    ElectronMain -->|POST /api/agent/jobs/:id/status| AgentGateway
    ElectronMain -->|Dispatch Spool Job| WinSpooler
    ElectronMain <-->|IPC Bridge| PreloadBridge
    PreloadBridge <-->|Secure API| RendererUI
```

---

## 2. Verified Subsystems & Data Flow

### 2.1. Real-Time Communication Verification
- **Verified Finding:** Currently, the platform **does not have an active WebSocket server or SSE server running on `server.ts`**.
- The frontend dashboard (`ShopPrintJobs.tsx`) and the existing agent endpoints in `server.ts` (`/api/agent/jobs`, `/api/agent/heartbeat`) utilize **HTTP REST Polling** (default interval: 5 seconds) for job synchronization.
- **Agent Architecture Implication:** The Electron Agent can be built immediately using resilient, jittered HTTP polling (3–5 seconds), with an optional long-polling or WebSocket upgrade in Phase 2.

### 2.2. Multi-Tenant Shop Isolation
- Every shop has a unique `shop_id` (UUID) and a unique human-readable `slug` (e.g., `shop_shree_ganesh`, `counter-quickprint`).
- The backend enforces tenant boundaries on all file downloads and job claims:
  - An agent registered to `shop_A` providing `x-agent-token` cannot claim or view jobs for `shop_B`.
  - The file storage endpoint (`/api/storage/files/:shopId/:jobId/:fileId`) explicitly checks `verifyElectronAgentRequest` against the URL's `:shopId`. If mismatched, it returns `403 Forbidden` (`Tenant Isolation Violation`).

### 2.3. Dual-Mode Storage & Database Layer
- **PostgreSQL Database:** When `DATABASE_URL` is set, `pgPool` connects to PostgreSQL and runs schema initialization.
- **Local JSON Fallback:** If `DATABASE_URL` is not provided (e.g. during local developer staging), `src/db/paymentStorage.ts` automatically maintains encrypted credentials in `.data/payment_integrations.json` via AES-256-GCM.
- **In-Memory File Vault:** Files uploaded via `/api/upload` are validated for magic-number binary signatures and held in `inMemoryPrivateFiles` (with metadata, MIME type, and expiration timestamps).
