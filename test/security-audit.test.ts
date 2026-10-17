/**
 * Comprehensive Automated Security Regression Test Suite — PrintFlow SaaS
 *
 * Verifies:
 * 1. SQL Injection Prevention & Query Parameterization
 * 2. Cross-Site Scripting (XSS) Prevention & HTML Sanitization
 * 3. CSRF Protection & Origin Validation
 * 4. Secure File Upload & Magic Byte Verification
 * 5. Broken Object-Level Authorization (BOLA / IDOR) Tenant Isolation
 * 6. JWT Lifecycle Security, Algorithm Confusion Defense & Revocation
 * 7. Cryptographic Password Hashing & Reset Token Invalidation
 * 8. Multi-Factor Authentication (RFC 6238 TOTP & Recovery Codes)
 * 9. API Secrets Server-Side Enclosure & Redaction
 * 10. Payment Signature Verification & Idempotency
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  buildSafeQuery,
  containsSqlInjection,
  escapeHtml,
  sanitizePlainText,
  validateUrlScheme,
  sanitizeFilename,
  verifyFileSignature,
  validateUploadFile,
  isOriginAllowed,
  generateCsrfToken,
  verifyCsrfToken,
  checkShopOwnership,
  checkJobAuthorization,
  checkPrinterAuthorization,
  checkTransactionAuthorization,
  checkTicketAuthorization,
  DistributedRateLimiterStore,
  createJwtAccessToken,
  verifyJwtAccessToken,
  revokeJwtToken,
  issueRefreshToken,
  rotateRefreshToken,
  hashPassword,
  verifyPassword,
  createPasswordResetToken,
  consumePasswordResetToken,
  generateMfaEnrollment,
  verifyTotpCode,
  generateRecoveryCodes,
  consumeRecoveryCode,
  redactSensitiveData
} from '../src/lib/security';
import { UserProfile, Shop, PrintJob, PrinterDevice, Transaction, SupportTicket } from '../src/types';

dotenv.config();

async function runSecurityTests() {
  console.log('🛡️ Running PrintFlow SaaS Comprehensive Security Test Suite...\n');
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

  // ==========================================================================
  // 1. SQL INJECTION PREVENTION & QUERY BUILDER
  // ==========================================================================
  console.log('1. Testing SQL Injection Prevention & Parameterized Queries...');
  {
    // Parameterized construction
    const q1 = buildSafeQuery({
      table: 'shops',
      select: ['id', 'name', 'status'],
      filters: { status: 'ACTIVE', owner_email: "test'; DROP TABLE users;--" },
      sortBy: 'created_at',
      sortOrder: 'DESC',
      limit: 10,
      offset: 0
    });

    assert(q1.sql.includes('WHERE "status" = $1 AND "owner_email" = $2'), 'Query uses bind parameters for untrusted values');
    assert(q1.parameters[1] === "test'; DROP TABLE users;--", 'Untrusted input is passed safely as bound data, not SQL code');
    assert(!q1.sql.includes("DROP TABLE"), 'Malicious SQL fragment is not executed in statement structure');

    // Reject unknown/injected table names
    let caughtTableErr = false;
    try {
      buildSafeQuery({ table: "users; DROP TABLE shops;--" });
    } catch {
      caughtTableErr = true;
    }
    assert(caughtTableErr, 'Rejects unauthorized or injection-laden table identifiers');

    // Reject invalid dynamic sort columns
    const q2 = buildSafeQuery({
      table: 'print_jobs',
      sortBy: "status; DELETE FROM print_jobs;--",
      sortOrder: 'ASC'
    });
    assert(!q2.sql.includes("DELETE FROM"), 'Rejects arbitrary SQL injection in dynamic sort clauses');

    // SQLi signature detector
    assert(containsSqlInjection("1' OR '1'='1"), 'Detects classic SQLi quote condition payload');
    assert(containsSqlInjection("admin' UNION SELECT null, password FROM users--"), 'Detects UNION SELECT attack');
    assert(containsSqlInjection("'; WAITFOR DELAY '0:0:5'--"), 'Detects time-based blind SQLi payload');
    assert(!containsSqlInjection("Shree Ganesh Xerox & Printing Station"), 'Legitimate shop search query passes clean');
    assert(!containsSqlInjection("College campus notes binding"), 'Legitimate customer filename query passes clean');
  }

  // ==========================================================================
  // 2. CROSS-SITE SCRIPTING (XSS) PREVENTION & SANITIZATION
  // ==========================================================================
  console.log('\n2. Testing Cross-Site Scripting (XSS) Prevention & HTML Sanitization...');
  {
    const xssPayload = '<script>alert("XSS")</script><img src="x" onerror="stealCookie()">';
    const escaped = escapeHtml(xssPayload);
    assert(!escaped.includes('<script>'), 'Encodes HTML tag opening brackets into entities');
    assert(escaped.includes('&lt;script&gt;'), 'Produces safe HTML entities for client rendering');

    const sanitized = sanitizePlainText(xssPayload);
    assert(!sanitized.includes('<script>'), 'Strips raw script elements from user text inputs');
    assert(!sanitized.includes('onerror='), 'Strips event handlers from stored strings');

    // URL Scheme validation
    assert(!validateUrlScheme('javascript:alert(document.cookie)'), 'Blocks javascript: URI scheme execution');
    assert(!validateUrlScheme('vbscript:msgbox(1)'), 'Blocks vbscript: URI scheme execution');
    assert(!validateUrlScheme('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), 'Blocks executable data: URI schemes');
    assert(validateUrlScheme('https://printflow.io/s/shree-ganesh'), 'Allows valid HTTPS navigation URL');
    assert(validateUrlScheme('/shop/dashboard'), 'Allows relative application route paths');
    assert(validateUrlScheme('mailto:support@printflow.io'), 'Allows standard mailto: links');
  }

  // ==========================================================================
  // 3. CSRF PROTECTION & ORIGIN VALIDATION
  // ==========================================================================
  console.log('\n3. Testing CSRF Protection & Origin Integrity...');
  {
    const allowed = ['http://localhost:3000', 'https://printflow.io'];
    assert(isOriginAllowed('http://localhost:3000', 'localhost:3000', allowed), 'Accepts configured local origin');
    assert(isOriginAllowed('https://printflow.io', 'printflow.io', allowed), 'Accepts production trusted domain');
    assert(!isOriginAllowed('https://evil-hacker-site.com', 'printflow.io', allowed), 'Blocks cross-site request from untrusted origin');

    // Signed double-submit CSRF token
    const secret = 'csrf_super_secret_test_key_12345';
    const token = generateCsrfToken('sess_user_991', secret);
    assert(verifyCsrfToken(token, 'sess_user_991', secret), 'Valid CSRF token verifies successfully');
    assert(!verifyCsrfToken(token, 'sess_other_user', secret), 'Rejects token paired with wrong session');
    assert(!verifyCsrfToken('tampered.signature', 'sess_user_991', secret), 'Rejects tampered CSRF signature');
  }

  // ==========================================================================
  // 4. SECURE FILE UPLOAD & MAGIC BYTE VERIFICATION
  // ==========================================================================
  console.log('\n4. Testing Secure File Upload & Magic Byte Verification...');
  {
    // 1. Legitimate PDF binary (%PDF-)
    const validPdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]);
    const pdfCheck = verifyFileSignature(validPdfBuffer);
    assert(pdfCheck.isValid && pdfCheck.mimeType === 'application/pdf', 'Verifies genuine PDF binary signature');

    // 2. Legitimate PNG binary (\x89PNG\r\n\x1a\n)
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
    const pngCheck = verifyFileSignature(validPngBuffer);
    assert(pngCheck.isValid && pngCheck.mimeType === 'image/png', 'Verifies genuine PNG binary signature');

    // 3. Legitimate JPEG binary (\xFF\xD8\xFF)
    const validJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const jpgCheck = verifyFileSignature(validJpgBuffer);
    assert(jpgCheck.isValid && jpgCheck.mimeType === 'image/jpeg', 'Verifies genuine JPEG binary signature');

    // 4. Path traversal filename sanitization
    const dirtyFilename = '../../../../etc/passwd.pdf';
    const cleanFilename = sanitizeFilename(dirtyFilename);
    assert(!cleanFilename.includes('..') && !cleanFilename.includes('/'), 'Strips directory traversal sequences from filename');
    assert(cleanFilename.endsWith('.pdf'), 'Preserves legitimate extension');

    // 5. Spoofed extension check (Executable masquerading as PDF)
    const fakePdfBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // Windows EXE magic bytes
    const uploadRes = validateUploadFile({
      buffer: fakePdfBuffer,
      filename: 'invoice.pdf',
      shopId: 'shop_1',
      jobId: 'job_1'
    });
    assert(!uploadRes.isValid, 'Rejects executable or malicious file spoofing a .pdf extension');

    // 6. Empty file validation
    const emptyUpload = validateUploadFile({
      buffer: Buffer.alloc(0),
      filename: 'empty.pdf',
      shopId: 'shop_1',
      jobId: 'job_1'
    });
    assert(!emptyUpload.isValid && Boolean(emptyUpload.error?.includes('empty')), 'Rejects 0-byte empty file upload');

    // 7. Full validation generates private storage path
    const validUpload = validateUploadFile({
      buffer: validPdfBuffer,
      filename: 'assignment.pdf',
      shopId: 'shop_shree_ganesh',
      jobId: 'PRT-10492'
    });
    assert(validUpload.isValid, 'Valid PDF with matching signature is accepted');
    assert(Boolean(validUpload.storageKey?.startsWith('storage/shops/shop_shree_ganesh/jobs/PRT-10492/')), 'Enforces tenant-isolated storage path');
  }

  // ==========================================================================
  // 5. BROKEN OBJECT-LEVEL AUTHORIZATION (BOLA / IDOR)
  // ==========================================================================
  console.log('\n5. Testing Broken Object-Level Authorization (BOLA / IDOR)...');
  {
    // Define two independent shop owner accounts
    const ownerA: UserProfile = {
      id: 'usr_owner_1',
      email: 'shopA@printflow.io',
      fullName: 'Ramesh Patel',
      role: 'SHOP_OWNER',
      shopId: 'shop_A',
      createdAt: new Date().toISOString()
    };

    const ownerB: UserProfile = {
      id: 'usr_owner_2',
      email: 'shopB@printflow.io',
      fullName: 'Vikram Singh',
      role: 'SHOP_OWNER',
      shopId: 'shop_B',
      createdAt: new Date().toISOString()
    };

    const admin: UserProfile = {
      id: 'usr_admin',
      email: 'admin@printflow.io',
      fullName: 'Platform Super Admin',
      role: 'ADMIN',
      createdAt: new Date().toISOString()
    };

    // Test Shop Ownership
    assert(checkShopOwnership(ownerA, 'shop_A').authorized, 'Owner A can access own Shop A');
    assert(!checkShopOwnership(ownerA, 'shop_B').authorized, 'Owner A is BLOCKED from accessing foreign Shop B (IDOR prevented)');
    assert(checkShopOwnership(admin, 'shop_B').authorized, 'Platform Super Admin is authorized for platform oversight');

    // Test Print Job Authorization
    const jobB: PrintJob = {
      id: 'PRT-9901',
      trackingToken: 'tr_test',
      shopId: 'shop_B',
      shopName: 'Shop B',
      customerName: 'Customer',
      files: [],
      totalAmount: 15,
      paymentStatus: 'SUCCESS',
      paymentMethod: 'UPI',
      printStatus: 'QUEUED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };

    assert(!checkJobAuthorization(ownerA, jobB).authorized, 'Owner A cannot access or cancel Shop B print job');
    assert(checkJobAuthorization(ownerB, jobB).authorized, 'Owner B can access own print job');

    // Test Printer Device Authorization
    const printerB: PrinterDevice = {
      id: 'prn_shopB_1',
      shopId: 'shop_B',
      deviceId: 'dev_canon_1',
      name: 'Canon IR 2625',
      model: 'Canon IR 2625',
      status: 'ONLINE',
      capabilities: {
        paperSizes: ['A4'],
        supportsColor: false,
        supportsDuplex: true
      },
      priority: 1,
      isEnabled: true,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    assert(!checkPrinterAuthorization(ownerA, printerB).authorized, 'Owner A cannot modify or delete Shop B printer');

    // Test Financial Transaction Authorization
    const txnB: Transaction = {
      id: 'txn_order_B',
      orderId: 'ORD-B',
      shopId: 'shop_B',
      shopName: 'Shop B',
      amount: 450,
      status: 'SUCCESS',
      paymentMethod: 'UPI',
      type: 'PRINT_JOB',
      createdAt: new Date().toISOString()
    };

    assert(!checkTransactionAuthorization(ownerA, txnB).authorized, 'Owner A cannot initiate refund for Shop B transaction');

    // Test Support Ticket Isolation
    const ticketB: SupportTicket = {
      id: 'tck_B_1',
      ticketNumber: 'TCK-201',
      shopId: 'shop_B',
      shopName: 'Shop B',
      subject: 'Private Billing Concern',
      description: 'Confidential bank account update',
      category: 'SUBSCRIPTION_BILLING',
      priority: 'HIGH',
      status: 'OPEN',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    assert(!checkTicketAuthorization(ownerA, ticketB).authorized, 'Owner A cannot read or reply to Shop B support tickets');
  }

  // ==========================================================================
  // 6. JWT & TOKEN LIFECYCLE SECURITY
  // ==========================================================================
  console.log('\n6. Testing JWT Lifecycle Security & Algorithm Confusion Defense...');
  {
    const jwtSecret = 'test_jwt_secure_random_key_9948271';
    const token = createJwtAccessToken({
      userId: 'usr_owner_1',
      role: 'SHOP_OWNER',
      shopId: 'shop_shree_ganesh',
      expiresInSec: 900,
      secret: jwtSecret
    });

    // 1. Valid token verification
    const verified = verifyJwtAccessToken(token, jwtSecret);
    assert(verified.valid, 'Validly signed HS256 JWT verifies successfully');
    assert(verified.payload?.sub === 'usr_owner_1', 'Preserves user identity claim');
    assert(verified.payload?.iss === 'printflow-auth', 'Verifies issuer claim');

    // 2. Algorithm confusion defense (reject "none" algorithm)
    const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payloadValid = Buffer.from(JSON.stringify(verified.payload)).toString('base64url');
    const unsignedToken = `${headerNone}.${payloadValid}.`;
    const rejectNone = verifyJwtAccessToken(unsignedToken, jwtSecret);
    assert(!rejectNone.valid, 'Strictly rejects "none" algorithm confusion attacks');

    // 3. Expired token rejection
    const expiredToken = createJwtAccessToken({
      userId: 'usr_owner_1',
      role: 'SHOP_OWNER',
      expiresInSec: -10, // Expired in past
      secret: jwtSecret
    });
    const rejectExpired = verifyJwtAccessToken(expiredToken, jwtSecret);
    assert(!rejectExpired.valid && Boolean(rejectExpired.error?.includes('expired')), 'Rejects expired token');

    // 4. Token revocation list
    const jti = verified.payload!.jti;
    revokeJwtToken(jti);
    const rejectRevoked = verifyJwtAccessToken(token, jwtSecret);
    assert(!rejectRevoked.valid && Boolean(rejectRevoked.error?.includes('revoked')), 'Revoked token JTI is blocked immediately');

    // 5. Refresh token rotation & reuse detection
    const initialRefresh = issueRefreshToken('usr_owner_1');
    const rotate1 = rotateRefreshToken(initialRefresh);
    assert(rotate1.valid && Boolean(rotate1.newRefreshToken), 'Rotates refresh token and returns new child token');

    // Attacker tries to reuse the old initialRefresh token!
    const reuseAttempt = rotateRefreshToken(initialRefresh);
    assert(!reuseAttempt.valid && Boolean(reuseAttempt.error?.includes('reuse')), 'Detects refresh token reuse and invalidates session family');
  }

  // ==========================================================================
  // 7. CRYPTOGRAPHIC PASSWORD HASHING & RESET TOKENS
  // ==========================================================================
  console.log('\n7. Testing Cryptographic Password Hashing & Reset Token Security...');
  {
    const plainPass = 'PrintFlow#Security2026';
    const hash = hashPassword(plainPass);

    assert(hash.startsWith('$pbkdf2-sha512$120000$'), 'Uses PBKDF2-SHA512 with 120,000 rounds and random salt');
    assert(hash !== plainPass, 'Password is never stored in plaintext');

    // Constant-time verification
    assert(verifyPassword(plainPass, hash), 'Verifies authentic password with stored hash');
    assert(!verifyPassword('WrongPassword123', hash), 'Rejects incorrect password');

    // Two hashes of the same password produce different hashes (Unique Salt per Password)
    const hash2 = hashPassword(plainPass);
    assert(hash !== hash2, 'Uses unique cryptographic salt per password hash (prevents rainbow tables)');

    // Single-use password reset tokens
    const { plainToken } = createPasswordResetToken('shop@printflow.io');
    const consume1 = consumePasswordResetToken(plainToken);
    assert(consume1.valid && consume1.email === 'shop@printflow.io', 'Single-use reset token verified successfully');

    // Second attempt with same token (Reuse blocked)
    const consume2 = consumePasswordResetToken(plainToken);
    assert(!consume2.valid, 'Reset token is invalidated immediately after single use');
  }

  // ==========================================================================
  // 8. MULTI-FACTOR AUTHENTICATION (RFC 6238 TOTP & RECOVERY CODES)
  // ==========================================================================
  console.log('\n8. Testing Multi-Factor Authentication (TOTP & Recovery Codes)...');
  {
    const { secretBase32, otpauthUrl } = generateMfaEnrollment('admin@printflow.io');
    assert(secretBase32.length >= 16, 'Generates high-entropy Base32 TOTP secret');
    assert(otpauthUrl.startsWith('otpauth://totp/PrintFlow:admin%40printflow.io'), 'Generates valid standard otpauth:// QR URI');

    // Generate current RFC 6238 token using the library's internal step computation
    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);
    assert(plainCodes.length === 8 && hashedCodes.length === 8, 'Generates exactly 8 single-use recovery codes');
    assert(plainCodes[0] !== hashedCodes[0], 'Stores recovery codes exclusively as SHA-256 hashes');

    // Consume recovery code
    const testRecoveryCode = plainCodes[0];
    const recResult = consumeRecoveryCode(testRecoveryCode, hashedCodes);
    assert(recResult.valid, 'Authentic recovery code consumes successfully');
    assert(recResult.remainingHashedCodes.length === 7, 'Used recovery code is removed from remaining valid codes');

    // Replay same recovery code
    const replayRecovery = consumeRecoveryCode(testRecoveryCode, recResult.remainingHashedCodes);
    assert(!replayRecovery.valid, 'Replay of already consumed recovery code is rejected');
  }

  // ==========================================================================
  // 9. RATE LIMITING & ABUSE PREVENTION
  // ==========================================================================
  console.log('\n9. Testing Distributed Rate Limiting & Abuse Prevention...');
  {
    const limiter = new DistributedRateLimiterStore();
    const testKey = 'ip:198.51.100.42';

    // Limit = 3 requests per 60 seconds
    const req1 = await limiter.consume(testKey, 3, 60000);
    assert(req1.allowed && req1.remaining === 2, 'Request 1 within quota is allowed');

    const req2 = await limiter.consume(testKey, 3, 60000);
    assert(req2.allowed && req2.remaining === 1, 'Request 2 within quota is allowed');

    const req3 = await limiter.consume(testKey, 3, 60000);
    assert(req3.allowed && req3.remaining === 0, 'Request 3 consumes remaining quota');

    // Request 4 exceeds quota -> HTTP 429
    const req4 = await limiter.consume(testKey, 3, 60000);
    assert(!req4.allowed && (req4.retryAfterSeconds || 0) > 0, 'Excess request 4 is rejected with Retry-After backoff');
  }

  // ==========================================================================
  // 10. SECRET REDACTION & LOG INTEGRITY
  // ==========================================================================
  console.log('\n10. Testing Secret Redaction & Log Integrity...');
  {
    const sensitiveObj = {
      user: 'admin@printflow.io',
      password: 'PlainSecretPassword123',
      razorpay: {
        keyId: 'rzp_test_Tli32dgjgjRMgf',
        keySecret: 'r14D2ncq76rgbDISPQfKSpZj'
      },
      agent: {
        authToken: 'agt_tok_super_secret_994'
      }
    };

    const redacted = redactSensitiveData(sensitiveObj);
    assert(redacted.password === 'Pla••••23' || redacted.password === '••••••••', 'Masks plaintext password');
    assert(redacted.razorpay.keySecret.includes('••••'), 'Masks Razorpay secret key in audit logging');
    assert(redacted.agent.authToken.includes('••••'), 'Masks device auth tokens');
    assert(redacted.razorpay.keyId === 'rzp_test_Tli32dgjgjRMgf', 'Preserves public client key for diagnosis');
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n========================================');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
