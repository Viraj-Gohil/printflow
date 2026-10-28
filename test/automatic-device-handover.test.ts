import assert from 'node:assert/strict';
import {
  requirePostgresPool,
  pairPrintAgent,
  authenticatePrintAgent,
  disconnectPrintAgent,
  getActivePrintAgentForShop,
  insertPrintAgentJob,
  getPrintAgentJob
} from '../src/db/paymentStorage';

const testShopId = 'a001a111-8888-8888-8888-000000000001';
const testShopUuid = 'a001a111-8888-8888-8888-000000000001';
const testTokenA = 'agt_tok_pc_a_handover_test_2026';
const testTokenB = 'agt_tok_pc_b_handover_test_2026';
const testDeviceAId = 'agent_handover_pc_a_01';
const testDeviceBId = 'agent_handover_pc_b_02';

async function runAutomaticDeviceHandoverTests() {
  console.log('================================================================');
  console.log('--- STARTING AUTOMATIC DEVICE HANDOVER TEST SUITE ---');
  console.log('================================================================');
  const pool = requirePostgresPool();

  // Clean up any test state & prepare test shop
  await pool.query(
    `INSERT INTO public.shops (id, name, slug, address, phone, email, status)
     VALUES ($1, 'Handover Test Store', 'handover-test-store-01', '789 Counter Way', '9123456780', 'handover@printflow.io', 'ACTIVE')
     ON CONFLICT (id) DO NOTHING`,
    [testShopUuid]
  );

  await pool.query('DELETE FROM print_agent_devices WHERE shop_id = $1 OR agent_id IN ($2, $3)', [
    testShopUuid,
    testDeviceAId,
    testDeviceBId
  ]);

  await pool.query('DELETE FROM print_agent_jobs WHERE shop_id = $1', [testShopUuid]);

  // Ensure unique index exists on shop_id where is_revoked = false
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_agent_per_shop ON print_agent_devices(shop_id) WHERE (is_revoked = false)`
  );

  // --------------------------------------------------------------------------
  // SCENARIO 1: PC A connects successfully
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 1] PC A connects: Must establish active session');
  const pairedA = await pairPrintAgent({
    shopId: testShopId,
    token: testTokenA,
    deviceName: 'Counter PC A (Floor 1)',
    agentId: testDeviceAId
  });

  assert.ok(pairedA, 'PC A pairing must succeed');
  assert.equal(pairedA.agentId, testDeviceAId);
  assert.equal(pairedA.deviceName, 'Counter PC A (Floor 1)');

  const statusA = await getActivePrintAgentForShop(testShopId);
  assert.ok(statusA, 'Status must exist');
  assert.equal(statusA.connected, true);
  assert.equal(statusA.agentId, testDeviceAId);
  assert.equal(statusA.deviceName, 'Counter PC A (Floor 1)');
  console.log('✓ Scenario 1 passed: PC A successfully paired and active');

  // Seed an in-flight print job claimed by PC A to verify job safety during handover
  console.log('\n[Job Safety Setup] Seeding in-flight PRINTING job and QUEUED job for PC A');
  const testJobId1 = 'job_inflight_handover_01';
  const testJobId2 = 'job_queued_handover_02';

  await insertPrintAgentJob({
    id: testJobId1,
    orderCode: 'PF-INF-01',
    trackingToken: 'trk_inf_01',
    orderId: 'order_inflight_01',
    paymentId: 'pay_inf_01',
    shopId: testShopUuid,
    customerName: 'Alice Walker',
    files: [
      {
        id: 'file_01',
        fileName: 'contract.pdf',
        fileUrl: '/uploads/contract.pdf',
        pageCount: 4,
        copies: 2,
        colorMode: 'BW',
        paperSize: 'A4',
        duplex: false
      }
    ],
    totalAmount: 8,
    paymentStatus: 'SUCCESS',
    claimedBy: testDeviceAId,
    claimedAt: new Date().toISOString(),
    printStatus: 'PRINTING'
  });

  await insertPrintAgentJob({
    id: testJobId2,
    orderCode: 'PF-QUE-02',
    trackingToken: 'trk_que_02',
    orderId: 'order_queued_02',
    paymentId: 'pay_que_02',
    shopId: testShopUuid,
    customerName: 'Bob Builder',
    files: [
      {
        id: 'file_02',
        fileName: 'blueprints.pdf',
        fileUrl: '/uploads/blueprints.pdf',
        pageCount: 10,
        copies: 1,
        colorMode: 'COLOR',
        paperSize: 'A4',
        duplex: false
      }
    ],
    totalAmount: 100,
    paymentStatus: 'SUCCESS',
    printStatus: 'QUEUED'
  });

  // --------------------------------------------------------------------------
  // SCENARIO 2: PC B connects and automatically takes over (Handover)
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 2] PC B connects: Must automatically revoke PC A and become active');
  const pairedB = await pairPrintAgent({
    shopId: testShopId,
    token: testTokenB,
    deviceName: 'Counter PC B (Floor 2)',
    agentId: testDeviceBId
  });

  assert.ok(pairedB, 'PC B pairing must succeed without requiring manual disconnect');
  assert.equal(pairedB.agentId, testDeviceBId);
  assert.equal(pairedB.deviceName, 'Counter PC B (Floor 2)');
  assert.equal(pairedB.handoverFrom, testDeviceAId, 'Handover must record previous device ID');

  // Verify database: PC B is now the single active device
  const statusAfterHandover = await getActivePrintAgentForShop(testShopId);
  assert.ok(statusAfterHandover, 'statusAfterHandover must exist');
  assert.equal(statusAfterHandover.connected, true);
  assert.equal(statusAfterHandover.agentId, testDeviceBId, 'Active agent must now be PC B');
  assert.equal(statusAfterHandover.deviceName, 'Counter PC B (Floor 2)');

  // Verify only 1 active device in database
  const activeCountRes = await pool.query(
    'SELECT COUNT(*)::int as count FROM print_agent_devices WHERE shop_id = $1 AND is_revoked = false',
    [testShopUuid]
  );
  assert.equal(activeCountRes.rows[0].count, 1, 'Exactly 1 active unrevoked device must exist');

  // Check PC A record in DB
  const pcARecord = await pool.query(
    'SELECT is_revoked, status, revocation_reason FROM print_agent_devices WHERE agent_id = $1',
    [testDeviceAId]
  );
  assert.equal(pcARecord.rows[0].is_revoked, true, 'PC A must be revoked');
  assert.equal(pcARecord.rows[0].revocation_reason, 'REPLACED_BY_NEW_DEVICE', 'Revocation reason must be REPLACED_BY_NEW_DEVICE');
  console.log('✓ Scenario 2 passed: PC B automatically took over; PC A revoked with REPLACED_BY_NEW_DEVICE');

  // --------------------------------------------------------------------------
  // SCENARIO 3: PC A is rejected afterward with clear message
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 3] PC A attempts heartbeat after handover: Must be rejected with clear message');
  const authA = await authenticatePrintAgent({
    agentId: testDeviceAId,
    token: testTokenA,
    targetShopId: testShopId
  });

  assert.equal(authA.valid, false, 'PC A credentials must NOT authenticate');
  assert.equal(authA.code, 'SESSION_REPLACED', 'Must return SESSION_REPLACED code');
  assert.equal(
    authA.error,
    'This agent session has been replaced by another device.',
    'Must return exact user-facing message'
  );
  console.log(`✓ Scenario 3 passed: PC A rejected with: "${authA.error}"`);

  // --------------------------------------------------------------------------
  // SCENARIO 4: Interrupted in-flight jobs handled safely
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 4] Verify job safety during handover');
  const job1 = await getPrintAgentJob(testJobId1);
  assert.ok(job1, 'In-flight job must exist');
  assert.equal(
    job1.printStatus,
    'REQUIRES_ATTENTION',
    'Interrupted in-flight job must transition to REQUIRES_ATTENTION, never marked completed'
  );
  const errorMsg = (job1 as any).errorMessage || (job1 as any).handoverNote || (job1 as any).jobData?.errorMessage || '';
  assert.ok(
    errorMsg.includes('replaced by another device'),
    `Error message must indicate session handover, got: "${errorMsg}"`
  );

  const job2 = await getPrintAgentJob(testJobId2);
  assert.ok(job2, 'Queued job must exist');
  assert.equal(job2.printStatus, 'QUEUED', 'Queued job must remain QUEUED for new PC to process');
  console.log('✓ Scenario 4 passed: In-flight job safely stopped; queued jobs preserved');

  // --------------------------------------------------------------------------
  // SCENARIO 5: App/PC Restarts (Same device reconnects cleanly)
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 5] PC B restarts and reconnects: Must update cleanly without creating duplicates');
  const restartB = await pairPrintAgent({
    shopId: testShopId,
    token: testTokenB,
    deviceName: 'Counter PC B (Floor 2 - Rebooted)',
    agentId: testDeviceBId
  });

  assert.ok(restartB);
  assert.equal(restartB.agentId, testDeviceBId);
  assert.equal(restartB.deviceName, 'Counter PC B (Floor 2 - Rebooted)');
  assert.equal(restartB.handoverFrom, null, 'Same device reconnection is not a handover');

  const countAfterRestart = await pool.query(
    'SELECT COUNT(*)::int as count FROM print_agent_devices WHERE shop_id = $1 AND is_revoked = false',
    [testShopUuid]
  );
  assert.equal(countAfterRestart.rows[0].count, 1, 'Only 1 active row after restart');
  console.log('✓ Scenario 5 passed: Restart reconnection preserved single active device');

  // --------------------------------------------------------------------------
  // SCENARIO 6: Simultaneous login attempts (Race Condition)
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 6] Simultaneous connection attempts: Atomic serialization');
  const raceDevice1Id = 'agent_race_handover_01';
  const raceDevice2Id = 'agent_race_handover_02';
  const raceToken1 = 'agt_tok_race_h1_2026';
  const raceToken2 = 'agt_tok_race_h2_2026';

  const raceResults = await Promise.allSettled([
    pairPrintAgent({
      shopId: testShopId,
      token: raceToken1,
      deviceName: 'Race PC 1',
      agentId: raceDevice1Id
    }),
    pairPrintAgent({
      shopId: testShopId,
      token: raceToken2,
      deviceName: 'Race PC 2',
      agentId: raceDevice2Id
    })
  ]);

  // Both should settle cleanly due to transaction serialization
  const raceFulfilled = raceResults.filter((r) => r.status === 'fulfilled');
  assert.ok(raceFulfilled.length >= 1, 'At least one simultaneous connection must succeed');

  const countAfterRace = await pool.query(
    'SELECT COUNT(*)::int as count FROM print_agent_devices WHERE shop_id = $1 AND is_revoked = false',
    [testShopUuid]
  );
  assert.equal(countAfterRace.rows[0].count, 1, 'Database must enforce exactly 1 active device after simultaneous race');

  const activeDeviceAfterRace = await getActivePrintAgentForShop(testShopId);
  assert.ok(activeDeviceAfterRace, 'activeDeviceAfterRace must exist');
  assert.ok(activeDeviceAfterRace.connected);
  console.log(`✓ Scenario 6 passed: Handover serialized; active device is now: ${activeDeviceAfterRace.agentId}`);

  // --------------------------------------------------------------------------
  // SCENARIO 7: Clean Disconnect Releases Shop
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 7] Manual Disconnect releases shop');
  const disconnectRes = await disconnectPrintAgent({ shopId: testShopId });
  assert.equal(disconnectRes.success, true);

  const statusAfterDisconnect = await getActivePrintAgentForShop(testShopId);
  assert.ok(statusAfterDisconnect, 'statusAfterDisconnect must exist');
  assert.equal(statusAfterDisconnect.connected, false, 'Shop must be disconnected');
  console.log('✓ Scenario 7 passed: Shop cleanly disconnected');

  // Cleanup test records
  await pool.query('DELETE FROM print_agent_devices WHERE shop_id = $1', [testShopUuid]);
  await pool.query('DELETE FROM print_agent_jobs WHERE shop_id = $1', [testShopUuid]);
  await pool.end();

  console.log('\n================================================================');
  console.log('--- ALL AUTOMATIC DEVICE HANDOVER TESTS PASSED 100%! ---');
  console.log('================================================================\n');
}

runAutomaticDeviceHandoverTests().catch((err) => {
  console.error('Handover Test Suite Failed:', err);
  process.exit(1);
});
