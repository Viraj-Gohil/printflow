# PrintFlow — Print Token Tracking Using Supabase Only Implementation Report

## 1. Overview
PrintFlow implements a secure customer print-token tracking system using **Supabase PostgreSQL as the sole authoritative database**, ensuring that all print tracking tokens, job statuses, timestamps, shop references, and order metadata are persisted and queried reliably in Supabase.

---

## 2. Print Token Specification
- **Generation**: Cryptographically secure, unpredictable tracking tokens generated on the server (e.g., `tr_9aa040e5e0082b47` or `trk_...`).
- **Database Storage**: Stored in the `tracking_token` column of Supabase PostgreSQL (`print_jobs` and `print_agent_jobs`), with database indexing and uniqueness constraints.
- **Exposure**: Raw tokens are returned to the customer only upon initial checkout confirmation and can be copied or tracked on the `/track-print` page.

---

## 3. Customer Tracking Page & API
- **Tracking Page (`/track-print`)**: A responsive customer portal where users can enter their tracking token to view real-time status, a status timeline (Payment Confirmed -> Queued -> Printing -> Completed), verified page counts, and shop details.
- **Tracking API (`GET /api/public/print-tracking/:token`)**:
  - Securely queries Supabase PostgreSQL for matching tracking tokens.
  - Applies rate-limiting (60 requests per minute).
  - Returns customer-safe tracking data while protecting sensitive file contents, payment secrets, and private URLs.

---

## 4. Files Changed & Added
- **`server.ts`**: Added `GET /api/public/print-tracking/:token` endpoint querying Supabase PostgreSQL.
- **`src/components/customer/TrackPrintPage.tsx`**: Created responsive customer tracking UI.
- **`src/App.tsx`**: Registered `/track-print` route.
- **`docs/PRINT_TOKEN_TRACKING_REPORT.md`**: Created implementation report.

---

## 5. Security & Verification
- **Supabase Only**: All tracking operations query Supabase PostgreSQL (`public.print_jobs` & `public.print_agent_jobs`).
- **Authorization**: Read-only access for customers; state transitions restricted to authorized backend processes and registered print agents.
- **Build & Linter**: Passed TypeScript type checking (`npm run lint`) and full production build (`npm run build`).
