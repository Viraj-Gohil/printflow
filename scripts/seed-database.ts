/**
 * PrintFlow: Database Seeder
 * Populates Neon PostgreSQL with complete initial master data:
 * - Shops (Royal Cyber Xerox, ABC Xerox, Campus Prints, QuickDoc)
 * - SaaS Plans (Starter, Growth, Pro, Enterprise)
 * - Pricing Rules (A4, A3, Legal, Single/Double, BW/Color)
 * - Print Agent Devices with deterministic tokens
 * - PrintFlow App State (Scopes for Platform and Shops)
 * 
 * Cleans out dummy mock orders & mock transactions for real production state.
 */
import dotenv from 'dotenv';
import { Pool } from 'pg';
import crypto from 'crypto';
import {
  INITIAL_SAAS_PLANS,
  INITIAL_SHOPS,
  INITIAL_PRICING_RULES,
  INITIAL_PRINTERS,
  INITIAL_AGENTS,
  INITIAL_PLATFORM_POLICIES,
  INITIAL_ADMIN_RAZORPAY_SETTINGS,
  INITIAL_SUPPORT_SETTINGS,
  INITIAL_SUPPORT_TICKETS
} from '../src/data/mockData';

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

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function getDeterministicAgentToken(shopId: string): string {
  if (shopId === 'shop_royal_cyber') {
    return 'agt_tok_royal_cyber_counter_master_2026';
  }
  const cleanId = (shopId || 'counter').replace(/[^a-zA-Z0-9]/g, '_');
  return `agt_tok_${cleanId}_master_2026`;
}

export async function seedDatabase(targetPool: Pool = pool) {
  const client = await targetPool.connect();
  console.log('🚀 Seeding master data to Neon PostgreSQL...');

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

      CREATE TABLE IF NOT EXISTS public.printflow_shop_mappings (
        client_shop_id VARCHAR(128) PRIMARY KEY,
        neon_shop_id VARCHAR(128) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Seed Print Agent Devices with deterministic tokens
    const agentSeeds = [
      {
        agentId: 'agent_rcx_1',
        shopId: 'shop_royal_cyber',
        deviceName: 'ROYAL-CYBE-PC01',
        token: getDeterministicAgentToken('shop_royal_cyber')
      },
      {
        agentId: 'agent_shp_abc_xerox_01',
        shopId: 'shp_abc_xerox_01',
        deviceName: 'ABC-PC01',
        token: getDeterministicAgentToken('shp_abc_xerox_01')
      },
      {
        agentId: 'agent_shop_univ_campus',
        shopId: 'shop_univ_campus',
        deviceName: 'CAMPUS-PC01',
        token: getDeterministicAgentToken('shop_univ_campus')
      },
      {
        agentId: 'agent_shop_quickdoc',
        shopId: 'shop_quickdoc',
        deviceName: 'QUICKDOC-PC01',
        token: getDeterministicAgentToken('shop_quickdoc')
      }
    ];

    for (const ag of agentSeeds) {
      await client.query(`
        INSERT INTO public.print_agent_devices (agent_id, shop_id, device_name, token_hash, is_revoked, status, last_seen, updated_at)
        VALUES ($1, $2, $3, $4, false, 'OFFLINE', NULL, NOW())
        ON CONFLICT (agent_id) DO UPDATE SET
          device_name = EXCLUDED.device_name,
          token_hash = EXCLUDED.token_hash,
          is_revoked = false,
          updated_at = NOW()
      `, [ag.agentId, ag.shopId, ag.deviceName, hashToken(ag.token)]);
    }

    // 3. Helper to upsert state record with both state_data and payload columns
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

    // 4. Seed Platform App State
    await upsertAppState('platform', 'saas_plans', INITIAL_SAAS_PLANS);
    await upsertAppState('platform', 'platform_policies', INITIAL_PLATFORM_POLICIES);
    await upsertAppState('platform', 'admin_razorpay_settings', INITIAL_ADMIN_RAZORPAY_SETTINGS);
    await upsertAppState('platform', 'support_settings', INITIAL_SUPPORT_SETTINGS);
    await upsertAppState('platform', 'audit_logs', []);

    // 5. Seed Shop App State for every active shop
    const allShopScopes = [
      ...INITIAL_SHOPS.map((s) => s.id),
      'shp_abc_xerox_01'
    ];

    for (const shopId of allShopScopes) {
      const shopObj = INITIAL_SHOPS.find((s) => s.id === shopId) || {
        ...INITIAL_SHOPS[0],
        id: shopId,
        name: shopId === 'shp_abc_xerox_01' ? 'ABC Xerox & Multi-Services' : 'Counter Print Shop',
        slug: shopId === 'shp_abc_xerox_01' ? 'abc-xerox' : 'counter-print-shop'
      };

      const rules = INITIAL_PRICING_RULES.filter((r) => r.shopId === shopId || (shopId === 'shp_abc_xerox_01' && r.shopId === 'shop_royal_cyber')).map((r) => ({
        ...r,
        shopId
      }));

      const printers = INITIAL_PRINTERS.filter((p) => p.shopId === shopId || (shopId === 'shp_abc_xerox_01' && p.shopId === 'shop_royal_cyber')).map((p) => ({
        ...p,
        shopId
      }));

      const token = getDeterministicAgentToken(shopId);
      const agents = [
        {
          id: `agent_${shopId}`,
          shopId,
          shopName: shopObj.name,
          deviceName: `${shopObj.slug.toUpperCase().slice(0, 10)}-PC01`,
          version: 'v1.4.2',
          agentVersion: 'v1.4.2',
          status: 'OFFLINE' as const,
          lastSeen: 'Not connected',
          connectedPrintersCount: 0,
          printerCount: 0,
          authToken: token,
          apiToken: token,
          createdAt: new Date().toISOString()
        }
      ];

      const tickets = INITIAL_SUPPORT_TICKETS.filter((t) => t.shopId === shopId);

      await upsertAppState(shopId, 'shops', [shopObj]);
      await upsertAppState(shopId, 'active_shop_id', shopId);
      await upsertAppState(shopId, 'pricing_rules', rules.length > 0 ? rules : INITIAL_PRICING_RULES.slice(0, 4));
      await upsertAppState(shopId, 'printers', printers.length > 0 ? printers : INITIAL_PRINTERS.slice(0, 2));
      await upsertAppState(shopId, 'agents', agents);
      await upsertAppState(shopId, 'print_jobs', []);
      await upsertAppState(shopId, 'transactions', []);
      await upsertAppState(shopId, 'audit_logs', []);
      await upsertAppState(shopId, 'support_tickets', tickets);
    }

    await client.query('COMMIT');
    console.log('✅ Successfully seeded all master data to Neon PostgreSQL!');
    console.log('   - 4 SaaS Plans (platform)');
    console.log(`   - ${allShopScopes.length} Shop App State Scopes: ${allShopScopes.join(', ')}`);
    console.log('   - Pricing Rules & Paper Sizes');
    console.log('   - Print Agent Devices & Persistent Tokens');
    console.log('   - Reset dummy mock orders & transactions to clean state');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to seed database:', error);
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
