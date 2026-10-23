import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  requirePostgresPool,
  getShopAgentAvailability,
  getCandidateShopIds,
  insertPrintAgentJob,
  getPrintAgentJobByOrder,
  listPrintAgentJobs,
  claimPrintAgentJob,
  updatePrintAgentJobStatus,
  resolvePrintFlowShopId
} from '../src/db/paymentStorage';

const testShopUuid = 'a001a111-0000-0000-0000-000000000001';
const testClientShopId = 'printflow-counter';
const testAgentId = 'agent_test_availability_01';
const testAgentToken = 'agt_tok_test_availability_secret_2026';

function hashToken(tok: string): string {
  return crypto.createHash('sha256').update(tok).digest('hex');
}

async function runTests() {
  console.log('--- STARTING PRINT PAYMENT & AGENT AVAILABILITY SUITE ---');
  const pool = requirePostgresPool();

  // Clean test agent device if exists
  await pool.query('DELETE FROM print_agent_devices WHERE agent_id = $1', [testAgentId]);

  // TEST 1: No agent registered -> returns NO_AGENT_REGISTERED and isAvailable=false
  console.log('Test 1: Availability when no agent is registered');
  const avail1 = await getShopAgentAvailability(testClientShopId);
  assert.equal(avail1.isAvailable, false);
  assert.equal(avail1.agentOnline, false);
  assert.equal(avail1.printerReady, false);
  assert.ok(avail1.message.includes('offline'));

  // TEST 2: Register agent in OFFLINE state -> returns AGENT_OFFLINE
  console.log('Test 2: Availability when agent is OFFLINE');
  await pool.query(
    `INSERT INTO print_agent_devices (agent_id, shop_id, device_name, token_hash, is_revoked, status, last_seen, printers, updated_at)
     VALUES ($1, $2, 'Test Desktop PC', $3, false, 'OFFLINE', NOW() - INTERVAL '2 minutes', '[]'::jsonb, NOW())`,
    [testAgentId, testClientShopId, hashToken(testAgentToken)]
  );

  const avail2 = await getShopAgentAvailability(testClientShopId);
  assert.equal(avail2.isAvailable, false);
  assert.equal(avail2.agentOnline, false);
  assert.equal(avail2.printerReady, false);
  assert.equal(avail2.reason, 'AGENT_OFFLINE');

  // TEST 3: Agent ONLINE with no ready printers -> returns PRINTER_UNAVAILABLE
  console.log('Test 3: Availability when agent is ONLINE but no ready printer');
  await pool.query(
    `UPDATE print_agent_devices
     SET status = 'ONLINE', last_seen = NOW(), printers = $2::jsonb, updated_at = NOW()
     WHERE agent_id = $1`,
    [
      testAgentId,
      JSON.stringify([
        { name: 'HP LaserJet', status: 'OFFLINE', isOnline: false, capabilities: { paperSizes: ['A4'], supportsColor: false, supportsDuplex: true } }
      ])
    ]
  );

  const avail3 = await getShopAgentAvailability(testClientShopId);
  assert.equal(avail3.isAvailable, false);
  assert.equal(avail3.agentOnline, true);
  assert.equal(avail3.printerReady, false);
  assert.equal(avail3.reason, 'PRINTER_UNAVAILABLE');

  // TEST 4: Agent ONLINE with a ready printer -> returns READY
  console.log('Test 4: Availability when agent and printer are both READY');
  await pool.query(
    `UPDATE print_agent_devices
     SET status = 'ONLINE', last_seen = NOW(), printers = $2::jsonb, updated_at = NOW()
     WHERE agent_id = $1`,
    [
      testAgentId,
      JSON.stringify([
        { name: 'Canon Pro 500', status: 'READY', isOnline: true, isDefault: true, capabilities: { paperSizes: ['A4', 'A3'], supportsColor: true, supportsDuplex: true } }
      ])
    ]
  );

  const avail4 = await getShopAgentAvailability(testClientShopId);
  assert.equal(avail4.isAvailable, true);
  assert.equal(avail4.agentOnline, true);
  assert.equal(avail4.printerReady, true);
  assert.equal(avail4.reason, 'READY');
  assert.equal(avail4.readyPrintersCount, 1);

  // TEST 5: Candidate shop ID resolution across aliases
  console.log('Test 5: Candidate shop ID resolution across aliases');
  const candidates = await getCandidateShopIds(testClientShopId);
  assert.ok(candidates.includes(testClientShopId));
  assert.ok(candidates.includes(testShopUuid));

  const availViaUuid = await getShopAgentAvailability(testShopUuid);
  assert.equal(availViaUuid.isAvailable, true, 'Availability check via UUID must match registered agent on clientShopId');

  // TEST 6: Payment-to-print dispatch and idempotency
  console.log('Test 6: Payment-to-print job insertion, polling, claiming and status updates');
  const testOrderId = `ord_suite_test_${Date.now()}`;
  const testJobId = `PRT-SUITE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const nowIso = new Date().toISOString();

  const dummyJob = {
    id: testJobId,
    orderCode: testJobId,
    trackingToken: `tr_${crypto.randomBytes(8).toString('hex')}`,
    orderId: testOrderId,
    paymentId: `pay_suite_${Date.now()}`,
    shopId: testClientShopId,
    customerName: 'Suite Customer',
    customerPhone: '9876543210',
    files: [
      {
        id: 'file_01',
        fileName: 'Invoice.pdf',
        fileUrl: '/download',
        downloadUrl: '/download',
        pageCount: 2,
        copies: 1,
        colorMode: 'BW' as const,
        paperSize: 'A4' as const,
        duplex: false
      }
    ],
    totalAmount: 10.0,
    paymentStatus: 'SUCCESS' as const,
    printStatus: 'QUEUED' as const,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const dummyFiles = [
    {
      id: 'file_01',
      mime: 'application/pdf',
      filename: 'Invoice.pdf',
      buffer: Buffer.from('%PDF-1.4 test payload')
    }
  ];

  // Insert print agent job
  const inserted = await insertPrintAgentJob(dummyJob, dummyFiles);
  assert.ok(inserted);
  assert.equal(inserted.id, testJobId);

  // Duplicate insertion (idempotency check)
  const duplicate = await insertPrintAgentJob(dummyJob, dummyFiles);
  assert.ok(duplicate);
  assert.equal(duplicate.id, testJobId);

  // Lookup by order
  const foundByOrder = await getPrintAgentJobByOrder(testClientShopId, testOrderId);
  assert.ok(foundByOrder);
  assert.equal(foundByOrder.id, testJobId);

  // Lookup by UUID alias
  const foundByUuid = await getPrintAgentJobByOrder(testShopUuid, testOrderId);
  assert.ok(foundByUuid);
  assert.equal(foundByUuid.id, testJobId);

  // Agent list/poll pending jobs
  const pendingJobs = await listPrintAgentJobs(testClientShopId, true, testAgentId);
  assert.ok(pendingJobs.some((j) => j.id === testJobId));

  // Agent claims job
  const claimed = await claimPrintAgentJob(testJobId, testClientShopId, testAgentId, new Date().toISOString());
  assert.ok(claimed);
  assert.equal(claimed.printStatus, 'ASSIGNED');
  assert.equal(claimed.claimedBy, testAgentId);

  // Agent updates status: DOWNLOADING -> PRINTING -> COMPLETED
  const downloading = await updatePrintAgentJobStatus({
    jobId: testJobId,
    shopId: testClientShopId,
    agentId: testAgentId,
    status: 'DOWNLOADING',
    updatedAt: new Date().toISOString(),
    expectedStatus: 'ASSIGNED'
  });
  assert.ok(downloading);
  assert.equal(downloading.printStatus, 'DOWNLOADING');

  const printing = await updatePrintAgentJobStatus({
    jobId: testJobId,
    shopId: testClientShopId,
    agentId: testAgentId,
    status: 'PRINTING',
    updatedAt: new Date().toISOString(),
    expectedStatus: 'DOWNLOADING',
    printerName: 'Canon Pro 500'
  });
  assert.ok(printing);
  assert.equal(printing.printStatus, 'PRINTING');

  const completed = await updatePrintAgentJobStatus({
    jobId: testJobId,
    shopId: testClientShopId,
    agentId: testAgentId,
    status: 'COMPLETED',
    updatedAt: new Date().toISOString(),
    expectedStatus: 'PRINTING',
    printerName: 'Canon Pro 500',
    pagesPrinted: 2
  });
  assert.ok(completed);
  assert.equal(completed.printStatus, 'COMPLETED');

  // Clean up test data
  await pool.query('DELETE FROM print_agent_job_files WHERE job_id = $1', [testJobId]);
  await pool.query('DELETE FROM print_agent_jobs WHERE job_id = $1', [testJobId]);
  await pool.query('DELETE FROM print_agent_devices WHERE agent_id = $1', [testAgentId]);

  console.log('✅ ALL PRINT PAYMENT & AGENT AVAILABILITY TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
