import { safeStorage } from 'electron';
import crypto from 'crypto';
import os from 'os';
import { logger } from '../logger/AgentLogger.js';

export class SafeStorageVault {
  private static instance: SafeStorageVault;

  private constructor() {
  }

  public static getInstance(): SafeStorageVault {
    if (!SafeStorageVault.instance) {
      SafeStorageVault.instance = new SafeStorageVault();
    }
    return SafeStorageVault.instance;
  }

  /**
   * Encrypts sensitive secret (e.g. agent auth token)
   */
  public encryptSecret(plainText: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Operating-system credential encryption is unavailable');
    }
    const encryptedBuffer = safeStorage.encryptString(plainText);
    return `dpapi:${encryptedBuffer.toString('base64')}`;
  }

  /**
   * Decrypts sensitive secret
   */
  public decryptSecret(cipherText: string): string {
    if (!cipherText) return '';

    try {
      if (cipherText.startsWith('dpapi:') && safeStorage.isEncryptionAvailable()) {
        const base64Data = cipherText.replace('dpapi:', '');
        const buffer = Buffer.from(base64Data, 'base64');
        return safeStorage.decryptString(buffer);
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

    if (cipherText.startsWith('dpapi:')) {
      throw new Error('Operating-system credential decryption is unavailable');
    }

    // Plaintext is returned only so existing local configuration can be re-encrypted on its next save.
    return cipherText;
  }
}

export const safeVault = SafeStorageVault.getInstance();
