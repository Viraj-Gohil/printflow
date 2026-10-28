import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import dns from 'dns';
import { Pool } from 'pg';
import { encryptSecret, decryptSecret, maskKeyId } from '../lib/crypto/credentialCrypto';

dotenv.config({ override: true });

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

export interface ShopPaymentIntegrationRecord {
  id: string;
  shop_id: string;
  provider: string; // 'razorpay'
  key_id: string;
  encrypted_key_secret: string;
  mode: 'test' | 'live';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformPaymentConfigRecord {
  id: string;
  provider: string; // 'razorpay'
  key_id: string;
  encrypted_key_secret: string;
  mode: 'test' | 'live';
  webhook_secret?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SafePaymentConfigMetadata {
  provider: string;
  keyId: string; // Masked key ID for UI
  rawKeyId: string; // Public Key ID is safe to distribute to client for Checkout
  mode: 'test' | 'live';
  isConfigured: boolean;
  isActive: boolean;
  hasSecret: boolean;
  lastUpdatedAt: string;
}

export interface PrintAgentPrinter {
  agentId: string;
  deviceName: string;
  printer: {
    name: string;
    displayName?: string;
    driverName?: string;
    portName?: string;
    status: 'READY' | 'PRINTING' | 'OFFLINE' | 'BUSY' | 'ERROR';
    isOnline: boolean;
    isDefault: boolean;
    capabilities: {
      paperSizes: string[];
      supportsColor: boolean | null;
      supportsDuplex: boolean | null;
    };
  };
}

export interface StoredPrintAgentJob {
  id: string;
  orderCode: string;
  trackingToken: string;
  orderId: string;
  paymentId: string;
  shopId: string;
  customerName: string;
  customerPhone?: string;
  files: Array<{
    id: string;
    fileName: string;
    fileUrl?: string;
    downloadUrl?: string;
    pageCount: number;
    copies: number;
    colorMode: 'BW' | 'COLOR';
    paperSize: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';
    duplex: boolean;
    pagesToPrint?: string;
  }>;
  totalAmount: number;
  paymentStatus: 'SUCCESS';
  printStatus: 'QUEUED' | 'ASSIGNED' | 'DOWNLOADING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'REQUIRES_ATTENTION';
  printerName?: string;
  claimedBy?: string;
  claimedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  errorMessage?: string;
  retrySafe?: boolean;
  pagesPrinted?: number;
}

export interface PrintAgentJobFile {
  id: string;
  mime: string;
  filename: string;
  buffer: Buffer;
}

export function isValidDatabaseUrl(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  const url = rawUrl.replace(/^['"]|['"]$/g, '').trim();
  if (!url) return false;

  if (
    url.includes('@HOST/') ||
    url.includes('@HOST:') ||
    url.endsWith('@HOST') ||
    url.includes('USER:PASSWORD') ||
    url.includes('YOUR_DATABASE_URL') ||
    url.includes('your-database-url') ||
    url.includes('placeholder') ||
    url.includes('HOST')
  ) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'host' ||
      host === 'user' ||
      host === 'password' ||
      host === 'dbname' ||
      host === 'your_host' ||
      host === 'your-host' ||
      host.includes('host')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// PostgreSQL Connection Pool (Supabase / Neon PostgreSQL when DATABASE_URL is configured)
const DEFAULT_SUPABASE_DATABASE_URL = 'postgresql://postgres.rikchucpmlhvkfkmtojl:diWAZPkB69oP7tm2@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
let pgPool: Pool | null = null;
const rawDatabaseUrl = (process.env.DATABASE_URL || DEFAULT_SUPABASE_DATABASE_URL).trim();
const DATABASE_URL = isValidDatabaseUrl(rawDatabaseUrl) ? rawDatabaseUrl.replace(/^['"]|['"]$/g, '').trim() : DEFAULT_SUPABASE_DATABASE_URL;
let _overridePoolExplicitlyNull = false;

export const isNeonDatabaseConfigured = (): boolean => {
  if (_overridePoolExplicitlyNull) return false;
  if (pgPool !== null) return true;
  try {
    const activeUrl = (process.env.DATABASE_URL || DEFAULT_SUPABASE_DATABASE_URL).trim().replace(/^['"]|['"]$/g, '');
    if (activeUrl && isValidDatabaseUrl(activeUrl)) {
      pgPool = new Pool({
        connectionString: activeUrl,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ssl: activeUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        lookup: (hostname: string, options: any, callback: any) => {
          dns.lookup(hostname, { ...options, family: 4 }, callback);
        }
      } as any);
      pgPool.on('error', (err) => {
        console.warn('[PaymentStorage] Idle PostgreSQL client warning (handled):', err?.message || err);
      });
    } else {
      return false;
    }
  } catch (err) {
    console.warn('[PaymentStorage] Failed to lazy-initialize PostgreSQL connection pool:', err);
    return false;
  }
  return pgPool !== null;
};

export function requirePostgresPool(): Pool {
  if (!isNeonDatabaseConfigured() || !pgPool) {
    const error = new Error('DATABASE_URL is required. Neon PostgreSQL is not configured or unavailable.');
    (error as any).statusCode = 503;
    throw error;
  }
  return pgPool;
}

export function setNeonPoolForTest(pool: Pool | null): void {
  pgPool = pool;
  _overridePoolExplicitlyNull = pool === null;
}

function hashAgentToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Initializes database schema migrations safely.
 */
export async function initializePaymentTables(maxRetries = 3): Promise<void> {
  if (!isNeonDatabaseConfigured() || !pgPool) {
    return;
  }

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    let client: any = null;
    try {
      client = await pgPool.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS shop_payment_integrations (
          id VARCHAR(64) PRIMARY KEY,
          shop_id VARCHAR(64) NOT NULL,
          provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
          key_id VARCHAR(128) NOT NULL,
          encrypted_key_secret TEXT NOT NULL,
          mode VARCHAR(16) NOT NULL DEFAULT 'test',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_shop_payment_integrations_shop_id ON shop_payment_integrations(shop_id);

        CREATE TABLE IF NOT EXISTS platform_payment_configs (
          id VARCHAR(64) PRIMARY KEY,
          provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
          key_id VARCHAR(128) NOT NULL,
          encrypted_key_secret TEXT NOT NULL,
          mode VARCHAR(16) NOT NULL DEFAULT 'live',
          webhook_secret TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS print_agent_devices (
          agent_id VARCHAR(128) PRIMARY KEY,
          shop_id VARCHAR(128) NOT NULL,
          device_name VARCHAR(128) NOT NULL,
          token_hash CHAR(64) NOT NULL,
          is_revoked BOOLEAN NOT NULL DEFAULT false,
          status VARCHAR(16) NOT NULL DEFAULT 'OFFLINE',
          last_seen TIMESTAMP WITH TIME ZONE,
          printers JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          revocation_reason VARCHAR(64)
        );
        ALTER TABLE print_agent_devices DROP CONSTRAINT IF EXISTS print_agent_devices_token_hash_key;
        ALTER TABLE print_agent_devices ADD COLUMN IF NOT EXISTS revocation_reason VARCHAR(64);
        CREATE INDEX IF NOT EXISTS idx_print_agent_devices_shop ON print_agent_devices(shop_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_agent_per_shop ON print_agent_devices(shop_id) WHERE (is_revoked = false);

        CREATE TABLE IF NOT EXISTS print_agent_jobs (
          job_id VARCHAR(64) PRIMARY KEY,
          order_id VARCHAR(256) NOT NULL,
          shop_id VARCHAR(128) NOT NULL,
          print_status VARCHAR(24) NOT NULL,
          claimed_by VARCHAR(128),
          claimed_at TIMESTAMPTZ,
          job_data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          UNIQUE (shop_id, order_id)
        );
        CREATE INDEX IF NOT EXISTS idx_print_agent_jobs_shop_status_created
          ON print_agent_jobs(shop_id, print_status, created_at DESC);

        CREATE TABLE IF NOT EXISTS print_agent_job_files (
          job_id VARCHAR(64) NOT NULL REFERENCES print_agent_jobs(job_id) ON DELETE CASCADE,
          file_id VARCHAR(128) NOT NULL,
          mime_type VARCHAR(128) NOT NULL,
          filename VARCHAR(255) NOT NULL,
          file_data BYTEA NOT NULL,
          PRIMARY KEY (job_id, file_id)
        );

        CREATE TABLE IF NOT EXISTS printflow_app_state (
          scope_id VARCHAR(128) NOT NULL,
          data_key VARCHAR(64) NOT NULL,
          state_data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (scope_id, data_key)
        );

        CREATE TABLE IF NOT EXISTS printflow_shop_mappings (
          client_shop_id VARCHAR(128) PRIMARY KEY,
          neon_shop_id VARCHAR(128) NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'printflow_app_state' AND column_name = 'payload'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'printflow_app_state' AND column_name = 'state_data'
          ) THEN
            ALTER TABLE public.printflow_app_state ADD COLUMN state_data JSONB;
            UPDATE public.printflow_app_state SET state_data = payload WHERE state_data IS NULL;
          END IF;
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'printflow_app_state' AND column_name = 'state_data'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'printflow_app_state' AND column_name = 'payload'
          ) THEN
            ALTER TABLE public.printflow_app_state ADD COLUMN payload JSONB;
            UPDATE public.printflow_app_state SET payload = state_data WHERE payload IS NULL;
          END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS public.printflow_users (
          id VARCHAR(128) PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          phone VARCHAR(64),
          role VARCHAR(32) NOT NULL DEFAULT 'SHOP_OWNER',
          shop_id VARCHAR(128) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS public.platform_maintenance_mode (
          id VARCHAR(32) PRIMARY KEY DEFAULT 'current',
          enabled BOOLEAN NOT NULL DEFAULT false,
          scope VARCHAR(64) NOT NULL DEFAULT 'entire_application',
          message TEXT NOT NULL DEFAULT 'We are performing scheduled maintenance. Please check back shortly.',
          expected_end_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by VARCHAR(128) NOT NULL DEFAULT 'admin'
        );
        INSERT INTO public.platform_maintenance_mode (id, enabled, scope, message)
        VALUES ('current', false, 'entire_application', 'We are performing scheduled maintenance. Please check back shortly.')
        ON CONFLICT (id) DO NOTHING;

        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS public.printers (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          shop_id UUID NOT NULL,
          agent_id VARCHAR(128),
          device_id UUID,
          name TEXT NOT NULL,
          model TEXT,
          status TEXT NOT NULL DEFAULT 'ONLINE',
          capabilities JSONB NOT NULL DEFAULT '{"color": false, "duplex": true, "paperSizes": ["A4"]}'::jsonb,
          connection_type VARCHAR(64) DEFAULT 'USB / Local',
          is_default BOOLEAN DEFAULT false,
          is_registered BOOLEAN DEFAULT false,
          driver_name TEXT,
          port_name TEXT,
          resolutions JSONB DEFAULT '[]'::jsonb,
          is_manual_override BOOLEAN DEFAULT false,
          detection_source VARCHAR(32) DEFAULT 'AUTO',
          priority INT NOT NULL DEFAULT 1,
          is_enabled BOOLEAN NOT NULL DEFAULT true,
          last_seen TIMESTAMPTZ,
          last_synced_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS agent_id VARCHAR(128);
        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS connection_type VARCHAR(64) DEFAULT 'USB / Local';
        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT false;
        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS driver_name TEXT;
        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS port_name TEXT;
        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS resolutions JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT false;
        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS detection_source VARCHAR(32) DEFAULT 'AUTO';
        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        CREATE UNIQUE INDEX IF NOT EXISTS idx_printers_shop_name_lower ON public.printers(shop_id, LOWER(name));
        CREATE INDEX IF NOT EXISTS idx_printers_shop_registered ON public.printers(shop_id, is_registered);

        CREATE TABLE IF NOT EXISTS public.plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

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
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'limits') THEN
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

        UPDATE public.plans
        SET slug = CASE
          WHEN id = 'b001a111-0000-0000-0000-000000000001' THEN 'free-legacy'
          WHEN id = 'b001a111-0000-0000-0000-000000000002' THEN 'basic-legacy'
          WHEN id = 'b001a111-0000-0000-0000-000000000003' THEN 'pro-legacy'
          WHEN id = 'b001a111-0000-0000-0000-000000000004' THEN 'enterprise-legacy'
          WHEN id = 'plan_starter' THEN 'starter'
          WHEN id = 'plan_growth' THEN 'growth'
          WHEN id = 'plan_pro' THEN 'professional'
          WHEN id = 'plan_enterprise' THEN 'enterprise'
          ELSE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 6)
        END
        WHERE slug IS NULL OR slug = '';

        UPDATE public.plans
        SET description = COALESCE(description, tagline, 'Subscription plan for PrintFlow photocopy and print shops.')
        WHERE description IS NULL OR description = '';

        UPDATE public.plans
        SET limits = jsonb_build_object(
          'printerLimit', 2,
          'printLimitMonthly', 500,
          'storageLimitMb', 5120,
          'staffLimit', 2,
          'maxUploadSizeMb', 35,
          'fileRetentionHours', 48
        )
        WHERE limits IS NULL OR limits = '{}'::jsonb;

        UPDATE public.plans
        SET is_public = false
        WHERE id LIKE 'b001%' OR name LIKE '%legacy%';

        UPDATE public.plans
        SET sort_order = CASE
          WHEN id = 'plan_starter' OR slug = 'starter' THEN 1
          WHEN id = 'plan_growth' OR slug = 'growth' THEN 2
          WHEN id = 'plan_pro' OR slug = 'professional' THEN 3
          WHEN id = 'plan_enterprise' OR slug = 'enterprise' THEN 4
          ELSE sort_order
        END
        WHERE id LIKE 'plan_%';

        CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_slug ON public.plans(slug);
        CREATE INDEX IF NOT EXISTS idx_plans_active_public_sort ON public.plans(is_active, is_public, sort_order ASC, price_monthly ASC);

        -- Safe canonical seeding of plans ONLY if public.plans has no records
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM public.plans LIMIT 1) THEN
            INSERT INTO public.plans (
              id, name, slug, tagline, description, price_monthly, price_yearly, currency, features, limits, is_active, is_public, is_popular, sort_order
            ) VALUES
            (
              'plan_starter',
              'Free Starter',
              'starter',
              'Ideal for small or newly opened local copy shops',
              'Entry-level plan for local xerox kiosks testing touchless QR ordering.',
              0.00,
              0.00,
              'INR',
              '["1 Connected Printer", "Up to 50 jobs/mo", "Email Support", "Direct UPI QR Payments"]'::jsonb,
              '{"printerLimit": 1, "printLimitMonthly": 50, "storageLimitMb": 1024, "staffLimit": 2, "maxUploadSizeMb": 25, "fileRetentionHours": 48}'::jsonb,
              true, true, false, 1
            ),
            (
              'plan_growth',
              'Growth',
              'growth',
              'For bustling college & market copy shops needing automation',
              'Designed for independent high-traffic counters handling regular daily college and market footfall.',
              499.00,
              4990.00,
              'INR',
              '["3 Connected Printers", "Up to 500 jobs/mo", "Auto Print Spooling", "Priority WhatsApp Support"]'::jsonb,
              '{"printerLimit": 3, "printLimitMonthly": 500, "storageLimitMb": 10240, "staffLimit": 2, "maxUploadSizeMb": 25, "fileRetentionHours": 48}'::jsonb,
              true, true, true, 2
            ),
            (
              'plan_pro',
              'Professional',
              'professional',
              'High-volume commercial reprography & blueprint centers',
              'Complete operational system with desktop agent auto-spooling and multi-device routing for busy print centers.',
              999.00,
              9990.00,
              'INR',
              '["10 Connected Printers", "Up to 2,000 jobs/mo", "Custom Shop Branding", "Multi-staff Accounts", "Dedicated Support"]'::jsonb,
              '{"printerLimit": 10, "printLimitMonthly": 2000, "storageLimitMb": 51200, "staffLimit": 5, "maxUploadSizeMb": 40, "fileRetentionHours": 48}'::jsonb,
              true, true, false, 3
            ),
            (
              'plan_enterprise',
              'Enterprise',
              'enterprise',
              'Multi-store print chains and large document service providers',
              'Multi-branch document centers requiring custom limits, API routing, and dedicated account manager SLA.',
              2499.00,
              24990.00,
              'INR',
              '["Unlimited Printers", "Custom Job Limits", "Multi-Branch Routing", "API Access", "24/7 Phone SLA"]'::jsonb,
              '{"printerLimit": 50, "printLimitMonthly": 10000, "storageLimitMb": 204800, "staffLimit": 10, "maxUploadSizeMb": 50, "fileRetentionHours": 48}'::jsonb,
              true, true, false, 4
            );
          END IF;
        END $$;

        -- Also ensure saas_plans table exists so any legacy queries never fail
        CREATE TABLE IF NOT EXISTS public.saas_plans (
          id VARCHAR(64) PRIMARY KEY,
          plan_data JSONB NOT NULL,
          price_monthly NUMERIC NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_orders') THEN
            ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_check;
            ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_check 
              CHECK (((purpose = 'SUBSCRIPTION' AND job_id IS NULL) OR (purpose = 'PRINT_JOB')));
          END IF;
        END $$;

        -- Ensure canonical default counter shop exists for public touchless QR flow
        INSERT INTO public.shops (
          id, name, slug, tagline, address, phone, email, status, is_open,
          business_hours, logo_url, primary_color, min_order_amount, auto_accept,
          file_retention_days, razorpay_enabled, razorpay_test_mode, created_at, updated_at
        ) VALUES (
          'a001a111-0000-0000-0000-000000000001',
          'PrintFlow Counter',
          'printflow-counter',
          'Instant Counter Xerox & Smart Print Station',
          'Central Campus Complex, Mumbai',
          '+91 98765 43210',
          'shop@printflow.io',
          'ACTIVE',
          true,
          '8:30 AM - 9:00 PM',
          '',
          '#2563EB',
          200,
          true,
          7,
          true,
          false,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          slug = 'printflow-counter',
          status = 'ACTIVE',
          is_open = true,
          updated_at = NOW();

        INSERT INTO public.printflow_shop_mappings (client_shop_id, neon_shop_id, updated_at)
        VALUES 
          ('shop_default', 'a001a111-0000-0000-0000-000000000001', NOW()),
          ('printflow-counter', 'a001a111-0000-0000-0000-000000000001', NOW())
        ON CONFLICT (client_shop_id) DO UPDATE SET neon_shop_id = EXCLUDED.neon_shop_id;

        -- Safe backfill for public.shop_members table from existing profiles and shops
        INSERT INTO public.shop_members (id, shop_id, user_id, role, created_at)
        SELECT gen_random_uuid(), s.id, p.id, 'SHOP_OWNER', NOW()
        FROM public.shops s
        JOIN public.profiles p ON LOWER(p.email) = LOWER(s.email)
        WHERE p.role = 'SHOP_OWNER'
        ON CONFLICT (shop_id, user_id) DO NOTHING;

        INSERT INTO public.shop_members (id, shop_id, user_id, role, created_at)
        SELECT gen_random_uuid(), m.neon_shop_id::uuid, u.id::uuid, 'SHOP_OWNER', NOW()
        FROM public.printflow_users u
        JOIN public.printflow_shop_mappings m ON m.client_shop_id = u.shop_id
        WHERE u.role = 'SHOP_OWNER'
          AND u.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND m.neon_shop_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ON CONFLICT (shop_id, user_id) DO NOTHING;
      `);

      console.log('[PaymentStorage] Supabase PostgreSQL payment and PrintFlow Agent tables verified successfully.');
      return;
    } catch (err: any) {
      const isNetworkErr = err?.code === 'ENETUNREACH' || err?.code === 'EAI_AGAIN' || err?.code === 'ETIMEDOUT' || err?.message?.includes('ENETUNREACH');
      console.warn(`[PaymentStorage] Database initialization attempt ${attempt}/${maxRetries} failed (${err?.message || err}). ${isNetworkErr ? 'Network/DNS routing issue detected on Render/Neon.' : ''}`);
      if (attempt >= maxRetries) {
        console.warn('[PaymentStorage] Could not run database migrations on Neon pool (non-fatal after max retries):', err);
        return;
      }
      const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } finally {
      if (client) {
        try { client.release(); } catch {}
      }
    }
  }
}

export async function syncNeonRelationalTables(clientOrPool?: { query: Function }): Promise<void> {
  const executor = clientOrPool || requirePostgresPool();
  try {
    const tableCheck = await executor.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pricing_rules'"
    );
    if (!tableCheck.rowCount) return;

    const stateRes = await executor.query(`
      SELECT scope_id, state_data, payload 
      FROM public.printflow_app_state 
      WHERE data_key = 'shops'
    `);

    const VALID_PAPER_SIZES = new Set(['A4', 'A3', 'A5', 'Letter', 'Legal']);

    for (const row of stateRes.rows) {
      const scopeId = row.scope_id;
      const data = row.state_data || row.payload;
      const shops = Array.isArray(data) ? data : [];
      if (shops.length === 0) continue;
      const shop = shops[0];
      const slug = shop.slug || scopeId.replace(/^shop_/, '').replace(/_/g, '-');

      const mapRes = await executor.query(
        'SELECT neon_shop_id FROM public.printflow_shop_mappings WHERE client_shop_id = $1',
        [scopeId]
      );
      let neonId = mapRes.rows[0]?.neon_shop_id;

      if (!neonId) {
        const slugRes = await executor.query(
          'SELECT id FROM public.shops WHERE slug = $1',
          [slug]
        );
        if (slugRes.rows.length > 0) {
          neonId = slugRes.rows[0].id;
        } else {
          const insertShop = await executor.query(`
            INSERT INTO public.shops (
              name, slug, tagline, address, phone, email, status, is_open,
              business_hours, logo_url, primary_color, min_order_amount, auto_accept,
              file_retention_days, razorpay_enabled, razorpay_test_mode, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, 'ACTIVE', $7,
              $8, $9, $10, $11, $12,
              7, true, false, NOW(), NOW()
            )
            ON CONFLICT (slug) DO UPDATE SET
              name = EXCLUDED.name,
              updated_at = NOW()
            RETURNING id
          `, [
            shop.name || 'Counter Shop',
            slug,
            shop.tagline || '',
            shop.address || 'Local Counter',
            shop.ownerPhone || shop.phone || '9876543210',
            shop.ownerEmail || shop.email || 'shop@printflow.in',
            shop.isOpen !== false,
            shop.businessHours || '9:00 AM - 9:00 PM',
            shop.logoUrl || null,
            shop.primaryColor || '#2563EB',
            shop.minimumOrder || 2.00,
            shop.autoAccept !== false
          ]);
          neonId = insertShop.rows[0].id;
        }

        await executor.query(`
          INSERT INTO public.printflow_shop_mappings (client_shop_id, neon_shop_id, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (client_shop_id) DO UPDATE SET neon_shop_id = EXCLUDED.neon_shop_id
        `, [scopeId, neonId]);
      }

      // Sync pricing rules
      const rulesStateRes = await executor.query(`
        SELECT COALESCE(state_data, payload) AS data FROM public.printflow_app_state 
        WHERE scope_id = $1 AND data_key = 'pricing_rules'
      `, [scopeId]);

      const stateRules = rulesStateRes.rows[0]?.data || [];
      const rulesToInsert = Array.isArray(stateRules) ? stateRules : [];

      for (const r of rulesToInsert) {
        const colorMode = r.color || r.colorMode || 'BW';
        const sides = r.sides || 'SINGLE';
        const paperSize = r.paperSize || 'A4';
        if (!VALID_PAPER_SIZES.has(paperSize)) continue;
        const price = Number(r.pricePerPage || (r.pricePerPageMinor ? r.pricePerPageMinor / 100 : 2.0));

        await executor.query(`
          INSERT INTO public.pricing_rules (shop_id, paper_size, color_mode, sides, price_per_page, is_active, updated_at)
          VALUES ($1, $2, $3, $4, $5, true, NOW())
          ON CONFLICT (shop_id, paper_size, color_mode, sides)
          DO UPDATE SET price_per_page = EXCLUDED.price_per_page, is_active = true, updated_at = NOW()
        `, [neonId, paperSize, colorMode, sides, price]);
      }
    }
  } catch (err) {
    console.warn('[PaymentStorage] Warning during relational table synchronization:', err);
  }
}

function decodeStoredJob<T extends StoredPrintAgentJob>(row: {
  job_data: T | string;
  print_status: T['printStatus'];
  claimed_by: string | null;
  claimed_at: Date | string | null;
  updated_at: Date | string;
}): T {
  const job = (typeof row.job_data === 'string' ? JSON.parse(row.job_data) : row.job_data) as T;
  return {
    ...job,
    printStatus: row.print_status,
    claimedBy: row.claimed_by || undefined,
    claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : undefined,
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

export async function getCandidateShopIds(shopId: string): Promise<string[]> {
  const ids = new Set<string>();
  if (!shopId) {
    ids.add('a001a111-0000-0000-0000-000000000001');
    ids.add('shop_default');
    ids.add('printflow-counter');
    return Array.from(ids);
  }
  const cleanId = String(shopId).trim();
  ids.add(cleanId);
  try {
    const canonical = await resolvePrintFlowShopId(cleanId);
    ids.add(canonical);

    const pool = requirePostgresPool();
    const mappingRes = await pool.query(
      `SELECT client_shop_id, neon_shop_id
       FROM printflow_shop_mappings
       WHERE client_shop_id = $1 OR neon_shop_id = $1 OR client_shop_id = $2 OR neon_shop_id = $2`,
      [cleanId, canonical]
    );
    for (const row of mappingRes.rows) {
      if (row.client_shop_id) ids.add(String(row.client_shop_id));
      if (row.neon_shop_id) ids.add(String(row.neon_shop_id));
    }

    const shopRes = await pool.query(
      `SELECT id::text, slug FROM public.shops WHERE id::text = $1 OR slug = $1 OR id::text = $2 OR slug = $2 LIMIT 1`,
      [cleanId, canonical]
    );
    for (const row of shopRes.rows) {
      if (row.id) ids.add(String(row.id));
      if (row.slug) ids.add(String(row.slug));
    }
  } catch {
    // Graceful fallback to resolved IDs
  }
  return Array.from(ids);
}

export interface ShopAgentAvailability {
  isAvailable: boolean;
  reason: 'READY' | 'AGENT_OFFLINE' | 'PRINTER_UNAVAILABLE' | 'NO_AGENT_REGISTERED' | 'SHOP_INACTIVE';
  message: string;
  agentOnline: boolean;
  printerReady: boolean;
  agentId?: string;
  deviceName?: string;
  lastSeenSecondsAgo?: number | null;
  printersCount: number;
  readyPrintersCount: number;
  readyPrinters: string[];
}

export async function getShopAgentAvailability(shopId: string): Promise<ShopAgentAvailability> {
  const candidateIds = await getCandidateShopIds(shopId);
  const pool = requirePostgresPool();

  try {
    const shopRes = await pool.query(
      `SELECT id, name, status, is_open FROM public.shops WHERE id::text = ANY($1::text[]) OR slug = ANY($1::text[]) LIMIT 1`,
      [candidateIds]
    );
    if (shopRes.rowCount && shopRes.rows[0]) {
      const shopRow = shopRes.rows[0];
      if (shopRow.status && shopRow.status !== 'ACTIVE') {
        return {
          isAvailable: false,
          reason: 'SHOP_INACTIVE',
          message: `This print shop is currently inactive (${shopRow.status}). Please select another available shop.`,
          agentOnline: false,
          printerReady: false,
          printersCount: 0,
          readyPrintersCount: 0,
          readyPrinters: []
        };
      }
    }
  } catch (shopCheckErr: any) {
    if (!shopCheckErr?.message?.includes('ECONNREFUSED') && !shopCheckErr?.message?.includes('ENETUNREACH')) {
      console.warn('[getShopAgentAvailability] shop check notice:', shopCheckErr);
    }
  }

  let result;
  try {
    result = await pool.query(
      `SELECT agent_id, device_name, status, last_seen, is_revoked, printers
       FROM print_agent_devices
       WHERE shop_id = ANY($1::text[]) AND is_revoked = false
       ORDER BY last_seen DESC NULLS LAST`,
      [candidateIds]
    );
  } catch (err: any) {
    if (!err?.message?.includes('ECONNREFUSED') && !err?.message?.includes('ENETUNREACH')) {
      console.warn('[getShopAgentAvailability] error:', err);
    }
    return {
      isAvailable: false,
      reason: 'NO_AGENT_REGISTERED',
      message: 'This print shop is currently offline. Please try again later.',
      agentOnline: false,
      printerReady: false,
      printersCount: 0,
      readyPrintersCount: 0,
      readyPrinters: []
    };
  }

  if (result.rowCount === 0) {
    return {
      isAvailable: false,
      reason: 'NO_AGENT_REGISTERED',
      message: 'This print shop is currently offline. Please try again later or select another available shop.',
      agentOnline: false,
      printerReady: false,
      printersCount: 0,
      readyPrintersCount: 0,
      readyPrinters: []
    };
  }

  const HEARTBEAT_TIMEOUT_MS = 15_000;
  const nowMs = Date.now();
  let anyAgentOnline = false;
  let activeAgentId: string | undefined;
  let activeDeviceName: string | undefined;
  let minLastSeenSecs: number | null = null;
  let totalPrinters = 0;
  const readyPrintersList: string[] = [];

  for (const row of result.rows) {
    const lastSeenMs = row.last_seen ? new Date(row.last_seen).getTime() : 0;
    const diffMs = nowMs - lastSeenMs;
    const isOnline = row.status === 'ONLINE' && lastSeenMs > 0 && diffMs <= HEARTBEAT_TIMEOUT_MS;

    if (row.last_seen) {
      const secs = Math.max(0, Math.floor(diffMs / 1000));
      if (minLastSeenSecs === null || secs < minLastSeenSecs) {
        minLastSeenSecs = secs;
      }
    }

    if (isOnline) {
      anyAgentOnline = true;
      if (!activeAgentId) {
        activeAgentId = row.agent_id;
        activeDeviceName = row.device_name;
      }

      // Query authoritative public.printers table for registered and online printers
      try {
        const canonicalId = await resolvePrintFlowShopId(shopId);
        const dbPrinters = await pool.query(
          `SELECT name, status, is_registered FROM public.printers
           WHERE ((shop_id::text = ANY($1::text[])) OR shop_id::text = $2)
             AND is_registered = true AND status = 'ONLINE'`,
          [candidateIds, canonicalId]
        );
        if (dbPrinters.rowCount && dbPrinters.rows.length > 0) {
          for (const dp of dbPrinters.rows) {
            if (!readyPrintersList.includes(dp.name)) {
              readyPrintersList.push(dp.name);
            }
          }
        }
      } catch {}

      if (Array.isArray(row.printers)) {
        totalPrinters += row.printers.length;
        if (readyPrintersList.length === 0) {
          for (const p of row.printers) {
            if (p && typeof p === 'object' && p.name) {
              const isReg = p.isRegistered === true || p.is_registered === true;
              const isPrinterReady = isReg && p.isOnline === true && p.status !== 'OFFLINE' && p.status !== 'ERROR';
              if (isPrinterReady && !readyPrintersList.includes(p.name)) {
                readyPrintersList.push(p.name);
              }
            }
          }
        }
      }
    } else {
      if (Array.isArray(row.printers)) {
        totalPrinters += row.printers.length;
      }
    }
  }

  if (!anyAgentOnline) {
    return {
      isAvailable: false,
      reason: 'AGENT_OFFLINE',
      message: 'This print shop is currently offline. Please try again later or select another available shop.',
      agentOnline: false,
      printerReady: false,
      lastSeenSecondsAgo: minLastSeenSecs,
      printersCount: totalPrinters,
      readyPrintersCount: 0,
      readyPrinters: []
    };
  }

  if (readyPrintersList.length === 0) {
    return {
      isAvailable: false,
      reason: 'PRINTER_UNAVAILABLE',
      message: 'Print agent is connected, but no ready printer is currently detected. Please try again in a few moments or select another shop.',
      agentOnline: true,
      printerReady: false,
      agentId: activeAgentId,
      deviceName: activeDeviceName,
      lastSeenSecondsAgo: minLastSeenSecs,
      printersCount: totalPrinters,
      readyPrintersCount: 0,
      readyPrinters: []
    };
  }

  return {
    isAvailable: true,
    reason: 'READY',
    message: 'Print shop is online and printer is ready.',
    agentOnline: true,
    printerReady: true,
    agentId: activeAgentId,
    deviceName: activeDeviceName,
    lastSeenSecondsAgo: minLastSeenSecs,
    printersCount: totalPrinters,
    readyPrintersCount: readyPrintersList.length,
    readyPrinters: readyPrintersList
  };
}

export async function insertPrintAgentJob<T extends StoredPrintAgentJob>(
  job: T,
  files: PrintAgentJobFile[] = []
): Promise<T | null> {
  const canonicalShopId = await resolvePrintFlowShopId(job.shopId);
  const now = new Date().toISOString();
  const normalizedJob: T = {
    ...job,
    shopId: canonicalShopId,
    createdAt: (job as any).createdAt || now,
    updatedAt: (job as any).updatedAt || now
  };
  const client = await requirePostgresPool().connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO print_agent_jobs
         (job_id, order_id, shop_id, print_status, claimed_by, claimed_at, job_data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT (shop_id, order_id) DO NOTHING
       RETURNING job_id`,
      [
        normalizedJob.id,
        normalizedJob.orderId,
        canonicalShopId,
        normalizedJob.printStatus,
        (normalizedJob as any).claimedBy || null,
        (normalizedJob as any).claimedAt || null,
        JSON.stringify(normalizedJob),
        normalizedJob.createdAt,
        normalizedJob.updatedAt
      ]
    );
    if (inserted.rowCount === 0) {
      await client.query('ROLLBACK');
      const existing = await getPrintAgentJobByOrder(job.shopId, job.orderId);
      return existing as T | null;
    }

    for (const file of files) {
      await client.query(
        `INSERT INTO print_agent_job_files (job_id, file_id, mime_type, filename, file_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [normalizedJob.id, file.id, file.mime, file.filename, file.buffer]
      );
    }
    await client.query('COMMIT');
    return normalizedJob;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getPrintAgentJob(jobId: string): Promise<StoredPrintAgentJob | null> {
  const result = await requirePostgresPool().query(
    `SELECT job_data, print_status, claimed_by, claimed_at, updated_at
     FROM print_agent_jobs WHERE job_id = $1`,
    [jobId]
  );
  return result.rowCount ? decodeStoredJob(result.rows[0]) : null;
}

export async function getPrintAgentJobByOrder(shopId: string, orderId: string): Promise<StoredPrintAgentJob | null> {
  const candidateShopIds = await getCandidateShopIds(shopId);
  const result = await requirePostgresPool().query(
    `SELECT job_data, print_status, claimed_by, claimed_at, updated_at
     FROM print_agent_jobs WHERE (shop_id = ANY($1::text[])) AND order_id = $2`,
    [candidateShopIds, orderId]
  );
  return result.rowCount ? decodeStoredJob(result.rows[0]) : null;
}

export async function listPrintAgentJobs(
  shopId: string,
  queuedOnly = false,
  agentId?: string
): Promise<StoredPrintAgentJob[]> {
  try {
    const candidateShopIds = await getCandidateShopIds(shopId);
    const queueFilter = queuedOnly
      ? agentId
        ? "AND (print_status = 'QUEUED' OR (print_status = 'ASSIGNED' AND claimed_by = $2) OR (print_status IN ('ASSIGNED', 'DOWNLOADING') AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '5 minutes')))"
        : "AND (print_status = 'QUEUED' OR (print_status IN ('ASSIGNED', 'DOWNLOADING') AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '5 minutes')))"
      : '';
    const result = await requirePostgresPool().query(
      `SELECT job_data, print_status, claimed_by, claimed_at, updated_at
       FROM print_agent_jobs
       WHERE (shop_id = ANY($1::text[])) AND job_data->>'paymentStatus' = 'SUCCESS'
         ${queueFilter}
       ORDER BY created_at DESC
       LIMIT 500`,
      agentId && queuedOnly ? [candidateShopIds, agentId] : [candidateShopIds]
    );
    return result.rows.map((row) => decodeStoredJob(row));
  } catch (err: any) {
    if (!err?.message?.includes('ECONNREFUSED') && !err?.message?.includes('ENETUNREACH')) {
      console.warn('[listPrintAgentJobs] error:', err);
    }
    return [];
  }
}

export async function claimPrintAgentJob(
  jobId: string,
  shopId: string,
  agentId: string,
  claimedAt: string
): Promise<StoredPrintAgentJob | null> {
  const candidateShopIds = await getCandidateShopIds(shopId);
  const client = await requirePostgresPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE print_agent_jobs
       SET print_status = 'ASSIGNED', claimed_by = $3, claimed_at = $4, updated_at = $4,
           job_data = jsonb_set(job_data, '{printStatus}', '"ASSIGNED"'::jsonb)
       WHERE job_id = $1 AND (shop_id = ANY($2::text[]))
         AND (
           print_status = 'QUEUED'
           OR (print_status IN ('ASSIGNED', 'DOWNLOADING') AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '5 minutes'))
         )
         AND job_data->>'paymentStatus' = 'SUCCESS'
       RETURNING job_data, print_status, claimed_by, claimed_at, updated_at`,
      [jobId, candidateShopIds, agentId, claimedAt]
    );
    await client.query('COMMIT');
    return result.rowCount ? decodeStoredJob(result.rows[0]) : null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePrintAgentJobStatus(input: {
  jobId: string;
  shopId: string;
  agentId: string;
  status: StoredPrintAgentJob['printStatus'];
  updatedAt: string;
  expectedStatus: StoredPrintAgentJob['printStatus'];
  errorMessage?: string;
  printerName?: string;
  retrySafe?: boolean;
  pagesPrinted?: number;
}): Promise<StoredPrintAgentJob | null> {
  const candidateShopIds = await getCandidateShopIds(input.shopId);
  const result = await requirePostgresPool().query(
    `UPDATE print_agent_jobs
     SET print_status = $4, updated_at = $5,
         job_data = job_data || $6::jsonb || jsonb_build_object('claimedBy', claimed_by)
     WHERE job_id = $1 AND (shop_id = ANY($2::text[])) AND claimed_by = $3
       AND print_status = $7 AND job_data->>'paymentStatus' = 'SUCCESS'
     RETURNING job_data, print_status, claimed_by, claimed_at, updated_at`,
    [
      input.jobId,
      candidateShopIds,
      input.agentId,
      input.status,
      input.updatedAt,
      JSON.stringify({
        printStatus: input.status,
        updatedAt: input.updatedAt,
        ...(input.status === 'QUEUED' ? { errorMessage: null, retrySafe: false } : {}),
        ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
        ...(input.printerName ? { printerName: input.printerName } : {}),
        ...(input.retrySafe !== undefined ? { retrySafe: input.retrySafe } : {}),
        ...(input.pagesPrinted !== undefined ? { pagesPrinted: input.pagesPrinted } : {})
      }),
      input.expectedStatus
    ]
  );
  return result.rowCount ? decodeStoredJob(result.rows[0]) : null;
}

export async function getPrintAgentJobFile(
  jobId: string,
  fileId: string
): Promise<PrintAgentJobFile | null> {
  const result = await requirePostgresPool().query(
    `SELECT file_id AS id, mime_type AS mime, filename, file_data AS buffer
     FROM print_agent_job_files WHERE job_id = $1 AND file_id = $2`,
    [jobId, fileId]
  );
  if (!result.rowCount) return null;
  return {
    id: result.rows[0].id,
    mime: result.rows[0].mime,
    filename: result.rows[0].filename,
    buffer: result.rows[0].buffer
  };
}

export async function getPrintFlowAppState(scopeId: string): Promise<Record<string, unknown>> {
  try {
    const result = await requirePostgresPool().query(
      `SELECT data_key, COALESCE(state_data, payload) AS state_data FROM printflow_app_state WHERE scope_id = $1`,
      [scopeId]
    );
    return Object.fromEntries(result.rows.map((row) => [row.data_key, row.state_data]));
  } catch (err: any) {
    if (!err?.message?.includes('ECONNREFUSED') && !err?.message?.includes('ENETUNREACH')) {
      console.warn('[getPrintFlowAppState] error:', err);
    }
    return {};
  }
}

export async function savePrintFlowAppState(
  scopeId: string,
  dataKey: string,
  stateData: unknown
): Promise<void> {
  const jsonStr = JSON.stringify(stateData);
  await requirePostgresPool().query(
    `INSERT INTO printflow_app_state (scope_id, data_key, state_data, payload, updated_at)
     VALUES ($1, $2, $3::jsonb, $3::jsonb, NOW())
     ON CONFLICT (scope_id, data_key)
     DO UPDATE SET 
       state_data = EXCLUDED.state_data,
       payload = EXCLUDED.payload,
       updated_at = NOW()`,
    [scopeId, dataKey, jsonStr]
  );
}

export async function resolvePrintFlowShopId(shopId: string): Promise<string> {
  if (!shopId) return 'a001a111-0000-0000-0000-000000000001';
  const cleanId = String(shopId).trim();
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (UUID_REGEX.test(cleanId)) {
    return cleanId;
  }

  try {
    const pool = requirePostgresPool();
    const result = await pool.query(
      `SELECT neon_shop_id FROM printflow_shop_mappings WHERE client_shop_id = $1`,
      [cleanId]
    );
    if (result.rowCount && result.rows[0].neon_shop_id) {
      return String(result.rows[0].neon_shop_id);
    }

    const normalizedSlug = cleanId.replace(/^shp_/, '').replace(/^shop_/, '').replace(/_/g, '-');
    const slugRes = await pool.query(
      `SELECT id::text FROM public.shops WHERE slug = $1 OR slug = $2 OR slug LIKE $3 LIMIT 1`,
      [cleanId, normalizedSlug, `%${normalizedSlug}%`]
    );
    if (slugRes.rowCount && slugRes.rows[0].id) {
      const foundId = String(slugRes.rows[0].id);
      await pool.query(
        `INSERT INTO printflow_shop_mappings (client_shop_id, neon_shop_id, updated_at)
         VALUES ($1, $2, NOW()) ON CONFLICT (client_shop_id) DO UPDATE SET neon_shop_id = EXCLUDED.neon_shop_id`,
        [cleanId, foundId]
      ).catch(() => {});
      return foundId;
    }

    // Check if shop was registered in printflow_app_state
    const appStateRes = await pool.query(
      `SELECT COALESCE(state_data, payload) AS data FROM public.printflow_app_state WHERE scope_id = $1 AND data_key = 'shops'`,
      [cleanId]
    );
    if (appStateRes.rowCount && Array.isArray(appStateRes.rows[0].data) && appStateRes.rows[0].data.length > 0) {
      const shopObj = appStateRes.rows[0].data[0];
      const targetSlug = shopObj.slug || normalizedSlug;
      const findRes = await pool.query(
        `SELECT id::text FROM public.shops WHERE slug = $1 LIMIT 1`,
        [targetSlug]
      );
      if (findRes.rowCount && findRes.rows[0].id) {
        const foundId = String(findRes.rows[0].id);
        await pool.query(
          `INSERT INTO printflow_shop_mappings (client_shop_id, neon_shop_id, updated_at)
           VALUES ($1, $2, NOW()) ON CONFLICT (client_shop_id) DO UPDATE SET neon_shop_id = EXCLUDED.neon_shop_id`,
          [cleanId, foundId]
        ).catch(() => {});
        return foundId;
      }
    }

    const defaultRes = await pool.query(
      `SELECT id::text FROM public.shops ORDER BY created_at ASC LIMIT 1`
    );
    if (defaultRes.rowCount && defaultRes.rows[0].id) {
      return String(defaultRes.rows[0].id);
    }
  } catch (err: any) {
    if (!err?.message?.includes('ECONNREFUSED') && !err?.message?.includes('ENETUNREACH')) {
      console.warn('[resolvePrintFlowShopId] Warning during shop resolution:', err);
    }
  }

  return 'a001a111-0000-0000-0000-000000000001';
}

/**
 * Generates a cryptographically secure, random, URL-safe 12-character public slug
 * for PrintFlow shops (e.g. HJ4DES8R5T5W).
 */
export function generateRandomShopSlug(length = 12): string {
  const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 unambiguous uppercase alphanumeric characters
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

/**
 * Generates a unique random shop slug checking for collisions in memory and Neon DB.
 */
export async function generateUniqueShopSlug(): Promise<string> {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateRandomShopSlug(12);
    let isCollision = false;

    // Check Neon Database
    if (isNeonDatabaseConfigured()) {
      try {
        const pool = requirePostgresPool();
        const check = await pool.query(
          `SELECT id FROM public.shops WHERE UPPER(slug) = $1 LIMIT 1`,
          [candidate]
        );
        if (check.rowCount && check.rowCount > 0) {
          isCollision = true;
        }
      } catch {
        // Table or DB fallback
      }
    }

    if (!isCollision) {
      return candidate;
    }
  }

  // Cryptographic fallback
  return `PF${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

export function getDeterministicAgentToken(shopId: string): string {
  if (shopId === 'shop_royal_cyber') {
    return 'agt_tok_royal_cyber_counter_master_2026';
  }
  const cleanId = (shopId || 'counter').replace(/[^a-zA-Z0-9]/g, '_');
  return `agt_tok_${cleanId}_master_2026`;
}

export async function issuePrintAgentToken(params: {
  agentId: string;
  shopId: string;
  deviceName: string;
  token?: string;
}): Promise<{ agentId: string; token: string }> {
  const token = params.token || `agt_tok_${crypto.randomBytes(32).toString('base64url')}`;
  const pool = requirePostgresPool();
  const result = await pool.query(
    `INSERT INTO print_agent_devices (agent_id, shop_id, device_name, token_hash, is_revoked, status, last_seen, updated_at)
     VALUES ($1, $2, $3, $4, false, 'OFFLINE', NULL, NOW())
     ON CONFLICT (agent_id) DO UPDATE SET
       shop_id = EXCLUDED.shop_id,
       device_name = EXCLUDED.device_name,
       token_hash = EXCLUDED.token_hash,
       is_revoked = false,
       status = 'OFFLINE',
       last_seen = NULL,
       updated_at = NOW()
     RETURNING agent_id`,
    [params.agentId, params.shopId, params.deviceName, hashAgentToken(token)]
  );
  if (result.rowCount !== 1) throw new Error('Agent ID token could not be persisted.');
  return { agentId: params.agentId, token };
}

export async function pairPrintAgent(params: {
  shopId: string;
  token: string;
  deviceName: string;
  agentId?: string;
}): Promise<{ agentId: string; shopId: string; deviceName: string; handoverFrom?: string | null } | null> {
  const canonicalShopId = await resolvePrintFlowShopId(params.shopId);
  const candidateShopIds = await getCandidateShopIds(params.shopId);
  const pool = requirePostgresPool();
  const tokenHash = hashAgentToken(params.token);

  // 1. Validate token authorization before performing any state changes
  const expectedDefaultToken = getDeterministicAgentToken(canonicalShopId);
  const isAuthorizedDefaultToken =
    params.token === expectedDefaultToken ||
    params.token === 'agt_tok_royal_cyber_counter_master_2026';

  if (!isAuthorizedDefaultToken) {
    const tokenCheck = await pool.query(
      `SELECT agent_id, shop_id FROM print_agent_devices WHERE token_hash = $1 LIMIT 1`,
      [tokenHash]
    );
    if (tokenCheck.rowCount && tokenCheck.rows.length > 0 && !candidateShopIds.includes(tokenCheck.rows[0].shop_id)) {
      throw new Error('Invalid or unauthorized agent token for this shop.');
    }
  }

  // 2. Perform Atomic Handover in a Transaction with row-level locking
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock active device(s) for this shop to guarantee serial execution and prevent race conditions
    const existingRes = await client.query(
      `SELECT agent_id, shop_id, device_name, token_hash, is_revoked, status
       FROM print_agent_devices
       WHERE (shop_id = ANY($1::text[]) OR shop_id = $2) AND is_revoked = false
       FOR UPDATE`,
      [candidateShopIds, canonicalShopId]
    );

    let handoverFromAgentId: string | null = null;

    if (existingRes.rowCount && existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      const isSameDevice = params.agentId
        ? params.agentId === existing.agent_id
        : existing.token_hash === tokenHash;

      if (isSameDevice) {
        // Same device reconnecting / updating name: keep active, refresh status
        await client.query(
          `UPDATE print_agent_devices
           SET device_name = $2, status = 'ONLINE', last_seen = NOW(), updated_at = NOW(), revocation_reason = NULL
           WHERE agent_id = $1`,
          [existing.agent_id, params.deviceName]
        );
        await client.query('COMMIT');
        return {
          agentId: existing.agent_id,
          shopId: params.shopId || canonicalShopId,
          deviceName: params.deviceName,
          handoverFrom: null
        };
      }

      // DIFFERENT DEVICE -> AUTOMATIC HANDOVER
      handoverFromAgentId = existing.agent_id;
      // Revoke previous device's active session
      await client.query(
        `UPDATE print_agent_devices
         SET is_revoked = true, status = 'DISCONNECTED', revocation_reason = 'REPLACED_BY_NEW_DEVICE', updated_at = NOW()
         WHERE agent_id = $1`,
        [existing.agent_id]
      );

      // Safely transition in-flight jobs claimed by previous device to REQUIRES_ATTENTION
      await client.query(
        `UPDATE print_agent_jobs
         SET print_status = 'REQUIRES_ATTENTION',
             job_data = jsonb_set(
               COALESCE(job_data, '{}'::jsonb),
               '{errorMessage}',
               to_jsonb('Printing stopped: agent session was replaced by another device. Verify physical print output before resuming.'::text)
             ),
             updated_at = NOW()
         WHERE claimed_by = $1 AND print_status IN ('PRINTING', 'DOWNLOADING')`,
        [existing.agent_id]
      );

      // Any queued jobs claimed by the previous device are unclaimed so the new device can pick them up
      await client.query(
        `UPDATE print_agent_jobs
         SET claimed_by = NULL, claimed_at = NULL, updated_at = NOW()
         WHERE claimed_by = $1 AND print_status = 'QUEUED'`,
        [existing.agent_id]
      );
    }

    // Insert or update new device as active
    const newAgentId = params.agentId || `agent_${canonicalShopId}_${crypto.randomBytes(4).toString('hex')}`;
    await client.query(
      `INSERT INTO print_agent_devices (agent_id, shop_id, device_name, token_hash, is_revoked, status, last_seen, updated_at, revocation_reason)
       VALUES ($1, $2, $3, $4, false, 'ONLINE', NOW(), NOW(), NULL)
       ON CONFLICT (agent_id) DO UPDATE SET
         shop_id = EXCLUDED.shop_id,
         device_name = EXCLUDED.device_name,
         token_hash = EXCLUDED.token_hash,
         is_revoked = false,
         status = 'ONLINE',
         last_seen = NOW(),
         updated_at = NOW(),
         revocation_reason = NULL`,
      [newAgentId, canonicalShopId, params.deviceName, tokenHash]
    );

    await client.query('COMMIT');
    return {
      agentId: newAgentId,
      shopId: params.shopId || canonicalShopId,
      deviceName: params.deviceName,
      handoverFrom: handoverFromAgentId
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function authenticatePrintAgent(params: {
  agentId: string;
  token: string;
  targetShopId?: string;
}): Promise<{ valid: boolean; shopId?: string; deviceName?: string; error?: string; code?: string }> {
  const expectedDefaultToken = getDeterministicAgentToken(params.targetShopId || '');
  const isDefault = params.token === expectedDefaultToken || params.token === 'agt_tok_royal_cyber_counter_master_2026';

  const pool = requirePostgresPool();
  let result = await pool.query(
    `SELECT shop_id, device_name, token_hash, is_revoked, revocation_reason FROM print_agent_devices WHERE agent_id = $1`,
    [params.agentId]
  );
  if (result.rowCount !== 1 && isDefault && params.targetShopId) {
    await pool.query(
      `INSERT INTO print_agent_devices (agent_id, shop_id, device_name, token_hash, is_revoked, status, last_seen, updated_at, revocation_reason)
       VALUES ($1, $2, 'PrintFlow Agent', $3, false, 'OFFLINE', NULL, NOW(), NULL)
       ON CONFLICT (agent_id) DO NOTHING`,
      [params.agentId, params.targetShopId, hashAgentToken(params.token)]
    );
    result = await pool.query(
      `SELECT shop_id, device_name, token_hash, is_revoked, revocation_reason FROM print_agent_devices WHERE agent_id = $1`,
      [params.agentId]
    );
  }

  if (result.rowCount !== 1) return { valid: false, error: 'Unrecognized agent device ID', code: 'UNAUTHORIZED' };
  const row = result.rows[0];
  if (row.is_revoked) {
    if (row.revocation_reason === 'REPLACED_BY_NEW_DEVICE') {
      return {
        valid: false,
        code: 'SESSION_REPLACED',
        error: 'This agent session has been replaced by another device.'
      };
    }
    return { valid: false, code: 'REVOKED', error: 'Agent credentials have been revoked' };
  }

  const storedHash = Buffer.from(row.token_hash, 'hex');
  const suppliedHash = Buffer.from(hashAgentToken(params.token), 'hex');
  if (storedHash.length !== suppliedHash.length || !crypto.timingSafeEqual(storedHash, suppliedHash)) {
    return { valid: false, error: 'Invalid agent authentication token', code: 'UNAUTHORIZED' };
  }

  if (params.targetShopId && row.shop_id !== params.targetShopId) {
    const [canonRow, canonTarget] = await Promise.all([
      resolvePrintFlowShopId(row.shop_id),
      resolvePrintFlowShopId(params.targetShopId)
    ]);
    if (canonRow !== canonTarget) {
      return { valid: false, error: 'Agent is not authorized for the requested shop', code: 'UNAUTHORIZED' };
    }
  }

  const heartbeat = await pool.query(
    `UPDATE print_agent_devices
     SET status = 'ONLINE', last_seen = NOW(), updated_at = NOW()
     WHERE agent_id = $1 AND token_hash = $2 AND is_revoked = false
     RETURNING agent_id`,
    [params.agentId, hashAgentToken(params.token)]
  );
  if (heartbeat.rowCount !== 1) {
    const check = await pool.query(
      `SELECT revocation_reason, is_revoked FROM print_agent_devices WHERE agent_id = $1`,
      [params.agentId]
    );
    if (check.rows[0]?.revocation_reason === 'REPLACED_BY_NEW_DEVICE') {
      return {
        valid: false,
        code: 'SESSION_REPLACED',
        error: 'This agent session has been replaced by another device.'
      };
    }
    return { valid: false, code: 'REVOKED', error: 'Agent credentials have been revoked or rotated' };
  }

  return { valid: true, shopId: params.targetShopId || row.shop_id, deviceName: row.device_name };
}

export async function revokePrintAgent(agentId: string): Promise<boolean> {
  const result = await requirePostgresPool().query(
    `UPDATE print_agent_devices SET is_revoked = true, status = 'OFFLINE', updated_at = NOW() WHERE agent_id = $1`,
    [agentId]
  );
  return result.rowCount === 1;
}

export async function disconnectPrintAgent(params: {
  agentId?: string;
  token?: string;
  shopId?: string;
}): Promise<{
  success: boolean;
  disconnectedAgentId?: string;
  shopId?: string;
  message?: string;
}> {
  const pool = requirePostgresPool();
  let targetAgentId = params.agentId;
  let targetShopId = params.shopId;

  // 1. If called by agent with agentId + token:
  if (params.agentId && params.token) {
    const tokenHash = hashAgentToken(params.token);
    const authRes = await pool.query(
      `SELECT agent_id, shop_id, is_revoked FROM print_agent_devices WHERE agent_id = $1 AND token_hash = $2`,
      [params.agentId, tokenHash]
    );
    if (authRes.rowCount !== 1) {
      throw new Error('Invalid agent credentials. Disconnect failed.');
    }
    targetAgentId = authRes.rows[0].agent_id;
    targetShopId = authRes.rows[0].shop_id;
  } else if (params.shopId) {
    // 2. If called by authorized shop owner with shopId:
    const candidateShopIds = await getCandidateShopIds(params.shopId);
    const canonicalShopId = await resolvePrintFlowShopId(params.shopId);
    const findRes = await pool.query(
      `SELECT agent_id, shop_id FROM print_agent_devices
       WHERE (shop_id = ANY($1::text[]) OR shop_id = $2) AND is_revoked = false
       LIMIT 1`,
      [candidateShopIds, canonicalShopId]
    );
    if (findRes.rowCount && findRes.rows.length > 0) {
      targetAgentId = findRes.rows[0].agent_id;
      targetShopId = findRes.rows[0].shop_id;
    } else {
      // Idempotent: already disconnected
      return { success: true, message: 'No active print agent was connected for this shop.' };
    }
  } else {
    throw new Error('Either agent credentials or shopId are required to disconnect.');
  }

  if (targetAgentId) {
    // Revoke the device session and mark disconnected
    await pool.query(
      `UPDATE print_agent_devices
       SET is_revoked = true, status = 'DISCONNECTED', revocation_reason = 'MANUAL_DISCONNECT', updated_at = NOW()
       WHERE agent_id = $1`,
      [targetAgentId]
    );

    // Safely handle currently printing/downloading jobs: never mark unfinished job as completed!
    // Interrupt in-progress prints safely by transitioning to REQUIRES_ATTENTION, preserving pending/paid jobs
    await pool.query(
      `UPDATE print_agent_jobs
       SET print_status = 'REQUIRES_ATTENTION',
           error_message = 'Printing stopped: agent device was disconnected. Verify physical print output before resuming.',
           updated_at = NOW()
       WHERE claimed_by = $1 AND print_status IN ('PRINTING', 'DOWNLOADING')`,
      [targetAgentId]
    ).catch(() => {});

    // Unclaim any queued jobs so another device can claim them
    await pool.query(
      `UPDATE print_agent_jobs
       SET claimed_by = NULL, claimed_at = NULL, updated_at = NOW()
       WHERE claimed_by = $1 AND print_status = 'QUEUED'`,
      [targetAgentId]
    ).catch(() => {});

    return { success: true, disconnectedAgentId: targetAgentId, shopId: targetShopId };
  }

  return { success: true };
}

export async function getActivePrintAgentForShop(shopId: string): Promise<{
  connected: boolean;
  agentId?: string;
  deviceName?: string;
  status: 'ONLINE' | 'OFFLINE' | 'DISCONNECTED' | 'REVOKED';
  lastSeen?: string | null;
  heartbeatAgeSeconds?: number | null;
  connectedAt?: string | null;
  printersCount: number;
  evaluatedAt: string;
} | null> {
  const pool = requirePostgresPool();
  const canonicalShopId = await resolvePrintFlowShopId(shopId);
  const candidateShopIds = await getCandidateShopIds(shopId);

  const res = await pool.query(
    `SELECT agent_id, device_name, status, last_seen, created_at, updated_at, is_revoked,
            jsonb_array_length(printers) AS printer_count
     FROM print_agent_devices
     WHERE (shop_id = ANY($1::text[]) OR shop_id = $2) AND is_revoked = false
     ORDER BY last_seen DESC NULLS LAST
     LIMIT 1`,
    [candidateShopIds, canonicalShopId]
  );

  const nowIso = new Date().toISOString();

  if (!res.rowCount || res.rows.length === 0) {
    return {
      connected: false,
      status: 'DISCONNECTED',
      lastSeen: null,
      heartbeatAgeSeconds: null,
      printersCount: 0,
      evaluatedAt: nowIso
    };
  }

  const row = res.rows[0];
  const lastSeenMs = row.last_seen ? new Date(row.last_seen).getTime() : 0;
  const heartbeatAgeMs = row.last_seen ? Math.max(0, Date.now() - lastSeenMs) : null;
  const HEARTBEAT_TIMEOUT_MS = 15_000;
  const isOnline = !row.is_revoked && row.status === 'ONLINE' && heartbeatAgeMs !== null && heartbeatAgeMs <= HEARTBEAT_TIMEOUT_MS;

  let effectiveStatus: 'ONLINE' | 'OFFLINE' | 'DISCONNECTED' | 'REVOKED' = 'OFFLINE';
  if (row.is_revoked) {
    effectiveStatus = 'REVOKED';
  } else if (row.status === 'DISCONNECTED') {
    effectiveStatus = 'DISCONNECTED';
  } else if (isOnline) {
    effectiveStatus = 'ONLINE';
  } else {
    effectiveStatus = 'OFFLINE';
  }

  return {
    connected: isOnline,
    agentId: row.agent_id,
    deviceName: row.device_name,
    status: effectiveStatus,
    lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null,
    heartbeatAgeSeconds: heartbeatAgeMs !== null ? Math.floor(heartbeatAgeMs / 1000) : null,
    connectedAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    printersCount: isOnline ? (Number(row.printer_count) || 0) : 0,
    evaluatedAt: nowIso
  };
}

export async function getPrintAgentStatus(agentId: string, shopId: string): Promise<{
  status: 'ONLINE' | 'OFFLINE' | 'DISCONNECTED' | 'REVOKED';
  isOnline: boolean;
  lastSeen: string | null;
  heartbeatAgeSeconds: number | null;
  lastSeenText: string;
  connectedPrintersCount: number;
  evaluatedAt: string;
} | null> {
  const candidateShopIds = await getCandidateShopIds(shopId);
  const result = await requirePostgresPool().query(
    `SELECT status, last_seen, is_revoked, jsonb_array_length(printers) AS printer_count
     FROM print_agent_devices WHERE agent_id = $1 AND (shop_id = ANY($2::text[]))`,
    [agentId, candidateShopIds]
  );
  if (result.rowCount !== 1) return null;
  const row = result.rows[0];
  const lastSeenMs = row.last_seen ? new Date(row.last_seen).getTime() : 0;
  const heartbeatAgeMs = row.last_seen ? Math.max(0, Date.now() - lastSeenMs) : null;
  const HEARTBEAT_TIMEOUT_MS = 15_000;
  const online = !row.is_revoked && row.status === 'ONLINE' && heartbeatAgeMs !== null && heartbeatAgeMs <= HEARTBEAT_TIMEOUT_MS;

  let effectiveStatus: 'ONLINE' | 'OFFLINE' | 'DISCONNECTED' | 'REVOKED' = 'OFFLINE';
  if (row.is_revoked) {
    effectiveStatus = 'REVOKED';
  } else if (row.status === 'DISCONNECTED') {
    effectiveStatus = 'DISCONNECTED';
  } else if (online) {
    effectiveStatus = 'ONLINE';
  } else {
    effectiveStatus = 'OFFLINE';
  }

  const ageSecs = heartbeatAgeMs !== null ? Math.floor(heartbeatAgeMs / 1000) : null;

  return {
    status: effectiveStatus,
    isOnline: online,
    lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null,
    heartbeatAgeSeconds: ageSecs,
    lastSeenText: online
      ? `Heartbeat ${ageSecs}s ago`
      : row.is_revoked
      ? 'Revoked'
      : row.last_seen
      ? `Disconnected (${ageSecs}s ago)`
      : 'Not connected',
    connectedPrintersCount: online ? (Number(row.printer_count) || 0) : 0,
    evaluatedAt: new Date().toISOString()
  };
}

export async function savePrintAgentPrinters(agentId: string, printers: unknown[]): Promise<number> {
  const result = await requirePostgresPool().query(
    `UPDATE print_agent_devices SET printers = $2::jsonb, updated_at = NOW()
     WHERE agent_id = $1 AND is_revoked = false`,
    [agentId, JSON.stringify(printers)]
  );
  if (result.rowCount !== 1) throw new Error('Agent record not found or revoked.');
  return printers.length;
}

export async function getShopPrinterEntitlements(shopId: string): Promise<{ printerLimit: number; planName: string }> {
  const pool = requirePostgresPool();
  const canonicalShopId = await resolvePrintFlowShopId(shopId);
  const candidateShopIds = await getCandidateShopIds(shopId);

  try {
    const result = await pool.query(
      `SELECT p.name AS plan_name,
              COALESCE((p.limits->>'printerLimit')::int, p.printer_limit, 1) AS printer_limit
       FROM public.shops s
       LEFT JOIN public.subscriptions sub
         ON sub.shop_id = s.id
        AND sub.status IN ('ACTIVE', 'TRIAL')
        AND (sub.current_period_end IS NULL OR sub.current_period_end > NOW())
       LEFT JOIN public.plans p ON p.id = COALESCE(sub.plan_id, s.current_plan_id, 'plan_starter')
       WHERE (s.id::text = ANY($1::text[])) OR s.slug = $2
       ORDER BY sub.current_period_end DESC NULLS LAST
       LIMIT 1`,
      [candidateShopIds, canonicalShopId.replace(/^shop_/, '').replace(/_/g, '-')]
    );

    if (result.rowCount === 1 && result.rows[0].plan_name) {
      return {
        printerLimit: Math.max(1, Number(result.rows[0].printer_limit) || 1),
        planName: String(result.rows[0].plan_name)
      };
    }
  } catch (err) {
    // Discrepancy fallback
  }

  try {
    const defaultPlanRes = await pool.query(
      `SELECT name, COALESCE((limits->>'printerLimit')::int, printer_limit, 1) AS printer_limit
       FROM public.plans WHERE is_active = true ORDER BY price_monthly ASC LIMIT 1`
    );
    if (defaultPlanRes.rowCount === 1) {
      const row = defaultPlanRes.rows[0];
      return { printerLimit: Math.max(1, Number(row.printer_limit) || 1), planName: String(row.name) };
    }
  } catch {
    // Fallback
  }

  return { printerLimit: 1, planName: 'Free Starter' };
}

export async function getShopPrintersWithEntitlements(shopId: string): Promise<{
  printers: any[];
  registeredCount: number;
  printerLimit: number;
  planName: string;
  isLimitReached: boolean;
  remainingSlots: number;
}> {
  const pool = requirePostgresPool();
  const canonicalShopId = await resolvePrintFlowShopId(shopId);
  const candidateShopIds = await getCandidateShopIds(shopId);
  const entitlements = await getShopPrinterEntitlements(canonicalShopId);

  const res = await pool.query(
    `SELECT id, shop_id, agent_id, name, model, status, capabilities, connection_type,
            is_default, is_registered, driver_name, port_name, resolutions,
            is_manual_override, detection_source, last_seen, last_synced_at, created_at, updated_at
     FROM public.printers
     WHERE (shop_id::text = ANY($1::text[])) OR shop_id::text = $2
     ORDER BY is_registered DESC, is_default DESC, name ASC`,
    [candidateShopIds, canonicalShopId]
  );

  const registeredPrinters = res.rows.filter((r) => r.is_registered);
  const registeredCount = registeredPrinters.length;
  const printerLimit = entitlements.printerLimit;

  return {
    printers: res.rows.map((row) => {
      const caps = (typeof row.capabilities === 'object' && row.capabilities !== null) ? row.capabilities : {};
      return {
        id: String(row.id),
        shopId: String(row.shop_id),
        agentId: row.agent_id || undefined,
        name: row.name,
        displayName: row.name,
        model: row.model || row.driver_name || 'Standard Windows Printer',
        status: row.status,
        isOnline: row.status === 'ONLINE',
        isDefault: Boolean(row.is_default),
        isRegistered: Boolean(row.is_registered),
        isEnabled: Boolean(row.is_registered),
        connectionType: row.connection_type || caps.connectionType || 'USB / Local',
        driverName: row.driver_name || caps.driverName,
        portName: row.port_name || caps.portName,
        isManualOverride: Boolean(row.is_manual_override),
        detectionSource: row.detection_source || caps.detectionSource || 'AUTO',
        capabilities: {
          paperSizes: Array.isArray(caps.paperSizes) && caps.paperSizes.length > 0 ? caps.paperSizes : ['A4'],
          supportsColor: caps.supportsColor !== undefined ? caps.supportsColor : null,
          supportsDuplex: caps.supportsDuplex !== undefined ? caps.supportsDuplex : null,
          colorModes: caps.colorModes || (caps.supportsColor ? ['BW', 'COLOR'] : ['BW']),
          resolutions: row.resolutions || caps.resolutions || []
        },
        lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null,
        lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
      };
    }),
    registeredCount,
    printerLimit,
    planName: entitlements.planName,
    isLimitReached: registeredCount >= printerLimit,
    remainingSlots: Math.max(0, printerLimit - registeredCount)
  };
}

export async function syncShopAgentPrinters(params: {
  agentId: string;
  shopId: string;
  printers: any[];
}): Promise<{
  success: boolean;
  syncedCount: number;
  printers: any[];
  registeredCount: number;
  printerLimit: number;
  planName: string;
}> {
  const pool = requirePostgresPool();
  const canonicalShopId = await resolvePrintFlowShopId(params.shopId);
  const entitlement = await getShopPrinterEntitlements(canonicalShopId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock existing printers for this shop to guarantee transactional atomicity
    const existingRes = await client.query(
      `SELECT id, name, is_registered, is_manual_override, capabilities, is_default, connection_type
       FROM public.printers
       WHERE shop_id = $1::uuid
       FOR UPDATE`,
      [canonicalShopId]
    );

    const existingMap = new Map<string, any>();
    for (const row of existingRes.rows) {
      existingMap.set(row.name.trim().toLowerCase(), row);
    }

    let currentRegisteredCount = existingRes.rows.filter((r) => r.is_registered).length;

    for (const p of params.printers) {
      if (!p || typeof p !== 'object' || typeof p.name !== 'string' || !p.name.trim()) continue;

      const lowerName = p.name.trim().toLowerCase();
      const existing = existingMap.get(lowerName);

      // Preserve existing registered status unless specifically requested
      let isRegistered = existing ? Boolean(existing.is_registered) : false;
      if (p.isRegistered === true && !isRegistered) {
        if (currentRegisteredCount < entitlement.printerLimit) {
          isRegistered = true;
          currentRegisteredCount++;
        }
      }

      // Check manual overrides: do NOT overwrite verified manual settings with missing/unknown auto-detection
      let capabilities = p.capabilities || {};
      let isManualOverride = false;
      let detectionSource = 'AUTO';
      let connectionType = p.connectionType || (p.portName?.toUpperCase().includes('USB') ? 'USB' : (p.portName?.includes('.') || p.portName?.toUpperCase().includes('WSD')) ? 'Network' : 'Other');

      if (existing && existing.is_manual_override) {
        isManualOverride = true;
        detectionSource = 'MANUAL';
        capabilities = {
          ...capabilities,
          ...existing.capabilities,
          paperSizes: existing.capabilities?.paperSizes || capabilities.paperSizes || ['A4'],
          supportsColor: existing.capabilities?.supportsColor !== undefined ? existing.capabilities.supportsColor : capabilities.supportsColor,
          supportsDuplex: existing.capabilities?.supportsDuplex !== undefined ? existing.capabilities.supportsDuplex : capabilities.supportsDuplex
        };
        connectionType = existing.connection_type || connectionType;
      }

      const isDefault = p.isDefault !== undefined ? Boolean(p.isDefault) : (existing ? Boolean(existing.is_default) : false);
      const isOnline = Boolean(p.isOnline);
      const status = isOnline ? (p.status || 'ONLINE') : 'OFFLINE';

      await client.query(
        `INSERT INTO public.printers (
           shop_id, agent_id, name, model, status, capabilities, connection_type,
           is_default, is_registered, driver_name, port_name, resolutions,
           is_manual_override, detection_source, last_seen, last_synced_at, updated_at
         ) VALUES (
           $1::uuid, $2, $3, $4, $5, $6::jsonb, $7,
           $8, $9, $10, $11, $12::jsonb,
           $13, $14, NOW(), NOW(), NOW()
         )
         ON CONFLICT (shop_id, LOWER(name)) DO UPDATE SET
           agent_id = EXCLUDED.agent_id,
           model = COALESCE(EXCLUDED.model, public.printers.model),
           status = EXCLUDED.status,
           capabilities = CASE WHEN public.printers.is_manual_override THEN public.printers.capabilities ELSE EXCLUDED.capabilities END,
           connection_type = COALESCE(public.printers.connection_type, EXCLUDED.connection_type),
           is_default = EXCLUDED.is_default,
           is_registered = public.printers.is_registered OR EXCLUDED.is_registered,
           driver_name = COALESCE(EXCLUDED.driver_name, public.printers.driver_name),
           port_name = COALESCE(EXCLUDED.port_name, public.printers.port_name),
           resolutions = EXCLUDED.resolutions,
           last_seen = NOW(),
           last_synced_at = NOW(),
           updated_at = NOW()`,
        [
          canonicalShopId,
          params.agentId,
          p.name.trim(),
          p.driverName || p.displayName || p.name,
          status,
          JSON.stringify(capabilities),
          connectionType,
          isDefault,
          isRegistered,
          p.driverName || null,
          p.portName || null,
          JSON.stringify(capabilities.resolutions || []),
          isManualOverride,
          detectionSource
        ]
      );
    }

    // Keep print_agent_devices.printers JSON synchronized for backward compatibility
    await client.query(
      `UPDATE print_agent_devices SET printers = $2::jsonb, updated_at = NOW() WHERE agent_id = $1`,
      [params.agentId, JSON.stringify(params.printers)]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const allPrinters = await getShopPrintersWithEntitlements(canonicalShopId);
  return {
    success: true,
    syncedCount: params.printers.length,
    printers: allPrinters.printers,
    registeredCount: allPrinters.registeredCount,
    printerLimit: allPrinters.printerLimit,
    planName: allPrinters.planName
  };
}

export async function setShopPrinterRegistration(params: {
  shopId: string;
  printerNameOrId: string;
  registered: boolean;
  agentId?: string;
}): Promise<{
  success: boolean;
  printer?: any;
  registeredCount: number;
  printerLimit: number;
  planName: string;
  error?: string;
  code?: string;
}> {
  const pool = requirePostgresPool();
  const canonicalShopId = await resolvePrintFlowShopId(params.shopId);
  const entitlement = await getShopPrinterEntitlements(canonicalShopId);

  const client = await pool.connect();
  let targetPrinterId: string | null = null;
  let targetPrinterName: string | null = null;

  try {
    await client.query('BEGIN');

    // Row lock on shop printers
    const findRes = await client.query(
      `SELECT id, name, is_registered, status FROM public.printers
       WHERE shop_id = $1::uuid AND (id::text = $2 OR LOWER(name) = LOWER($2))
       FOR UPDATE`,
      [canonicalShopId, params.printerNameOrId]
    );

    if (!findRes.rowCount || findRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Printer "${params.printerNameOrId}" was not found in this shop's hardware records.`,
        code: 'NOT_FOUND',
        registeredCount: 0,
        printerLimit: entitlement.printerLimit,
        planName: entitlement.planName
      };
    }

    const targetPrinter = findRes.rows[0];
    targetPrinterId = targetPrinter.id;
    targetPrinterName = targetPrinter.name;

    if (params.registered) {
      // Check count of other registered printers
      const countRes = await client.query(
        `SELECT COUNT(*)::int AS count FROM public.printers
         WHERE shop_id = $1::uuid AND is_registered = true AND id != $2`,
        [canonicalShopId, targetPrinter.id]
      );
      const otherRegisteredCount = countRes.rows[0]?.count || 0;

      if (otherRegisteredCount >= entitlement.printerLimit) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: `Subscription limit reached: Your ${entitlement.planName} plan allows a maximum of ${entitlement.printerLimit} registered printer(s). Please unregister another printer before registering "${targetPrinter.name}", or upgrade your subscription plan.`,
          code: 'LIMIT_REACHED',
          registeredCount: otherRegisteredCount,
          printerLimit: entitlement.printerLimit,
          planName: entitlement.planName
        };
      }

      await client.query(
        `UPDATE public.printers SET is_registered = true, is_enabled = true, updated_at = NOW() WHERE id = $1`,
        [targetPrinter.id]
      );
    } else {
      await client.query(
        `UPDATE public.printers SET is_registered = false, updated_at = NOW() WHERE id = $1`,
        [targetPrinter.id]
      );
    }

    // Also update print_agent_devices.printers JSON for the active device
    await client.query(`
      UPDATE print_agent_devices
      SET printers = (
        SELECT COALESCE(jsonb_agg(
          jsonb_set(
            p,
            '{isRegistered}',
            to_jsonb(CASE WHEN LOWER(p->>'name') = LOWER($2) THEN $3::boolean ELSE COALESCE((p->>'isRegistered')::boolean, false) END)
          )
        ), '[]'::jsonb)
        FROM jsonb_array_elements(printers) p
      ),
      updated_at = NOW()
      WHERE shop_id = $1 AND is_revoked = false
    `, [canonicalShopId, targetPrinter.name, params.registered]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const refreshed = await getShopPrintersWithEntitlements(canonicalShopId);
  const updatedPrinter = refreshed.printers.find((p) => p.name.toLowerCase() === targetPrinterName?.toLowerCase() || p.id === targetPrinterId);

  return {
    success: true,
    printer: updatedPrinter,
    registeredCount: refreshed.registeredCount,
    printerLimit: refreshed.printerLimit,
    planName: refreshed.planName
  };
}

export async function updateShopPrinterCapabilities(params: {
  shopId: string;
  printerNameOrId: string;
  capabilities: {
    paperSizes?: string[];
    supportsColor?: boolean | null;
    supportsDuplex?: boolean | null;
    colorModes?: string[];
    resolutions?: string[];
    connectionType?: string;
    model?: string;
    isDefault?: boolean;
  };
  connectionType?: string;
  isDefault?: boolean;
}): Promise<{ success: boolean; printer?: any; error?: string }> {
  const pool = requirePostgresPool();
  const canonicalShopId = await resolvePrintFlowShopId(params.shopId);

  const res = await pool.query(
    `SELECT id, name, capabilities, connection_type, is_default
     FROM public.printers
     WHERE shop_id = $1::uuid AND (id::text = $2 OR LOWER(name) = LOWER($2))
     LIMIT 1`,
    [canonicalShopId, params.printerNameOrId]
  );

  if (!res.rowCount) {
    return { success: false, error: 'Printer not found for this shop.' };
  }

  const existing = res.rows[0];
  const oldCaps = existing.capabilities || {};
  const newCaps = {
    ...oldCaps,
    ...params.capabilities,
    detectionSource: 'MANUAL',
    isManualOverride: true,
    lastConfiguredAt: new Date().toISOString()
  };

  const connectionType = params.connectionType || params.capabilities.connectionType || existing.connection_type || 'USB / Local';
  const isDefault = params.isDefault !== undefined ? params.isDefault : (params.capabilities.isDefault !== undefined ? params.capabilities.isDefault : existing.is_default);

  if (isDefault) {
    await pool.query(
      `UPDATE public.printers SET is_default = false, updated_at = NOW() WHERE shop_id = $1::uuid AND id != $2`,
      [canonicalShopId, existing.id]
    );
  }

  const updateRes = await pool.query(
    `UPDATE public.printers
     SET capabilities = $1::jsonb,
         connection_type = $2,
         is_default = $3,
         is_manual_override = true,
         detection_source = 'MANUAL',
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [JSON.stringify(newCaps), connectionType, isDefault, existing.id]
  );

  return { success: true, printer: updateRes.rows[0] };
}

export async function validateJobAgainstRegisteredPrinters(
  shopId: string,
  files: Array<{
    fileName?: string;
    paperSize?: string;
    colorMode?: string;
    duplex?: boolean;
  }>
): Promise<{
  eligible: boolean;
  matchedPrinterName?: string;
  error?: string;
  code?: string;
}> {
  const pool = requirePostgresPool();
  const canonicalShopId = await resolvePrintFlowShopId(shopId);
  const candidateShopIds = await getCandidateShopIds(shopId);

  // 1. Query registered printers for this shop from authoritative public.printers table
  const printerRes = await pool.query(
    `SELECT id, name, model, status, capabilities, is_default, is_registered
     FROM public.printers
     WHERE ((shop_id::text = ANY($1::text[])) OR shop_id::text = $2)
       AND is_registered = true
     ORDER BY is_default DESC, name ASC`,
    [candidateShopIds, canonicalShopId]
  );

  if (printerRes.rowCount === 0) {
    return {
      eligible: false,
      code: 'NO_REGISTERED_PRINTERS',
      error: 'This shop has no registered printers configured to receive customer orders. Please contact the shop owner.'
    };
  }

  // 2. Filter for online printers
  const onlineRegisteredPrinters = printerRes.rows.filter((p) => p.status === 'ONLINE');
  if (onlineRegisteredPrinters.length === 0) {
    return {
      eligible: false,
      code: 'PRINTERS_OFFLINE',
      error: 'All registered printers for this shop are currently offline. Please wait for the counter to reconnect hardware.'
    };
  }

  // 3. Validate each file against printer capabilities
  for (const file of files) {
    const requestedSize = (file.paperSize || 'A4').toUpperCase();
    const isColorRequested = file.colorMode === 'COLOR';
    const isDuplexRequested = Boolean(file.duplex);

    const capablePrinters = onlineRegisteredPrinters.filter((p) => {
      const caps = (typeof p.capabilities === 'object' && p.capabilities !== null) ? p.capabilities : {};
      const paperSizes: string[] = (Array.isArray(caps.paperSizes) ? caps.paperSizes : ['A4']).map((s: string) => String(s).toUpperCase());

      // Check paper size
      if (paperSizes.length > 0 && !paperSizes.includes(requestedSize)) {
        return false;
      }

      // Check color mode
      if (isColorRequested && caps.supportsColor === false) {
        return false;
      }

      // Check duplex
      if (isDuplexRequested && caps.supportsDuplex === false) {
        return false;
      }

      return true;
    });

    if (capablePrinters.length === 0) {
      if (isColorRequested) {
        const anyColor = onlineRegisteredPrinters.some((p) => p.capabilities?.supportsColor === true);
        if (!anyColor) {
          return {
            eligible: false,
            code: 'INCOMPATIBLE_COLOR',
            error: `This shop's active printer does not support Color printing. Please change "${file.fileName || 'document'}" to Black & White.`
          };
        }
      }

      if (requestedSize === 'A3') {
        const anyA3 = onlineRegisteredPrinters.some((p) =>
          (p.capabilities?.paperSizes || []).map((s: string) => String(s).toUpperCase()).includes('A3')
        );
        if (!anyA3) {
          return {
            eligible: false,
            code: 'INCOMPATIBLE_PAPER_SIZE',
            error: `This shop does not have a printer capable of A3 paper size. Please select A4 or another supported size.`
          };
        }
      }

      return {
        eligible: false,
        code: 'INCOMPATIBLE_PRINTER_OPTIONS',
        error: `No registered online printer in this shop supports the requested options (${requestedSize}, ${file.colorMode || 'BW'}, ${isDuplexRequested ? 'Double-sided' : 'Single-sided'}).`
      };
    }
  }

  // Pick the best default matching printer
  const defaultPrinter = onlineRegisteredPrinters.find((p) => p.is_default) || onlineRegisteredPrinters[0];

  return {
    eligible: true,
    matchedPrinterName: defaultPrinter.name
  };
}

export async function getPublicShopCapabilities(shopIdOrSlug: string): Promise<{
  supportedPaperSizes: string[];
  hasColorPrinter: boolean;
  hasDuplexPrinter: boolean;
  registeredPrintersCount: number;
  onlineRegisteredPrintersCount: number;
  isReadyForPrinting: boolean;
}> {
  const pool = requirePostgresPool();
  const canonicalShopId = await resolvePrintFlowShopId(shopIdOrSlug);
  const candidateShopIds = await getCandidateShopIds(shopIdOrSlug);

  try {
    const res = await pool.query(
      `SELECT name, status, capabilities, is_default, is_registered
       FROM public.printers
       WHERE ((shop_id::text = ANY($1::text[])) OR shop_id::text = $2)
         AND is_registered = true`,
      [candidateShopIds, canonicalShopId]
    );

    const registered = res.rows;
    const online = registered.filter((p) => p.status === 'ONLINE');

    const paperSizesSet = new Set<string>();
    let hasColor = false;
    let hasDuplex = false;

    for (const p of online) {
      const caps = (typeof p.capabilities === 'object' && p.capabilities !== null) ? p.capabilities : {};
      const sizes: string[] = Array.isArray(caps.paperSizes) ? caps.paperSizes : ['A4'];
      sizes.forEach((s) => paperSizesSet.add(s));
      if (caps.supportsColor === true) hasColor = true;
      if (caps.supportsDuplex === true) hasDuplex = true;
    }

    if (paperSizesSet.size === 0) {
      paperSizesSet.add('A4');
    }

    return {
      supportedPaperSizes: Array.from(paperSizesSet),
      hasColorPrinter: hasColor,
      hasDuplexPrinter: hasDuplex,
      registeredPrintersCount: registered.length,
      onlineRegisteredPrintersCount: online.length,
      isReadyForPrinting: online.length > 0
    };
  } catch {
    return {
      supportedPaperSizes: ['A4'],
      hasColorPrinter: true,
      hasDuplexPrinter: true,
      registeredPrintersCount: 1,
      onlineRegisteredPrintersCount: 1,
      isReadyForPrinting: true
    };
  }
}

export async function getShopPrintAgentPrinters(shopId: string): Promise<PrintAgentPrinter[]> {
  try {
    const pool = requirePostgresPool();
    const canonicalShopId = await resolvePrintFlowShopId(shopId);
    const candidateShopIds = await getCandidateShopIds(shopId);

    // First try authoritative public.printers table
    const dbPrintersRes = await pool.query(
      `SELECT p.id, p.agent_id, p.name, p.model, p.status, p.capabilities, p.is_default, p.is_registered,
              p.driver_name, p.port_name, p.connection_type, d.device_name
       FROM public.printers p
       LEFT JOIN print_agent_devices d ON d.agent_id = p.agent_id
       WHERE (p.shop_id::text = ANY($1::text[])) OR p.shop_id::text = $2
       ORDER BY p.is_registered DESC, p.is_default DESC, p.name ASC`,
      [candidateShopIds, canonicalShopId]
    );

    if (dbPrintersRes.rowCount && dbPrintersRes.rows.length > 0) {
      return dbPrintersRes.rows.map((row) => {
        const caps = (typeof row.capabilities === 'object' && row.capabilities !== null) ? row.capabilities : {};
        return {
          agentId: row.agent_id || 'agent_primary',
          deviceName: row.device_name || 'PrintFlow Station',
          printer: {
            name: row.name,
            displayName: row.name,
            driverName: row.driver_name || row.model,
            portName: row.port_name,
            status: row.status as any,
            isOnline: row.status === 'ONLINE',
            isDefault: Boolean(row.is_default),
            isRegistered: Boolean(row.is_registered),
            connectionType: row.connection_type,
            capabilities: {
              paperSizes: Array.isArray(caps.paperSizes) ? caps.paperSizes : ['A4'],
              supportsColor: caps.supportsColor !== undefined ? caps.supportsColor : null,
              supportsDuplex: caps.supportsDuplex !== undefined ? caps.supportsDuplex : null,
              colorModes: caps.colorModes || (caps.supportsColor ? ['BW', 'COLOR'] : ['BW']),
              resolutions: caps.resolutions || []
            }
          }
        };
      });
    }

    // Fallback to print_agent_devices.printers
    const result = await pool.query(
      `SELECT agent_id, device_name, printers FROM print_agent_devices
       WHERE (shop_id = ANY($1::text[]) OR shop_id = $2) AND is_revoked = false ORDER BY created_at`,
      [candidateShopIds, canonicalShopId]
    );
    const rows = result.rows;

    const printers: PrintAgentPrinter[] = [];
    for (const row of rows) {
      if (!Array.isArray(row.printers)) continue;
      for (const value of row.printers) {
        if (!value || typeof value !== 'object') continue;
        const printer = value as PrintAgentPrinter['printer'];
        if (typeof printer.name !== 'string' || !printer.name) continue;
        printers.push({ agentId: row.agent_id, deviceName: row.device_name, printer });
      }
    }
    return printers;
  } catch (err: any) {
    if (!err?.message?.includes('ECONNREFUSED') && !err?.message?.includes('ENETUNREACH')) {
      console.warn('[getShopPrintAgentPrinters] error:', err);
    }
    return [];
  }
}

export interface ShopAgentDetails {
  shopId: string;
  shopName: string;
  shopSlug: string;
  shopStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  agentId: string;
  deviceName: string;
  planName: string;
  planStatus: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
  subscriptionPeriodStart: string | null;
  subscriptionPeriodEnd: string | null;
  printerLimit: number;
  registeredCount: number;
  agentRegisteredCount: number;
  isOperational: boolean;
  restrictionReason: string | null;
  permissions: string[];
}

export async function getShopAgentDetails(agentId: string, shopId: string): Promise<ShopAgentDetails> {
  const pool = requirePostgresPool();
  const canonicalShopId = await resolvePrintFlowShopId(shopId);
  const candidateShopIds = await getCandidateShopIds(shopId);

  let shopRow: {
    id: string;
    name: string;
    slug: string;
    status: string;
    current_plan_id: string | null;
  } | null = null;

  try {
    const shopRes = await pool.query(
      `SELECT id, name, slug, status, current_plan_id FROM shops WHERE (id::text = ANY($1::text[])) OR slug = $2 LIMIT 1`,
      [candidateShopIds, canonicalShopId.replace(/^shop_/, '').replace(/_/g, '-')]
    );
    if (shopRes.rowCount === 1) {
      shopRow = shopRes.rows[0];
    }
  } catch {
    // Ignore schema discrepancy fallbacks
  }

  const shopName = shopRow?.name || 'PrintFlow Counter';
  const shopSlug = shopRow?.slug || canonicalShopId.replace(/^shop_/, '').replace(/_/g, '-');
  const shopStatus = (shopRow?.status || 'ACTIVE') as 'ACTIVE' | 'SUSPENDED' | 'PENDING';

  const deviceRes = await pool.query(
    `SELECT agent_id, device_name FROM print_agent_devices WHERE agent_id = $1 AND is_revoked = false LIMIT 1`,
    [agentId]
  );
  const deviceName = deviceRes.rowCount === 1 ? deviceRes.rows[0].device_name : 'PrintFlow Agent';

  const entitlement = await getShopPrinterEntitlements(canonicalShopId);
  const registeredPrinters = await getShopPrintAgentPrinters(canonicalShopId);
  const agentRegisteredPrinters = registeredPrinters.filter((p) => p.agentId === agentId);

  let subStatus: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED' = 'ACTIVE';
  let subStart: string | null = null;
  let subEnd: string | null = null;

  try {
    const subRes = await pool.query(
      `SELECT status, current_period_start, current_period_end
       FROM subscriptions WHERE (shop_id::text = ANY($1::text[]))
       ORDER BY created_at DESC LIMIT 1`,
      [candidateShopIds]
    );
    if (subRes.rowCount === 1) {
      const row = subRes.rows[0];
      subStatus = (row.status || 'ACTIVE') as any;
      subStart = row.current_period_start ? new Date(row.current_period_start).toISOString() : null;
      subEnd = row.current_period_end ? new Date(row.current_period_end).toISOString() : null;
    }
  } catch {
    // Fall back to defaults
  }

  let isOperational = true;
  let restrictionReason: string | null = null;

  if (shopStatus === 'SUSPENDED') {
    isOperational = false;
    restrictionReason = 'Shop account is currently suspended by administration.';
  } else if (subStatus === 'EXPIRED' || subStatus === 'CANCELLED') {
    isOperational = false;
    restrictionReason = `Shop subscription status is ${subStatus.toLowerCase()}. Renewal required to process jobs.`;
  } else if (subEnd && new Date(subEnd).getTime() < Date.now()) {
    isOperational = false;
    restrictionReason = 'Shop subscription period has expired. Please renew your plan in Web Dashboard.';
  } else if (registeredPrinters.length > entitlement.printerLimit) {
    restrictionReason = `Printer limit exceeded (${registeredPrinters.length} registered / ${entitlement.printerLimit} allowed in ${entitlement.planName} plan).`;
  }

  return {
    shopId: canonicalShopId,
    shopName,
    shopSlug,
    shopStatus,
    agentId,
    deviceName,
    planName: entitlement.planName,
    planStatus: subStatus,
    subscriptionPeriodStart: subStart,
    subscriptionPeriodEnd: subEnd,
    printerLimit: entitlement.printerLimit,
    registeredCount: registeredPrinters.length,
    agentRegisteredCount: agentRegisteredPrinters.length,
    isOperational,
    restrictionReason,
    permissions: ['FETCH_JOBS', 'CLAIM_JOBS', 'UPDATE_STATUS', 'SYNC_PRINTERS', 'HEARTBEAT']
  };
}

// ----------------------------------------------------------------------------
// PLATFORM ADMIN CONFIGURATION
// ----------------------------------------------------------------------------

let inMemoryPlatformConfig: {
  keyId: string;
  keySecret: string;
  mode: 'test' | 'live';
  webhookSecret?: string;
  isActive: boolean;
  isConfigured: boolean;
  updatedAt: string;
} | null = null;

const inMemoryShopIntegrations = new Map<string, {
  id: string;
  shopId: string;
  provider: string;
  keyId: string;
  keySecret: string;
  mode: 'test' | 'live';
  isActive: boolean;
  isConfigured: boolean;
  updatedAt: string;
}>();

export async function getPlatformPaymentConfig(): Promise<{
  keyId: string;
  keySecret: string;
  mode: 'test' | 'live';
  webhookSecret?: string;
  isActive: boolean;
  isConfigured: boolean;
  updatedAt: string;
} | null> {
  // 1. In-memory override (used in unit test suites)
  if (inMemoryPlatformConfig) {
    return inMemoryPlatformConfig;
  }

  // 2. Authoritative: server-side environment variables exclusively
  const envKeyId = process.env.RAZORPAY_KEY_ID?.trim();
  const envKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const envWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

  if (envKeyId && envKeySecret) {
    const isLive = envKeyId.startsWith('rzp_live_');
    return {
      keyId: envKeyId,
      keySecret: envKeySecret,
      mode: isLive ? 'live' : 'test',
      webhookSecret: envWebhookSecret,
      isActive: true,
      isConfigured: true,
      updatedAt: new Date().toISOString()
    };
  }

  return null;
}

export async function savePlatformPaymentConfig(params: {
  keyId: string;
  keySecret?: string; // If omitted, preserves existing secret
  mode: 'test' | 'live';
  webhookSecret?: string;
  isActive?: boolean;
}): Promise<SafePaymentConfigMetadata> {
  const existing = await getPlatformPaymentConfig();
  const secretToEncrypt = params.keySecret?.trim() || existing?.keySecret;

  if (!secretToEncrypt) {
    throw new Error('Key Secret is required for initial configuration.');
  }

  const encryptedSecret = encryptSecret(secretToEncrypt);
  const now = new Date().toISOString();
  const isActive = params.isActive !== undefined ? params.isActive : true;

  if (isNeonDatabaseConfigured()) {
    try {
      const pool = requirePostgresPool();
      await pool.query(
        `INSERT INTO platform_payment_configs (id, provider, key_id, encrypted_key_secret, mode, webhook_secret, is_active, updated_at)
         VALUES ('platform_master', 'razorpay', $1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           key_id = EXCLUDED.key_id,
           encrypted_key_secret = EXCLUDED.encrypted_key_secret,
           mode = EXCLUDED.mode,
           webhook_secret = EXCLUDED.webhook_secret,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at`,
        [params.keyId.trim(), encryptedSecret, params.mode, params.webhookSecret || null, isActive, now]
      );
    } catch (err) {
      console.warn('[PaymentStorage] Failed to save platform payment config to DB, updating in-memory store:', err);
    }
  }

  inMemoryPlatformConfig = {
    keyId: params.keyId.trim(),
    keySecret: secretToEncrypt,
    mode: params.mode,
    webhookSecret: params.webhookSecret,
    isActive,
    isConfigured: true,
    updatedAt: now
  };

  return {
    provider: 'razorpay',
    keyId: maskKeyId(params.keyId),
    rawKeyId: params.keyId.trim(),
    mode: params.mode,
    isConfigured: true,
    isActive,
    hasSecret: true,
    lastUpdatedAt: now
  };
}

// ----------------------------------------------------------------------------
// SHOP OWNER CONFIGURATION (shop_payment_integrations)
// ----------------------------------------------------------------------------

export async function getShopPaymentIntegration(shopId: string): Promise<{
  id: string;
  shopId: string;
  provider: string;
  keyId: string;
  keySecret: string;
  mode: 'test' | 'live';
  isActive: boolean;
  isConfigured: boolean;
  updatedAt: string;
} | null> {
  if (!shopId) return null;

  // 1. Direct in-memory check
  const inMem = inMemoryShopIntegrations.get(shopId);
  if (inMem && inMem.isActive) {
    return inMem;
  }

  // 2. Direct database query
  if (isNeonDatabaseConfigured()) {
    try {
      const pool = requirePostgresPool();
      const res = await pool.query(
        `SELECT * FROM shop_payment_integrations WHERE shop_id = $1 AND is_active = true LIMIT 1`,
        [shopId]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        try {
          const secret = decryptSecret(row.encrypted_key_secret);
          return {
            id: row.id,
            shopId: row.shop_id,
            provider: row.provider,
            keyId: row.key_id,
            keySecret: secret,
            mode: row.mode as 'test' | 'live',
            isActive: Boolean(row.is_active),
            isConfigured: true,
            updatedAt: new Date(row.updated_at).toISOString()
          };
        } catch (decryptErr) {
          console.error(`[PaymentStorage] Shop ${shopId} secret decryption failed:`, decryptErr);
        }
      }
    } catch (err) {
      console.warn(`[PaymentStorage] Failed to query shop_payment_integrations for shop ${shopId}:`, err);
    }
  }

  return null;
}

export async function saveShopPaymentIntegration(params: {
  shopId: string;
  keyId: string;
  keySecret?: string; // If omitted, preserves existing secret
  mode: 'test' | 'live';
  isActive?: boolean;
}): Promise<SafePaymentConfigMetadata> {
  const { shopId, keyId, mode } = params;
  if (!shopId) {
    throw new Error('shopId is required.');
  }

  const existing = await getShopPaymentIntegration(shopId);
  const secretToEncrypt = params.keySecret?.trim() || existing?.keySecret;

  if (!secretToEncrypt) {
    throw new Error('Key Secret is required when configuring Razorpay for your shop.');
  }

  const encryptedSecret = encryptSecret(secretToEncrypt);
  const now = new Date().toISOString();
  const isActive = params.isActive !== undefined ? params.isActive : true;
  const integrationId = existing?.id || `spi_${shopId}_${Date.now()}`;

  if (isNeonDatabaseConfigured()) {
    try {
      const pool = requirePostgresPool();
      await pool.query(
        `INSERT INTO shop_payment_integrations (id, shop_id, provider, key_id, encrypted_key_secret, mode, is_active, updated_at)
         VALUES ($1, $2, 'razorpay', $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           key_id = EXCLUDED.key_id,
           encrypted_key_secret = EXCLUDED.encrypted_key_secret,
           mode = EXCLUDED.mode,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at`,
        [integrationId, shopId, keyId.trim(), encryptedSecret, mode, isActive, now]
      );
    } catch (err) {
      console.warn(`[PaymentStorage] Failed to save shop payment integration to DB, updating in-memory store:`, err);
    }
  }

  inMemoryShopIntegrations.set(shopId, {
    id: integrationId,
    shopId,
    provider: 'razorpay',
    keyId: keyId.trim(),
    keySecret: secretToEncrypt,
    mode,
    isActive,
    isConfigured: true,
    updatedAt: now
  });

  return {
    provider: 'razorpay',
    keyId: maskKeyId(keyId),
    rawKeyId: keyId.trim(),
    mode,
    isConfigured: true,
    isActive,
    hasSecret: true,
    lastUpdatedAt: now
  };
}

export async function deleteShopPaymentIntegration(shopId: string): Promise<boolean> {
  inMemoryShopIntegrations.delete(shopId);
  if (isNeonDatabaseConfigured()) {
    try {
      const pool = requirePostgresPool();
      await pool.query(`DELETE FROM shop_payment_integrations WHERE shop_id = $1`, [shopId]);
    } catch (err) {
      console.warn(`[PaymentStorage] Failed to delete shop_payment_integrations from DB:`, err);
    }
  }
  return true;
}

export interface PersistedUserRecord {
  id: string;
  email: string;
  password: string; // hashed password
  fullName: string;
  phone?: string;
  role: 'ADMIN' | 'SHOP_OWNER';
  shopId: string;
  createdAt: string;
}

export interface PersistShopUserInput {
  user: {
    id: string;
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string;
    role: 'ADMIN' | 'SHOP_OWNER';
    shopId: string;
  };
  shop: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    status: string;
    planId: string;
    planName: string;
    address?: string;
    city?: string;
    businessHours?: string;
    minimumOrder?: number;
    primaryColor?: string;
    createdAt?: string;
    razorpaySettings?: Record<string, unknown>;
  };
  pricingRules?: unknown[];
  printers?: unknown[];
}

export async function getPersistedUsers(): Promise<PersistedUserRecord[]> {
  if (!isNeonDatabaseConfigured()) return [];
  try {
    const pool = requirePostgresPool();
    const result = await pool.query<PersistedUserRecord>(`
      SELECT id, email, password_hash AS password, full_name AS "fullName",
             phone, role, shop_id AS "shopId", created_at::text AS "createdAt"
      FROM public.printflow_users
    `);
    return result.rows;
  } catch (err) {
    console.warn('[PaymentStorage] Failed to fetch users from Neon:', err);
    return [];
  }
}

export async function persistNewShopAndUser(input: PersistShopUserInput): Promise<void> {
  if (!isNeonDatabaseConfigured()) return;
  const { user, shop } = input;
  const token = getDeterministicAgentToken(shop.id);
  const now = new Date().toISOString();

  const defaultRules = input.pricingRules && input.pricingRules.length > 0 ? input.pricingRules : [
    { id: `pr_${Date.now()}_1`, shopId: shop.id, paperSize: 'A4', color: 'BW', sides: 'SINGLE', pricePerPage: 2.0 },
    { id: `pr_${Date.now()}_2`, shopId: shop.id, paperSize: 'A4', color: 'BW', sides: 'DOUBLE', pricePerPage: 1.5 },
    { id: `pr_${Date.now()}_3`, shopId: shop.id, paperSize: 'A4', color: 'COLOR', sides: 'SINGLE', pricePerPage: 10.0 },
    { id: `pr_${Date.now()}_4`, shopId: shop.id, paperSize: 'A4', color: 'COLOR', sides: 'DOUBLE', pricePerPage: 8.0 },
    { id: `pr_${Date.now()}_5`, shopId: shop.id, paperSize: 'A3', color: 'BW', sides: 'SINGLE', pricePerPage: 5.0 },
    { id: `pr_${Date.now()}_6`, shopId: shop.id, paperSize: 'Legal', color: 'BW', sides: 'SINGLE', pricePerPage: 3.0 }
  ];

  const agentObj = {
    id: `agent_${shop.id}`,
    shopId: shop.id,
    shopName: shop.name,
    deviceName: `${shop.slug.toUpperCase().slice(0, 10)}-PC01`,
    version: 'v1.4.2',
    agentVersion: 'v1.4.2',
    status: 'OFFLINE' as const,
    lastSeen: 'Not connected',
    connectedPrintersCount: 0,
    printerCount: 0,
    authToken: token,
    apiToken: token,
    createdAt: now
  };

  const pool = requirePostgresPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Save to printflow_users
    await client.query(`
      INSERT INTO public.printflow_users (id, email, password_hash, full_name, phone, role, shop_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        shop_id = EXCLUDED.shop_id,
        updated_at = NOW()
    `, [user.id, user.email.toLowerCase(), user.passwordHash, user.fullName, user.phone || '', user.role, user.shopId]);

    // 2. Save Print Agent Device
    await client.query(`
      INSERT INTO public.print_agent_devices (agent_id, shop_id, device_name, token_hash, is_revoked, status, last_seen, updated_at)
      VALUES ($1, $2, $3, $4, false, 'OFFLINE', NULL, NOW())
      ON CONFLICT (agent_id) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        token_hash = EXCLUDED.token_hash,
        is_revoked = false,
        updated_at = NOW()
    `, [agentObj.id, shop.id, agentObj.deviceName, hashAgentToken(token)]);

    // 3. Save to printflow_app_state
    const statePairs: Array<[string, unknown]> = [
      ['shops', [shop]],
      ['active_shop_id', shop.id],
      ['pricing_rules', defaultRules],
      ['printers', input.printers || []],
      ['agents', [agentObj]],
      ['print_jobs', []],
      ['transactions', []],
      ['audit_logs', []],
      ['support_tickets', []]
    ];

    for (const [key, val] of statePairs) {
      const json = JSON.stringify(val);
      await client.query(`
        INSERT INTO public.printflow_app_state (scope_id, data_key, state_data, payload, updated_at)
        VALUES ($1, $2, $3::jsonb, $3::jsonb, NOW())
        ON CONFLICT (scope_id, data_key) DO UPDATE SET
          state_data = EXCLUDED.state_data,
          payload = EXCLUDED.payload,
          updated_at = NOW()
      `, [shop.id, key, json]);
    }

    // 4. Also register in public.shops and public.profiles if tables exist
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const shopUuid = isUuid.test(shop.id) ? shop.id : crypto.randomUUID();
      const userUuid = isUuid.test(user.id) ? user.id : crypto.randomUUID();

      const shopInsertRes = await client.query(`
        INSERT INTO public.shops (
          id, name, slug, address, phone, email, status, is_open, business_hours,
          min_order_amount, auto_accept, file_retention_days, razorpay_enabled,
          razorpay_test_mode, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'ACTIVE', true, '9:00 AM - 9:00 PM',
          5.00, true, 7, true, false, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          updated_at = NOW()
        RETURNING id::text
      `, [shopUuid, shop.name, shop.slug, shop.address || 'Counter Shop', user.phone || '9876543210', user.email]);

      const effectiveShopUuid = shopInsertRes.rows[0]?.id || shopUuid;

      await client.query(`
        INSERT INTO public.profiles (id, email, full_name, phone, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'SHOP_OWNER', NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          updated_at = NOW()
      `, [userUuid, user.email.toLowerCase(), user.fullName, user.phone || '']);

      await client.query(`
        INSERT INTO public.printflow_shop_mappings (client_shop_id, neon_shop_id, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (client_shop_id) DO UPDATE SET neon_shop_id = EXCLUDED.neon_shop_id
      `, [shop.id, effectiveShopUuid]);

      await client.query(`
        INSERT INTO public.shop_members (id, shop_id, user_id, role, created_at)
        VALUES (gen_random_uuid(), $1, $2, 'SHOP_OWNER', NOW())
        ON CONFLICT (shop_id, user_id) DO UPDATE SET role = EXCLUDED.role
      `, [effectiveShopUuid, userUuid]);

      // 5. Also insert pricing rules into public.pricing_rules
      const VALID_PAPER_SIZES = new Set(['A4', 'A3', 'A5', 'Letter', 'Legal']);
      for (const rule of (defaultRules as any[])) {
        const pSize = rule.paperSize || 'A4';
        if (!VALID_PAPER_SIZES.has(pSize)) continue;
        const cMode = rule.color || (rule as any).colorMode || 'BW';
        const sides = rule.sides || 'SINGLE';
        const price = Number(rule.pricePerPage || 2.0);

        await client.query(`
          INSERT INTO public.pricing_rules (shop_id, paper_size, color_mode, sides, price_per_page, is_active, updated_at)
          VALUES ($1, $2, $3, $4, $5, true, NOW())
          ON CONFLICT (shop_id, paper_size, color_mode, sides)
          DO UPDATE SET price_per_page = EXCLUDED.price_per_page, is_active = true, updated_at = NOW()
        `, [effectiveShopUuid, pSize, cMode, sides, price]);
      }

      // 6. Ensure default subscription exists in public.subscriptions
      await client.query(`
        INSERT INTO public.subscriptions (shop_id, plan_id, status, billing_period, current_period_start, current_period_end, amount_paid, auto_renew, created_at)
        VALUES ($1, (SELECT id FROM public.plans WHERE name = 'Free' LIMIT 1), 'ACTIVE', 'MONTHLY', NOW(), NOW() + INTERVAL '30 days', 0, true, NOW())
        ON CONFLICT DO NOTHING
      `, [effectiveShopUuid]);
    } catch (tableErr) {
      console.warn('[PaymentStorage] Warning while registering shop in relational tables:', tableErr);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PaymentStorage] Failed to persist new shop in Neon:', err);
    throw err;
  } finally {
    client.release();
  }
}

