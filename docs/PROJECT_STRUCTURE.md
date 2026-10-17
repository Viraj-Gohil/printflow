# PrintFlow Cloud: Project Structure & Technology Stack Blueprint

**Project Name:** PrintFlow Cloud (Multi-tenant Xerox & Print Shop SaaS)  
**Environment:** Linux / Node.js Dev Server (Port 3000) with Express & Vite Middleware  
**Verification Date:** October 2026  
**Audience:** Desktop Systems Engineer / AI Coding Agent building the Windows Electron Print Agent  

---

## 1. High-Level Technology Stack

| Layer | Technologies & Libraries | Verified File References |
|---|---|---|
| **Runtime & Build** | Node.js (v22+), TypeScript (v7/v5), Vite 8.3, `tsx` v4.21, Bun/NPM | `package.json`, `tsconfig.json`, `vite.config.ts` |
| **Backend Server** | Express 4.21.2, `cookie-parser`, `dotenv`, custom crypto/security | `server.ts` |
| **Frontend Framework** | React 19.0.1, React DOM 19.0.1, Tailwind CSS v4.3.3, `@tailwindcss/vite` | `src/App.tsx`, `src/main.tsx`, `src/index.css` |
| **Icons & Animation** | `lucide-react` (0.546.0), `framer-motion` (14.0.0), `motion` (12.23.24) | `package.json`, `src/components/` |
| **Payment Gateway** | Razorpay Node.js SDK (`razorpay` ^2.9.8), Standard Checkout modal, UPI QR | `server.ts`, `src/lib/razorpay.ts`, `src/components/payment/` |
| **Database & Persistence** | PostgreSQL (Neon via `pg` ^8.23.1) with dual-mode in-memory / JSON fallback (`.data/payment_integrations.json`), Supabase SQL Schema | `src/db/paymentStorage.ts`, `supabase/migrations/001_initial_schema.sql` |
| **Security & Cryptography** | `crypto` (`aes-256-gcm`, HMAC-SHA256), timing-safe comparisons, magic-bytes MIME validation, SSRF protection | `src/lib/crypto/credentialCrypto.ts`, `src/lib/electronAgentSecurity.ts`, `src/lib/ssrfProtection.ts` |
| **QR Code Generation** | `qrcode` (1.5.4) with `@types/qrcode` | `package.json`, `src/components/shop/ShopQrCodes.tsx` |

---

## 2. Directory & File Organization

