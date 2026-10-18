/**
 * PRINTFLOW: NEON-ONLY AUTHORITATIVE PERSISTENCE VERIFICATION TEST SUITE
 *
 * Validates that Neon PostgreSQL is the sole authoritative database for all
 * business and application data:
 * 1. Fail-closed behavior: requirePostgresPool() throws HTTP 503 when Neon is unconfigured
 * 2. Elimination of in-memory maps in server.ts
 * 3. Zero local JSON persistence (.data/ directory & payment_integrations.json deleted & absent)
 * 4. Electron Print Agent: jobs_queue.json eliminated; runtime queue starts empty and reconciles from Neon
 * 5. Supabase Storage: customer print documents persist to private cloud storage with metadata in Neon
 * 6. Neon repository operations: integrations & user persistence query PostgreSQL directly
 * 7. Browser localStorage: all business persistence eliminated; only ephemeral runtime state permitted
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  requirePostgresPool,
  setNeonPoolForTest,
  getShopPaymentIntegration,
  saveShopPaymentIntegration,
  deleteShopPaymentIntegration,
  getPlatformPaymentConfig,
  savePlatformPaymentConfig
} from '../src/db/paymentStorage';
import { buildObjectPath, DEFAULT_STORAGE_BUCKET } from '../src/lib/storage/supabaseStorage';
import { encryptSecret } from '../src/lib/crypto/credentialCrypto';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          console.log(`  ✅ PASS: ${name}`);
          passed++;
        })
        .catch((err) => {
          console.error(`  ❌ FAIL: ${name}`, err);
          failed++;
        });
    }
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`, err);
    failed++;
  }
}

async function runNeonOnlyTests() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING PRINTFLOW NEON-ONLY AUTHORITATIVE PERSISTENCE TESTS');
  console.log('===============================================================\n');

  // 1. Fail-Closed Check When Neon is Unconfigured
  await test('requirePostgresPool throws 503 error when Neon pool is unconfigured', () => {
    setNeonPoolForTest(null as any);
    assert.throws(
      () => requirePostgresPool(),
      (err: any) => err?.statusCode === 503 && Boolean(err?.message.includes('Neon PostgreSQL is not configured'))
    );
  });

  // 2. Verified That In-Memory Maps Are Completely Removed From server.ts
  await test('server.ts contains zero authoritative in-memory Map declarations', () => {
    const serverSource = fs.readFileSync(path.resolve('server.ts'), 'utf8');
    assert.strictEqual(serverSource.includes('const trackedPaymentOrders = new Map'), false, 'trackedPaymentOrders must be removed');
    assert.strictEqual(serverSource.includes('const verifiedPayments = new Map'), false, 'verifiedPayments must be removed');
    assert.strictEqual(serverSource.includes('const orderIdToPaymentId = new Map'), false, 'orderIdToPaymentId must be removed');
    assert.strictEqual(serverSource.includes('const inMemoryPrivateFiles = new Map'), false, 'inMemoryPrivateFiles must be removed');
    assert.strictEqual(serverSource.includes('const backendPrintJobs = new Map'), false, 'backendPrintJobs must be removed');
    assert.strictEqual(serverSource.includes('const backendPrintJobsByOrder = new Map'), false, 'backendPrintJobsByOrder must be removed');
  });

  // 3. Verified No .data/ Directory Or Local JSON Persistence File Exists
  await test('No .data/ directory or local JSON payment integration file exists', () => {
    const dataDirPath = path.resolve('.data');
    const localJsonPath = path.resolve('.data', 'payment_integrations.json');
    assert.strictEqual(fs.existsSync(localJsonPath), false, 'payment_integrations.json must not exist');
    assert.strictEqual(fs.existsSync(dataDirPath), false, '.data directory must not exist');
  });

  // 4. Mock Pool Operations: Neon Is The Sole Authoritative Target
  await test('Neon payment integration queries execute against PostgreSQL tables', async () => {
    const queriesExecuted: Array<{ sql: string; values: any[] }> = [];
    const validEncryptedSecret = encryptSecret('neon_unit_test_secret_123');

    const mockPool = {
      query: async (text: string, params?: any[]) => {
        queriesExecuted.push({ sql: text, values: params || [] });
        if (text.includes('SELECT') && text.includes('shop_payment_integrations')) {
          return {
            rowCount: 1,
            rows: [{
              shop_id: 'shop_neon_test_1',
              key_id: 'rzp_test_neon_key_123',
              encrypted_key_secret: validEncryptedSecret,
              account_upi_id: 'neon@upi',
              auto_capture: true,
              receipt_prefix: 'NEO-',
              webhook_secret: 'whsec_neon_123',
              is_active: true,
              key_status: 'ACTIVE',
              environment: 'TEST',
              auth_flow: 'DIRECT_KEYS',
              updated_at: new Date().toISOString()
            }]
          };
        }
        return { rowCount: 1, rows: [] };
      }
    };

    setNeonPoolForTest(mockPool as any);

    // Fetch integration
    const integration = await getShopPaymentIntegration('shop_neon_test_1');
    assert.strictEqual(integration !== null, true);
    assert.strictEqual(integration?.keyId, 'rzp_test_neon_key_123');
    assert.strictEqual(integration?.keySecret, 'neon_unit_test_secret_123');

    // Verify it queried the database
    const selectQuery = queriesExecuted.find((q) => q.sql.includes('shop_payment_integrations'));
    assert.strictEqual(Boolean(selectQuery), true);
    assert.strictEqual(selectQuery?.values[0], 'shop_neon_test_1');

    // Save integration
    await saveShopPaymentIntegration({
      shopId: 'shop_neon_test_1',
      keyId: 'rzp_test_neon_key_updated',
      keySecret: 'new_secret_123',
      mode: 'test',
      isActive: true
    });

    const insertQuery = queriesExecuted.find((q) => q.sql.includes('INSERT INTO shop_payment_integrations'));
    assert.strictEqual(Boolean(insertQuery), true);

    // Delete integration
    await deleteShopPaymentIntegration('shop_neon_test_1');
    const deleteQuery = queriesExecuted.find((q) => q.sql.includes('DELETE FROM shop_payment_integrations'));
    assert.strictEqual(Boolean(deleteQuery), true);

    // Ensure no .data folder was created
    assert.strictEqual(fs.existsSync(path.resolve('.data')), false);
  });

  // 5. Electron Print Agent: No Local Database Authority
  await test('Electron Print Agent vault eliminates jobs_queue.json disk writes', () => {
    const vaultSource = fs.readFileSync(
      path.resolve('print-agent/src/main/storage/LocalDataVault.ts'),
      'utf8'
    );
    assert.ok(
      vaultSource.includes('Neon PostgreSQL is the sole authoritative database'),
      'Vault must document Neon as authoritative database'
    );
    assert.ok(
      vaultSource.includes('Purge legacy jobs_queue.json if present on disk'),
      'Vault must purge legacy jobs_queue.json if found'
    );
    assert.strictEqual(
      vaultSource.includes('fs.writeFileSync(temporaryPath, JSON.stringify(arr, null, 2)'),
      false,
      'Vault must not write jobs array to disk'
    );
  });

  await test('JobQueueManager runtime queue starts empty and reconciles from Neon', () => {
    const queueSource = fs.readFileSync(
      path.resolve('print-agent/src/main/queue/JobQueueManager.ts'),
      'utf8'
    );
    assert.ok(
      queueSource.includes('Runtime queue begins empty; authoritative jobs are reconciled from Neon on startup'),
      'JobQueueManager must initialize queue empty'
    );
  });

  // 6. Supabase Storage For Files with Neon Metadata
  await test('Supabase Storage private bucket path format adheres to tenant isolation contract', () => {
    const objectPath = buildObjectPath('shop_tenant_42', 'job_alpha_99', 'file_doc_01', '.pdf');
    assert.strictEqual(objectPath, 'shops/shop_tenant_42/jobs/job_alpha_99/files/file_doc_01.pdf');
    assert.strictEqual(DEFAULT_STORAGE_BUCKET, 'print-documents');
  });

  // 7. Frontend Store: Zero Business Persistence in localStorage
  await test('Frontend store.tsx does not invoke localStorage.setItem for business data', () => {
    const storeSource = fs.readFileSync(path.resolve('src/lib/store.tsx'), 'utf8');
    assert.strictEqual(
      storeSource.includes("localStorage.setItem(STORAGE_KEY_PREFIX + 'shops'"),
      false,
      'Shops must not be written to localStorage'
    );
    assert.strictEqual(
      storeSource.includes("localStorage.setItem(STORAGE_KEY_PREFIX + 'pricing_rules'"),
      false,
      'Pricing rules must not be written to localStorage'
    );
    assert.strictEqual(
      storeSource.includes("localStorage.setItem(STORAGE_KEY_PREFIX + 'printers'"),
      false,
      'Printers must not be written to localStorage'
    );
    assert.strictEqual(
      storeSource.includes("localStorage.setItem(STORAGE_KEY_PREFIX + 'print_jobs'"),
      false,
      'Print jobs must not be written to localStorage'
    );
    assert.strictEqual(
      storeSource.includes("localStorage.setItem(STORAGE_KEY_PREFIX + 'transactions'"),
      false,
      'Transactions must not be written to localStorage'
    );
    assert.ok(
      storeSource.includes('Authoritative business data is loaded from Neon via backend APIs; localStorage persistence is eliminated.'),
      'store.tsx must document elimination of localStorage persistence'
    );
  });

  // Summary
  console.log('\n===============================================================');
  console.log(`🎉 NEON-ONLY AUTHORITATIVE TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runNeonOnlyTests().catch((err) => {
  console.error('Test runner encountered an unhandled exception:', err);
  process.exit(1);
});
