# PrintFlow Cloud: API Endpoint Inventory & Protocol Specification

**Document Type:** API Reference & Agent Network Protocol  
**Source File:** `server.ts` (monolithic backend)  
**Host Port:** `3000`  
**Authentication Types:**
1. **Cookie Session:** `session_id` (HttpOnly signed cookie)
2. **Bearer JWT:** `Authorization: Bearer <token>`
3. **M2M Device Token:** `x-agent-id: <agentId>`, `x-agent-token: <authToken>`

---

## 1. Electron Agent M2M Core APIs

These endpoints are implemented in `server.ts` specifically for the Windows Electron Print Agent.

### 1.1. Agent Heartbeat
- **Method:** `POST`
- **Route:** `/api/agent/heartbeat`
- **Rate Limit:** 60 requests / minute
- **Authentication:** M2M Headers required:
  - `x-agent-id`: string (e.g. `agent_shop_shree_ganesh` or `COUNTER-PC01`)
  - `x-agent-token`: string (e.g. `agt_tok_sgx_live_99482`)
- **Headers Verified:** `verifyElectronAgentRequest()` in `src/lib/electronAgentSecurity.ts`. Constant-time comparison.
- **Request Body:** Optional telemetry payload:
  ```json
  {
    "status": "ONLINE",
    "connectedPrintersCount": 3,
    "firmwareVersion": "v1.4.2",
    "timestamp": 1728864000000
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "status": "ONLINE",
    "shopId": "shop_shree_ganesh",
    "acknowledgedAt": "2026-10-14T05:00:00.000Z"
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Missing `x-agent-id` or `x-agent-token`.
  - `403 Forbidden`: Unrecognized device, invalid token, or token marked as `isRevoked: true`.
- **Reuse for Agent:** **DIRECT REUSE**. The Electron Agent must call this every 15–30 seconds to maintain `ONLINE` status in the shop dashboard.

---

### 1.2. Agent Poll Eligible Jobs
- **Method:** `GET`
- **Route:** `/api/agent/jobs`
- **Authentication:** M2M Headers required:
  - `x-agent-id`: string
  - `x-agent-token`: string
- **Query / Optional Header:** `?shopId=<shopId>` or header `x-shop-id: <shopId>`.
- **Tenant Validation:** Server verifies that the device's registered `shopId` matches the requested shop. If mismatched, returns `403 Forbidden` (`Tenant Isolation Violation`).
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "shopId": "shop_shree_ganesh",
    "jobs": [
      {
        "id": "PRT-98214",
        "orderCode": "PRT-98214",
        "trackingToken": "tr_x839d01k",
        "shopId": "shop_shree_ganesh",
        "customerName": "Ramesh Kumar",
        "customerPhone": "+919876543210",
        "paymentStatus": "SUCCESS",
        "printStatus": "QUEUED",
        "totalAmount": 24.00,
        "files": [
          {
            "id": "file_89abc123",
            "fileName": "Annual_Report_2026.pdf",
            "fileSize": 1420580,
            "fileType": "application/pdf",
            "paperSize": "A4",
            "color": "BW",
            "sides": "DOUBLE",
            "copies": 2,
            "estimatedPages": 6,
            "pageSelection": "ALL",
            "storagePath": "shop_shree_ganesh/job_1728864000/file_89abc123.pdf",
            "downloadUrl": "/api/storage/files/shop_shree_ganesh/PRT-98214/file_89abc123?token=1728867600.a3f9e2..."
          }
        ],
        "assignedPrinterId": "printer_canon_ir2520",
        "createdAt": "2026-10-14T05:01:00.000Z"
      }
    ]
  }
  ```
- **Reuse for Agent:** **DIRECT REUSE**. Core polling mechanism for the background print engine.

---

