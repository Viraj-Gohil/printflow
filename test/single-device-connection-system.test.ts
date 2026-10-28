import assert from 'node:assert/strict';
import {
  requirePostgresPool,
  pairPrintAgent,
  authenticatePrintAgent,
  disconnectPrintAgent,
  getActivePrintAgentForShop,
  getCandidateShopIds
} from '../src/db/paymentStorage';

const testShopId = 'a001a111-9999-9999-9999-000000000001';
const testShopUuid = 'a001a111-9999-9999-9999-000000000001';
const testTokenA = 'agt_tok_pc_a_secure_token_2026';
const testTokenB = 'agt_tok_pc_b_secure_token_2026';
const testDeviceAId = 'agent_pc_alpha_01';
const testDeviceBId = 'agent_pc_beta_02';

async function runSingleDeviceConnectionSystemTests() {
  console.log('================================================================');
  console.log('--- STARTING SINGLE-DEVICE CONNECTION SYSTEM TEST SUITE ---');
  console.log('================================================================');
  const pool = requirePostgresPool();

  // Clean up any test state & prepare test shop
  await pool.query(
    `INSERT INTO public.shops (id, name, slug, address, phone, email, status)
     VALUES ($1, 'Single Device Store', 'single-device-store-01', '456 Main St', '9876543210', 'single@printflow.io', 'ACTIVE')
     ON CONFLICT (id) DO NOTHING`,
    [testShopUuid]
  );

  await pool.query('DELETE FROM print_agent_devices WHERE shop_id = $1 OR agent_id IN ($2, $3)', [
    testShopUuid,
    testDeviceAId,
    testDeviceBId
  ]);

  // Ensure partial unique index exists on shop_id where is_revoked = false
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_agent_per_shop ON print_agent_devices(shop_id) WHERE (is_revoked = false)`
  );

  // --------------------------------------------------------------------------
  // SCENARIO 1: Connect PC A: success
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 1] Connect PC A: Must succeed cleanly');
  const pairedA = await pairPrintAgent({
    shopId: testShopId,
    token: testTokenA,
    deviceName: 'Counter PC A (Windows 11)',
    agentId: testDeviceAId
  });

  assert.ok(pairedA, 'PC A pairing must succeed');
  assert.equal(pairedA.agentId, testDeviceAId, 'Paired agent ID must match PC A');
  assert.equal(pairedA.deviceName, 'Counter PC A (Windows 11)');

  // Verify status is active & recorded
  const activeStatusA = await getActivePrintAgentForShop(testShopId);
  assert.ok(activeStatusA, 'Active device status must be returned');
  assert.equal(activeStatusA.connected, true, 'Shop must show an active connected device');
  assert.equal(activeStatusA.agentId, testDeviceAId);
  assert.equal(activeStatusA.deviceName, 'Counter PC A (Windows 11)');
  console.log('✓ Scenario 1 passed: PC A connected successfully');

  // --------------------------------------------------------------------------
  // SCENARIO 2: Connect PC B while PC A is active: Blocked with clear message
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 2] Connect PC B while PC A is active: Must be rejected with clear message & active device info');
  let scenario2Blocked = false;
  let scenario2Error: any = null;

  try {
    await pairPrintAgent({
      shopId: testShopId,
      token: testTokenB,
      deviceName: 'Counter PC B (Laptop 02)',
      agentId: testDeviceBId
    });
  } catch (err: any) {
    scenario2Blocked = true;
    scenario2Error = err;
  }

  assert.equal(scenario2Blocked, true, 'PC B connection must be blocked when PC A is active');
  assert.ok(
    scenario2Error.message.includes('already registered'),
    `Error message must state that an agent is already registered. Got: ${scenario2Error.message}`
  );
  assert.equal(scenario2Error.code, 'SHOP_ALREADY_CONNECTED');
  assert.ok(scenario2Error.activeDevice, 'Must include activeDevice metadata');
  assert.equal(scenario2Error.activeDevice.agentId, testDeviceAId, 'activeDevice must identify PC A');
  assert.equal(scenario2Error.activeDevice.deviceName, 'Counter PC A (Windows 11)');
  assert.ok(scenario2Error.userMessage.includes('already connected to another PC'));
  console.log(`✓ Scenario 2 passed: PC B was blocked with message: "${scenario2Error.userMessage}"`);

  // --------------------------------------------------------------------------
  // SCENARIO 3: Disconnect PC A: success
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 3] Disconnect PC A: Must revoke token and release active device reservation');
  const disconnectA = await disconnectPrintAgent({
    agentId: testDeviceAId,
    token: testTokenA
  });

  assert.ok(disconnectA, 'Disconnect operation must succeed');
  assert.equal(disconnectA.success, true);
  assert.equal(disconnectA.disconnectedAgentId, testDeviceAId);

  // Verify shop now shows disconnected
  const activeStatusAfterDisconnect = await getActivePrintAgentForShop(testShopId);
  assert.equal(activeStatusAfterDisconnect?.connected, false, 'Shop must no longer have an active connected device');
  console.log('✓ Scenario 3 passed: PC A was securely disconnected');

  // --------------------------------------------------------------------------
  // SCENARIO 4: Connect PC B afterward: success
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 4] Connect PC B afterward: Must succeed now that previous device was disconnected');
  const pairedB = await pairPrintAgent({
    shopId: testShopId,
    token: testTokenB,
    deviceName: 'Counter PC B (Laptop 02)',
    agentId: testDeviceBId
  });

  assert.ok(pairedB, 'PC B pairing must succeed after PC A was disconnected');
  assert.equal(pairedB.agentId, testDeviceBId);
  assert.equal(pairedB.deviceName, 'Counter PC B (Laptop 02)');

  const activeStatusB = await getActivePrintAgentForShop(testShopId);
  assert.equal(activeStatusB?.connected, true);
  assert.equal(activeStatusB?.agentId, testDeviceBId);
  assert.equal(activeStatusB?.deviceName, 'Counter PC B (Laptop 02)');
  console.log('✓ Scenario 4 passed: PC B successfully connected after PC A disconnect');

  // --------------------------------------------------------------------------
  // SCENARIO 5: Attempt to use PC A's revoked credentials: rejected
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 5] Attempt to use PC A revoked credentials: Must be rejected');
  const authA = await authenticatePrintAgent({
    agentId: testDeviceAId,
    token: testTokenA,
    targetShopId: testShopId
  });

  assert.equal(authA.valid, false, 'Revoked PC A credentials must NOT authenticate');
  assert.ok(authA.error?.includes('revoked'), `Error must mention revoked credentials. Got: ${authA.error}`);
  console.log(`✓ Scenario 5 passed: Revoked credentials strictly rejected with: "${authA.error}"`);

  // --------------------------------------------------------------------------
  // SCENARIO 6: Restart the agent or PC: secure reconnection without duplicates
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 6] Reconnecting same PC B after restart: Must succeed without duplicate records');
  const reconnectedB = await pairPrintAgent({
    shopId: testShopId,
    token: testTokenB,
    deviceName: 'Counter PC B (Updated OS Build)',
    agentId: testDeviceBId
  });

  assert.ok(reconnectedB, 'Reconnection of same device must succeed');
  assert.equal(reconnectedB.agentId, testDeviceBId);

  // Heartbeat check
  const heartbeatB = await authenticatePrintAgent({
    agentId: testDeviceBId,
    token: testTokenB,
    targetShopId: testShopId
  });
  assert.equal(heartbeatB.valid, true, 'Heartbeat for PC B must be valid');

  // Verify only 1 active record exists in database for this shop
  const activeCountRes = await pool.query(
    'SELECT COUNT(*)::int as count FROM print_agent_devices WHERE shop_id = $1 AND is_revoked = false',
    [testShopUuid]
  );
  assert.equal(activeCountRes.rows[0].count, 1, 'Database must enforce exactly 1 active device for the shop');
  console.log('✓ Scenario 6 passed: Same device reconnected without duplicating records (exactly 1 active row)');

  // --------------------------------------------------------------------------
  // SCENARIO 7: Simultaneous connection attempts: Only one device succeeds
  // --------------------------------------------------------------------------
  console.log('\n[Scenario 7] Simultaneous connection race condition: Atomic single-device enforcement');
  // First disconnect device B so the shop is open
  await disconnectPrintAgent({ shopId: testShopId });

  const raceDevice1Id = 'agent_race_device_01';
  const raceDevice2Id = 'agent_race_device_02';
  const raceToken1 = 'agt_tok_race_01_token_2026';
  const raceToken2 = 'agt_tok_race_02_token_2026';

  const results = await Promise.allSettled([
    pairPrintAgent({
      shopId: testShopId,
      token: raceToken1,
      deviceName: 'Race Device 1',
      agentId: raceDevice1Id
    }),
    pairPrintAgent({
      shopId: testShopId,
      token: raceToken2,
      deviceName: 'Race Device 2',
      agentId: raceDevice2Id
    })
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one simultaneous pairing attempt must succeed');
  assert.equal(rejected.length, 1, 'The competing simultaneous pairing attempt must be rejected');

  const winner = (fulfilled[0] as PromiseFulfilledResult<any>).value;
  const loserErr = (rejected[0] as PromiseRejectedResult).reason;
  assert.ok(
    loserErr.message.includes('already registered'),
    `Loser must be blocked with one-agent-per-shop message. Got: ${loserErr.message}`
  );

  const finalActiveRes = await pool.query(
    'SELECT COUNT(*)::int as count FROM print_agent_devices WHERE shop_id = $1 AND is_revoked = false',
    [testShopUuid]
  );
  assert.equal(finalActiveRes.rows[0].count, 1, 'Exactly 1 active device must remain in database after race');
  console.log(`✓ Scenario 7 passed: Winner was ${winner.agentId}; Loser was blocked with: "${loserErr.message}"`);

  // Clean up
  await pool.query('DELETE FROM print_agent_devices WHERE shop_id = $1 OR agent_id IN ($2, $3, $4, $5)', [
    testShopUuid,
    testDeviceAId,
    testDeviceBId,
    raceDevice1Id,
    raceDevice2Id
  ]);

  await pool.end();

  console.log('\n================================================================');
  console.log('--- ALL 7 SINGLE-DEVICE CONNECTION SCENARIOS PASSED 100%! ---');
  console.log('================================================================\n');
}

runSingleDeviceConnectionSystemTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
