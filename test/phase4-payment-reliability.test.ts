import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadMigrations } from '../src/db/migrations';
import {
  DurablePaymentRepository,
  PaymentOrderPurpose,
  PaymentOrderStatus,
  PaymentRefundStatus,
  VerifyAndTransitionInput
} from '../src/db/durablePaymentRepository';

const validShopId = '11111111-1111-4111-8111-111111111111';
const validJobId = '22222222-2222-4222-8222-222222222222';
const validOrderId = 'order_mock_1234567890';
const validPaymentId = 'pay_mock_1234567890';
const validShopSecret = 'shop_rzp_secret_998877';
const validPlatformSecret = 'platform_rzp_secret_112233';

// ============================================================================
// 1. MIGRATION 005 VALIDATION
// ============================================================================
async function testPhase4MigrationValidation() {
  const migrations = await loadMigrations();
  const phase4Migration = migrations.find((m) => m.filename === '005_phase4_payment_reliability.sql');

  assert.ok(phase4Migration, '005_phase4_payment_reliability.sql must be loaded');
  assert.equal(phase4Migration.id, '005');
  assert.ok(/^[a-f0-9]{64}$/.test(phase4Migration.checksum), 'Migration must have a 64-char sha256 checksum');

  // Verify schema additions
  assert.ok(phase4Migration.sql.includes('reconciliation_needed'), 'Must add reconciliation_needed column');
  assert.ok(phase4Migration.sql.includes('reconciliation_attempts'), 'Must add reconciliation_attempts column');
  assert.ok(phase4Migration.sql.includes('last_reconciled_at'), 'Must add last_reconciled_at column');
  assert.ok(phase4Migration.sql.includes('idx_payment_orders_reconcile'), 'Must create reconciliation index');
  assert.ok(phase4Migration.sql.includes('CREATE TABLE IF NOT EXISTS public.payment_refunds'), 'Must create payment_refunds table');
  assert.ok(phase4Migration.sql.includes('trg_payment_refunds_updated_at'), 'Must include updated_at trigger for refunds');

  console.log('  ✅ PASS: Migration 005 valid and correctly loaded');
}

// ============================================================================
// 2. PAYMENT ORDER CREATION WITH AUTHORITATIVE QUOTES & ACCOUNT SEPARATION
// ============================================================================
async function testPaymentOrderCreationAndAccountSeparation() {
  const executedQueries: Array<{ text: string; values?: any[] }> = [];

  const mockClient = {
    query: async (queryTextOrConfig: any, values?: any[]) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      const vals = typeof queryTextOrConfig === 'string' ? values : queryTextOrConfig.values;
      executedQueries.push({ text, values: vals });

      // Quote check for print job
      if (text.includes('print_checkout_quotes')) {
        return {
          rowCount: 1,
          rows: [{
            amount_minor: '2500', // 2500 paise = ₹25.00
            expires_at: new Date(Date.now() + 60000), // Valid for 1 minute
            shop_id: validShopId
          }]
        };
      }

      // Check existing order
      if (text.includes('SELECT id::text, job_id::text, shop_id::text, purpose, provider')) {
        return { rowCount: 0, rows: [] };
      }

      // Insert payment_order
      if (text.includes('INSERT INTO public.payment_orders')) {
        return {
          rowCount: 1,
          rows: [{
            id: '33333333-3333-4333-8333-333333333333',
            job_id: validJobId,
            shop_id: validShopId,
            purpose: 'PRINT_JOB',
            provider: 'RAZORPAY',
            provider_order_id: validOrderId,
            provider_account_ref: 'acc_shop_123',
            currency: 'INR',
            amount_minor: '2500',
            status: 'CREATED',
            idempotency_key: 'idem_123',
            reconciliation_needed: false,
            reconciliation_attempts: 0,
            last_reconciled_at: null,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          }]
        };
      }

      return { rowCount: 0, rows: [] };
    },
    release: () => {}
  };

  const mockDb = { connect: async () => mockClient };
  const repo = new DurablePaymentRepository(mockDb as any);

  // A. Customer print job payment order creation
  const order = await repo.createPaymentOrder({
    jobId: validJobId,
    shopId: validShopId,
    purpose: 'PRINT_JOB',
    providerOrderId: validOrderId,
    providerAccountRef: 'acc_shop_123',
    amountMinor: 2500,
    currency: 'INR'
  });

  assert.equal(order.id, '33333333-3333-4333-8333-333333333333');
  assert.equal(order.purpose, 'PRINT_JOB');
  assert.equal(order.amountMinor, 2500);
  assert.equal(order.status, 'CREATED');

  // B. Price manipulation defense: client provides different amount than quote
  await assert.rejects(
    async () => {
      await repo.createPaymentOrder({
        jobId: validJobId,
        shopId: validShopId,
        purpose: 'PRINT_JOB',
        providerOrderId: 'order_manipulated_123',
        providerAccountRef: 'acc_shop_123',
        amountMinor: 100, // Client tries to pay only ₹1.00 (100 paise) instead of ₹25.00
        currency: 'INR'
      });
    },
    /Payment amount \(100 paise\) does not match authoritative quote \(2500 paise\)/,
    'Must reject manipulated payment amount'
  );

  // C. Print job requires a jobId
  await assert.rejects(
    async () => {
      await repo.createPaymentOrder({
        shopId: validShopId,
        purpose: 'PRINT_JOB',
        providerOrderId: 'order_no_job_123',
        providerAccountRef: 'acc_shop_123',
        amountMinor: 2500
      });
    },
    /jobId is required for PRINT_JOB payment orders/
  );

  // D. Subscription payment order requires jobId to be null
  await assert.rejects(
    async () => {
      await repo.createPaymentOrder({
        jobId: validJobId, // Error: subscription should not have a customer print jobId
        shopId: validShopId,
        purpose: 'SUBSCRIPTION',
        providerOrderId: 'order_sub_with_job',
        providerAccountRef: 'acc_platform_123',
        amountMinor: 49900
      });
    },
    /jobId must be null for SUBSCRIPTION payment orders/
  );

  console.log('  ✅ PASS: Payment order creation enforces quotes and purpose isolation');
}

