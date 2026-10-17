-- Phase 2: Shop API support additions. Apply only through the migration runner.
-- Depends on 001_initial_schema.sql and 002_durable_checkout_foundation.sql.
-- Additive only: no DROP, no ALTER that removes columns.

-- 1. Ensure uuid-ossp is available (harmless if already enabled).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Add is_active flag to pricing_rules for soft-delete support (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pricing_rules' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.pricing_rules ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END;
$$;

-- 3. Add updated_at to pricing_rules for change tracking (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pricing_rules' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.pricing_rules
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END;
$$;

-- 4. Durable webhook idempotency: upgrade razorpay_webhook_events with shop_id tracking.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'razorpay_webhook_events' AND column_name = 'shop_id'
  ) THEN
    ALTER TABLE public.razorpay_webhook_events ADD COLUMN shop_id TEXT;
  END IF;
END;
$$;

-- 5. Index for webhook event lookup by type.
CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_type_received
  ON public.razorpay_webhook_events (event_type, received_at DESC);

-- 6. Payment order status update trigger (tracks updated_at automatically).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for payment_orders.updated_at (idempotent via DROP IF EXISTS).
DROP TRIGGER IF EXISTS trg_payment_orders_updated_at ON public.payment_orders;
CREATE TRIGGER trg_payment_orders_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Soft-delete flag for shops (suspended without data loss).
-- shops.status CHECK already has 'SUSPENDED' so no new column needed.

-- 8. Index for shops by status (used by shop listing API).
CREATE INDEX IF NOT EXISTS idx_shops_status ON public.shops (status);

-- 9. Index for pricing_rules active rules per shop.
CREATE INDEX IF NOT EXISTS idx_pricing_rules_shop_active
  ON public.pricing_rules (shop_id, is_active) WHERE is_active = true;

