let safeStorage: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  safeStorage = require('electron').safeStorage;
} catch {
  safeStorage = {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString()
  };
}
import crypto from 'crypto';
import os from 'os';
import { logger } from '../logger/AgentLogger.js';

export class SafeStorageVault {
  private static instance: SafeStorageVault;

  private constructor() {
    this.runEncryptionDiagnostic();
  }

  public static getInstance(): SafeStorageVault {
    if (!SafeStorageVault.instance) {
      SafeStorageVault.instance = new SafeStorageVault();
    }
    return SafeStorageVault.instance;
  }

  /**
   * Returns the active credential storage backend ('dpapi' or 'aes-256-gcm').
   */
  public getSelectedStorageBackend(): string {
    try {
      if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
        return 'dpapi';
      }
    } catch {}
    return 'aes-256-gcm';
  }

  /**
   * Performs an encryption/decryption round-trip diagnostic.
   */
  public runEncryptionDiagnostic(): { success: boolean; backend: string; error?: string } {
    const backend = this.getSelectedStorageBackend();
    try {
      const testSecret = 'printflow_diagnostic_test_token_123';
      const encrypted = this.encryptSecret(testSecret);
      const decrypted = this.decryptSecret(encrypted);
      if (decrypted !== testSecret) {
        throw new Error('Encryption round-trip verification failed: decrypted text does not match original.');
      }
      logger.info('STORAGE', `Encryption diagnostic passed successfully using backend: ${backend}`);
      return { success: true, backend };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown diagnostic error';
      logger.error('STORAGE', `Encryption diagnostic failed using backend: ${backend}`, { error: message });
      return { success: false, backend, error: message };
    }
  }

  /**
   * Encrypts sensitive secret (e.g. agent auth token) securely using DPAPI or AES-256-GCM fallback.
   */
  public encryptSecret(plainText: string): string {
    if (!plainText) return '';
    try {
      if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
        const encryptedBuffer = safeStorage.encryptString(plainText);
        return `dpapi:${encryptedBuffer.toString('base64')}`;
      }
    } catch (err) {
      logger.warn('STORAGE', 'DPAPI encryption unavailable or failed, falling back to AES-256-GCM secure vault', { error: err instanceof Error ? err.message : err });
    }

    // Fallback secure AES-256-GCM encryption (never plaintext)
    const machineFingerprint = `${os.hostname()}_${os.platform()}_${os.arch()}_PrintFlowVault`;
    const key = crypto.createHash('sha256').update(machineFingerprint).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `aes:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts sensitive secret
   */
  public decryptSecret(cipherText: string): string {
    if (!cipherText) return '';

    try {
      if (cipherText.startsWith('dpapi:')) {
        if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
          const base64Data = cipherText.replace('dpapi:', '');
          const buffer = Buffer.from(base64Data, 'base64');
          return safeStorage.decryptString(buffer);
        } else {
          // Fallback decryption attempt if machine fingerprint matches or safeStorage is tested in test environments
          const machineFingerprint = `${os.hostname()}_${os.platform()}_${os.arch()}_PrintFlowVault`;
          const fallbackKey = crypto.createHash('sha256').update(machineFingerprint).digest();
          try {
            const base64Data = cipherText.replace('dpapi:', '');
            const buffer = Buffer.from(base64Data, 'base64');
            // If it was actually encrypted via safeStorage in a previous session where DPAPI was active, but now DPAPI is unavailable,
            // we log the error or return empty rather than crashing.
          } catch {}
          throw new Error('OS DPAPI credential decryption is unavailable in current runtime environment.');
        }
      }

      if (cipherText.startsWith('aes:')) {
        const machineFingerprint = `${os.hostname()}_${os.platform()}_${os.arch()}_PrintFlowVault`;
        const legacyKey = crypto.createHash('sha256').update(machineFingerprint).digest();
        const parts = cipherText.split(':');
        if (parts.length === 4) {
          const iv = Buffer.from(parts[1], 'hex');
          const tag = Buffer.from(parts[2], 'hex');
          const enc = parts[3];
          const decipher = crypto.createDecipheriv('aes-256-gcm', legacyKey, iv);
          decipher.setAuthTag(tag);
          let dec = decipher.update(enc, 'hex', 'utf8');
          dec += decipher.final('utf8');
          return dec;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown decryption error';
      logger.error('AUTH', 'Failed to decrypt stored credential', { error: message });
      throw new Error(`Unable to decrypt stored agent credential: ${message}`);
    }

    // Plaintext is returned only so existing legacy local configuration can be re-encrypted on its next save.
    return cipherText;
  }
}

export const safeVault = SafeStorageVault.getInstance();
