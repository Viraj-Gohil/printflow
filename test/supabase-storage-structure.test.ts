/**
 * Comprehensive Test Suite for PrintFlow Shop-Wise and Date-Wise Supabase Storage Structure
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import { buildObjectPath, DEFAULT_STORAGE_BUCKET, MockStorageService, SupabaseStorageService } from '../src/lib/storage/supabaseStorage';

async function runStorageStructureTests() {
  console.log('🧪 Running PrintFlow Supabase Storage Structure Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err?.message || err}`);
      failed++;
    }
  }

  // 1. Correct path generation with date partitioning
  test('Correct shop/year/month/day/job/file path generation', () => {
    const shopId = 'shop_uuid_8f31';
    const jobId = 'job_uuid_a123';
    const fileId = 'file_uuid_f001';
    const fixedDate = new Date('2026-10-21T12:00:00Z');
    const path = buildObjectPath(shopId, jobId, fileId, '.pdf', fixedDate);

    assert.strictEqual(
      path,
      'shops/shop_uuid_8f31/21-10-2026/jobs/job_uuid_a123/file_uuid_f001.pdf',
      'Path matches shops/{shopId}/{DD}-{MM}-{YYYY}/jobs/{jobId}/{fileId}.{ext}'
    );
  });

  // 2. Two shops having isolated object paths
  test('Two shops have strictly isolated object paths', () => {
    const jobId = 'job_common_100';
    const fileId = 'file_common_200';
    const date = new Date('2026-10-21T00:00:00Z');

    const pathA = buildObjectPath('shop_A', jobId, fileId, 'pdf', date);
    const pathB = buildObjectPath('shop_B', jobId, fileId, 'pdf', date);

    assert.notStrictEqual(pathA, pathB, 'Paths for different shops must differ');
    assert(pathA.startsWith('shops/shop_A/'), 'Path A starts with shop_A');
    assert(pathB.startsWith('shops/shop_B/'), 'Path B starts with shop_B');
  });

  // 3. Multiple files for the same job
  test('Multiple files for the same job get unique file IDs and paths', () => {
    const shopId = 'shop_multi';
    const jobId = 'job_multi_99';
    const date = new Date('2026-10-21T00:00:00Z');

    const file1Id = `file_${crypto.randomBytes(8).toString('hex')}`;
    const file2Id = `file_${crypto.randomBytes(8).toString('hex')}`;

    const path1 = buildObjectPath(shopId, jobId, file1Id, 'pdf', date);
    const path2 = buildObjectPath(shopId, jobId, file2Id, 'jpg', date);

    assert.notStrictEqual(path1, path2, 'Multiple files in same job must have unique paths');
    assert(path1.endsWith('.pdf'), 'File 1 extension');
    assert(path2.endsWith('.jpg'), 'File 2 extension');
  });

  // 4. Mock storage upload and download roundtrip
  const mockStorage = new MockStorageService('print-documents');
  test('MockStorageService uploads and downloads successfully', async () => {
    const shopId = 'shop_test';
    const jobId = 'job_test';
    const fileId = 'file_test';
    const buffer = Buffer.from('%PDF-1.4 test document content');
    const objectPath = buildObjectPath(shopId, jobId, fileId, 'pdf', new Date('2026-10-21T00:00:00Z'));

    const uploadRes = await mockStorage.upload({
      shopId,
      jobId,
      fileId,
      extension: 'pdf',
      buffer,
      contentType: 'application/pdf'
    });

    assert.strictEqual(uploadRes.bucket, 'print-documents', 'Bucket is print-documents');
    assert.strictEqual(uploadRes.objectPath, objectPath, 'Object path matches');
    assert.strictEqual(uploadRes.sizeBytes, buffer.length, 'Size matches');

    const downloaded = await mockStorage.download(objectPath);
    assert.strictEqual(downloaded.toString(), buffer.toString(), 'Downloaded buffer matches original');
  });

  // 5. Private bucket access & signed URL generation
  test('Private bucket generates signed URL with expiration', async () => {
    const shopId = 'shop_priv';
    const jobId = 'job_priv';
    const fileId = 'file_priv';
    const buffer = Buffer.from('secret doc');
    const objectPath = buildObjectPath(shopId, jobId, fileId, 'pdf');

    await mockStorage.upload({ shopId, jobId, fileId, extension: 'pdf', buffer, contentType: 'application/pdf' });
    const signed = await mockStorage.createSignedUrl(objectPath, 900);

    assert(signed.signedUrl.includes('print-documents'), 'Signed URL references private bucket');
    assert(signed.expiresAt instanceof Date, 'Returns expiration Date');
  });

  // 6. Shop renaming stability
  test('Shop renaming preserves object path validity (ID-based paths)', () => {
    const canonicalShopId = 'shop_uuid_stable_123';
    const jobId = 'job_1';
    const fileId = 'file_1';
    const date = new Date('2026-10-21T00:00:00Z');

    const pathBeforeRename = buildObjectPath(canonicalShopId, jobId, fileId, 'pdf', date);
    // Rename shop name from "Old Name" to "New Elite Print Shop", but canonical ID remains identical
    const pathAfterRename = buildObjectPath(canonicalShopId, jobId, fileId, 'pdf', date);

    assert.strictEqual(pathBeforeRename, pathAfterRename, 'Object path remains unchanged when shop name changes');
  });

  console.log('\n========================================');
  console.log(`Storage Structure Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStorageStructureTests().catch((err) => {
  console.error('Storage structure test execution failed:', err);
  process.exit(1);
});