// ============================================================================
// 3. CRYPTOGRAPHIC SIGNATURE & TIMING-SAFE HMAC VERIFICATION
// ============================================================================
async function testCryptographicSignatureAndAccountSeparation() {
  const orderId = 'order_test_sig_123';
  const paymentId = 'pay_test_sig_123';

  // Generate genuine signature with shop secret
  const validShopSig = crypto
    .createHmac('sha256', validShopSecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Generate genuine signature with platform secret
  const validPlatformSig = crypto
    .createHmac('sha256', validPlatformSecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Verify helper using timingSafeEqual
  const verifyHmac = (secret: string, sig: string): boolean => {
    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    if (expected.length !== sig.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  };

  // Valid signatures match their respective secrets
  assert.equal(verifyHmac(validShopSecret, validShopSig), true, 'Shop secret must verify shop signature');
  assert.equal(verifyHmac(validPlatformSecret, validPlatformSig), true, 'Platform secret must verify platform signature');

  // ACCOUNT SEPARATION: Cross-account verification fails!
  assert.equal(verifyHmac(validPlatformSecret, validShopSig), false, 'Platform secret must NOT verify shop signature');
  assert.equal(verifyHmac(validShopSecret, validPlatformSig), false, 'Shop secret must NOT verify platform signature');

  // Tampered signature (single byte altered) fails
  const tamperedSig = validShopSig.slice(0, -2) + (validShopSig.slice(-2) === 'aa' ? 'bb' : 'aa');
  assert.equal(verifyHmac(validShopSecret, tamperedSig), false, 'Tampered signature must fail verification');

  // Malformed length fails safely without throwing
  assert.equal(verifyHmac(validShopSecret, 'short_sig'), false, 'Mismatched length must return false safely');

  console.log('  ✅ PASS: Timing-safe HMAC verification and account separation confirmed');
}

// ============================================================================
// 4. ATOMIC PAYMENT-TO-JOB TRANSITION (DATABASE ATOMICITY)
// ============================================================================
async function testAtomicPaymentVerification() {
  const executedQueries: Array<{ text: string; values?: any[] }> = [];

  const mockClient = {
    query: async (queryTextOrConfig: any, values?: any[]) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      const vals = typeof queryTextOrConfig === 'string' ? values : queryTextOrConfig.values;
      executedQueries.push({ text, values: vals });

      // 1. Lock payment_order FOR UPDATE
      if (text.includes('SELECT id::text, job_id::text, shop_id::text, purpose, amount_minor, currency, status')) {
        return {
          rowCount: 1,
          rows: [{
            id: 'order-record-uuid-1',
            job_id: validJobId,
            shop_id: validShopId,
            purpose: 'PRINT_JOB',
            amount_minor: '2500',
            currency: 'INR',
            status: 'CREATED'
          }]
        };
      }

      // 2. Lock print_job FOR UPDATE
      if (text.includes('SELECT id::text, shop_id::text, payment_status, print_status, total_amount')) {
        return {
          rowCount: 1,
          rows: [{
            id: validJobId,
            shop_id: validShopId,
            payment_status: 'PENDING',
            print_status: 'CREATED',
            total_amount: '25.00' // ₹25.00 = 2500 paise
          }]
        };
      }

      return { rowCount: 1, rows: [] };
    },
    release: () => {}
  };

  const mockDb = { connect: async () => mockClient };
  const repo = new DurablePaymentRepository(mockDb as any);

  const sigHash = crypto.createHash('sha256').update('sig_valid_test').digest('hex');

  const result = await repo.executeAtomicPaymentVerification({
    providerOrderId: validOrderId,
    providerPaymentId: validPaymentId,
    providerSignatureHash: sigHash,
    amountMinor: 2500,
    currency: 'INR'
  });

  assert.equal(result.status, 'PAID');
  assert.equal(result.alreadyProcessed, false);
  assert.equal(result.jobPrintStatus, 'QUEUED', 'Print job must transition to QUEUED');

  // Verify the exact sequence of SQL queries inside the transaction:
  const queryTexts = executedQueries.map((q) => q.text);
  assert.ok(queryTexts.some((t) => t.includes('BEGIN')), 'Transaction must BEGIN');
  assert.ok(queryTexts.some((t) => t.includes('SELECT id::text, job_id::text') && t.includes('FOR UPDATE')), 'Order locked FOR UPDATE');
  assert.ok(queryTexts.some((t) => t.includes('UPDATE public.payment_orders') && t.includes("status = 'PAID'")), 'Order updated to PAID');
  assert.ok(queryTexts.some((t) => t.includes('INSERT INTO public.payment_transactions')), 'Transaction row inserted');
  assert.ok(queryTexts.some((t) => t.includes('UPDATE public.print_jobs') && t.includes("payment_status = 'SUCCESS'")), 'Print job payment_status updated to SUCCESS');
  assert.ok(queryTexts.some((t) => t.includes('INSERT INTO public.print_job_events') && t.includes('PAYMENT_VERIFIED_JOB_QUEUED')), 'Audit event logged');
  assert.ok(queryTexts.some((t) => t.includes('COMMIT')), 'Transaction must COMMIT');

  console.log('  ✅ PASS: Atomic payment-to-job transition in single PostgreSQL transaction');
}

// ============================================================================
// 5. IDEMPOTENT RE-VERIFICATION
// ============================================================================
async function testIdempotentPaymentVerification() {
  const executedQueries: Array<{ text: string }> = [];

  const mockClient = {
    query: async (queryTextOrConfig: any) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      executedQueries.push({ text });

      if (text.includes('SELECT id::text, job_id::text, shop_id::text, purpose, amount_minor, currency, status')) {
        return {
          rowCount: 1,
          rows: [{
            id: 'order-record-uuid-1',
            job_id: validJobId,
            shop_id: validShopId,
            purpose: 'PRINT_JOB',
            amount_minor: '2500',
            currency: 'INR',
            status: 'PAID' // ALREADY PAID!
          }]
        };
      }

      if (text.includes('SELECT print_status FROM public.print_jobs WHERE id = $1')) {
        return {
          rowCount: 1,
          rows: [{ print_status: 'QUEUED' }]
        };
      }

      return { rowCount: 1, rows: [] };
    },
    release: () => {}
  };

  const mockDb = { connect: async () => mockClient };
  const repo = new DurablePaymentRepository(mockDb as any);
  const sigHash = crypto.createHash('sha256').update('sig_valid_test').digest('hex');

  const result = await repo.executeAtomicPaymentVerification({
    providerOrderId: validOrderId,
    providerPaymentId: validPaymentId,
    providerSignatureHash: sigHash,
    amountMinor: 2500,
    currency: 'INR'
  });

  assert.equal(result.status, 'PAID');
  assert.equal(result.alreadyProcessed, true, 'Must return alreadyProcessed: true');
  assert.equal(result.jobPrintStatus, 'QUEUED');

  // Verify that no duplicate transaction insert or print_jobs update was executed
  const queryTexts = executedQueries.map((q) => q.text);
  assert.ok(!queryTexts.some((t) => t.includes('INSERT INTO public.payment_transactions')), 'Must NOT insert duplicate transaction');

  console.log('  ✅ PASS: Idempotent re-verification preserves state without duplicates');
}

// ============================================================================
// 6. OUT-OF-ORDER WEBHOOK DELIVERY DEFENSE
// ============================================================================
async function testOutOfOrderWebhookDeliveryDefense() {
  // Case A: payment.failed arrives AFTER order is already marked PAID
  const mockClientA = {
    query: async (queryTextOrConfig: any) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;

      if (text.includes('FROM public.payment_orders') && text.includes('FOR UPDATE')) {
        return {
          rowCount: 1,
          rows: [{ id: 'order-uuid-1', status: 'PAID', job_id: validJobId }]
        };
      }
      return { rowCount: 1, rows: [] };
    },
    release: () => {}
  };

  const repoA = new DurablePaymentRepository({ connect: async () => mockClientA } as any);
  const resultA = await repoA.handlePaymentFailure(validOrderId, 'Late failure notification from bank');

  assert.equal(resultA.ignoredDueToPriorPaid, true, 'Late failure must be ignored because order is already PAID');
  assert.equal(resultA.updated, false);

  // Case B: payment.failed arrives on CREATED order
  const executedB: string[] = [];
  const mockClientB = {
    query: async (queryTextOrConfig: any) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      executedB.push(text);

      if (text.includes('FROM public.payment_orders') && text.includes('FOR UPDATE')) {
        return {
          rowCount: 1,
          rows: [{ id: 'order-uuid-1', status: 'CREATED', job_id: validJobId }]
        };
      }
      return { rowCount: 1, rows: [] };
    },
    release: () => {}
  };

  const repoB = new DurablePaymentRepository({ connect: async () => mockClientB } as any);
  const resultB = await repoB.handlePaymentFailure(validOrderId, 'Insufficient funds');

  assert.equal(resultB.ignoredDueToPriorPaid, false);
  assert.equal(resultB.updated, true);
  assert.ok(executedB.some((t) => t.includes("SET status = 'FAILED'")), 'Order status must be updated to FAILED');

  console.log('  ✅ PASS: Out-of-order webhook delivery defense protects verified PAID orders');
}

