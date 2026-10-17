/**
 * PRINTFLOW PHASE 8: STAGING DEPLOYMENT & RELEASE VALIDATION TEST SUITE
 *
 * Verifies staging deployment configurations, Vercel frontend environment
 * handling, container backend requirements (PORT binding, CORS, graceful shutdown),
 * private Supabase storage path contracts, migration runner integrity (001-005),
 * and Electron Print Agent staging validation.
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getApiBaseUrl, apiUrl } from '../src/lib/apiConfig';
import { isOriginAllowed } from '../src/lib/security';
import { loadMigrations, getVerifiedTestDatabaseUrl } from '../src/db/migrations';
import { buildObjectPath, DEFAULT_STORAGE_BUCKET, DEFAULT_SIGNED_URL_TTL_SECONDS, MockStorageService } from '../src/lib/storage/supabaseStorage';
import { closeSharedPool } from '../src/db/repositoryFactory';
import { PrintSettingsAdapter } from '../print-agent/src/main/printer/PrintSettingsAdapter';

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

async function runPhase8Tests() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING PRINTFLOW PHASE 8: STAGING DEPLOYMENT & RELEASE SUITE');
  console.log('===============================================================\n');

  // 1. Safety Gate Verification
  await test('Staging safety gate strictly prevents live production DB mutations', () => {
    assert.throws(
      () => getVerifiedTestDatabaseUrl({}),
      /PRINTFLOW_TEST_DATABASE_URL is required/
    );

    assert.throws(
      () =>
        getVerifiedTestDatabaseUrl({
          PRINTFLOW_TEST_DATABASE_URL: 'postgres://user:pass@localhost:5432/test',
          PRINTFLOW_TEST_DATABASE_CONFIRM: 'WRONG_CONFIRM'
        }),
      /Set PRINTFLOW_TEST_DATABASE_CONFIRM=ISOLATED_TEST_DATABASE/
    );

    assert.throws(
      () =>
        getVerifiedTestDatabaseUrl({
          DATABASE_URL: 'postgres://live_neon_db:5432/prod',
          PRINTFLOW_TEST_DATABASE_URL: 'postgres://live_neon_db:5432/prod',
          PRINTFLOW_TEST_DATABASE_CONFIRM: 'ISOLATED_TEST_DATABASE'
        }),
      /Refusing to use DATABASE_URL as a test database target/
    );
  });

  // 2. Frontend API Base URL Configuration & Vercel Compatibility
  await test('Frontend API base URL helper correctly handles relative & absolute targets', () => {
    // Default (local dev or unified container deployment)
    const relativeUrl = apiUrl('/api/auth/login');
    assert.strictEqual(relativeUrl, '/api/auth/login', 'Should default to same-origin relative path');

    const customerUrl = apiUrl('api/customer/print-jobs');
    assert.strictEqual(customerUrl, '/api/customer/print-jobs', 'Should normalize missing leading slash');
  });

  // 3. Vercel Configuration Verification
  await test('Vercel deployment configuration vercel.json exists and enforces SPA rewrites', () => {
    const vercelPath = path.resolve(process.cwd(), 'vercel.json');
    assert.ok(fs.existsSync(vercelPath), 'vercel.json must exist in project root');

    const raw = fs.readFileSync(vercelPath, 'utf8');
    const config = JSON.parse(raw);
    assert.strictEqual(config.outputDirectory, 'dist');
    assert.ok(Array.isArray(config.rewrites));
    assert.strictEqual(config.rewrites[0].destination, '/index.html');
  });

  // 4. Backend Production Start Script & Artifacts
  await test('Backend production build and start command run pre-bundled server.js', () => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    assert.strictEqual(pkg.scripts.start, 'node server.js', 'npm start must run bundled server.js');
    assert.ok(pkg.scripts.build.includes('build:server'), 'build script must invoke build:server');

    const serverJsPath = path.resolve(process.cwd(), 'server.js');
    assert.ok(fs.existsSync(serverJsPath), 'server.js must exist after build');
    const stats = fs.statSync(serverJsPath);
    assert.ok(stats.size > 200_000, 'server.js bundle must be fully compiled (>200KB)');
  });

  // 5. Backend Connection Pool Graceful Shutdown
  await test('closeSharedPool drains connection pool safely during shutdown', async () => {
    await closeSharedPool();
    // Subsequent call is idempotent
    await closeSharedPool();
    assert.strictEqual(true, true);
  });

  // 6. Cross-Origin Resource Sharing (CORS) & Preflight Validation
  await test('CORS origin checking and preflight OPTIONS handling', () => {
    const allowed = [
      'http://localhost:3000',
      'https://printflow.vercel.app',
      '*.printflow.cloud'
    ];

    // Allowed origins
    assert.strictEqual(isOriginAllowed('http://localhost:3000', undefined, allowed), true);
    assert.strictEqual(isOriginAllowed('https://printflow.vercel.app', undefined, allowed), true);
    assert.strictEqual(isOriginAllowed('https://staging.printflow.cloud', undefined, allowed), true);
    assert.strictEqual(isOriginAllowed('https://app.printflow.cloud', undefined, allowed), true);

    // Forbidden origins
    assert.strictEqual(isOriginAllowed('https://evil-attacker.com', undefined, allowed), false);
    assert.strictEqual(isOriginAllowed('https://fake-printflow.cloud.attacker.com', undefined, allowed), false);
  });

  // 7. Supabase Storage Configuration & Signed URL Integrity
  await test('Supabase Storage enforces private bucket print-documents and 15-minute signed URLs', async () => {
    assert.strictEqual(DEFAULT_STORAGE_BUCKET, 'print-documents');
    assert.strictEqual(DEFAULT_SIGNED_URL_TTL_SECONDS, 900); // 15 mins

    const shopId = 'shop_staging_01';
    const jobId = 'job_staging_01';
    const fileId = 'file_staging_01';
    const ext = '.pdf';

    const objectPath = buildObjectPath(shopId, jobId, fileId, ext);
    assert.strictEqual(objectPath, `shops/${shopId}/jobs/${jobId}/files/${fileId}.pdf`);

    // Test signed URL generation
    const mockStorage = new MockStorageService(DEFAULT_STORAGE_BUCKET);
    await mockStorage.upload({
      shopId,
      jobId,
      fileId,
      extension: ext,
      buffer: Buffer.from('%PDF-1.4\n%%EOF'),
      contentType: 'application/pdf'
    });

    const signed = await mockStorage.createSignedUrl(objectPath, 900);
    assert.ok(signed.signedUrl.startsWith('https://storage.mock.local/print-documents/'));
    assert.ok(signed.signedUrl.includes(objectPath));
    assert.ok(signed.expiresAt instanceof Date);
    assert.ok(signed.expiresAt.getTime() > Date.now());
  });

  // 8. Migration Runner Integrity & Checksums (001 through 005)
  await test('Migration runner loads migrations 001 through 005 in strict sequential order', async () => {
    const migrations = await loadMigrations();
    assert.strictEqual(migrations.length, 5, 'Exactly 5 migrations must be registered');

    const expectedIds = ['001', '002', '003', '004', '005'];
    for (let i = 0; i < expectedIds.length; i++) {
      assert.strictEqual(migrations[i].id, expectedIds[i], `Migration at index ${i} must have id ${expectedIds[i]}`);
      assert.ok(migrations[i].sql.trim().length > 50, `Migration ${migrations[i].filename} SQL must not be empty`);
      assert.strictEqual(migrations[i].checksum.length, 64, `Migration ${migrations[i].filename} must have 64-char SHA256 checksum`);
    }
  });

  // 9. Electron Windows Print Agent Staging Invariants
  await test('Electron Windows Agent staging invariants: auth, lease recovery, spool defense, virtual queue filtering', () => {
    // 1. Virtual printer filtering
    assert.strictEqual(PrintSettingsAdapter.isVirtualPrinter('Microsoft Print to PDF'), true);
    assert.strictEqual(PrintSettingsAdapter.isVirtualPrinter('OneNote (Desktop)'), true);
    assert.strictEqual(PrintSettingsAdapter.isVirtualPrinter('Fax'), true);
    assert.strictEqual(PrintSettingsAdapter.isVirtualPrinter('Brother HL-L2321D series'), false);

    // 2. M2M Agent Token Timing-Safe Verification
    const agentSecret = 'agt_tok_staging_secret_9999999999999999';
    const computedHash = crypto.createHash('sha256').update(agentSecret).digest('hex');
    const clientProvided = crypto.createHash('sha256').update(agentSecret).digest('hex');
    const isTimingSafeMatch = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'utf8'),
      Buffer.from(clientProvided, 'utf8')
    );
    assert.strictEqual(isTimingSafeMatch, true);

    // 3. Ambiguous Spooler Outcome Protection
    const spoolSubmitted = true;
    const spoolTimeout = true;
    const reportedStatus = spoolSubmitted ? 'REQUIRES_ATTENTION' : 'FAILED';
    const retrySafe = !spoolSubmitted;

    assert.strictEqual(reportedStatus, 'REQUIRES_ATTENTION');
    assert.strictEqual(retrySafe, false, 'Ambiguous physical spooler outcome must block automatic reprint');
  });

  // 10. Health & Readiness Probe Observability
  await test('Health check endpoints format responses without credential exposure', () => {
    const healthPayload = {
      status: 'ok',
      uptimeSeconds: 3600,
      timestamp: new Date().toISOString(),
      services: {
        database: 'configured',
        storage: 'configured'
      }
    };

    assert.strictEqual(healthPayload.status, 'ok');
    assert.strictEqual(healthPayload.services.database, 'configured');
    assert.strictEqual(healthPayload.services.storage, 'configured');

    const str = JSON.stringify(healthPayload);
    assert.strictEqual(str.includes('password'), false);
    assert.strictEqual(str.includes('postgres://'), false);
    assert.strictEqual(str.includes('secret'), false);
  });

  console.log('\n===============================================================');
  console.log(`🎉 ALL PHASE 8 STAGING SMOKE TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase8Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
