-- PrintFlow Migration 010: SaaS Subscription, Trial & Billing System
-- Implements production-ready subscription model, usage tracking, and plan enforcement

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Extend public.plans with introductory pricing and offer configurations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'introductory_price') THEN
    ALTER TABLE public.plans ADD COLUMN introductory_price NUMERIC(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'is_introductory_offer_active') THEN
    ALTER TABLE public.plans ADD COLUMN is_introductory_offer_active BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'introductory_offer_expires_at') THEN
    ALTER TABLE public.plans ADD COLUMN introductory_offer_expires_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'renewal_price') THEN
    ALTER TABLE public.plans ADD COLUMN renewal_price NUMERIC(10,2);
  END IF;
END $$;

-- 2. Upsert Canonical Plans (Starter ₹399, Growth ₹699, Business ₹1499 / Launch ₹1199)
INSERT INTO public.plans (
  id, name, slug, tagline, description, price_monthly, price_yearly, currency,
  features, limits, is_active, is_public, is_popular, sort_order,
  introductory_price, is_introductory_offer_active, renewal_price
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Starter',
  'starter',
  '7-Day Free Trial available · Perfect for single-printer kiosks',
  'Entry-level tier for local xerox and copy counters with 1 printer and up to 500 print jobs/month.',
  399.00,
  3830.00,
  'INR',
  '["500 print jobs per billing period", "1 registered printer connection", "1 shop location", "7-Day Free Starter Trial", "QR code generation & touchless upload", "PDF preview & print settings", "Customer online payment", "Automatic print execution", "Basic print queue & job history", "Pause / Resume / Cancel", "Basic sales dashboard"]'::jsonb,
  '{"printLimitMonthly": 500, "printerLimit": 1, "shopLimit": 1, "trialDays": 7, "smartPrinterSelection": false, "prioritySupport": false, "loadBalancing": false}'::jsonb,
  true,
  true,
  false,
  1,
  NULL,
  false,
  399.00
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_active = true,
  is_public = true,
  sort_order = 1,
  renewal_price = 399.00;

INSERT INTO public.plans (
  id, name, slug, tagline, description, price_monthly, price_yearly, currency,
  features, limits, is_active, is_public, is_popular, sort_order,
  introductory_price, is_introductory_offer_active, renewal_price
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Growth',
  'growth',
  'Recommended for busy college & market photocopy shops',
  'High-capacity operational plan supporting up to 5 printers, 2,000 monthly print jobs, and smart printer selection.',
  699.00,
  6710.00,
  'INR',
  '["Everything in Starter", "2,000 print jobs per billing period", "Up to 5 registered printer connections", "Smart printer selection", "Advanced print queue & priority spooling", "Priority job management", "Advanced sales analytics", "Printer performance reports", "Multiple printer management"]'::jsonb,
  '{"printLimitMonthly": 2000, "printerLimit": 5, "shopLimit": 1, "trialDays": 0, "smartPrinterSelection": true, "prioritySupport": false, "loadBalancing": false}'::jsonb,
  true,
  true,
  true,
  2,
  NULL,
  false,
  699.00
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_active = true,
  is_public = true,
  is_popular = true,
  sort_order = 2,
  renewal_price = 699.00;

INSERT INTO public.plans (
  id, name, slug, tagline, description, price_monthly, price_yearly, currency,
  features, limits, is_active, is_public, is_popular, sort_order,
  introductory_price, is_introductory_offer_active, renewal_price
) VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid,
  'Business',
  'business',
  'Introductory Offer ₹1,199/mo (Reg. ₹1,499) · Commercial hubs',
  'Full enterprise print automation with smart load balancing, automated queue optimization, up to 10 printers and 5,000 monthly jobs.',
  1499.00,
  14390.00,
  'INR',
  '["Everything in Growth", "5,000 print jobs per billing period", "Up to 10 registered printer connections", "Advanced smart load balancing", "Automated queue optimization", "Printer failure & jam monitoring", "Advanced analytics & custom reports", "Advanced printer management", "Priority technical support"]'::jsonb,
  '{"printLimitMonthly": 5000, "printerLimit": 10, "shopLimit": 1, "trialDays": 0, "smartPrinterSelection": true, "prioritySupport": true, "loadBalancing": true, "introductoryPrice": 1199, "regularPrice": 1499, "introOfferActive": true}'::jsonb,
  true,
  true,
  false,
  3,
  1199.00,
  true,
  1499.00
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_active = true,
  is_public = true,
  sort_order = 3,
  introductory_price = 1199.00,
  is_introductory_offer_active = true,
  renewal_price = 1499.00;

-- 3. Extend public.subscriptions to support comprehensive SaaS lifecycle states
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'trialing', 'active', 'past_due', 'cancelled', 'expired', 'suspended',
    'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'SUSPENDED'
  ));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'trial_start_at') THEN
    ALTER TABLE public.subscriptions ADD COLUMN trial_start_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'trial_end_at') THEN
    ALTER TABLE public.subscriptions ADD COLUMN trial_end_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'cancelled_at') THEN
    ALTER TABLE public.subscriptions ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'grace_period_end') THEN
    ALTER TABLE public.subscriptions ADD COLUMN grace_period_end TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'razorpay_subscription_id') THEN
    ALTER TABLE public.subscriptions ADD COLUMN razorpay_subscription_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'razorpay_payment_id') THEN
    ALTER TABLE public.subscriptions ADD COLUMN razorpay_payment_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'is_introductory_pricing') THEN
    ALTER TABLE public.subscriptions ADD COLUMN is_introductory_pricing BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'renewal_price') THEN
    ALTER TABLE public.subscriptions ADD COLUMN renewal_price NUMERIC(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'pending_downgrade_plan_id') THEN
    ALTER TABLE public.subscriptions ADD COLUMN pending_downgrade_plan_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'updated_at') THEN
    ALTER TABLE public.subscriptions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- 4. One-time 7-Day Trial History to prevent abuse across shop lifecycle
CREATE TABLE IF NOT EXISTS public.trial_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id TEXT NOT NULL UNIQUE,
  user_id UUID,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trial_history_shop_id ON public.trial_history(shop_id);

-- 5. Authoritative Usage Records (Track print jobs and printer connections per billing period)
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id TEXT NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  print_jobs_used INT NOT NULL DEFAULT 0,
  printer_connections_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_shop_billing_period UNIQUE (shop_id, billing_period_start)
);
CREATE INDEX IF NOT EXISTS idx_usage_records_shop_dates ON public.usage_records(shop_id, billing_period_start, billing_period_end);

-- 6. Subscription Lifecycle Audit Events
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  shop_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_events_shop_created ON public.subscription_events(shop_id, created_at DESC);

-- 7. Subscription Payment Transactions & Invoices
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id TEXT NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')) DEFAULT 'PENDING',
  billing_period TEXT NOT NULL DEFAULT 'MONTHLY',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_payments_shop ON public.subscription_payments(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_payments_order ON public.subscription_payments(razorpay_order_id);
