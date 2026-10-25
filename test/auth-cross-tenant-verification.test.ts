import assert from 'assert';
import dotenv from 'dotenv';
import pg from 'pg';
import { enforceServerAuthorization } from '../src/lib/security';
import { resolvePrintFlowShopId } from '../src/db/paymentStorage';

dotenv.config({ override: true });

async function runAuthVerificationTest() {
  console.log('🚀 Running Cross-Tenant Authorization & Auth Flow Integration Tests...\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('Skipping database-dependent assertions (DATABASE_URL not set).');
    return;
  }

  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    // 1. Verify Viraj Gohil profile and shop canonical UUIDs
    const profileRes = await pool.query(
      `SELECT id::text, email FROM public.profiles WHERE LOWER(email) = 'virajgohil245@gmail.com' LIMIT 1`
    );
    assert.strictEqual(profileRes.rowCount, 1, 'Viraj Gohil profile must exist in public.profiles');
    const virajProfileUuid = profileRes.rows[0].id;
    assert.match(virajProfileUuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Profile ID must be a valid UUID');
    console.log('✅ 1. Profile UUID verified:', virajProfileUuid);

    const shopRes = await pool.query(
      `SELECT id::text, name, slug FROM public.shops WHERE email = 'virajgohil245@gmail.com' LIMIT 1`
    );
    assert.strictEqual(shopRes.rowCount, 1, 'Viraj Xerox & Print Center must exist in public.shops');
    const virajShopUuid = shopRes.rows[0].id;
    assert.match(virajShopUuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Shop ID must be a valid UUID');
    console.log('✅ 2. Shop UUID verified:', virajShopUuid);

    // 2. Verify resolvePrintFlowShopId maps custom slug string to canonical UUID
    const mappedShopUuid = await resolvePrintFlowShopId('shop_viraj_245');
    assert.strictEqual(mappedShopUuid, virajShopUuid, 'resolvePrintFlowShopId must map shop_viraj_245 to canonical shop UUID');
    console.log('✅ 3. resolvePrintFlowShopId mapped shop_viraj_245 ->', mappedShopUuid);

    // 3. Verify shop_members table membership link
    const memberRes = await pool.query(
      `SELECT role FROM public.shop_members WHERE shop_id = $1 AND user_id = $2 LIMIT 1`,
      [virajShopUuid, virajProfileUuid]
    );
    assert.strictEqual(memberRes.rowCount, 1, 'Viraj Gohil must be linked to Viraj Xerox in shop_members');
    assert.strictEqual(memberRes.rows[0].role, 'SHOP_OWNER', 'Role must be SHOP_OWNER');
    console.log('✅ 4. shop_members link verified for Viraj Gohil (Role: SHOP_OWNER)');

    // 4. Test enforceServerAuthorization with resolved session context
    const authorizedSession = {
      sessionId: 'sess_test_viraj',
      userId: virajProfileUuid,
      email: 'virajgohil245@gmail.com',
      role: 'SHOP_OWNER' as const,
      shopId: virajShopUuid,
      fullName: 'Viraj Gohil',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      lastActiveAt: Date.now()
    };

    // A. Accessing own shop settings (AUTHORIZED)
    const ownAuthz = enforceServerAuthorization(authorizedSession, {
      resourceType: 'SHOP',
      shopId: virajShopUuid
    });
    assert.strictEqual(ownAuthz.authorized, true, 'Viraj Gohil must be authorized to access own shop settings');
    console.log('✅ 5. Accessing own shop payment settings: AUTHORIZED');

    // B. Attempting to access another shop's settings (DENIED / CROSS-TENANT VIOLATION)
    const foreignShopUuid = '5386e6f6-ff50-400d-9f06-a341023f0a5e';
    const foreignAuthz = enforceServerAuthorization(authorizedSession, {
      resourceType: 'SHOP',
      shopId: foreignShopUuid
    });
    assert.strictEqual(foreignAuthz.authorized, false, 'Viraj Gohil must NOT be authorized to access foreign shop settings');
    assert.match(foreignAuthz.reason || '', /Cross-tenant violation/, 'Reason must indicate Cross-tenant violation');
    console.log('✅ 6. Accessing foreign shop payment settings: DENIED (Cross-Tenant Security Preserved)');

    console.log('\n🎉 ALL AUTHENTICATION & CROSS-TENANT AUTHORIZATION TESTS PASSED!\n');
  } finally {
    await pool.end();
  }
}

runAuthVerificationTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