```
printflow/
├── .data/                                    # Local JSON fallback storage for payment secrets
│   └── payment_integrations.json             # Encrypted secrets store when DATABASE_URL is unset
├── .env.example                              # Template environment variables (no raw secrets)
├── index.html                                # Single-page application entry HTML
├── metadata.json                             # AI Studio applet metadata & capabilities
├── package.json                              # Scripts, dependencies & build definitions
├── server.ts                                 # Full-stack monolithic Express backend & Vite middleware
├── tsconfig.json                             # TypeScript compiler configuration
├── vite.config.ts                            # Vite configuration with Tailwind CSS plugin
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql            # Master PostgreSQL / Supabase schema (14 tables, RLS)
├── docs/                                     # Architecture & Print Agent technical blueprint specifications
└── src/
    ├── main.tsx                              # React DOM root render
    ├── App.tsx                               # Client application shell & state provider wrapper
    ├── index.css                             # Tailwind CSS v4 styling entry point (@import "tailwindcss";)
    ├── types/
    │   └── index.ts                          # Comprehensive TypeScript contracts (Jobs, Agents, Printers)
    ├── db/
    │   └── paymentStorage.ts                 # Dual-mode database layer (PostgreSQL connection pool + fallback)
    ├── lib/
    │   ├── store.tsx                         # Core React client-side state store (Context + localStorage)
    │   ├── store/
    │   │   └── appStore.tsx                  # Modular sub-stores for platform policies
    │   ├── electronAgentSecurity.ts          # M2M auth, safeStorage interface & device token registry
    │   ├── razorpay.ts                       # Client-side Razorpay Checkout script loader & helpers
    │   ├── security.ts                       # General web security helpers (CSRF, sanitization)
    │   ├── clientSecurity.ts                 # Client-side validation & sanitization
    │   ├── ssrfProtection.ts                 # Advanced DNS/IP whitelist protection for remote documents
    │   ├── validation.ts                     # Input validation (phones, emails, file types, pricing)
    │   ├── logger.ts                         # Server-side structured logger with PII & secret redaction
    │   ├── crypto/
    │   │   └── credentialCrypto.ts           # AES-256-GCM symmetric encryption for gateway credentials
    │   └── utils/
    │       └── pricing.ts                    # Dynamic print pricing engine based on paper, color & sides
    ├── data/
    │   └── mockData.ts                       # Seeding data for shops, printers, plans & initial jobs
    └── components/
        ├── admin/                            # Super Admin platform dashboard components
        │   ├── AdminDashboard.tsx            # Platform KPI metrics (revenue, active shops, print volume)
        │   ├── AdminAgents.tsx               # Global overview of connected Electron agents
        │   ├── AdminShops.tsx                # Multi-tenant shop approval, suspension & management
        │   ├── AdminPrintJobs.tsx            # Global print job audit & monitoring
        │   ├── AdminPayments.tsx             # Platform payment tracking & manual reconciliations
        │   ├── AdminPlatformSettings.tsx     # Global Razorpay credentials & fee configurations
        │   ├── AdminSubscriptions.tsx        # SaaS tier management & subscriber allocations
        │   ├── AdminAuditLogs.tsx            # Tamper-evident admin action logs
        │   ├── AdminSupport.tsx              # Platform support ticket desk
        │   └── AdminSystemHealth.tsx         # Node.js server health, memory, and database status
        ├── shop/                             # Shop Owner dashboard components
        │   ├── ShopDashboard.tsx             # Counter stats (today's jobs, revenue, online hardware)
        │   ├── ShopPrintJobs.tsx             # Live print job queue, status inspection & simulation
        │   ├── ShopPrinters.tsx              # Hardware manager, printer capability configuration & SaaS quotas
        │   ├── ShopPrintAgent.tsx            # Electron agent connection instructions, token & REST API contract
        │   ├── ShopQrCodes.tsx               # Storefront counter QR codes & customer ordering URL generator
        │   ├── ShopPricing.tsx               # Per-page rate card (A4/A3, B&W/Color, Single/Double)
        │   ├── ShopPayments.tsx              # Counter transaction ledger & Razorpay onboarding status
        │   ├── ShopSubscription.tsx         # SaaS plan tier, printer limit quotas & upgrade modal
        │   └── ShopSettings.tsx              # Shop metadata, business hours & gateway credentials
        ├── customer/                         # Customer mobile & desktop counter ordering
        │   └── CustomerPrintFlow.tsx         # 4-step workflow: File Upload -> Settings -> Razorpay -> Live Tracker
        ├── payment/                          # Payment components
        │   ├── RazorpayCheckoutModal.tsx     # Standard Razorpay popup checkout wrapper
        │   └── RazorpayCheckoutButton.tsx    # Reusable payment action button
        ├── auth/
        │   └── AuthPages.tsx                 # Shop owner login, signup, password reset & MFA verification
        ├── landing/
        │   └── LandingPage.tsx               # PrintFlow Cloud SaaS marketing & pricing landing page
        └── shared/ & common/
            ├── StatusBadge.tsx               # Color-coded badges for jobs, agents, printers & payments
            └── ToastContainer.tsx            # Floating toast notification system
```

---

## 3. Detailed Component Responsibilities & Agent Relevance

### 3.1. `server.ts`
- **Responsibility:** Monolithic backend containing express middlewares, rate limiters, Razorpay order creation and signature verification, secure binary file upload validation (magic bytes), short-lived signed download token generation, tenant isolation checks, and machine-to-machine (M2M) Agent APIs.
- **Print Agent Relevance:** **CRITICAL**. Houses all endpoints the Electron Agent interacts with:
  - `POST /api/agent/heartbeat`: Device alive notification and status reporting.
  - `GET /api/agent/jobs`: Polling endpoint for pending paid jobs for the agent's shop.
  - `POST /api/agent/jobs/:id/claim`: Atomically claiming a job to avoid duplicate printing.
  - `POST /api/agent/jobs/:id/status`: Reporting state transitions (`DOWNLOADING`, `PRINTING`, `COMPLETED`, `FAILED`).
  - `GET /api/storage/files/:shopId/:jobId/:fileId`: Authorized file download endpoint requiring `x-agent-token` and `x-agent-id`.

