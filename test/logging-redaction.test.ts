/**
 * PrintFlow SaaS — Sensitive Data Logging Prevention & Structured Audit Test Suite
 * 
 * Verifies:
 * 1. Zero Sensitive Data in Logs (Passwords, JWTs, API keys, Webhook secrets, Device credentials).
 * 2. Nested Object & HTTP Header Redaction.
 * 3. Document / File Content & Binary Buffer Redaction.
 * 4. Pre-signed Storage URL Credential Masking.
 * 5. Structured Logging & Correlation ID Tracking.
 * 6. Production Error Serialization & Stack Trace Shielding.
 * 7. Audit Log Retention & GDPR/Compliance Purge Policy.
 */

import {
  logger,
  deepRedact,
  sanitizeStringContent,
  StructuredLogRecord
} from '../src/lib/logger';

async function runLoggingRedactionTests() {
  console.log('🛡️ Running PrintFlow Structured Logging & Data Redaction Test Suite...\n');
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

  // Clear audit buffer before test run
  logger.clearAuditLogs();

  // ==========================================================================
  // 1. CREDENTIAL REDACTION IN OBJECTS
  // ==========================================================================
  console.log('1. Testing Credential Redaction in Structured Contexts...');
  {
    const payload = {
      email: 'owner@printflow.shop',
      password: 'SuperSecretPassword!@#123',
      currentPassword: 'OldSecretPassword!1',
      token: 'jwt.token.here',
      authToken: 'agt_tok_device_secret_9948',
      secret: 'whsec_enterprise_webhook_secret',
      keySecret: 'rzp_live_secret_key_8892',
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role',
      razorpay_signature: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
      recoveryCodes: ['REC-1234-5678', 'REC-8765-4321'],
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      creditCard: {
        cardNumber: '4111111111111234',
        cvv: '999',
        expiry: '12/28'
      },
      // Non-sensitive public diagnostic fields
      shopId: 'shop_123',
      orderId: 'order_987',
      statusCode: 200
    };

    const redacted = deepRedact(payload);

    assert(redacted.password === '[REDACTED]', 'Redacts user password');
    assert(redacted.currentPassword === '[REDACTED]', 'Redacts current/old password');
    assert(redacted.token === '[REDACTED]', 'Redacts generic token');
    assert(redacted.authToken === '[REDACTED]', 'Redacts device auth token');
    assert(redacted.secret === '[REDACTED]', 'Redacts webhook secret');
    assert(redacted.keySecret === '[REDACTED]', 'Redacts payment gateway key secret');
    assert(redacted.supabaseKey === '[REDACTED]', 'Redacts Supabase service key');
    assert(redacted.razorpay_signature === '[REDACTED]', 'Redacts cryptographic payment signature');
    assert(redacted.mfaSecret === '[REDACTED]', 'Redacts MFA TOTP secret');
    assert(redacted.recoveryCodes === '[REDACTED]', 'Redacts recovery codes');
    assert(redacted.creditCard.cardNumber === '[REDACTED]', 'Redacts nested credit card number');
    assert(redacted.creditCard.cvv === '[REDACTED]', 'Redacts nested CVV');

    // Confirm safe non-sensitive diagnostic info remains intact
    assert(redacted.shopId === 'shop_123', 'Preserves public shop ID for diagnostic correlation');
    assert(redacted.orderId === 'order_987', 'Preserves public order ID for diagnostic correlation');
    assert(redacted.statusCode === 200, 'Preserves numeric HTTP status code');
  }

  // ==========================================================================
  // 2. DOCUMENT CONTENTS & BINARY BUFFER REDACTION
  // ==========================================================================
  console.log('\n2. Testing File Contents & Binary Buffer Redaction...');
  {
    const filePayload = {
      filename: 'confidential_contract.pdf',
      fileBase64: 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFI...',
      rawBody: 'Sensitive internal document text here...',
      buffer: Buffer.from('Binary PDF data 1234567890'),
      jobId: 'job_4482',
      mimeType: 'application/pdf'
    };

    const redacted = deepRedact(filePayload);

    assert(redacted.fileBase64 === '[REDACTED]', 'Redacts base64 document payload');
    assert(redacted.rawBody === '[REDACTED]', 'Redacts raw body document text');
    assert(redacted.buffer.includes('BINARY_BUFFER'), 'Redacts binary buffer contents and reports byte length safely');
    assert(redacted.filename === 'confidential_contract.pdf', 'Preserves safe metadata filename');
    assert(redacted.jobId === 'job_4482', 'Preserves job ID');
  }

  // ==========================================================================
  // 3. PRE-SIGNED URL & STRING TOKEN MASKING
  // ==========================================================================
  console.log('\n3. Testing Pre-signed URL Credential Masking in Strings...');
  {
    const signedUrl = 'https://storage.printflow.io/files/shop_1/job_2/file_3?token=1712660000.abcd5678efgh9012&expires=1712660000';
    const sanitizedUrl = sanitizeStringContent(signedUrl);

    assert(!sanitizedUrl.includes('abcd5678efgh9012'), 'Strips signed storage token signature from URL string');
    assert(sanitizedUrl.includes('[REDACTED]'), 'Replaces URL query credential with [REDACTED]');

    const bearerHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const sanitizedBearer = sanitizeStringContent(bearerHeader);
    assert(!sanitizedBearer.includes('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'), 'Strips raw JWT bearer token from header string');
    assert(sanitizedBearer.includes('Bearer [REDACTED]'), 'Replaces Bearer token with Bearer [REDACTED]');
  }

  // ==========================================================================
  // 4. REQUEST / CORRELATION ID & STRUCTURED LOGGING
  // ==========================================================================
  console.log('\n4. Testing Structured Logging & Correlation IDs...');
  {
    const reqId = logger.generateCorrelationId();
    assert(reqId.startsWith('req_') && reqId.length >= 16, 'Generates high-entropy correlation ID');

    // Emit structured audit log
    const logRecord = logger.info('Order processed successfully', {
      requestId: reqId,
      shopId: 'shop_shree_ganesh',
      orderId: 'order_live_9941',
      password: 'ShouldNeverAppearInLog',
      token: 'jwt_secret_token_123'
    });

    assert(logRecord.level === 'INFO', 'Emits correct structured log level');
    assert(logRecord.context?.requestId === reqId, 'Preserves correlation ID in log context');
    assert(logRecord.context?.password === '[REDACTED]', 'Ensures password is redacted in emitted log record');
    assert(logRecord.context?.token === '[REDACTED]', 'Ensures token is redacted in emitted log record');
    assert(logRecord.context?.shopId === 'shop_shree_ganesh', 'Preserves shopId for searchability');
  }

  // ==========================================================================
  // 5. ERROR SERIALIZATION & STACK TRACE PROTECTION
  // ==========================================================================
  console.log('\n5. Testing Error Serialization & Stack Trace Shielding...');
  {
    const err = new Error('Database connection failed with credentials db_user:SecretPass123@internal-db:5432');
    
    // In production mode, stack traces should be suppressed
    process.env.NODE_ENV = 'production';
    const prodRedacted = deepRedact(err);
    assert(prodRedacted.name === 'Error', 'Preserves error name');
    assert(prodRedacted.stack === undefined, 'Suppresses stack traces in production environment');
    
    // Reset NODE_ENV
    process.env.NODE_ENV = 'test';
  }

  // ==========================================================================
  // 6. AUDIT LOG RETENTION & PURGE POLICY
  // ==========================================================================
  console.log('\n6. Testing Audit Log Buffer & Retention Policy...');
  {
    const logs = logger.getAuditLogs();
    assert(logs.length > 0, 'Audit logs recorded in in-memory buffer');

    // Purge logs older than 0ms to verify deletion
    const purged = logger.purgeExpiredAuditLogs(0);
    assert(purged >= 1, 'Purges expired audit logs according to retention policy');
    assert(logger.getAuditLogs().length === 0, 'Audit log buffer emptied after zero-window purge');
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n========================================');
  console.log(`Logging Redaction Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLoggingRedactionTests().catch((err) => {
  console.error('Fatal Logging test runner error:', err);
  process.exit(1);
});
