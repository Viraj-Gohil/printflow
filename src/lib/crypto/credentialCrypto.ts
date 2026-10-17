import crypto from 'crypto';

// Master encryption key derived from environment variable or secure PBKDF2/scrypt salt
// Encryption key MUST be stored separately from the database
const RAW_KEY = process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY || process.env.MASTER_ENCRYPTION_KEY || process.env.ENCRYPTION_SECRET;
const SALT = Buffer.from('printflow-payment-vault-salt-2026-v1', 'utf8');

// Derive a fixed 32-byte key for AES-256-GCM
const DERIVED_KEY: Buffer = RAW_KEY
  ? (RAW_KEY.length === 64
      ? Buffer.from(RAW_KEY, 'hex')
      : crypto.scryptSync(RAW_KEY, SALT, 32))
  : crypto.scryptSync(process.env.SESSION_SECRET || 'printflow-secure-payment-credentials-master-2026', SALT, 32);

/**
 * Encrypts a secret at the application layer using authenticated AES-256-GCM.
 * Never stores secrets in plaintext in PostgreSQL or memory.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Invalid plaintext secret provided for encryption');
  }

  // 12-byte recommended IV for AES-GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Serialization format: aes-256-gcm:iv:tag:ciphertext
  return `aes-256-gcm:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

/**
 * Decrypts an authenticated AES-256-GCM secret.
 * Verifies authenticity tag to prevent tampering.
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload provided for decryption');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 4 || parts[0] !== 'aes-256-gcm') {
    throw new Error('Unrecognized ciphertext format; expected aes-256-gcm:iv:tag:ciphertext');
  }

  const [, ivHex, tagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', DERIVED_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Safely masks a Razorpay Key ID for display in UI or logs.
 * Example: rzp_live_TmtCNk0tJgUAQP -> rzp_live_TmtC••••••••
 */
export function maskKeyId(keyId?: string): string {
  if (!keyId) return 'Not Configured';
  const trimmed = keyId.trim();
  if (trimmed.length <= 13) return trimmed;
  return `${trimmed.slice(0, 13)}${'•'.repeat(8)}`;
}

/**
 * Validates Razorpay Key ID format and verifies consistency with mode.
 */
export function validateKeyFormat(keyId: string, expectedMode?: 'test' | 'live'): { valid: boolean; error?: string } {
  if (!keyId || typeof keyId !== 'string') {
    return { valid: false, error: 'Key ID is required' };
  }

  const trimmed = keyId.trim();
  if (!/^rzp_(test|live)_[a-zA-Z0-9]{10,24}$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid Razorpay Key ID format. Expected "rzp_test_..." or "rzp_live_..."'
    };
  }

  const isTestKey = trimmed.startsWith('rzp_test_');
  const isLiveKey = trimmed.startsWith('rzp_live_');

  if (expectedMode === 'live' && !isLiveKey) {
    return {
      valid: false,
      error: 'Configuration is set to Live Production Mode, but the Key ID is a Test key (rzp_test_...)'
    };
  }

  if (expectedMode === 'test' && !isTestKey) {
    return {
      valid: false,
      error: 'Configuration is set to Test Sandbox Mode, but the Key ID is a Live key (rzp_live_...)'
    };
  }

  return { valid: true };
}
