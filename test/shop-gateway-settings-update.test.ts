import assert from 'node:assert/strict';
import {
  saveShopPaymentIntegration,
  getShopPaymentIntegration,
  requirePostgresPool
} from '../src/db/paymentStorage';

async function runShopGatewaySettingsTests() {
  console.log('--- STARTING SHOP PAYMENT GATEWAY SETTINGS TEST SUITE ---');
  const pool = requirePostgresPool();
  const testShopId = 'a001a111-8888-8888-8888-000000000077';

  // Seed test shop
  await pool.query(
    `INSERT INTO public.shops (id, name, slug, address, phone, email, status)
     VALUES ($1, 'Gateway Test Shop', 'gateway-test-shop', '456 Test Ave', '9876543211', 'gateway77@printflow.io', 'ACTIVE')
     ON CONFLICT (id) DO NOTHING`,
    [testShopId]
  );

  // Test 1: Save Shop Payment Integration with Key ID, Secret, and Mode
  console.log('Test 1: Save Shop Payment Integration (Razorpay Key ID, Key Secret, Mode)');
  const savedConfig = await saveShopPaymentIntegration({
    shopId: testShopId,
    keyId: 'rzp_test_GatewayTestKey123',
    keySecret: 'GatewayTestSecret456',
    mode: 'test',
    isActive: true
  });

  assert.ok(savedConfig, 'Saved gateway config metadata must be returned');
  assert.equal(savedConfig.provider, 'razorpay');
  assert.equal(savedConfig.mode, 'test');
  assert.equal(savedConfig.isActive, true);
  assert.equal(savedConfig.hasSecret, true);

  // Test 2: Retrieve Shop Payment Integration metadata
  console.log('Test 2: Retrieve stored Shop Payment Integration without exposing secret');
  const retrieved = await getShopPaymentIntegration(testShopId);
  assert.ok(retrieved, 'Retrieved integration record must exist');
  assert.equal(retrieved.keyId, 'rzp_test_GatewayTestKey123');
  assert.equal(retrieved.keySecret, 'GatewayTestSecret456');
  assert.equal(retrieved.mode, 'test');
  assert.equal(retrieved.isActive, true);

  // Cleanup test record
  await pool.query('DELETE FROM shop_payment_integrations WHERE shop_id = $1', [testShopId]);
  await pool.end();

  console.log('--- ALL SHOP PAYMENT GATEWAY SETTINGS TESTS PASSED SUCCESSFULLY! ---');
}

runShopGatewaySettingsTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
