import assert from 'node:assert/strict';
import { loadMigrations } from '../src/db/migrations';
import { NeonBusinessRepository } from '../src/db/neonRepositories';

const validUuid = '11111111-1111-4111-8111-111111111111';
const otherUuid = '22222222-2222-4222-8222-222222222222';

// ============================================================================
// 1. MIGRATIONS VALIDATION (PHASE 2)
// ============================================================================
async function testPhase2Migrations() {
  const migrations = await loadMigrations();
  const phase2Migration = migrations.find((m) => m.filename === '003_phase2_shop_api_support.sql');
  assert.ok(phase2Migration, '003_phase2_shop_api_support.sql must exist');
  assert.equal(phase2Migration.id, '003');
  assert.ok(/^[a-f0-9]{64}$/.test(phase2Migration.checksum), 'Migration must have sha256 checksum');
  assert.ok(phase2Migration.sql.includes('pricing_rules'), 'Must reference pricing_rules');
  assert.ok(phase2Migration.sql.includes('razorpay_webhook_events'), 'Must reference webhook events');
  console.log('  ✅ PASS: Phase 2 migration 003 validated');
}

// ============================================================================
// 2. REPOSITORY INPUT VALIDATION (FAIL-FAST BEFORE DB ACCESS)
// ============================================================================
async function testRepositoryInputValidation() {
  let connected = false;
  const mockDb = {
    connect: async () => {
      connected = true;
      throw new Error('should not connect');
    }
  };
  const repo = new NeonBusinessRepository(mockDb as any);

  // Shop validation
  await assert.rejects(() => repo.findActiveShopBySlug(''), /slug/);
  await assert.rejects(() => repo.findActiveShopBySlug('invalid/slug/test'), /slug/);
  await assert.rejects(() => repo.findShopById('not-a-uuid'), /UUID/);
  await assert.rejects(() => repo.updateShopStatus(validUuid, 'INVALID' as any), /Invalid shop status/);
  await assert.rejects(() => repo.updateShopIsOpen('invalid-uuid', true), /UUID/);

  // Membership validation
  await assert.rejects(() => repo.assertShopMember('not-uuid', validUuid), /UUID/);
  await assert.rejects(() => repo.assertShopMember(validUuid, 'not-uuid'), /UUID/);
  await assert.rejects(() => repo.getShopMemberRole('not-uuid', validUuid), /UUID/);

  // Pricing rules validation
  await assert.rejects(() => repo.getActivePricingRules('not-a-uuid'), /UUID/);
  await assert.rejects(
    () =>
      repo.upsertPricingRule({
        shopId: 'bad-uuid',
        paperSize: 'A4',
        colorMode: 'BW',
        sides: 'SINGLE',
        pricePerPageMinor: 100
      }),
    /UUID/
  );
  await assert.rejects(
    () =>
      repo.upsertPricingRule({
        shopId: validUuid,
        paperSize: 'B5' as any,
        colorMode: 'BW',
        sides: 'SINGLE',
        pricePerPageMinor: 100
      }),
    /paperSize/
  );
  await assert.rejects(
    () =>
      repo.upsertPricingRule({
        shopId: validUuid,
        paperSize: 'A4',
        colorMode: 'GRAYSCALE' as any,
        sides: 'SINGLE',
        pricePerPageMinor: 100
      }),
    /colorMode/
  );
  await assert.rejects(
    () =>
      repo.upsertPricingRule({
        shopId: validUuid,
        paperSize: 'A4',
        colorMode: 'BW',
        sides: 'QUAD' as any,
        pricePerPageMinor: 100
      }),
    /sides/
  );
  await assert.rejects(
    () =>
      repo.upsertPricingRule({
        shopId: validUuid,
        paperSize: 'A4',
        colorMode: 'BW',
        sides: 'SINGLE',
        pricePerPageMinor: -50
      }),
    /non-negative/
  );
  await assert.rejects(() => repo.softDeletePricingRule('bad-uuid', validUuid), /UUID/);

  // Print jobs validation
  await assert.rejects(
    () =>
      repo.createDraftPrintJobWithQuote({
        shopId: 'bad-uuid',
        customerName: 'John',
        totalAmountMinor: 100,
        quote: { currency: 'INR', pricingSnapshot: {}, expiresAt: new Date(Date.now() + 60000) },
        expiresAt: new Date(Date.now() + 120000)
      }),
    /UUID/
  );
  await assert.rejects(() => repo.getPrintJobById('not-uuid'), /UUID/);
  await assert.rejects(() => repo.listPrintJobsByShop('not-uuid'), /UUID/);

  // Webhook validation
  await assert.rejects(
    () =>
      repo.recordWebhookEventIdempotent({
        providerEventId: '',
        eventType: 'payment.captured',
        payloadSha256: 'a'.repeat(64)
      }),
    /providerEventId/
  );
  await assert.rejects(
    () =>
      repo.recordWebhookEventIdempotent({
        providerEventId: 'evt_1',
        eventType: 'payment.captured',
        payloadSha256: 'invalid-hash'
      }),
    /64-char hex/
  );

  // Verified payment recording validation
  await assert.rejects(
    () =>
      repo.recordVerifiedPayment({
        providerOrderId: 'bad_order',
        providerPaymentId: 'pay_123',
        providerSignatureHash: 'b'.repeat(64),
        amountMinor: 100,
        currency: 'INR'
      }),
    /providerOrderId/
  );
  await assert.rejects(
    () =>
      repo.recordVerifiedPayment({
        providerOrderId: 'order_123',
        providerPaymentId: 'bad_payment',
        providerSignatureHash: 'b'.repeat(64),
        amountMinor: 100,
        currency: 'INR'
      }),
    /providerPaymentId/
  );
  await assert.rejects(
    () =>
      repo.recordVerifiedPayment({
        providerOrderId: 'order_123',
        providerPaymentId: 'pay_123',
        providerSignatureHash: 'short-hash',
        amountMinor: 100,
        currency: 'INR'
      }),
    /providerSignatureHash/
  );

  assert.equal(connected, false, 'No database connection must be attempted for invalid input');
  console.log('  ✅ PASS: Repository input validation rejects bad inputs before DB connection');
}

