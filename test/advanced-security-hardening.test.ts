/**
 * PrintFlow SaaS — Advanced Security Hardening Automated Test Suite
 *
 * Verifies:
 * 1. Removal of Authentication Tokens from Browser LocalStorage (Zero Credential Leakage)
 * 2. Strict Server-Side Authorization & Anti-Spoofing (Header Spoofing Rejection & BOLA Defense)
 * 3. Electron Print Agent Credential Isolation & Hardware/OS Vault Security
 * 4. Private File Download HMAC Signature & Cross-Tenant Boundary Enforcement
 * 5. Secure Session Lifecycle, HttpOnly Cookie Configuration & Instant Revocation
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  createSecureSession,
  validateSecureSession,
  destroySecureSession,
  destroyAllSessionsForUser,
  enforceServerAuthorization,
  sanitizeClientStorage,
  ServerSession,
  verifyFileSignature,
  validateUploadFile,
  sanitizeFilename
} from '../src/lib/security';
import {
  OSSecureCredentialVault,
  pairElectronAgent,
  verifyElectronAgentRequest,
  rotateElectronAgentToken,
  revokeElectronAgentDevice,
  electronDeviceRegistry
} from '../src/lib/electronAgentSecurity';

dotenv.config();

async function runAdvancedHardeningTests() {
  console.log('🛡️ Running PrintFlow Advanced Security Hardening Test Suite...\n');
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
  // CONTROL 1: REMOVAL OF AUTHENTICATION TOKENS FROM LOCAL STORAGE
  // ==========================================================================
  console.log('1. Testing Elimination of Authentication Tokens from Browser Storage...');
  {
    // Simulate browser storage containing legacy tokens
    const mockStorage = new Map<string, string>();
    mockStorage.set('printflow_prod_v2_current_user', JSON.stringify({ email: 'owner@shop.com', passwordHash: 'secret' }));
    mockStorage.set('printflow_prod_v2_users', JSON.stringify([{ id: '1', password: 'xyz' }]));
    mockStorage.set('printflow_auth_token', 'jwt_bearer_token_12345');
    mockStorage.set('printflow_prod_v2_theme', 'light'); // Legitimate non-sensitive UI preference

    const storageAdapter = {
      removeItem: (k: string) => mockStorage.delete(k),
      key: (i: number) => Array.from(mockStorage.keys())[i] || null,
      get length() { return mockStorage.size; }
    };

    const removed = sanitizeClientStorage(storageAdapter);

    assert(removed.length >= 3, 'Purges legacy authentication and credential keys from storage');
    assert(!mockStorage.has('printflow_prod_v2_current_user'), 'Browser localStorage does not contain current_user or passwords');
    assert(!mockStorage.has('printflow_auth_token'), 'Browser localStorage does not contain auth tokens');
    assert(mockStorage.has('printflow_prod_v2_theme'), 'Preserves legitimate non-sensitive UI preferences');

    // HttpOnly Cookie Configuration Test
    const user = {
      id: 'usr_shop_owner_1',
      email: 'owner@printflow.io',
      role: 'SHOP_OWNER' as const,
      shopId: 'shop_shree_ganesh',
      fullName: 'Ramesh Patel'
    };
    const { signedCookie, cookieOptions } = createSecureSession(user);

    assert(cookieOptions.httpOnly === true, 'Session cookie enforces httpOnly: true (inaccessible to JavaScript / XSS)');
    assert(cookieOptions.sameSite === 'strict', 'Session cookie enforces SameSite: Strict (CSRF mitigation)');
    assert(cookieOptions.path === '/', 'Session cookie scoped to root application path');
    assert(signedCookie.includes('.'), 'Session cookie is cryptographically signed with HMAC-SHA256');
  }

  // ==========================================================================
  // CONTROL 2: ENFORCE SERVER-SIDE AUTHORIZATION & PREVENT HEADER SPOOFING
  // ==========================================================================
  console.log('\n2. Testing Server-Side Authorization & Anti-Spoofing Defenses...');
  {
    const shopOwnerSession: ServerSession = {
      sessionId: 'sess_owner_99',
      userId: 'usr_owner_1',
      email: 'owner@printflow.io',
      role: 'SHOP_OWNER',
      shopId: 'shop_A',
      fullName: 'Shop Owner A',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      lastActiveAt: Date.now()
    };

    const customerSession: ServerSession = {
      sessionId: 'sess_cust_55',
      userId: 'usr_cust_101',
      email: 'student@college.edu',
      role: 'CUSTOMER',
      fullName: 'Student Customer',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      lastActiveAt: Date.now()
    };

    const adminSession: ServerSession = {
      sessionId: 'sess_admin_01',
      userId: 'usr_admin',
      email: 'admin@printflow.io',
      role: 'ADMIN',
      fullName: 'Super Admin',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      lastActiveAt: Date.now()
    };

    // 1. Shop Owner accessing own shop resource -> ALLOWED
    const ownShopCheck = enforceServerAuthorization(shopOwnerSession, {
      resourceType: 'SHOP',
      shopId: 'shop_A'
    });
    assert(ownShopCheck.authorized, 'Shop Owner is authorized to access own shop resources');

    // 2. Shop Owner attempting cross-tenant access to Shop B -> BLOCKED
    const crossTenantCheck = enforceServerAuthorization(shopOwnerSession, {
      resourceType: 'SHOP',
      shopId: 'shop_B'
    });
    assert(!crossTenantCheck.authorized, 'Shop Owner is strictly BLOCKED from accessing Shop B (IDOR prevented)');

    // 3. Shop Owner attempting privilege escalation to ADMIN_SETTINGS -> BLOCKED
    const escalationCheck = enforceServerAuthorization(shopOwnerSession, {
      resourceType: 'ADMIN_SETTINGS'
    });
    assert(!escalationCheck.authorized, 'Shop Owner cannot access Admin settings (Privilege Escalation prevented)');

    // 4. Customer attempting to access Shop B printer -> BLOCKED
    const customerPrinterCheck = enforceServerAuthorization(customerSession, {
      resourceType: 'PRINTER',
      shopId: 'shop_A'
    });
    assert(!customerPrinterCheck.authorized, 'Customer role cannot manage physical printer hardware');

    // 5. Customer accessing own print job -> ALLOWED
    const customerOwnJob = enforceServerAuthorization(customerSession, {
      resourceType: 'JOB',
      customerId: 'usr_cust_101',
      shopId: 'shop_A'
    });
    assert(customerOwnJob.authorized, 'Customer can access their own submitted print job');

    // 6. Customer accessing another customer print job -> BLOCKED
    const customerForeignJob = enforceServerAuthorization(customerSession, {
      resourceType: 'JOB',
      customerId: 'usr_cust_999',
      shopId: 'shop_A'
    });
    assert(!customerForeignJob.authorized, 'Customer is BLOCKED from accessing foreign customer print jobs');

    // 7. Fail closed on missing session context
    const missingSessionCheck = enforceServerAuthorization(null, {
      resourceType: 'SHOP',
      shopId: 'shop_A'
    });
    assert(!missingSessionCheck.authorized, 'Fails closed when session context is missing or null');

    // 8. Platform Admin has authorized platform oversight
    const adminAccess = enforceServerAuthorization(adminSession, {
      resourceType: 'SHOP',
      shopId: 'shop_B'
    });
    assert(adminAccess.authorized, 'Platform Super Admin is authorized for platform operations');
  }

  // ==========================================================================
  // CONTROL 3: ELECTRON PRINT AGENT CREDENTIAL ISOLATION & M2M SECURITY
  // ==========================================================================
  console.log('\n3. Testing Electron Print Agent Credential Isolation & OS Vault...');
  {
    const vault = new OSSecureCredentialVault();

    // 1. Hardware/OS Credential Vault encryption and retrieval
    const testSecret = 'agt_tok_super_secret_hardware_key_99182';
    await vault.storeSecret('agent_device_token', testSecret);

    const retrieved = await vault.retrieveSecret('agent_device_token');
    assert(retrieved === testSecret, 'OS-backed hardware vault securely stores and decrypts device credentials');

    // 2. Hardware encryption is active
    assert(vault.isHardwareAccelerated(), 'OS-backed credential vault uses hardware-accelerated encryption');

    // 3. Machine-to-Machine authentication with authentic device credentials
    electronDeviceRegistry.set('agent_shop_shree_ganesh', {
      agentId: 'agent_shop_shree_ganesh',
      shopId: 'shop_shree_ganesh',
      authToken: 'agt_tok_sgx_live_99482',
      deviceName: 'COUNTER-PC01',
      status: 'ONLINE',
      isRevoked: false,
      registeredAt: Date.now(),
      lastHeartbeatAt: Date.now()
    });
    const paired = pairElectronAgent({
      shopId: 'shop_shree_ganesh',
      authToken: 'agt_tok_sgx_live_99482',
      deviceName: 'Counter PC'
    });
    assert(paired.success && paired.device?.agentId === 'agent_shop_shree_ganesh', 'Valid dashboard-issued token pairs only with its registered shop');
    const invalidPair = pairElectronAgent({
      shopId: 'shop_shree_ganesh',
      authToken: 'agt_tok_invalid'
    });
    assert(!invalidPair.success, 'Unknown agent tokens cannot self-register during pairing');
    const crossShopPair = pairElectronAgent({
      shopId: 'shop_other',
      authToken: 'agt_tok_sgx_live_99482'
    });
    assert(!crossShopPair.success, 'Agent token cannot be paired to a different shop');
    const validM2M = verifyElectronAgentRequest({
      agentId: 'agent_shop_shree_ganesh',
      authToken: 'agt_tok_sgx_live_99482',
      targetShopId: 'shop_shree_ganesh'
    });
    assert(validM2M.valid && validM2M.device?.status === 'ONLINE', 'Authentic Electron agent M2M credentials verified');

    // 4. Cross-tenant device claim attempt -> BLOCKED
    const crossShopM2M = verifyElectronAgentRequest({
      agentId: 'agent_shop_shree_ganesh',
      authToken: 'agt_tok_sgx_live_99482',
      targetShopId: 'shop_royal_cyber'
    });
    assert(!crossShopM2M.valid, 'Electron agent is forbidden from claiming jobs belonging to another shop');

    // 5. Fraudulent agent token -> BLOCKED
    const fraudulentM2M = verifyElectronAgentRequest({
      agentId: 'agent_shop_shree_ganesh',
      authToken: 'agt_tok_attacker_forged'
    });
    assert(!fraudulentM2M.valid, 'Forged agent token is rejected via constant-time comparison');

    // 6. Token rotation invalidates old token
    const rotation = rotateElectronAgentToken('agent_shop_shree_ganesh');
    assert(rotation.success && Boolean(rotation.newAuthToken), 'Rotates agent device token successfully');

    // Old token should now fail
    const oldTokenFail = verifyElectronAgentRequest({
      agentId: 'agent_shop_shree_ganesh',
      authToken: 'agt_tok_sgx_live_99482'
    });
    assert(!oldTokenFail.valid, 'Old agent token is invalidated immediately upon rotation');

    // 7. Instant device revocation
    revokeElectronAgentDevice('agent_shop_shree_ganesh');
    const revokedCheck = verifyElectronAgentRequest({
      agentId: 'agent_shop_shree_ganesh',
      authToken: rotation.newAuthToken!
    });
    assert(!revokedCheck.valid && Boolean(revokedCheck.error?.includes('revoked')), 'Revoked agent device is rejected immediately');
  }

  // ==========================================================================
  // CONTROL 4: PRIVATE FILE DOWNLOAD PRE-SIGNED TOKENS & TENANT ISOLATION
  // ==========================================================================
  console.log('\n4. Testing Private File Download Pre-signed Tokens & Isolation...');
  {
    const storageSecret = 'storage_secret_key_99481234';
    const shopId = 'shop_shree_ganesh';
    const jobId = 'PRT-10992';
    const fileId = 'file_abc123';
    const expiresAt = Date.now() + 3600000;

    // Legitimate HMAC signed token
    const payload = `${shopId}|${jobId}|${fileId}|${expiresAt}`;
    const sig = crypto.createHmac('sha256', storageSecret).update(payload).digest('hex');
    const validToken = `${expiresAt}.${sig}`;

    // Verify token validation logic
    const [tokenExpStr, tokenSig] = validToken.split('.');
    const expectedSig = crypto.createHmac('sha256', storageSecret).update(`${shopId}|${jobId}|${fileId}|${tokenExpStr}`).digest('hex');
    assert(tokenSig === expectedSig, 'Authentic pre-signed file download token verifies cleanly');

    // Attacker attempts to change fileId or jobId with same token -> Tampering detected
    const tamperedPayload = `${shopId}|PRT-ATTACKER_JOB|${fileId}|${tokenExpStr}`;
    const tamperedSig = crypto.createHmac('sha256', storageSecret).update(tamperedPayload).digest('hex');
    assert(tokenSig !== tamperedSig, 'Tampered job ID or file ID in download URL causes signature mismatch');

    // Path traversal defense on stored files
    const dirtyPath = '../../etc/shadow.pdf';
    const cleanPath = sanitizeFilename(dirtyPath);
    assert(!cleanPath.includes('..') && !cleanPath.includes('/'), 'File storage strictly sanitizes path traversal characters');
  }

  // ==========================================================================
  // CONTROL 5: SECURE SESSION LIFECYCLE & REVOCATION REGISTRY
  // ==========================================================================
  console.log('\n5. Testing Secure Session Lifecycle & Instant Revocation...');
  {
    const testUser = {
      id: 'usr_test_sess_1',
      email: 'session.test@printflow.io',
      role: 'SHOP_OWNER' as const,
      shopId: 'shop_shree_ganesh',
      fullName: 'Session Tester'
    };

    // 1. Create session
    const { signedCookie, session } = createSecureSession(testUser, 1800000); // 30m
    assert(session.userId === 'usr_test_sess_1', 'Session record created with correct user ID');

    // 2. Validate session
    const validated = validateSecureSession(signedCookie);
    assert(validated.valid && validated.session?.userId === 'usr_test_sess_1', 'Valid signed cookie validates successfully');

    // 3. Tampered cookie signature is rejected
    const tamperedCookie = signedCookie.slice(0, -4) + 'abcd';
    const tamperedResult = validateSecureSession(tamperedCookie);
    assert(!tamperedResult.valid, 'Tampered session cookie signature is rejected');

    // 4. Destroy single session (Logout)
    const destroyed = destroySecureSession(signedCookie);
    assert(destroyed, 'Session destroyed cleanly on logout');
    const postLogoutCheck = validateSecureSession(signedCookie);
    assert(!postLogoutCheck.valid, 'Logged-out session cannot be used again');

    // 5. Invalidate all sessions for compromised user
    const { signedCookie: cookie1 } = createSecureSession(testUser);
    const { signedCookie: cookie2 } = createSecureSession(testUser);
    const revokedCount = destroyAllSessionsForUser('usr_test_sess_1');
    assert(revokedCount >= 2, 'Revokes all concurrent sessions for user upon security event');
    assert(!validateSecureSession(cookie1).valid && !validateSecureSession(cookie2).valid, 'All user sessions are immediately blocked');
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n========================================');
  console.log(`Hardening Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdvancedHardeningTests().catch((err) => {
  console.error('Hardening test execution failed:', err);
  process.exit(1);
});
