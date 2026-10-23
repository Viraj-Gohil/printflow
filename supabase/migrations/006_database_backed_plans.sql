-- PrintFlow Migration 006: Enhanced Database-Backed SaaS Plans & Pricing
-- Implements complete schema for dynamic SaaS subscription plans & limits

-- 1. Ensure uuid extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create or adapt public.plans table
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT,
  tagline TEXT,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Safely add missing columns if table already existed with older schema
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'slug') THEN
    ALTER TABLE public.plans ADD COLUMN slug TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'description') THEN
    ALTER TABLE public.plans ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'currency') THEN
    ALTER TABLE public.plans ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'limits') THEN
    ALTER TABLE public.plans ADD COLUMN limits JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'is_public') THEN
    ALTER TABLE public.plans ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'sort_order') THEN
    ALTER TABLE public.plans ADD COLUMN sort_order INT NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'is_popular') THEN
    ALTER TABLE public.plans ADD COLUMN is_popular BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'tagline') THEN
    ALTER TABLE public.plans ADD COLUMN tagline TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'updated_at') THEN
    ALTER TABLE public.plans ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- 4. Backfill slugs and limits for existing plans if needed
UPDATE public.plans
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

UPDATE public.plans
SET limits = jsonb_build_object(
  'printLimitMonthly', COALESCE(NULLIF(print_limit, 0), 500),
  'printerLimit', COALESCE(NULLIF(printer_limit, 0), 2),
  'storageLimitMb', COALESCE(NULLIF(storage_limit_gb * 1024, 0), 5120),
  'staffLimit', 2,
  'maxUploadSizeMb', 35,
  'fileRetentionHours', 48
)
WHERE limits IS NULL OR limits = '{}'::jsonb;

-- 5. Indexes and constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_slug ON public.plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_active_public_sort ON public.plans(is_active, is_public, sort_order ASC, price_monthly ASC);

-- 6. Seed canonical plans if table is empty
INSERT INTO public.plans (
  id, name, slug, tagline, description, price_monthly, price_yearly, currency, features, limits, is_active, is_public, is_popular, sort_order
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Starter',
  'starter',
  'For small photocopy shops testing the platform',
  'Entry-level plan for local xerox kiosks testing touchless QR ordering.',
  0.00,
  0.00,
  'INR',
  '["Up to 100 prints/month", "1 Counter QR Stand", "Desktop Print Agent (1 PC)", "Razorpay & UPI Payments"]'::jsonb,
  '{"printerLimit": 1, "printLimitMonthly": 100, "storageLimitMb": 1000, "staffLimit": 1, "maxUploadSizeMb": 25, "fileRetentionHours": 24}'::jsonb,
  true,
  true,
  false,
  1
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'starter' OR name = 'Starter');

INSERT INTO public.plans (
  id, name, slug, tagline, description, price_monthly, price_yearly, currency, features, limits, is_active, is_public, is_popular, sort_order
)
SELECT
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Growth',
  'growth',
  'For busy college-area xerox & copy shops',
  'Designed for independent high-traffic counters handling regular daily college and market footfall.',
  499.00,
  399.00,
  'INR',
  '["Unlimited Monthly Prints", "3 Printable Counter QR Stands", "Multi-Printer Spooling (B&W + Color)", "Daily Revenue & Accounting Reports", "Priority WhatsApp Support"]'::jsonb,
  '{"printerLimit": 3, "printLimitMonthly": 5000, "storageLimitMb": 10000, "staffLimit": 3, "maxUploadSizeMb": 40, "fileRetentionHours": 48}'::jsonb,
  true,
  true,
  true,
  2
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'growth' OR name = 'Growth');

INSERT INTO public.plans (
  id, name, slug, tagline, description, price_monthly, price_yearly, currency, features, limits, is_active, is_public, is_popular, sort_order
)
SELECT
  '00000000-0000-0000-0000-000000000003'::uuid,
  'Commercial Pro Hub',
  'commercial-pro-hub',
  'For high-volume xerox centers & busy campus hubs',
  'Complete operational system with desktop agent auto-spooling and multi-device routing for busy print centers.',
  999.00,
  799.00,
  'INR',
  '["Up to 20 Connected Printers", "Multiple Cashier Logins", "Custom Branding & Domain", "Dedicated Account Manager"]'::jsonb,
  '{"printerLimit": 20, "printLimitMonthly": 50000, "storageLimitMb": 50000, "staffLimit": 10, "maxUploadSizeMb": 50, "fileRetentionHours": 72}'::jsonb,
  true,
  true,
  false,
  3
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE slug = 'commercial-pro-hub' OR name = 'Commercial Pro Hub');