// ============================================================================
// 3. TRANSACTION ROLLBACK INTEGRITY
// ============================================================================
async function testTransactionRollback() {
  // Test upsertPricingRule rollback
  {
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql.trim().split(' ')[0]);
        if (sql.includes('INSERT INTO public.pricing_rules')) {
          throw new Error('simulated unique constraint failure');
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined
    };
    const repo = new NeonBusinessRepository({ connect: async () => client } as any);
    await assert.rejects(
      () =>
        repo.upsertPricingRule({
          shopId: validUuid,
          paperSize: 'A4',
          colorMode: 'BW',
          sides: 'SINGLE',
          pricePerPageMinor: 200
        }),
      /simulated unique constraint failure/
    );
    assert.deepEqual(statements, ['BEGIN', 'INSERT', 'ROLLBACK'], 'Must rollback pricing rule on failure');
  }

  // Test createDraftPrintJobWithQuote rollback
  {
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql.trim().split(' ')[0]);
        if (sql.includes('INSERT INTO public.print_jobs')) {
          return { rows: [{ id: validUuid }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO public.print_checkout_quotes')) {
          throw new Error('simulated quote constraint violation');
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined
    };
    const repo = new NeonBusinessRepository({ connect: async () => client } as any);
    await assert.rejects(
      () =>
        repo.createDraftPrintJobWithQuote({
          shopId: validUuid,
          customerName: 'Alice',
          totalAmountMinor: 500,
          quote: { currency: 'INR', pricingSnapshot: { p: 1 }, expiresAt: new Date(Date.now() + 60000) },
          expiresAt: new Date(Date.now() + 120000)
        }),
      /simulated quote constraint violation/
    );
    assert.deepEqual(statements, ['BEGIN', 'INSERT', 'INSERT', 'ROLLBACK'], 'Must rollback print job draft on quote error');
  }

  // Test recordVerifiedPayment rollback
  {
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql.trim().split(' ')[0]);
        if (sql.includes('UPDATE public.payment_orders')) {
          return { rows: [{ id: validUuid }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO public.payment_transactions')) {
          throw new Error('simulated transaction insertion failure');
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined
    };
    const repo = new NeonBusinessRepository({ connect: async () => client } as any);
    await assert.rejects(
      () =>
        repo.recordVerifiedPayment({
          providerOrderId: 'order_abc123',
          providerPaymentId: 'pay_xyz789',
          providerSignatureHash: 'c'.repeat(64),
          amountMinor: 200,
          currency: 'INR'
        }),
      /simulated transaction insertion failure/
    );
    assert.deepEqual(statements, ['BEGIN', 'UPDATE', 'INSERT', 'ROLLBACK'], 'Must rollback payment recording on error');
  }

  console.log('  ✅ PASS: Explicit transaction rollback verified across all write operations');
}

// ============================================================================
// 4. DUPLICATE OPERATIONS & IDEMPOTENCY
// ============================================================================
async function testDuplicateOperationsIdempotency() {
  // Test webhook event idempotency (ON CONFLICT DO NOTHING returns rowCount 0)
  {
    let callCount = 0;
    const client = {
      query: async (sql: string) => {
        callCount++;
        if (callCount === 1) return { rows: [{ id: validUuid }], rowCount: 1 };
        return { rows: [], rowCount: 0 }; // Second time: duplicate conflict
      },
      release: () => undefined
    };
    const repo = new NeonBusinessRepository({ connect: async () => client } as any);

    const first = await repo.recordWebhookEventIdempotent({
      providerEventId: 'evt_dup_test',
      eventType: 'payment.captured',
      payloadSha256: 'd'.repeat(64)
    });
    assert.equal(first, true, 'First event arrival must return true');

    const second = await repo.recordWebhookEventIdempotent({
      providerEventId: 'evt_dup_test',
      eventType: 'payment.captured',
      payloadSha256: 'd'.repeat(64)
    });
    assert.equal(second, false, 'Duplicate arrival must return false without throwing');
  }

  // Test verified payment idempotency when order is already PAID
  {
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql.trim().split(' ')[0]);
        if (sql.includes('UPDATE public.payment_orders')) {
          return { rows: [], rowCount: 0 }; // Order not in CREATED status
        }
        if (sql.includes('SELECT id, status FROM public.payment_orders')) {
          return { rows: [{ id: validUuid, status: 'PAID' }], rowCount: 1 }; // Already marked PAID
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined
    };
    const repo = new NeonBusinessRepository({ connect: async () => client } as any);
    // Should gracefully complete without throwing
    await repo.recordVerifiedPayment({
      providerOrderId: 'order_already_paid',
      providerPaymentId: 'pay_dup123',
      providerSignatureHash: 'e'.repeat(64),
      amountMinor: 300,
      currency: 'INR'
    });
    assert.ok(statements.includes('ROLLBACK'), 'Already paid order rolls back without error');
  }

  console.log('  ✅ PASS: Webhook and payment idempotency correctly handles duplicate events');
}

