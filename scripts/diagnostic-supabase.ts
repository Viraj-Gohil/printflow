import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

dotenv.config({ override: true });

async function runDiagnostic() {
  console.log('==================================================');
  console.log(' SUPABASE & DATABASE ENVIRONMENT DIAGNOSTIC');
  console.log('==================================================');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  console.log(`[Config] SUPABASE_URL: ${supabaseUrl ? supabaseUrl : 'NOT SET (Missing)'}`);
  console.log(`[Config] SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? '*** SET (' + serviceRoleKey.substring(0, 8) + '...)' : 'NOT SET (Empty)'}`);
  console.log(`[Config] DATABASE_URL: ${databaseUrl ? '*** SET (' + databaseUrl.substring(0, 25) + '...)' : 'NOT SET (Missing)'}`);

  if (!supabaseUrl) {
    console.error('\n❌ ERROR: SUPABASE_URL is not set in environment variables.');
  }

  if (!serviceRoleKey) {
    console.warn('\n⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY / SUPABASE_ANON_KEY) is empty or not set.');
    console.warn('   Supabase client REST queries require a valid Supabase key. However, direct PostgreSQL connection via DATABASE_URL can still be verified.');
  }

  if (supabaseUrl && serviceRoleKey) {
    console.log('\n[1/2] Testing Supabase Client Connection & Query...');
    try {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { count, error, status } = await supabase
        .from('printflow_users')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.warn(`⚠️ Supabase client query warning (status ${status}):`, error.message);
        const { error: err2 } = await supabase.from('shop_payment_integrations').select('*', { count: 'exact', head: true });
        if (err2) {
          console.error('❌ Supabase client query failed on fallback table:', err2.message);
        } else {
          console.log('✅ Supabase client successfully connected and queried shop_payment_integrations!');
        }
      } else {
        console.log(`✅ Supabase client successfully connected! Row count in printflow_users: ${count ?? 0}`);
      }
    } catch (err: any) {
      console.error('❌ Supabase client initialization or query threw an exception:', err?.message || err);
    }
  } else {
    console.log('\n[1/2] Supabase Client test skipped due to missing service role key.');
  }

  if (databaseUrl) {
    console.log('\n[2/2] Testing Direct PostgreSQL Pool Connection (SELECT count(*) FROM printflow_users / shops)...');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    try {
      const client = await pool.connect();
      const res = await client.query('SELECT current_database(), current_user, version()');
      console.log('✅ Direct PostgreSQL connection successful!');
      console.log('   Database:', res.rows[0].current_database);
      console.log('   User:', res.rows[0].current_user);

      try {
        const countRes = await client.query('SELECT count(*) FROM printflow_users');
        console.log(`✅ Query check: SELECT count(*) FROM printflow_users = ${countRes.rows[0].count}`);
      } catch (e: any) {
        console.log('ℹ️ printflow_users table not present yet or migration pending:', e.message);
      }

      try {
        const shopsRes = await client.query('SELECT count(*) FROM shops');
        console.log(`✅ Query check: SELECT count(*) FROM shops = ${shopsRes.rows[0].count}`);
      } catch (e: any) {
        console.log('ℹ️ shops table not present in this schema (using printflow_users / shop_payment_integrations).');
      }

      client.release();
      await pool.end();
    } catch (err: any) {
      console.error('❌ Direct PostgreSQL pool connection failed:', err?.message || err);
      try { await pool.end(); } catch {}
    }
  } else {
    console.log('\n[2/2] Direct PostgreSQL Pool Connection skipped (DATABASE_URL not set).');
  }

  console.log('\n==================================================');
  console.log(' DIAGNOSTIC COMPLETE');
  console.log('==================================================');
}

runDiagnostic().catch((err) => {
  console.error('Diagnostic script execution failed:', err);
  process.exit(1);
});