### 3.2. `src/lib/electronAgentSecurity.ts`
- **Responsibility:** Implements the security contract for the desktop agent. Defines TypeScript interfaces (`DeviceCredentials`, `AgentHeartbeatPayload`, `ElectronAgentAPI`), the in-memory device registry (`electronDeviceRegistry`), token rotation/revocation logic, and constant-time token verification (`verifyElectronAgentRequest`).
- **Print Agent Relevance:** **CRITICAL**. Defines the blueprint for the Electron main process, preload bridge, and operating system safeStorage vault.

### 3.3. `supabase/migrations/001_initial_schema.sql`
- **Responsibility:** Formal PostgreSQL schema definition including tables for `profiles`, `shops`, `devices`, `printers`, `print_jobs`, `payments`, `plans`, and `subscriptions`, along with indexes and Row-Level Security (RLS) policies.
- **Print Agent Relevance:** **CRITICAL**. Identifies the exact database columns, UUID foreign keys, and status enum constraints that the backend and agent must satisfy.

### 3.4. `src/types/index.ts`
- **Responsibility:** Unified TypeScript definitions for the entire platform. Defines `PrintJob`, `FilePrintConfig`, `PrinterDevice`, `ElectronAgent`, `PrintStatus`, `PaymentStatus`, and `PaperSize`.
- **Print Agent Relevance:** **CRITICAL**. The Electron Agent must import or mirror these exact types to ensure full serialization compatibility.

### 3.5. `src/components/shop/ShopPrintAgent.tsx`
- **Responsibility:** Shop-owner UI tab for monitoring the desktop agent, copying the device bearer authentication token, viewing connected printer counts, and inspecting API contracts.
- **Print Agent Relevance:** **HIGH**. The UI surface where shop owners generate the token and verify that their Windows PC has successfully connected.

### 3.6. `src/components/shop/ShopPrinters.tsx`
- **Responsibility:** Shop-owner UI for managing hardware printers, configuring color/duplex capabilities, and enforcing SaaS subscription printer quotas.
- **Print Agent Relevance:** **HIGH**. The Electron Agent discovers physical Windows printers and synchronizes them with this list.

### 3.7. `src/components/customer/CustomerPrintFlow.tsx`
- **Responsibility:** The end-customer ordering interface. Collects files, calculates prices via `src/lib/utils/pricing.ts`, triggers Razorpay Checkout, verifies payment on `server.ts`, and creates the `PrintJob` in state.
- **Print Agent Relevance:** **HIGH**. Generates the exact job specifications (paper size, color, copies, orientation, page range) that the Windows spooler must execute.

---

## 4. Environment Variables Configuration

The following environment variables are defined or referenced across `server.ts`, `.env.example`, and `src/db/paymentStorage.ts`:

| Variable Name | Client / Server | Purpose |
|---|---|---|
| `PORT` | Server | HTTP port for Express (defaults to `3000`) |
| `NODE_ENV` | Server | Runtime mode (`development`, `production`, `test`) |
| `APP_URL` | Server / Client | Root canonical URL for webhooks and QR codes |
| `DATABASE_URL` | Server | PostgreSQL connection string (Neon or Supabase) |
| `SESSION_SECRET` | Server | Secret for signing session cookies |
| `JWT_SECRET` | Server | Secret for signing user and agent Bearer JWTs |
| `STORAGE_SIGN_SECRET` | Server | Secret for HMAC-SHA256 file download token signatures |
| `RAZORPAY_KEY_ID` | Server | Platform default Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | Server | Platform default Razorpay Key Secret |
| `VITE_RAZORPAY_KEY_ID` | Client (`VITE_`) | Public Razorpay Key ID for client-side Checkout |
| `GEMINI_API_KEY` | Server | Optional Gemini API key for smart document summarization |

*Note: In accordance with security guidelines, no raw secrets are stored in version control.*
