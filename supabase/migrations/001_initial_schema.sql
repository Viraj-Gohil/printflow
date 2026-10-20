-- PrintFlow: PostgreSQL Initial Schema for Supabase
-- Multi-tenant Xerox & Printing SaaS Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles (RBAC for Admin, Shop Owner, Customer)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SHOP_OWNER', 'CUSTOMER')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. SaaS Plans
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  tagline TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  print_limit INT NOT NULL DEFAULT 500,
  printer_limit INT NOT NULL DEFAULT 2,
  storage_limit_gb INT NOT NULL DEFAULT 5,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Shops (Tenants)
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'PENDING')) DEFAULT 'ACTIVE',
  is_open BOOLEAN NOT NULL DEFAULT true,
  business_hours TEXT DEFAULT '9:00 AM - 9:00 PM',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563EB',
  min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 2.00,
  auto_accept BOOLEAN NOT NULL DEFAULT true,
  file_retention_days INT NOT NULL DEFAULT 7,
  -- Shop Owner's Razorpay Gateway credentials
  razorpay_key_id TEXT,
  razorpay_key_secret TEXT,
  razorpay_upi_id TEXT,
  razorpay_enabled BOOLEAN NOT NULL DEFAULT false,
  razorpay_test_mode BOOLEAN NOT NULL DEFAULT true,
  current_plan_id UUID REFERENCES public.plans(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Shop Members (Maps User to Shop)
CREATE TABLE IF NOT EXISTS public.shop_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('SHOP_OWNER', 'STAFF')) DEFAULT 'SHOP_OWNER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(shop_id, user_id)
);

-- 6. Shop Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'TRIAL')) DEFAULT 'ACTIVE',
  billing_period TEXT NOT NULL CHECK (billing_period IN ('MONTHLY', 'YEARLY')) DEFAULT 'MONTHLY',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  current_period_end TIMESTAMPTZ NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_id TEXT,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Devices / Electron Print Agents
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  agent_version TEXT NOT NULL DEFAULT 'v1.0.0',
  status TEXT NOT NULL CHECK (status IN ('ONLINE', 'OFFLINE')) DEFAULT 'OFFLINE',
  auth_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  printer_count INT NOT NULL DEFAULT 0,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Printers
CREATE TABLE IF NOT EXISTS public.printers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL CHECK (status IN ('ONLINE', 'OFFLINE', 'BUSY', 'PAUSED')) DEFAULT 'ONLINE',
  capabilities JSONB NOT NULL DEFAULT '{"paperSizes":["A4"],"color":false,"duplex":true}'::jsonb,
  priority INT NOT NULL DEFAULT 1,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Shop Pricing Rules
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  paper_size TEXT NOT NULL CHECK (paper_size IN ('A4', 'A3', 'A5', 'Letter', 'Legal')),
  color_mode TEXT NOT NULL CHECK (color_mode IN ('BW', 'COLOR')),
  sides TEXT NOT NULL CHECK (sides IN ('SINGLE', 'DOUBLE')),
  price_per_page NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(shop_id, paper_size, color_mode, sides)
);

-- 10. Print Jobs
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_code TEXT NOT NULL UNIQUE, -- e.g. PRT-1024
  tracking_token TEXT NOT NULL UNIQUE, -- secure unguessable token for guest lookups
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(10,2) NOT NULL,
  file_status TEXT NOT NULL CHECK (file_status IN ('UPLOADING', 'UPLOADED', 'VERIFIED', 'FAILED')) DEFAULT 'UPLOADED',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUND_PENDING', 'REFUNDED')) DEFAULT 'PENDING',
  print_status TEXT NOT NULL CHECK (print_status IN (
    'CREATED', 'QUEUED', 'ASSIGNED', 'DOWNLOADING', 'PRINTING', 
    'COMPLETED', 'FAILED', 'PRINT_INTERRUPTED', 'REQUIRES_ATTENTION', 'CANCELLED'
  )) DEFAULT 'QUEUED',
  payment_method TEXT NOT NULL DEFAULT 'DEMO',
  payment_id TEXT,
  assigned_printer_id UUID REFERENCES public.printers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 11. Payment Transactions
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.print_jobs(id) ON DELETE SET NULL,
  order_code TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PENDING', 'FAILED', 'REFUNDED')),
  payment_gateway TEXT NOT NULL CHECK (payment_gateway IN ('RAZORPAY', 'DEMO')),
  gateway_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. Platform Global Settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id INT PRIMARY KEY DEFAULT 1,
  razorpay_key_id TEXT,
  razorpay_key_secret TEXT,
  razorpay_webhook_secret TEXT,
  razorpay_test_mode BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'INR',
  platform_fee_percent NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  support_email TEXT NOT NULL DEFAULT 'support@printflow.in',
  auto_shop_approval BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')) DEFAULT 'MEDIUM',
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')) DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_status ON public.print_jobs (shop_id, print_status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_created ON public.print_jobs (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_tracking_token ON public.print_jobs (tracking_token);
CREATE INDEX IF NOT EXISTS idx_print_jobs_order_code ON public.print_jobs (order_code);
CREATE INDEX IF NOT EXISTS idx_printers_shop_status ON public.printers (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_shop_status ON public.devices (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_shop_created ON public.payments (shop_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Sample RLS policies:
-- Platform admin bypass helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Shop Owner check
CREATE OR REPLACE FUNCTION public.is_shop_owner(check_shop_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members 
    WHERE user_id = auth.uid() AND shop_id = check_shop_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Policy: Shops can be read by public if active (for /s/[shopSlug])
DROP POLICY IF EXISTS "Public shops viewable by everyone" ON public.shops;
CREATE POLICY "Public shops viewable by everyone" ON public.shops
  FOR SELECT USING (status = 'ACTIVE');

-- Policy: Shop Owners can manage their own shop
DROP POLICY IF EXISTS "Shop owners manage their shop" ON public.shops;
CREATE POLICY "Shop owners manage their shop" ON public.shops
  FOR ALL USING (is_admin() OR is_shop_owner(id));

-- Policy: Print Jobs - Shop owners can see jobs for their shop only
DROP POLICY IF EXISTS "Shop owners view their jobs" ON public.print_jobs;
CREATE POLICY "Shop owners view their jobs" ON public.print_jobs
  FOR SELECT USING (is_admin() OR is_shop_owner(shop_id));

DROP POLICY IF EXISTS "Customers view their own jobs" ON public.print_jobs;
CREATE POLICY "Customers view their own jobs" ON public.print_jobs
  FOR SELECT USING (customer_id = auth.uid());