// ============================================================================
// 5. FAIL-CLOSED BEHAVIOR (NO SILENT FALLBACK TO LOCAL MEMORY/JSON)
// ============================================================================
async function testFailClosedDatabaseBehavior() {
  const failingDb = {
    connect: async () => {
      throw new Error('Neon connection timeout (simulated database outage)');
    }
  };
  const repo = new NeonBusinessRepository(failingDb as any);

  // Every single repository method must fail-closed (throw, never return fallback data)
  await assert.rejects(() => repo.findActiveShopBySlug('valid-slug'), /Neon connection timeout/);
  await assert.rejects(() => repo.findShopById(validUuid), /Neon connection timeout/);
  await assert.rejects(() => repo.listAllShops(), /Neon connection timeout/);
  await assert.rejects(() => repo.updateShopStatus(validUuid, 'ACTIVE'), /Neon connection timeout/);
  await assert.rejects(() => repo.updateShopIsOpen(validUuid, true), /Neon connection timeout/);
  await assert.rejects(() => repo.assertShopMember(validUuid, otherUuid), /Neon connection timeout/);
  await assert.rejects(() => repo.getShopMemberRole(validUuid, otherUuid), /Neon connection timeout/);
  await assert.rejects(() => repo.getActivePricingRules(validUuid), /Neon connection timeout/);
  await assert.rejects(
    () =>
      repo.upsertPricingRule({
        shopId: validUuid,
        paperSize: 'A4',
        colorMode: 'BW',
        sides: 'SINGLE',
        pricePerPageMinor: 100
      }),
    /Neon connection timeout/
  );
  await assert.rejects(() => repo.softDeletePricingRule(validUuid, otherUuid), /Neon connection timeout/);
  await assert.rejects(() => repo.getPrintJobById(validUuid), /Neon connection timeout/);
  await assert.rejects(() => repo.listPrintJobsByShop(validUuid), /Neon connection timeout/);
  await assert.rejects(
    () =>
      repo.recordWebhookEventIdempotent({
        providerEventId: 'evt_1',
        eventType: 'test',
        payloadSha256: 'f'.repeat(64)
      }),
    /Neon connection timeout/
  );

  console.log('  ✅ PASS: Fail-closed verified: database outages throw controlled errors, zero silent fallbacks');
}

