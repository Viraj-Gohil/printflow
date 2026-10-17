-- Phase 1 additive durable checkout foundation. Apply only through the migration runner.
-- Requires the reviewed baseline schema (001_initial_schema.sql) in an isolated database first.

CREATE TABLE IF NOT EXISTS public.guest_checkout_capabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_guest_checkout_capabilities_job ON public.guest_checkout_capabilities(job_id);

CREATE TABLE IF NOT EXISTS public.print_checkout_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  pricing_snapshot JSONB NOT NULL,
  quoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > quoted_at)
);
CREATE INDEX IF NOT EXISTS idx_print_checkout_quotes_shop_expiry ON public.print_checkout_quotes(shop_id, expires_at);

CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  object_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL CHECK (length(original_filename) BETWEEN 1 AND 255),
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  sha256 CHAR(64) NOT NULL,
  verified_page_count INTEGER NOT NULL CHECK (verified_page_count > 0),
  upload_state TEXT NOT NULL CHECK (upload_state IN ('PENDING', 'UPLOADED', 'VERIFIED', 'FAILED', 'DELETED')),
  retention_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, id),
  CHECK (object_path LIKE 'shops/%/jobs/%/files/%')
);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_shop_job ON public.uploaded_files(shop_id, job_id);

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID UNIQUE REFERENCES public.print_jobs(id) ON DELETE RESTRICT,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (purpose IN ('PRINT_JOB', 'SUBSCRIPTION')),
  provider TEXT NOT NULL CHECK (provider = 'RAZORPAY'),
  provider_order_id TEXT NOT NULL UNIQUE,
  provider_account_ref TEXT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED')),
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((purpose = 'PRINT_JOB' AND job_id IS NOT NULL) OR (purpose = 'SUBSCRIPTION' AND job_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_shop_status ON public.payment_orders(shop_id, status);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
  provider_payment_id TEXT NOT NULL UNIQUE,
  provider_signature_hash CHAR(64) NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CAPTURED', 'FAILED', 'REFUNDED')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.razorpay_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload_sha256 CHAR(64) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);

CREATE TABLE IF NOT EXISTS public.print_job_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('SYSTEM', 'CUSTOMER', 'AGENT', 'SHOP_OWNER', 'ADMIN')),
  actor_id TEXT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  event_code TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_print_job_events_job_created ON public.print_job_events(job_id, created_at);

CREATE TABLE IF NOT EXISTS public.agent_job_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (lease_expires_at > created_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_job_claims_active_job ON public.agent_job_claims(job_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_job_claims_device_lease ON public.agent_job_claims(device_id, lease_expires_at) WHERE released_at IS NULL;