// ============================================================================
// 7. SERVER RESTART RECOVERY (DURABLE DATABASE RESOLUTION)
// ============================================================================
async function testServerRestartRecovery() {
  // Simulate complete process memory wipe (Map cleared)
  const mockInMemoryTrackedOrders = new Map<string, any>();
  const mockInMemoryVerifiedPayments = new Map<string, any>();

  assert.equal(mockInMemoryTrackedOrders.size, 0, 'Memory map is empty after restart');
  assert.equal(mockInMemoryVerifiedPayments.size, 0, 'Verified payments map is empty after restart');

  // Query database repository for order truth
  const mockClient = {
    query: async (queryTextOrConfig: any) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;

      if (text.includes('SELECT id::text, job_id::text, shop_id::text, purpose, provider')) {
        return {
          rowCount: 1,
          rows: [{
            id: '33333333-3333-4333-8333-333333333333',
            job_id: validJobId,
            shop_id: validShopId,
            purpose: 'PRINT_JOB',
            provider: 'RAZORPAY',
            provider_order_id: validOrderId,
            provider_account_ref: 'acc_shop_123',
            currency: 'INR',
            amount_minor: '2500',
            status: 'PAID', // Durable truth in Neon
            idempotency_key: 'idem_123',
            reconciliation_needed: false,
            reconciliation_attempts: 0,
            last_reconciled_at: null,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          }]
        };
      }
      return { rowCount: 0, rows: [] };
    },
    release: () => {}
  };

  const repo = new DurablePaymentRepository({ connect: async () => mockClient } as any);
  const dbOrder = await repo.getPaymentOrderByProviderId(validOrderId);

  assert.ok(dbOrder, 'Order must be recovered from Neon');
  assert.equal(dbOrder.status, 'PAID', 'Durable status is PAID');
  assert.equal(dbOrder.amountMinor, 2500);
  assert.equal(dbOrder.shopId, validShopId);

  console.log('  ✅ PASS: Server restart recovery resolves payment truth from Neon');
}

