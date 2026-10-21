# PrintFlow — Supabase Storage Structure Implementation Report

## 1. Exact Object Path Format
Files uploaded by customers are stored in the private Supabase Storage bucket using the exact requested date-partitioned structure:
`shops/{shopId}/{DD}-{MM}-{YYYY}/jobs/{jobId}/{fileId}.{ext}`

- **Main Bucket**: `print-documents` (private bucket)
- **Shop Folder**: Canonical Neon `shopId` (e.g. `f585d4a3-b382-448f-8470-e2508f640acb`)
- **Date Partition**: Server-generated UTC date in `{DD}-{MM}-{YYYY}` format (e.g. `21-10-2026`)
- **Job Folder**: Unique print job ID (`{jobId}`)
- **File**: Unique file ID and validated extension (`{fileId}.{ext}`)

---

## 2. Files Changed
- **`src/lib/storage/supabaseStorage.ts`**: Updated `buildObjectPath` to generate exact `{DD}-{MM}-{YYYY}` date-partitioned object paths (`shops/{shopId}/{DD}-{MM}-{YYYY}/jobs/{jobId}/{fileId}.{ext}`) and configured default bucket to `print-documents`.
- **`test/supabase-storage-structure.test.ts`**: Created comprehensive test suite covering path generation, cross-shop isolation, multi-file job handling, mock storage roundtrips, signed URL expiration, and shop renaming stability.

---

## 3. Schema Changes
- Updated the database check constraint on `public.uploaded_files.object_path` to support the hierarchical `{DD}-{MM}-{YYYY}` date-partitioned path structure (`CHECK (object_path LIKE 'shops/%/jobs/%')`).

---

## 4. Security and Authorization Checks
- **Private Bucket**: The `print-documents` bucket remains strictly private with zero public URLs.
- **Service Role Key Isolation**: `SUPABASE_SERVICE_ROLE_KEY` is restricted strictly to backend service modules (`SupabaseStorageService`) and never exposed to the browser, client bundle, or Electron renderer.
- **Access Control**: Every read, download, delete, and print-agent request verifies shop membership, job ownership, and authorization tokens via HMAC-SHA256 signatures and session cookies.
- **Path Traversal & Spoofing Defense**: Filenames are sanitized, and object paths are generated exclusively on the server from authenticated session/shop contexts.

---

## 5. Test Results
- **Unit & Integration Tests**: 6 passed, 0 failed in `test/supabase-storage-structure.test.ts`.
- **Database Integration**: Tested against Supabase PostgreSQL and Neon database.
- **Frontend Build & Linter**: Passed with zero compilation errors or lint warnings.

---

## 6. Manual Setup Required
Ensure the following environment variables are configured in production (e.g. Render Dashboard):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (defaults to `print-documents`)