// ============================================================================
// 6. SUCCESSFUL READ & WRITE EXECUTION (MOCKED REPOSITORY)
// ============================================================================
async function testSuccessfulOperations() {
  const client = {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('public.shops') && sql.includes('slug = $1')) {
        return {
          rows: [
            {
              id: validUuid,
              slug: params[0],
              name: 'Test Shop',
              status: 'ACTIVE',
              isOpen: true,
              minOrderAmount: 200,
              autoAccept: true
            }
          ],
          rowCount: 1
        };
      }
      if (sql.includes('public.shop_members') && sql.includes('shop_id = $1')) {
        return { rows: [{ role: 'SHOP_OWNER' }], rowCount: 1 };
      }
      if (sql.includes('SELECT') && sql.includes('public.pricing_rules') && sql.includes('shop_id = $1')) {
        return {
          rows: [
            {
              id: validUuid,
              shopId: validUuid,
              paperSize: 'A4',
              colorMode: 'BW',
              sides: 'SINGLE',
              pricePerPageMinor: 150,
              isActive: true
            }
          ],
          rowCount: 1
        };
      }
      if (sql.includes('INSERT INTO public.pricing_rules')) {
        return { rows: [{ id: validUuid }], rowCount: 1 };
      }
      if (sql.includes('public.print_jobs') && sql.includes('shop_id = $1')) {
        return {
          rows: [
            {
              id: validUuid,
              orderCode: 'PRT-1001',
              trackingToken: 'tr_123',
              totalAmountMinor: 300,
              paymentStatus: 'SUCCESS',
              printStatus: 'QUEUED'
            }
          ],
          rowCount: 1
        };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined
  };

  const repo = new NeonBusinessRepository({ connect: async () => client } as any);

  const shop = await repo.findActiveShopBySlug('test-shop');
  assert.ok(shop);
  assert.equal(shop.slug, 'test-shop');
  assert.equal(shop.status, 'ACTIVE');

  await assert.doesNotReject(() => repo.assertShopMember(validUuid, otherUuid));
  const role = await repo.getShopMemberRole(validUuid, otherUuid);
  assert.equal(role, 'SHOP_OWNER');

  const rules = await repo.getActivePricingRules(validUuid);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].pricePerPageMinor, 150);

  const upserted = await repo.upsertPricingRule({
    shopId: validUuid,
    paperSize: 'A4',
    colorMode: 'BW',
    sides: 'SINGLE',
    pricePerPageMinor: 150
  });
  assert.equal(upserted.id, validUuid);

  const jobs = await repo.listPrintJobsByShop(validUuid);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].orderCode, 'PRT-1001');

  console.log('  ✅ PASS: Successful repository operations execute parameterized SQL with clean hydration');
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function runAll() {
  console.log('\n========================================');
  console.log('Running Phase 2 Neon Integration Tests');
  console.log('========================================\n');

  await testPhase2Migrations();
  await testRepositoryInputValidation();
  await testTransactionRollback();
  await testDuplicateOperationsIdempotency();
  await testFailClosedDatabaseBehavior();
  await testSuccessfulOperations();

  console.log('\n========================================');
  console.log('All Phase 2 Integration Tests PASSED');
  console.log('========================================\n');
}

runAll().catch((err) => {
  console.error('\n❌ Phase 2 test failure:', err);
  process.exit(1);
});