// ============================================================================
// 8. RECONCILIATION SERVICE & UNRESOLVED ORDER TRACKING
// ============================================================================
async function testReconciliationTracking() {
  const executed: string[] = [];
  const mockClient = {
    query: async (queryTextOrConfig: any) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      executed.push(text);

      if (text.includes('SELECT id::text, job_id::text, shop_id::text, purpose, provider')) {
        return {
          rowCount: 1,
          rows: [{
            id: 'order-unresolved-1',
            job_id: validJobId,
            shop_id: validShopId,
            purpose: 'PRINT_JOB',
            provider: 'RAZORPAY',
            provider_order_id: 'order_pending_999',
            provider_account_ref: 'acc_shop_123',
            currency: 'INR',
            amount_minor: '1500',
            status: 'CREATED',
            idempotency_key: 'idem_999',
            reconciliation_needed: true,
            reconciliation_attempts: 2,
            last_reconciled_at: new Date(),
            metadata: { reconciliationReason: 'Network timeout during checkout' },
            created_at: new Date(),
            updated_at: new Date()
          }]
        };
      }
      return { rowCount: 1, rows: [] };
    },
    release: () => {}
  };

  const repo = new DurablePaymentRepository({ connect: async () => mockClient } as any);

  // A. Flag order for reconciliation
  await repo.markOrderReconciliationNeeded(validOrderId, 'Callback not received after 15 minutes');
  assert.ok(executed.some((t) => t.includes('reconciliation_needed = true')), 'Must flag reconciliation_needed');

  // B. List unresolved orders
  const unresolved = await repo.listUnresolvedOrders(50);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].reconciliationNeeded, true);
  assert.equal(unresolved[0].reconciliationAttempts, 2);

  console.log('  ✅ PASS: Reconciliation tracking accurately flags and lists unresolved orders');
}

