/**
 * Unit Test Suite for Scheduled Midnight IST Supabase Storage Cleanup Job
 */

import assert from 'node:assert';
import { MockStorageService } from '../src/lib/storage/supabaseStorage';

async function runCleanupTests() {
  console.log('🧪 Running PrintFlow Storage Cleanup Job Test Suite...\n');
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

  // 1. Test MockStorageService batch deletion of expired object paths
  await (async () => {
    try {
      const storage = new MockStorageService('print-documents');
      const shopId = 'shop_cleanup_test';
      const jobId = 'job_cleanup_1';
      const fileId1 = 'file_1';
      const fileId2 = 'file_2';

      const path1 = `shops/${shopId}/21-10-2026/jobs/${jobId}/${fileId1}.pdf`;
      const path2 = `shops/${shopId}/21-10-2026/jobs/${jobId}/${fileId2}.png`;

      await storage.upload({ shopId, jobId, fileId: fileId1, extension: 'pdf', buffer: Buffer.from('doc 1'), contentType: 'application/pdf' });
      await storage.upload({ shopId, jobId, fileId: fileId2, extension: 'png', buffer: Buffer.from('doc 2'), contentType: 'image/png' });

      assert(storage.has(path1), 'File 1 exists in mock storage');
      assert(storage.has(path2), 'File 2 exists in mock storage');

      // Batch delete expired files
      await storage.delete([path1, path2]);

      assert(!storage.has(path1), 'File 1 deleted successfully by cleanup job');
      assert(!storage.has(path2), 'File 2 deleted successfully by cleanup job');

      console.log('  ✅ PASS: MockStorageService batch deletion of expired object paths');
      passed++;
    } catch (err: any) {
      console.error('  ❌ FAIL: MockStorageService batch deletion of expired object paths');
      console.error(`     Error: ${err?.message || err}`);
      failed++;
    }
  })();

  console.log('\n========================================');
  console.log(`Storage Cleanup Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCleanupTests().catch((err) => {
  console.error('Storage cleanup test execution failed:', err);
  process.exit(1);
});
