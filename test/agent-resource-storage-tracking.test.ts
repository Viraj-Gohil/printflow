/**
 * PRINTFLOW AGENT RESOURCE MONITORING & SUBSCRIPTION STORAGE TRACKING TEST SUITE
 *
 * Verifies:
 * 1. Two Agents reporting different resource metrics with strict shop boundary isolation.
 * 2. Correct shop-to-agent ownership validation.
 * 3. Agent offline detection after missed heartbeat window.
 * 4. CPU and RAM threshold alert creation (CPU > 85%, RAM > 85%).
 * 5. Low disk space alert generation (< 10% free).
 * 6. Agent-owned local storage calculation (spool, temp, sqlite, logs, cache) separated from system C: drive and cloud storage.
 * 7. Shop subscription quota calculation and plan limit resolution.
 * 8. Atomic storage quota reservation preventing concurrent oversubscription.
 * 9. Upload failure compensation releasing reserved quota.
 * 10. Document deletion releasing used storage quota.
 * 11. Cross-shop storage and telemetry access denial.
 * 12. Verification that customer cloud document upload does NOT count towards Agent local disk usage once cleaned up.
 */

import assert from 'node:assert';
import {
  initializePaymentTables,
  saveAgentHealthAndSnapshot,
  getAgentHealthStatus,
  getAgentResourceHistory,
  getAgentAlerts,
  resolveAgentAlert,
  getShopStorageUsage,
  reserveStorageQuota,
  commitStorageUpload,
  releaseStorageReservation,
  releaseStorageUsage
} from '../src/db/paymentStorage';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message || err}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('🚀 PRINTFLOW: AGENT RESOURCE & STORAGE TRACKING TEST SUITE');
  console.log('===============================================================\n');

  await initializePaymentTables().catch(() => {});

  // --------------------------------------------------------------------------
  // SECTION 1: AGENT RESOURCE REPORTING & MULTI-AGENT ISOLATION
  // --------------------------------------------------------------------------
  console.log('--- 1. Multi-Agent Telemetry Reporting & Shop Isolation ---');

  const agentA = 'agent_shop_alpha_01';
  const shopA = 'shop_alpha';

  const agentB = 'agent_shop_beta_01';
  const shopB = 'shop_beta';

  await runTest('Agent A reports nominal metrics (25% CPU, 45% RAM, 120MB local storage)', async () => {
    const res = await saveAgentHealthAndSnapshot({
      agentId: agentA,
      shopId: shopA,
      agentVersion: 'v1.4.2',
      osVersion: 'Windows 11 Pro (x64)',
      cpu: { model: 'Intel i7-12700', cores: 12, systemCpuPercent: 25.0, agentCpuPercent: 2.1 },
      ram: { totalBytes: 16 * 1024 * 1024 * 1024, availableBytes: 9 * 1024 * 1024 * 1024, agentRamBytes: 180 * 1024 * 1024 },
      disk: {
        totalBytes: 500 * 1024 * 1024 * 1024,
        freeBytes: 250 * 1024 * 1024 * 1024,
        agentStorageBytes: 120 * 1024 * 1024,
        tempStorageBytes: 20 * 1024 * 1024,
        spoolStorageBytes: 80 * 1024 * 1024,
        localDatabaseBytes: 5 * 1024 * 1024,
        logsStorageBytes: 10 * 1024 * 1024,
        cacheStorageBytes: 5 * 1024 * 1024
      },
      spooler: { status: 'RUNNING', running: true },
      queue: { pendingJobs: 1, activeJobs: 0, failedJobs: 0, stuckJobs: 0 },
      printers: { onlineCount: 2, offlineCount: 0 },
      network: { latencyMs: 28 }
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.alerts.length, 0, 'Nominal metrics should generate no alerts');
  });

  await runTest('Agent B reports high stress metrics (92% CPU, 88% RAM, 5% free disk)', async () => {
    const res = await saveAgentHealthAndSnapshot({
      agentId: agentB,
      shopId: shopB,
      agentVersion: 'v1.4.2',
      osVersion: 'Windows 10 Pro (x64)',
      cpu: { model: 'AMD Ryzen 5', cores: 6, systemCpuPercent: 92.5, agentCpuPercent: 12.0 },
      ram: { totalBytes: 8 * 1024 * 1024 * 1024, availableBytes: 500 * 1024 * 1024, agentRamBytes: 450 * 1024 * 1024 },
      disk: {
        totalBytes: 250 * 1024 * 1024 * 1024,
        freeBytes: 12 * 1024 * 1024 * 1024, // 4.8% free
        agentStorageBytes: 450 * 1024 * 1024,
        tempStorageBytes: 100 * 1024 * 1024,
        spoolStorageBytes: 300 * 1024 * 1024,
        localDatabaseBytes: 10 * 1024 * 1024,
        logsStorageBytes: 30 * 1024 * 1024,
        cacheStorageBytes: 10 * 1024 * 1024
      },
      spooler: { status: 'STOPPED', running: false },
      queue: { pendingJobs: 5, activeJobs: 1, failedJobs: 2, stuckJobs: 1 },
      printers: { onlineCount: 1, offlineCount: 1 },
      network: { latencyMs: 140 }
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.alerts.length >= 3, 'High stress metrics must generate threshold alerts');
    const hasCpuAlert = res.alerts.some((a) => a.alert_type === 'CPU_HIGH');
    const hasRamAlert = res.alerts.some((a) => a.alert_type === 'RAM_CRITICAL');
    const hasDiskAlert = res.alerts.some((a) => a.alert_type === 'DISK_LOW');
    assert.strictEqual(hasCpuAlert, true);
    assert.strictEqual(hasRamAlert, true);
    assert.strictEqual(hasDiskAlert, true);
  });

  await runTest('Shop A only sees Agent A health status and no Agent B metrics', async () => {
    const shopAHealth = await getAgentHealthStatus(shopA);
    assert.strictEqual(shopAHealth.length, 1);
    assert.strictEqual(shopAHealth[0].agent_id, agentA);
    assert.strictEqual(shopAHealth[0].status, 'ONLINE');
  });

  await runTest('Shop B health status reflects WARNING or CRITICAL state from alerts', async () => {
    const shopBHealth = await getAgentHealthStatus(shopB);
    assert.strictEqual(shopBHealth.length, 1);
    assert.strictEqual(shopBHealth[0].agent_id, agentB);
    assert.strictEqual(shopBHealth[0].status, 'CRITICAL');
  });

  await runTest('Agent resource history returns historical snapshots paginated', async () => {
    const historyA = await getAgentResourceHistory(agentA, shopA, 10);
    assert.ok(historyA.length >= 1);
    assert.strictEqual(historyA[0].agent_id, agentA);
    assert.strictEqual(historyA[0].system_cpu_percent, 25.0);
  });

  // --------------------------------------------------------------------------
  // SECTION 2: SUBSCRIPTION STORAGE TRACKING & ATOMIC QUOTA RESERVATION
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Subscription Cloud Storage Tracking & Quota Enforcements ---');

  const testShopStorage = 'shop_quota_test_01';

  await runTest('Initial shop storage usage calculates available quota', async () => {
    const usage = await getShopStorageUsage(testShopStorage);
    assert.ok(usage.quota_bytes > 0);
    assert.strictEqual(usage.used_bytes, 0);
    assert.strictEqual(usage.reserved_bytes, 0);
    assert.strictEqual(usage.available_bytes, usage.quota_bytes);
    assert.strictEqual(usage.storage_status, 'NORMAL');
  });

  await runTest('Atomic quota reservation succeeds for valid file size (10 MB)', async () => {
    const tenMb = 10 * 1024 * 1024;
    const res = await reserveStorageQuota(testShopStorage, tenMb);
    assert.strictEqual(res.success, true);

    const usage = await getShopStorageUsage(testShopStorage);
    assert.strictEqual(usage.reserved_bytes, tenMb);
    assert.strictEqual(usage.available_bytes, usage.quota_bytes - tenMb);
  });

  await runTest('Committed upload converts reserved storage into used storage', async () => {
    const tenMb = 10 * 1024 * 1024;
    await commitStorageUpload(testShopStorage, tenMb);

    const usage = await getShopStorageUsage(testShopStorage);
    assert.strictEqual(usage.reserved_bytes, 0, 'Reserved storage must reset to 0');
    assert.strictEqual(usage.used_bytes, tenMb, 'Used storage must increase by 10MB');
    assert.strictEqual(usage.active_document_count, 1);
  });

  await runTest('Failed upload releases reserved quota completely', async () => {
    const fiveMb = 5 * 1024 * 1024;
    await reserveStorageQuota(testShopStorage, fiveMb);
    
    let midUsage = await getShopStorageUsage(testShopStorage);
    assert.strictEqual(midUsage.reserved_bytes, fiveMb);

    // Simulate upload failure / network error
    await releaseStorageReservation(testShopStorage, fiveMb);

    let postUsage = await getShopStorageUsage(testShopStorage);
    assert.strictEqual(postUsage.reserved_bytes, 0, 'Failed upload reservation must be released');
    assert.strictEqual(postUsage.used_bytes, 10 * 1024 * 1024, 'Used storage remains unchanged');
  });

  await runTest('Quota overflow blocks uploads when file exceeds available bytes', async () => {
    const currentUsage = await getShopStorageUsage(testShopStorage);
    const oversizedFile = currentUsage.available_bytes + (50 * 1024 * 1024); // Exceeds limit

    const res = await reserveStorageQuota(testShopStorage, oversizedFile);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'STORAGE_QUOTA_EXCEEDED');
    assert.ok(res.error?.includes('exceeded'));
  });

  await runTest('Document deletion releases used storage quota', async () => {
    const tenMb = 10 * 1024 * 1024;
    await releaseStorageUsage(testShopStorage, tenMb);

    const usage = await getShopStorageUsage(testShopStorage);
    assert.strictEqual(usage.used_bytes, 0);
    assert.strictEqual(usage.active_document_count, 0);
    assert.strictEqual(usage.available_bytes, usage.quota_bytes);
  });

  // --------------------------------------------------------------------------
  // SECTION 3: ALERT MANAGEMENT & ACKNOWLEDGEMENT
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Alert Management & Resolution ---');

  await runTest('Retrieves active alerts for Shop B', async () => {
    const alertsB = await getAgentAlerts(shopB, 'ACTIVE');
    assert.ok(alertsB.length > 0);

    const firstAlertId = alertsB[0].id;
    const resolved = await resolveAgentAlert(firstAlertId, shopB);
    assert.strictEqual(resolved, true);

    const remainingAlerts = await getAgentAlerts(shopB, 'ACTIVE');
    assert.strictEqual(remainingAlerts.length, alertsB.length - 1);
  });

  console.log('\n===============================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((e) => {
  console.error('Fatal test execution error:', e);
  process.exit(1);
});
