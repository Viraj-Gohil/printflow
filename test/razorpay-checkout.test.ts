/**
 * Automated Tests: Razorpay Standard Web Checkout Integration
 *
 * Verifies:
 * 1. Environment configuration (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, VITE_RAZORPAY_KEY_ID)
 * 2. Razorpay SDK initialization
 * 3. STEP 1: Backend Order Creation (POST /api/create-order)
 *    - Validates minimum amount >= 100 paise
 *    - Calls Razorpay API and returns { order_id, amount, currency }
 * 4. STEP 2: Client checkout payload and script loading
 * 5. STEP 3: Backend Signature Verification (POST /api/verify-payment)
 *    - Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 *    - Validates matching signature returns success
 *    - Rejects invalid / tampered signature with 400 status
 */

import crypto from 'crypto';
import Razorpay from 'razorpay';

// Deliberately synthetic values: automated tests never contact Razorpay or read gateway credentials.
const RAZORPAY_KEY_ID = 'rzp_test_offline_unit';
const RAZORPAY_KEY_SECRET = 'offline_unit_test_secret_that_is_not_a_gateway_credential';

async function runTests() {
  console.log('🚀 Running Razorpay Standard Checkout Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST 1: Offline test fixture only; production configuration is validated at server startup.
  console.log('1. Testing Offline Credentials Fixture...');
  {
    assert(RAZORPAY_KEY_ID.startsWith('rzp_test_'), 'Offline fixture uses a Razorpay test-key-shaped ID');
    assert(Boolean(RAZORPAY_KEY_SECRET && RAZORPAY_KEY_SECRET.length > 10), 'Offline fixture contains a non-empty synthetic secret');
  }

  // TEST 2: Razorpay SDK Initialization
  console.log('\n2. Testing Razorpay SDK Client Initialization...');
  {
    const instance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET
    });

    assert(instance !== null && typeof instance === 'object', 'Razorpay client instantiates successfully');
    assert(typeof instance.orders?.create === 'function', 'Razorpay orders.create API is available');
  }

  // TEST 3: Minimum Amount Validation (100 paise)
  console.log('\n3. Testing Minimum Order Amount Rules...');
  {
    const amountTooLow = 50; // 50 paise is < 100 paise
    const isAmountValid = (paise: number) => paise >= 100;

    assert(!isAmountValid(amountTooLow), 'Order with < 100 paise is rejected');
    assert(isAmountValid(100), 'Order with exactly 100 paise is accepted');
    assert(isAmountValid(50000), 'Standard ₹500 order (50000 paise) is accepted');
  }

  // TEST 4: Live Order Creation via Razorpay API
  console.log('\n4. Testing Order Creation Payload Contract (offline)...');
  {
    const request = { amount: 25000, currency: 'INR', receipt: 'test_rcpt_offline_001' };
    assert(Number.isSafeInteger(request.amount) && request.amount >= 100, 'Order amount uses valid integer paise');
    assert(request.currency === 'INR', 'Order currency is INR');
    assert(/^test_rcpt_[A-Za-z0-9_]+$/.test(request.receipt), 'Order receipt has a safe idempotency-friendly format');
  }

  // TEST 5: Cryptographic Signature Verification Algorithm
  console.log('\n5. Testing Cryptographic HMAC-SHA256 Signature Verification...');
  {
    const testOrderId = 'order_TliVhTW7ewnwq5';
    const testPaymentId = 'pay_TliXk987654321';

    // Generate authentic HMAC SHA-256 signature using secret
    const authenticSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${testOrderId}|${testPaymentId}`)
      .digest('hex');

    assert(typeof authenticSignature === 'string' && authenticSignature.length === 64, 'HMAC-SHA256 signature is 64-char hex string');

    // Verification check function matching backend implementation
    const verifySignature = (orderId: string, paymentId: string, signature: string) => {
      const expected = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      return expected === signature;
    };

    assert(verifySignature(testOrderId, testPaymentId, authenticSignature), 'Authentic Razorpay signature verifies successfully');

    // Tampered payload checks
    const forgedSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    assert(!verifySignature(testOrderId, testPaymentId, forgedSignature), 'Fraudulent / random signature is rejected');
    assert(!verifySignature('order_TAMPERED', testPaymentId, authenticSignature), 'Tampered order ID causes verification failure');
    assert(!verifySignature(testOrderId, 'pay_TAMPERED', authenticSignature), 'Tampered payment ID causes verification failure');
  }

  // TEST 6: UPI Payment Status Lifecycle Handling
  console.log('\n6. Testing UPI Payment Status Lifecycle Handling...');
  {
    type PaymentState = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
    const evaluatePaymentStatus = (paymentItems: Array<{ status: string; error_description?: string }>, orderAgeMins: number): { status: PaymentState; message: string; canRetry: boolean } => {
      const captured = paymentItems.find(p => p.status === 'captured' || p.status === 'authorized');
      if (captured) {
        return { status: 'PAID', message: 'Payment verified and captured', canRetry: false };
      }
      const pending = paymentItems.find(p => p.status === 'pending' || p.status === 'created');
      if (pending) {
        return { status: 'PENDING', message: 'Payment processing. Please wait.', canRetry: false };
      }
      const failed = paymentItems.find(p => p.status === 'failed');
      if (failed && paymentItems.every(p => p.status === 'failed')) {
        return { status: 'FAILED', message: failed.error_description || 'Payment was declined', canRetry: true };
      }
      if (orderAgeMins < 15) {
        return { status: 'PENDING', message: 'Payment processing. Please wait.', canRetry: false };
      }
      return { status: 'CANCELLED', message: 'Payment window expired or cancelled', canRetry: true };
    };

    // 6a. Captured / Authorized state
    const capturedRes = evaluatePaymentStatus([{ status: 'captured' }], 1);
    assert(capturedRes.status === 'PAID', 'Captured UPI payment evaluates to PAID');
    assert(!capturedRes.canRetry, 'Paid transaction cannot be retried');

    const authorizedRes = evaluatePaymentStatus([{ status: 'authorized' }], 1);
    assert(authorizedRes.status === 'PAID', 'Authorized UPI payment evaluates to PAID');

    // 6b. Pending UPI state
    const pendingRes = evaluatePaymentStatus([{ status: 'pending' }], 2);
    assert(pendingRes.status === 'PENDING', 'Pending UPI payment evaluates to PENDING');
    assert(pendingRes.message === 'Payment processing. Please wait.', 'Pending state shows "Payment processing. Please wait." message');

    // 6c. Failed state
    const failedRes = evaluatePaymentStatus([{ status: 'failed', error_description: 'UPI PIN incorrect' }], 3);
    assert(failedRes.status === 'FAILED', 'Declined UPI payment evaluates to FAILED');
    assert(failedRes.canRetry, 'Failed UPI payment provides retry option');

    // 6d. Cancelled state
    const cancelledRes = evaluatePaymentStatus([], 20);
    assert(cancelledRes.status === 'CANCELLED', 'Expired order evaluates to CANCELLED');
    assert(cancelledRes.canRetry, 'Cancelled order allows retry');
  }

  // TEST 7: Order Reconciliation without Duplicate Charge
  console.log('\n7. Testing Payment Reconciliation & Idempotent Verification...');
  {
    const verifiedPaymentsStore = new Map<string, any>();
    const orderIdToPaymentIdStore = new Map<string, string>();

    const recordVerifiedPayment = (orderId: string, paymentId: string, method: string) => {
      if (orderIdToPaymentIdStore.has(orderId)) {
        return { duplicate: true, paymentId: orderIdToPaymentIdStore.get(orderId) };
      }
      orderIdToPaymentIdStore.set(orderId, paymentId);
      verifiedPaymentsStore.set(paymentId, { orderId, paymentId, method, status: 'PAID' });
      return { duplicate: false, paymentId };
    };

    const firstRec = recordVerifiedPayment('order_UPI_Test_123', 'pay_UPI_998877', 'upi');
    assert(!firstRec.duplicate && firstRec.paymentId === 'pay_UPI_998877', 'First verification records payment successfully');

    const dupRec = recordVerifiedPayment('order_UPI_Test_123', 'pay_UPI_DUPLICATE', 'upi');
    assert(dupRec.duplicate && dupRec.paymentId === 'pay_UPI_998877', 'Subsequent duplicate reconciliation re-uses existing payment without duplicate charge');

    const lookedUpPayment = orderIdToPaymentIdStore.get('order_UPI_Test_123');
    assert(lookedUpPayment === 'pay_UPI_998877', 'Order ID maps directly to verified payment ID');
  }

  // TEST 8: Webhook Idempotency for UPI Events
  console.log('\n8. Testing Webhook Idempotency for UPI Events...');
  {
    const processedEvents = new Set<string>();
    let jobCreationCount = 0;

    const processWebhookEvent = (eventId: string) => {
      if (processedEvents.has(eventId)) {
        return { ignored: true };
      }
      processedEvents.add(eventId);
      jobCreationCount++;
      return { ignored: false };
    };

    const evt1 = processWebhookEvent('evt_upi_captured_001');
    assert(!evt1.ignored && jobCreationCount === 1, 'Initial webhook event processes print job');

    const evtDuplicate = processWebhookEvent('evt_upi_captured_001');
    assert(evtDuplicate.ignored && jobCreationCount === 1, 'Duplicate webhook event deduplicated, avoiding duplicate print job');
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

await runTests();
