-- Phase 3: Supabase Storage & Guest Checkout Additions.
-- Apply only through the migration runner.
-- Additive only: no DROP, no destructive changes.

-- 1. Ensure storage_bucket column exists on uploaded_files with default private bucket name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'uploaded_files' AND column_name = 'storage_bucket'
  ) THEN
    ALTER TABLE public.uploaded_files ADD COLUMN storage_bucket TEXT NOT NULL DEFAULT 'print-documents';
  END IF;
END;
$$;

-- 2. Performance index for retention expiration and bounded cleanup
CREATE INDEX IF NOT EXISTS idx_uploaded_files_retention_expiry
  ON public.uploaded_files (retention_expires_at)
  WHERE upload_state != 'DELETED';

-- 3. Performance index for upload state triage
CREATE INDEX IF NOT EXISTS idx_uploaded_files_state
  ON public.uploaded_files (upload_state);

-- 4. Performance index for guest capability token lookup by hash
CREATE INDEX IF NOT EXISTS idx_guest_checkout_capabilities_token_hash
  ON public.guest_checkout_capabilities (token_hash);

-- 5. Performance index for expired guest token cleanup
CREATE INDEX IF NOT EXISTS idx_guest_checkout_capabilities_expiry
  ON public.guest_checkout_capabilities (expires_at)
  WHERE revoked_at IS NULL;

