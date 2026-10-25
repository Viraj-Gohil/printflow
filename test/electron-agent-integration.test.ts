import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  requirePostgresPool,
  pairPrintAgent,
  authenticatePrintAgent,
  getShopAgentDetails,
  getShopPrinterEntitlements,
  savePrintAgentPrinters,
  revokePrintAgent,
  getCandidateShopIds
} from '../src/db/paymentStorage';

const testShopUuid = 'a001a111-0000-0000-0000-000000000001';
const testClientShopId = 'printflow-counter';
const testAgentId = 'agent_integration_e2e_01';
const testAgentToken = 'agt_tok_e2e_secure_pair_token_2026';

async function runAgentIntegrationTests() {
  console.log('--- STARTING ELECTRON AGENT INTEGRATION TEST SUITE ---');
  const pool = requirePostgresPool();

  // Clean up test agent record
  await pool.query('DELETE FROM print_agent_devices WHERE agent_id = $1', [testAgentId]);

  // TEST 1: Pair print agent device
  console.log('Test 1: Secure agent device pairing');
  const paired = await pairPrintAgent({
    shopId: testClientShopId,
    token: testAgentToken,
    deviceName: 'Counter Desktop PC'
  });
  assert.ok(paired, 'Pairing must return device identity');
  assert.ok(paired.agentId && typeof paired.agentId === 'string', 'Agent ID must be non-empty string');
  assert.equal(paired.shopId, testClientShopId);

  const activeAgentId = paired.agentId;

  // TEST 2: Authenticate agent & heartbeat
  console.log('Test 2: Authenticate agent and verify heartbeat ping');
  const auth = await authenticatePrintAgent({
    agentId: activeAgentId,
    token: testAgentToken,
    targetShopId: testClientShopId
  });
  assert.ok(auth.valid, 'Agent token must be valid');
  assert.equal(auth.shopId, testClientShopId);

  // TEST 3: Fetch shop and subscription details (Phase 2)
  console.log('Test 3: Retrieve authoritative shop & plan details for agent');
  const shopInfo = await getShopAgentDetails(activeAgentId, testClientShopId);
  assert.equal(shopInfo.agentId, activeAgentId);
  assert.ok(shopInfo.shopName, 'Shop name must be present');
  assert.ok(shopInfo.planName, 'Plan name must be present');
  assert.ok(typeof shopInfo.printerLimit === 'number' && shopInfo.printerLimit >= 0, 'Printer limit must be non-negative integer');
  assert.equal(shopInfo.isOperational, true, 'Active shop should be operational');

  // TEST 4: Plan-based printer limit enforcement (Phase 3)
  console.log('Test 4: Verify plan printer limit enforcement');
  const entitlement = await getShopPrinterEntitlements(testClientShopId);
  assert.ok(entitlement.printerLimit >= 1, 'Entitlement must declare printer limit');

  const testPrinters = [
    {
      name: 'HP LaserJet Pro M404dn',
      displayName: 'HP LaserJet Pro M404dn',
      isDefault: true,
      status: 'READY',
      isOnline: true,
      capabilities: { paperSizes: ['A4', 'Letter'], supportsColor: false, supportsDuplex: true }
    }
  ];

  const syncedCount = await savePrintAgentPrinters(activeAgentId, testPrinters);
  assert.equal(syncedCount, 1, 'Synced 1 printer successfully');

  // TEST 5: Verify candidate shop IDs resolution
  console.log('Test 5: Verify shop ID alias candidate resolution');
  const candidates = await getCandidateShopIds(testClientShopId);
  assert.ok(candidates.includes(testClientShopId), 'Candidates must include client shop ID');
  assert.ok(candidates.includes(testShopUuid), 'Candidates must include Neon shop UUID');

  // TEST 6: Token revocation and security check (Phase 1 & Phase 8)
  console.log('Test 6: Verify agent token revocation');
  const revoked = await revokePrintAgent(activeAgentId);
  assert.equal(revoked, true, 'Agent revocation must return true');

  const authRevoked = await authenticatePrintAgent({
    agentId: activeAgentId,
    token: testAgentToken
  });
  assert.equal(authRevoked.valid, false, 'Revoked agent must fail authentication');
  assert.ok(authRevoked.error?.includes('revoked'), 'Error must mention token revocation');

  // Cleanup
  await pool.query('DELETE FROM print_agent_devices WHERE agent_id = $1', [activeAgentId]);
  await pool.end();

  console.log('--- ALL ELECTRON AGENT INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
}

runAgentIntegrationTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
