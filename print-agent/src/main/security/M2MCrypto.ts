import crypto from 'crypto';
import path from 'path';

export class M2MCrypto {
  /**
   * Constructs standard headers for PrintFlow Cloud Machine-to-Machine requests
   */
  public static buildAuthHeaders(params: {
    agentId: string;
    authToken: string;
    shopId?: string;
  }): Record<string, string> {
    const headers: Record<string, string> = {
      'x-agent-id': params.agentId,
      'x-agent-token': params.authToken,
      'Content-Type': 'application/json',
      'User-Agent': 'PrintFlow-Agent-Win64/v1.4.2'
    };

    if (params.shopId) {
      headers['x-shop-id'] = params.shopId;
    }

    return headers;
  }

  /**
   * Generates HMAC SHA256 signature for signed payloads
   */
  public static signPayload(payload: string, secretKey: string): string {
    return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
  }

  /**
   * Sanitizes Windows filename to prevent shell injection or directory traversal
   */
  public static sanitizeFilename(filename: string): string {
    const base = path.basename(filename);
    return base.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * Sanitizes printer names for safe execution in Windows PowerShell / CLI
   */
  public static sanitizePrinterName(printerName: string): string {
    return printerName.replace(/["';`$]/g, '').trim();
  }
}