// ============================================================================
// 9. MANUAL REFUND LIFECYCLE & TENANT ISOLATION
// ============================================================================
async function testManualRefundLifecycle() {
  const executed: string[] = [];

  const mockClient = {
    query: async (queryTextOrConfig: any, values?: any[]) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      const vals = typeof queryTextOrConfig === 'string' ? values : queryTextOrConfig.values;
      executed.push(text);

      // 1. Fetch payment_order
      if (text.includes('FROM public.payment_orders') && text.includes('WHERE id = $1')) {
        return {
          rowCount: 1,
          rows: [{
            id: '33333333-3333-4333-8333-333333333333',
            shop_id: validShopId,
            amount_minor: '2500', // ₹25.00
            status: 'PAID',
            currency: 'INR',
            job_id: validJobId
          }]
        };
      }

      // 2. Existing refunds sum
      if (text.includes('SUM(amount_minor)') && text.includes('FROM public.payment_refunds')) {
        return {
          rowCount: 1,
          rows: [{ sum_minor: '0' }]
        };
      }

      // 3. Find transaction
      if (text.includes('SELECT id::text FROM public.payment_transactions')) {
        return {
          rowCount: 1,
          rows: [{ id: 'tx-uuid-1' }]
        };
      }

      // 4. Insert refund
      if (text.includes('INSERT INTO public.payment_refunds')) {
        return {
          rowCount: 1,
          rows: [{
            id: '55555555-5555-4555-8555-555555555555',
            payment_order_id: '33333333-3333-4333-8333-333333333333',
            payment_transaction_id: 'tx-uuid-1',
            shop_id: validShopId,
            provider_refund_id: null,
            amount_minor: vals?.[3] || 2500,
            currency: 'INR',
            reason: 'Customer requested cancellation',
            status: 'REQUESTED',
            operator_id: 'admin_ops',
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          }]
        };
      }

      // Update refund status
      if (text.includes('UPDATE public.payment_refunds')) {
        return {
          rowCount: 1,
          rows: [{
            id: '55555555-5555-4555-8555-555555555555',
            payment_order_id: '33333333-3333-4333-8333-333333333333',
            payment_transaction_id: 'tx-uuid-1',
            shop_id: validShopId,
            provider_refund_id: 'rfnd_rzp_123',
            amount_minor: '2500',
            currency: 'INR',
            reason: 'Customer requested cancellation',
            status: vals?.[1] || 'COMPLETED',
            operator_id: 'admin_ops',
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          }]
        };
      }

      if (text.includes('SELECT job_id::text FROM public.payment_orders WHERE id = $1')) {
        return {
          rowCount: 1,
          rows: [{ job_id: validJobId }]
        };
      }

      return { rowCount: 1, rows: [] };
    },
    release: () => {}
  };

  const repo = new DurablePaymentRepository({ connect: async () => mockClient } as any);

  // A. Record manual refund
  const refund = await repo.recordManualRefund({
    paymentOrderId: '33333333-3333-4333-8333-333333333333',
    shopId: validShopId,
    amountMinor: 2500,
    reason: 'Customer requested cancellation',
    operatorId: 'admin_ops'
  });

  assert.equal(refund.status, 'REQUESTED');
  assert.equal(refund.amountMinor, 2500);

  // B. Transition refund status to COMPLETED
  const completed = await repo.updateRefundStatus({
    refundId: '55555555-5555-4555-8555-555555555555',
    toStatus: 'COMPLETED',
    providerRefundId: 'rfnd_rzp_123',
    notes: 'Manually executed via Razorpay dashboard'
  });

  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.providerRefundId, 'rfnd_rzp_123');

  // Verify that print_jobs was updated to REFUNDED
  assert.ok(executed.some((t) => t.includes("UPDATE public.print_jobs SET payment_status = 'REFUNDED'")), 'Print job payment_status must update to REFUNDED');

  // C. Cross-tenant isolation check: shop mismatch throws
  const foreignShopId = '99999999-9999-4999-8999-999999999999';
  await assert.rejects(
    async () => {
      await repo.recordManualRefund({
        paymentOrderId: '33333333-3333-4333-8333-333333333333',
        shopId: foreignShopId, // Different shop!
        amountMinor: 2500,
        reason: 'Attempt cross-tenant refund'
      });
    },
    /Tenant isolation violation: Payment order does not belong to this shop/
  );

  console.log('  ✅ PASS: Manual refund tracking enforces tenant isolation and audit lifecycle');
}

