/**
 * PrintFlow: Supabase Database Bootstrapper
 * Ensures core schema tables and Platform Admin account exist.
 * Does NOT seed dummy shops, mock print jobs, fake transactions, or demo agents.
 */
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { hashPassword } from '../src/lib/security';

dotenv.config();

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
const DATABASE_URL = rawDatabaseUrl ? rawDatabaseUrl.replace(/^['"]|['"]$/g, '').trim() : undefined;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not configured in .env or environment.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const DEFAULT_PLATFORM_PLANS = [
  {
    id: 'plan_starter',
    name: 'Free Starter',
    tagline: 'Ideal for small or newly opened local copy shops',
    price_monthly: 0,
    price_yearly: 0,
    print_limit: 50,
    printer_limit: 1,
    storage_limit_gb: 1,
    features: ['1 Connected Printer', 'Up to 50 jobs/mo', 'Email Support', 'Direct UPI QR Payments'],
    is_active: true,
    is_popular: false
  },
  {
    id: 'plan_growth',
    name: 'Growth',
    tagline: 'For bustling college & market copy shops needing automation',
    price_monthly: 499,
    price_yearly: 4990,
    print_limit: 500,
    printer_limit: 3,
    storage_limit_gb: 10,
    features: ['3 Connected Printers', 'Up to 500 jobs/mo', 'Auto Print Spooling', 'Priority WhatsApp Support'],
    is_active: true,
    is_popular: true
  },
  {
    id: 'plan_pro',
    name: 'Professional',
    tagline: 'High-volume commercial reprography & blueprint centers',
    price_monthly: 999,
    price_yearly: 9990,
    print_limit: 2000,
    printer_limit: 10,
    storage_limit_gb: 50,
    features: ['10 Connected Printers', 'Up to 2,000 jobs/mo', 'Custom Shop Branding', 'Multi-staff Accounts', 'Dedicated Support'],
    is_active: true,
    is_popular: false
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    tagline: 'Multi-store print chains and large document service providers',
    price_monthly: 2499,
    price_yearly: 24990,
    print_limit: 10000,
    printer_limit: 50,
    storage_limit_gb: 200,
    features: ['Unlimited Printers', 'Custom Job Limits', 'Multi-Branch Routing', 'API Access', '24/7 Phone SLA'],
    is_active: true,
    is_popular: false
  }
];

export async function seedDatabase(targetPool: Pool = pool) {
  const client = await targetPool.connect();
  console.log('🚀 Bootstrapping Supabase PostgreSQL schema and admin account...');

  try {
    await client.query('BEGIN');

    // 1. Ensure core schema tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.printflow_app_state (
        scope_id VARCHAR(128) NOT NULL,
        data_key VARCHAR(64) NOT NULL,
        state_data JSONB,
        payload JSONB,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (scope_id, data_key)
      );

      CREATE TABLE IF NOT EXISTS public.print_agent_devices (
        agent_id VARCHAR(128) PRIMARY KEY,
        shop_id VARCHAR(128) NOT NULL,
        device_name VARCHAR(128) NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        is_revoked BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(16) NOT NULL DEFAULT 'OFFLINE',
        last_seen TIMESTAMP WITH TIME ZONE,
        printers JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

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

      CREATE TABLE IF NOT EXISTS public.printflow_shop_mappings (
        client_shop_id VARCHAR(128) PRIMARY KEY,
        neon_shop_id VARCHAR(128) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.plans (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        tagline TEXT,
        price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0,
        price_yearly NUMERIC(10, 2) NOT NULL DEFAULT 0,
        print_limit INTEGER NOT NULL DEFAULT 50,
        printer_limit INTEGER NOT NULL DEFAULT 1,
        storage_limit_gb INTEGER NOT NULL DEFAULT 1,
        features JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_popular BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Ensure Platform Admin is seeded (Only One Predefined Admin Login)
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@PrintFlow2026!';
    const adminHash = hashPassword(adminPassword);
    await client.query(`
      INSERT INTO public.printflow_users (id, email, password_hash, full_name, phone, role, shop_id, created_at, updated_at)
      VALUES ('usr_admin', 'admin@printflow.io', $1, 'Platform Super Admin', '9876543200', 'ADMIN', 'platform_admin', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        role = 'ADMIN',
        shop_id = 'platform_admin',
        updated_at = NOW()
    `, [adminHash]);

    // 3. Ensure SaaS Catalog Plans exist
    for (const plan of DEFAULT_PLATFORM_PLANS) {
      await client.query(`
        INSERT INTO public.plans (id, name, tagline, price_monthly, price_yearly, print_limit, printer_limit, storage_limit_gb, features, is_active, is_popular, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          tagline = EXCLUDED.tagline,
          price_monthly = EXCLUDED.price_monthly,
          price_yearly = EXCLUDED.price_yearly,
          print_limit = EXCLUDED.print_limit,
          printer_limit = EXCLUDED.printer_limit,
          storage_limit_gb = EXCLUDED.storage_limit_gb,
          features = EXCLUDED.features,
          is_active = EXCLUDED.is_active,
          is_popular = EXCLUDED.is_popular,
          updated_at = NOW()
      `, [
        plan.id, plan.name, plan.tagline, plan.price_monthly, plan.price_yearly,
        plan.print_limit, plan.printer_limit, plan.storage_limit_gb,
        JSON.stringify(plan.features), plan.is_active, plan.is_popular
      ]);
    }

    // 4. Upsert Platform App State configuration
    const upsertAppState = async (scopeId: string, dataKey: string, value: unknown) => {
      const json = JSON.stringify(value);
      await client.query(`
        INSERT INTO public.printflow_app_state (scope_id, data_key, state_data, payload, updated_at)
        VALUES ($1, $2, $3::jsonb, $3::jsonb, NOW())
        ON CONFLICT (scope_id, data_key) DO UPDATE SET
          state_data = EXCLUDED.state_data,
          payload = EXCLUDED.payload,
          updated_at = NOW()
      `, [scopeId, dataKey, json]);
    };

    await upsertAppState('platform', 'saas_plans', DEFAULT_PLATFORM_PLANS);
    await upsertAppState('platform', 'audit_logs', []);

    await client.query('COMMIT');
    console.log('✅ Supabase PostgreSQL bootstrapped successfully:');
    console.log('   - 1 Predefined Admin Login: admin@printflow.io');
    console.log('   - 4 Live SaaS Plans');
    console.log('   - Zero dummy shops, zero dummy printers, zero dummy jobs');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to bootstrap database:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  seedDatabase().then(() => pool.end()).catch(() => {
    pool.end();
    process.exit(1);
  });
}
