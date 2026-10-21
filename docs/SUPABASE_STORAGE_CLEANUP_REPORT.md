# PrintFlow — Scheduled Midnight IST Supabase Storage Cleanup Job Report

## 1. Overview
PrintFlow implements a secure, production-ready scheduled background cleanup job that automatically deletes eligible expired customer print files from the private Supabase Storage bucket (`print-documents`) at **12:00 AM midnight India Standard Time (IST / `Asia/Kolkata`, UTC+5:30)** every day.

---

## 2. Schedule & Timezone Implementation
- **Timezone**: India Standard Time (`Asia/Kolkata`, UTC+5:30).
- **Execution Mechanism**: Server-authoritative recursive `setTimeout` timer calculated dynamically from system epoch time to target exactly 12:00 AM IST without drift across Daylight Saving / timezone changes.
- **Bootstrapping**: Initialized automatically when `server.ts` boots up.

---

## 3. Eligibility & Deletion Workflow
1. **Query**: Queries `public.uploaded_files` in Neon PostgreSQL for files where `upload_state != 'DELETED'` and either `retention_expires_at <= NOW()` or `created_at < NOW() - INTERVAL '24 hours'`.
2. **Batch Deletion**: Calls `storageProvider.delete(objectPaths)` to remove files from the private Supabase bucket (`print-documents`).
3. **Database Audit Update**: Marks successfully processed records as `upload_state = 'DELETED'` in `public.uploaded_files`.
4. **Fault Tolerance**: Wrapped in try/catch blocks with structured Winston audit logging (`logger.info`, `logger.warn`, `logger.error`) so transient bucket timeout errors do not crash the background timer.

---

## 4. Administrative Control Route
- **Endpoint**: `POST /api/admin/storage/cleanup`
- **Authorization**: Requires `requireAdminRole` middleware (Platform Admin session required).
- **Body Parameter**: `olderThanHours` (defaults to 24 hours).
- **Response**: Returns `{ success: true, purgedCount, olderThanHours }`.

---

## 5. Files Changed & Added
- **`server.ts`**: Added `getMsUntilNextMidnightIST`, `runMidnightIstStorageCleanupJob`, recursive midnight timer initialization, and fully implemented `POST /api/admin/storage/cleanup`.
- **`test/storage-cleanup.test.ts`**: Created unit test suite verifying batch deletion and cleanup mechanics.
- **`docs/SUPABASE_STORAGE_CLEANUP_REPORT.md`**: Created documentation report.

---

## 6. Test & Build Verification
- **Unit Tests**: Passed successfully.
- **TypeScript Linter (`npm run lint`)**: Passed with zero errors.
- **Production Build (`npm run build`)**: Client and server bundles compiled successfully.