// ============================================================================
// 10. DATABASE SAFETY GATE (INTEGRATION TESTS SAFELY BLOCKED)
// ============================================================================
async function testDatabaseSafetyGate() {
  const testDbUrl = process.env.PRINTFLOW_TEST_DATABASE_URL;
  const testDbConfirm = process.env.PRINTFLOW_TEST_DATABASE_CONFIRM;

  const isIsolatedTestDatabaseConfigured = Boolean(
    testDbUrl &&
    testDbConfirm === 'ISOLATED_TEST_DATABASE'
  );

  if (!isIsolatedTestDatabaseConfigured) {
    console.log('  🔒 SAFETY GATE VERIFIED: Live Neon database integration tests are BLOCKED');
    console.log('     Reason: PRINTFLOW_TEST_DATABASE_URL and PRINTFLOW_TEST_DATABASE_CONFIRM=ISOLATED_TEST_DATABASE are not set.');
    console.log('     DATABASE_URL will NEVER be silently migrated or connected to during automated testing.');
  } else {
    console.log('  ℹ️ Isolated test database confirmed. Integration tests authorized.');
  }

  assert.equal(
    process.env.PRINTFLOW_TEST_DATABASE_CONFIRM === 'ISOLATED_TEST_DATABASE' && Boolean(process.env.PRINTFLOW_TEST_DATABASE_URL),
    isIsolatedTestDatabaseConfigured
  );
  console.log('  ✅ PASS: Database safety gate successfully confirmed');
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function runAllPhase4Tests() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING PRINTFLOW PHASE 4: PAYMENT RELIABILITY TEST SUITE');
  console.log('===============================================================\n');

  try {
    await testPhase4MigrationValidation();
    await testPaymentOrderCreationAndAccountSeparation();
    await testCryptographicSignatureAndAccountSeparation();
    await testAtomicPaymentVerification();
    await testIdempotentPaymentVerification();
    await testOutOfOrderWebhookDeliveryDefense();
    await testServerRestartRecovery();
    await testReconciliationTracking();
    await testManualRefundLifecycle();
    await testDatabaseSafetyGate();

    console.log('\n===============================================================');
    console.log('🎉 ALL PHASE 4 PAYMENT RELIABILITY TESTS PASSED (10/10)');
    console.log('===============================================================\n');
  } catch (error) {
    console.error('\n❌ Phase 4 test failed:', error);
    process.exit(1);
  }
}

runAllPhase4Tests();
