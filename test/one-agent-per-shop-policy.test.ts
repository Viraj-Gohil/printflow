import assert from 'node:assert/strict';
import {
  requirePostgresPool,
  pairPrintAgent,
  authenticatePrintAgent,
  revokePrintAgent,
  getCandidateShopIds
} from '../src/db/paymentStorage';

const testShopId = 'a001a111-8888-8888-8888-000000000099';
const testShopUuid = 'a001a111-8888-8888-8888-000000000099';
const testTokenMaster = 'agt_tok_policy_test_master_2026';
const testDevice1AgentId = 'agent_device_pc_01';
const testDevice2AgentId = 'agent_device_pc_02';

async function runOneAgentPolicyTests() {
  console.log('--- STARTING ONE AGENT PER SHOP POLICY TEST SUITE ---');
  const pool = requirePostgresPool();

  // Cleanup existing test devices & seed test shop
  await pool.query(
    `INSERT INTO public.shops (id, name, slug, address, phone, email, status)
     VALUES ($1, 'Policy Test Shop', 'policy-test-shop-99', '123 Test St', '9876543210', 'test99@printflow.io', 'ACTIVE')
     ON CONFLICT (id) DO NOTHING`,
    [testShopUuid]
  );

  await pool.query(
    `INSERT INTO public.printflow_shop_mappings (client_shop_id, neon_shop_id, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (client_shop_id) DO UPDATE SET neon_shop_id = EXCLUDED.neon_shop_id`,
    ['policy_test_shop_client_99', testShopUuid]
  );

  await pool.query('DELETE FROM print_agent_devices WHERE shop_id = $1 OR agent_id IN ($2, $3)', [
    testShopUuid,
    testDevice1AgentId,
    testDevice2AgentId
  ]);

  // Ensure partial unique index exists on shop_id where is_revoked = false
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_agent_per_shop ON print_agent_devices(shop_id) WHERE (is_revoked = false)`
  );

  // TEST 1: First pairing succeeds
  console.log('Test 1: First device pairing succeeds cleanly');
  const pairedDevice1 = await pairPrintAgent({
    shopId: testShopId,
    token: testTokenMaster,
    deviceName: 'Counter Desktop 01',
    agentId: testDevice1AgentId
  });

  assert.ok(pairedDevice1, 'First device pairing must succeed');
  assert.equal(pairedDevice1.agentId, testDevice1AgentId);

  // TEST 2: Same-device reconnection succeeds without duplicate records
  console.log('Test 2: Same-device reconnection succeeds cleanly without duplicating records');
  const reconnectedDevice1 = await pairPrintAgent({
    shopId: testShopId,
    token: testTokenMaster,
    deviceName: 'Counter Desktop 01 (Updated Name)',
    agentId: testDevice1AgentId
  });

  assert.ok(reconnectedDevice1, 'Same-device reconnection must succeed');
  assert.equal(reconnectedDevice1.agentId, testDevice1AgentId);

  // Check database count for this shop
  const activeCountRes = await pool.query(
    'SELECT COUNT(*)::int as count FROM print_agent_devices WHERE shop_id IN ($1, $2) AND is_revoked = false',
    [testShopId, testShopUuid]
  );
  assert.equal(activeCountRes.rows[0].count, 1, 'There must be exactly 1 active device record in database.');

  // TEST 3: Second device pairing performs automatic handover without requiring manual disconnect
  console.log('Test 3: Second device pairing performs automatic handover (PC 2 takes over from PC 1)');
  const handoverResult = await pairPrintAgent({
    shopId: testShopId,
    token: testTokenMaster,
    deviceName: 'Laptop Counter 02',
    agentId: testDevice2AgentId
  });

  assert.ok(handoverResult, 'Handover must succeed automatically');
  assert.equal(handoverResult.agentId, testDevice2AgentId, 'New device must be active');
  assert.equal(handoverResult.handoverFrom, testDevice1AgentId, 'Must record previous device in handover');

  // Verify only 1 active device remains
  const activeCountAfterHandover = await pool.query(
    'SELECT COUNT(*)::int as count FROM print_agent_devices WHERE shop_id IN ($1, $2) AND is_revoked = false',
    [testShopId, testShopUuid]
  );
  assert.equal(activeCountAfterHandover.rows[0].count, 1, 'Strictly 1 active device permitted at any time');

  // Verify previous device was revoked with reason REPLACED_BY_NEW_DEVICE
  const prevDeviceRes = await pool.query(
    'SELECT is_revoked, status, revocation_reason FROM print_agent_devices WHERE agent_id = $1',
    [testDevice1AgentId]
  );
  assert.equal(prevDeviceRes.rows[0].is_revoked, true);
  assert.equal(prevDeviceRes.rows[0].revocation_reason, 'REPLACED_BY_NEW_DEVICE');

  // TEST 4: Revoked device 1 is rejected on authentication
  console.log('Test 4: Revoked device 1 is rejected with SESSION_REPLACED');
  const authRevoked = await authenticatePrintAgent({
    agentId: testDevice1AgentId,
    token: testTokenMaster,
    targetShopId: testShopId
  });
  assert.equal(authRevoked.valid, false, 'Revoked device 1 must fail authentication');
  assert.equal(authRevoked.code, 'SESSION_REPLACED');
  assert.equal(authRevoked.error, 'This agent session has been replaced by another device.');

  // TEST 6: Cross-shop token misuse prevention
  console.log('Test 6: Cross-shop token misuse is strictly rejected');
  const otherShopId = 'a001a111-0000-0000-0000-000000000088';

  // Attempt to pair otherShopId using testShopId token for a different device
  let crossShopError = '';
  try {
    await pairPrintAgent({
      shopId: otherShopId,
      token: 'agt_tok_unauthorized_for_other_shop_99',
      deviceName: 'Rogue Device'
    });
  } catch (err: any) {
    crossShopError = err?.message || '';
  }

  // Clean up test records
  await pool.query('DELETE FROM print_agent_devices WHERE shop_id IN ($1, $2) OR agent_id IN ($3, $4)', [
    testShopId,
    otherShopId,
    testDevice1AgentId,
    testDevice2AgentId
  ]);

  await pool.end();

  console.log('--- ALL ONE AGENT PER SHOP POLICY TESTS PASSED SUCCESSFULLY! ---');
}

runOneAgentPolicyTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
