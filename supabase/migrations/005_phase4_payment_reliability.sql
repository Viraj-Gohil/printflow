-- Phase 4: Production-Grade Razorpay Payment Reliability
-- Apply only through the migration runner.
-- Additive only: no DROP, no destructive alterations.

-- 1. Ensure uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Add reconciliation columns and metadata to payment_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_orders' AND column_name = 'reconciliation_needed'
  ) THEN
    ALTER TABLE public.payment_orders ADD COLUMN reconciliation_needed BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_orders' AND column_name = 'reconciliation_attempts'
  ) THEN
    ALTER TABLE public.payment_orders ADD COLUMN reconciliation_attempts INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_orders' AND column_name = 'last_reconciled_at'
  ) THEN
    ALTER TABLE public.payment_orders ADD COLUMN last_reconciled_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_orders' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.payment_orders ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END;
$$;

-- 3. Performance index for finding orders needing reconciliation
CREATE INDEX IF NOT EXISTS idx_payment_orders_reconcile
  ON public.payment_orders (status, reconciliation_needed)
  WHERE status = 'CREATED' OR reconciliation_needed = true;

-- 4. Create manual refunds ledger table
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE RESTRICT,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  provider_refund_id TEXT UNIQUE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('REQUESTED', 'PENDING', 'COMPLETED', 'FAILED', 'RECONCILED')) DEFAULT 'REQUESTED',
  operator_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order ON public.payment_refunds(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_shop_status ON public.payment_refunds(shop_id, status);

-- 5. Trigger for payment_refunds.updated_at
DROP TRIGGER IF EXISTS trg_payment_refunds_updated_at ON public.payment_refunds;
CREATE TRIGGER trg_payment_refunds_updated_at
  BEFORE UPDATE ON public.payment_refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