### 1.3. Agent Claim Job (Atomic Lock)
- **Method:** `POST`
- **Route:** `/api/agent/jobs/:id/claim`
- **Authentication:** M2M Headers: `x-agent-id`, `x-agent-token`.
- **Parameters:** `:id` = Print Job ID (e.g. `PRT-98214`).
- **Purpose:** Claims the job so that no other counter PC or thread can process it simultaneously.
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "jobId": "PRT-98214",
    "claimedBy": "agent_shop_shree_ganesh",
    "shopId": "shop_shree_ganesh",
    "claimedAt": "2026-10-14T05:01:05.000Z"
  }
  ```
- **Error Responses:**
  - `403 Forbidden`: Agent credentials invalid or job belongs to another shop.
  - `409 Conflict`: Job has already been claimed by another device.
- **Reuse for Agent:** **DIRECT REUSE**.

---

### 1.4. Agent Report Job Print Status
- **Method:** `POST`
- **Route:** `/api/agent/jobs/:id/status`
- **Authentication:** M2M Headers: `x-agent-id`, `x-agent-token`.
- **Request Body:**
  ```json
  {
    "status": "DOWNLOADING" | "PRINTING" | "COMPLETED" | "FAILED" | "REQUIRES_ATTENTION",
    "errorMessage": "Optional failure or uncertain-outcome description",
    "retrySafe": false,
    "pagesPrinted": 12
  }
  ```
- **Validation:** Updates must belong to the authenticated claiming device, the job must be payment-confirmed, and transitions must follow the server-side print state machine. Retry is allowed only for a backend-recorded failure explicitly marked safe before spool submission. Competing updates are rejected.
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "jobId": "PRT-98214",
    "newStatus": "COMPLETED",
    "updatedAt": "2026-10-14T05:01:30.000Z"
  }
  ```
- **Reuse for Agent:** **DIRECT REUSE**.

### 1.5. Customer Order Status
- **Method:** `GET`
- **Route:** `/api/customer/print-jobs/:id/status`
- **Authentication:** `x-print-tracking-token` header containing the per-order capability token returned with the paid order; comparisons are constant-time.
- **Response:** Safe status fields only (`printStatus`, `updatedAt`, printer name, error message, and pages printed). Does not return customer/payment data or document content.
- **Purpose:** Lets the existing customer tracking screen poll its actual backend order state without shop credentials.

### 1.6. Secure Document Download
- **Method:** `GET`
- **Route:** `/api/agent/jobs/:id/file?fileId=<fileId>`
- **Authentication:** M2M Agent Headers (`x-agent-id`, `x-agent-token`); job must be payment-confirmed, claimed by this device, and belong to its shop.
- **Security Protections:**
  1. Device token authentication with revocation checks.
  2. Shop isolation and a claim-owner check before the document is returned.
  3. File IDs must belong to the requested job; files are streamed from the private print-job store.
- **Response:** Binary file stream with headers:
  - `Content-Type: application/pdf` (or `image/png`, `image/jpeg`)
  - `Content-Disposition: attachment; filename="Annual_Report_2026.pdf"`
- **Reuse for Agent:** **DIRECT REUSE**. The agent downloads the document directly to a secure local staging folder prior to spooling.

---

### 1.7. Agent Token Rotation & Revocation
- **Rotate Token Route:** `POST /api/agent/:agentId/rotate-token`
  - **Auth:** Requires Shop Owner role (`requireShopOwnerRole`) or Admin.
  - **Response:** `{ "success": true, "newAuthToken": "agt_tok_..." }`.
  - **Action:** Immediately invalidates the old token and activates the new one.
- **Revoke Device Route:** `POST /api/agent/:agentId/revoke`
  - **Auth:** Requires Admin role (`requireAdminRole`).
  - **Action:** Sets `isRevoked: true` and `status: "SUSPENDED"`. Subsequent heartbeat and claim calls fail immediately with `403 Forbidden`.

---

## 2. Customer & Payment Gateway APIs

| Endpoint | Method | Role / Auth | Description |
|---|---|---|---|
| `/api/upload` | `POST` | Public / Counter Customer | Accepts file base64, performs magic-bytes validation, stores file, returns signed token. |
| `/api/create-order` | `POST` | Public / Counter Customer | Creates Razorpay order in paise, sets receipt and notes. |
| `/api/verify-payment` | `POST` | Public / Customer Callback | Verifies HMAC-SHA256 signature (`order_id\|payment_id`) and sets payment status to `PAID`. |
| `/api/payment/check-status` | `ALL` | Public / Polling | Checks current status of a Razorpay order without charging again. |
| `/api/payment/reconcile` | `POST` | Customer / Shop Owner | Reconciles payment if checkout modal dismissed but bank debited. |
| `/api/payment/webhook` | `POST` | Razorpay Webhook Engine | Validates webhook signature and idempotently marks order as paid. |

---

## 3. Recommended New APIs for Print Agent Support

During the inspection of `server.ts`, the following two extensions are identified as desirable additions to complete the agent ecosystem:

1. `POST /api/agent/printers/sync`:
   - Allows the Windows Agent to report the list of installed Windows printers, their driver names, and detected capabilities (color, duplex, paper trays).
   - Automatically populates the shop's `printers` table in the database.
2. `GET /api/agent/events` (Optional Long-Polling / SSE):
   - In place of standard 5-second polling, allows the agent to hold an open connection for instant print dispatch.
