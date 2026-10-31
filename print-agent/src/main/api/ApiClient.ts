import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { AgentConfig, DiscoveredPrinter, PrintJobItem } from '../../renderer/types/agent.js';
import { M2MCrypto } from '../security/M2MCrypto.js';
import { logger } from '../logger/AgentLogger.js';

export class ApiClient {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  public updateConfig(config: AgentConfig): void {
    this.config = config;
  }

  private getBaseUrl(): string {
    return this.config.serverUrl.replace(/\/+$/, '');
  }

  private getHeaders(): Record<string, string> {
    return M2MCrypto.buildAuthHeaders({
      agentId: this.config.agentId,
      authToken: this.config.authToken,
      shopId: this.config.shopId
    });
  }

  /**
   * Pairs the agent device with the shop cloud backend
   */
  public async pairDevice(pairingData: {
    serverUrl: string;
    shopId: string;
    authToken: string;
    deviceName?: string;
  }): Promise<{ success: boolean; agentId?: string; shopId?: string; error?: string; code?: string; activeDevice?: any }> {
    let backendUrl: URL;
    try {
      backendUrl = new URL(pairingData.serverUrl);
    } catch {
      return { success: false, error: 'Enter a valid PrintFlow backend URL.' };
    }
    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(backendUrl.hostname);
    if (
      (backendUrl.protocol !== 'https:' && !(backendUrl.protocol === 'http:' && isLocalhost)) ||
      backendUrl.username ||
      backendUrl.password ||
      backendUrl.search ||
      backendUrl.hash
    ) {
      return { success: false, error: 'Use an HTTPS backend URL (HTTP is only allowed for localhost).' };
    }
    const url = `${backendUrl.toString().replace(/\/+$/, '')}/api/agent/pair`;
    logger.info('AUTH', `Initiating device pairing at ${url}...`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PrintFlow-Agent-Win64/v1.4.2'
        },
        body: JSON.stringify({
          shopId: pairingData.shopId,
          authToken: pairingData.authToken,
          deviceName: pairingData.deviceName || this.config.deviceName
        })
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        shopId?: string;
        agentId?: string;
        code?: string;
        activeDevice?: any;
      };
      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || `Pairing failed with status ${response.status}`,
          code: data.code,
          activeDevice: data.activeDevice
        };
      }
      if (data.shopId !== pairingData.shopId || typeof data.agentId !== 'string' || !data.agentId) {
        return { success: false, error: 'The server returned an invalid device identity.' };
      }

      logger.info('AUTH', `Successfully paired with shop ${data.shopId} as device ${data.agentId}`);
      return { success: true, agentId: data.agentId, shopId: data.shopId };
    } catch (err: any) {
      logger.error('AUTH', `Network error during pairing: ${err.message}`);
      return { success: false, error: `Connection failed: ${err.message}` };
    }
  }

  /**
   * Securely disconnects this desktop agent from the backend shop
   */
  public async disconnectDevice(): Promise<{ success: boolean; error?: string }> {
    const url = `${this.getBaseUrl()}/api/agent/disconnect`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders()
      });
      const data = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      return { success: response.ok && Boolean(data.success), error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Sends heartbeat ping to maintain online status and acknowledge connectivity
   */
  public async sendHeartbeat(): Promise<{
    success: boolean;
    status?: string;
    error?: string;
    code?: string;
    sessionReplaced?: boolean;
  }> {
    const url = `${this.getBaseUrl()}/api/agent/heartbeat`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders()
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        status?: string;
        error?: string;
        code?: string;
      };

      if (!response.ok || !data.success) {
        return {
          success: false,
          code: data.code,
          sessionReplaced: data.code === 'SESSION_REPLACED' || data.error?.includes('replaced by another device'),
          error: data.error || `HTTP ${response.status}`
        };
      }

      return { success: Boolean(data.success), status: data.status };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetches shop, plan, subscription, and entitlement details
   */
  public async getShopInfo(): Promise<{
    success: boolean;
    shopInfo?: import('../../renderer/types/agent.js').ShopDetails;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/agent/info`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const data = (await response.json().catch(() => ({}))) as any;
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || `HTTP ${response.status}: Failed to retrieve shop details.` };
      }
      return {
        success: true,
        shopInfo: {
          shopId: data.shopId,
          shopName: data.shopName,
          shopSlug: data.shopSlug,
          shopStatus: data.shopStatus,
          agentId: data.agentId,
          deviceName: data.deviceName,
          planName: data.planName,
          planStatus: data.planStatus,
          subscriptionPeriodStart: data.subscriptionPeriodStart,
          subscriptionPeriodEnd: data.subscriptionPeriodEnd,
          printerLimit: data.printerLimit,
          registeredCount: data.registeredCount,
          agentRegisteredCount: data.agentRegisteredCount,
          isOperational: data.isOperational,
          restrictionReason: data.restrictionReason,
          permissions: data.permissions || []
        }
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Pushes discovered Windows printers to shop inventory
   */
  public async getPrinterEntitlements(): Promise<{
    success: boolean;
    printerLimit?: number;
    planName?: string;
    registeredCount?: number;
    agentRegisteredCount?: number;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/agent/printer-entitlements`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const data = (await response.json()) as {
        success?: boolean;
        printerLimit?: number;
        planName?: string;
        registeredCount?: number;
        agentRegisteredCount?: number;
        error?: string;
      };
      if (!response.ok || !data.success || !Number.isInteger(data.printerLimit) || (data.printerLimit as number) < 0) {
        return { success: false, error: data.error || `HTTP ${response.status}: could not read printer plan.` };
      }
      return {
        success: true,
        printerLimit: data.printerLimit,
        planName: data.planName,
        registeredCount: data.registeredCount,
        agentRegisteredCount: data.agentRegisteredCount
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async syncPrinters(printers: DiscoveredPrinter[]): Promise<{ success: boolean; error?: string }> {
    const url = `${this.getBaseUrl()}/api/agent/printers/sync`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ printers })
      });

      const data = (await response.json()) as { success?: boolean; error?: string };
      return { success: response.ok && Boolean(data.success), error: data.error || (!response.ok ? `HTTP ${response.status}` : undefined) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async registerPrinter(
    printerName: string,
    registered: boolean
  ): Promise<{ success: boolean; error?: string; code?: string }> {
    const url = `${this.getBaseUrl()}/api/agent/printers/register`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ printerName, registered })
      });

      const data = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string; code?: string };
      return {
        success: response.ok && Boolean(data.success),
        error: data.error || (!response.ok ? `HTTP ${response.status}` : undefined),
        code: data.code
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetches queued print jobs authorized for this shop
   */
  public async fetchPendingJobs(): Promise<{
    success: boolean;
    jobs: PrintJobItem[];
    error?: string;
    code?: string;
    sessionReplaced?: boolean;
  }> {
    const url = `${this.getBaseUrl()}/api/agent/jobs?shopId=${encodeURIComponent(this.config.shopId)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        jobs?: PrintJobItem[];
        error?: string;
        code?: string;
      };

      if (!response.ok || !data.success) {
        return {
          success: false,
          jobs: [],
          code: data.code,
          sessionReplaced: data.code === 'SESSION_REPLACED' || data.error?.includes('replaced by another device'),
          error: data.error || `HTTP ${response.status}`
        };
      }

      return { success: true, jobs: data.jobs || [] };
    } catch (err: any) {
      return { success: false, jobs: [], error: err.message };
    }
  }

  /**
   * Claims a print job to lock it exclusively for this desktop agent
   */
  public async claimJob(jobId: string): Promise<{ success: boolean; job?: PrintJobItem; error?: string }> {
    const url = `${this.getBaseUrl()}/api/agent/jobs/${encodeURIComponent(jobId)}/claim`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders()
      });

      const data = (await response.json()) as { success?: boolean; error?: string; job?: PrintJobItem };
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to claim job' };
      }

      return { success: true, job: data.job };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Updates job status (DOWNLOADING | PRINTING | COMPLETED | FAILED)
   */
  public async updateJobStatus(
    jobId: string,
    status: 'QUEUED' | 'DOWNLOADING' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'REQUIRES_ATTENTION',
    errorMessage?: string,
    printerName?: string,
    retrySafe?: boolean,
    pagesPrinted?: number
  ): Promise<{ success: boolean; error?: string }> {
    const url = `${this.getBaseUrl()}/api/agent/jobs/${encodeURIComponent(jobId)}/status`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ status, errorMessage, printerName, retrySafe, pagesPrinted })
      });

      const data = (await response.json()) as { success?: boolean; error?: string };
      return { success: response.ok && Boolean(data.success), error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Downloads print document safely into temporary local storage for printing
   */
  public async downloadDocument(jobId: string, downloadPathOrUrl?: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
    let target: URL;
    try {
      target = new URL(
        downloadPathOrUrl || `/api/agent/jobs/${encodeURIComponent(jobId)}/file`,
        `${this.getBaseUrl()}/`
      );
      if (target.origin !== new URL(this.getBaseUrl()).origin) {
        return { success: false, error: 'Document URL must use the configured PrintFlow backend.' };
      }
    } catch {
      return { success: false, error: 'Invalid document download URL.' };
    }

    logger.info('NETWORK', `Downloading document for job ${jobId} from the configured backend.`);

    try {
      const response = await fetch(target, {
        method: 'GET',
        headers: this.getHeaders(),
        redirect: 'error'
      });

      if (!response.ok) {
        const ct = response.headers.get('content-type')?.toLowerCase() || '';
        if (ct.includes('application/json')) {
          try {
            const errData = (await response.json()) as any;
            return { success: false, error: errData?.error || `Server rejected document download with HTTP ${response.status}` };
          } catch {}
        }
        if (ct.includes('text/html')) {
          return { success: false, error: `Document download failed: Server returned an HTML error page (HTTP ${response.status}).` };
        }
        return { success: false, error: `Document download failed with HTTP ${response.status}` };
      }

      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > 100 * 1024 * 1024) {
        return { success: false, error: 'Downloaded document exceeds the 100 MB limit.' };
      }
      const reader = response.body?.getReader();
      if (!reader) return { success: false, error: 'Backend returned an empty document response.' };
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > 100 * 1024 * 1024) {
          await reader.cancel();
          return { success: false, error: 'Downloaded document exceeds the 100 MB limit.' };
        }
        chunks.push(value);
      }
      if (totalBytes === 0) return { success: false, error: 'Downloaded document is empty.' };
      const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));

      // Inspect binary magic numbers directly from the downloaded buffer
      let detectedFormat: 'pdf' | 'png' | 'jpeg' | 'webp' | null = null;
      if (buffer.length >= 5 && buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        detectedFormat = 'pdf';
      } else if (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ) {
        detectedFormat = 'png';
      } else if (
        buffer.length >= 3 &&
        buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
      ) {
        detectedFormat = 'jpeg';
      } else if (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
      ) {
        detectedFormat = 'webp';
      }

      // If buffer is not any recognized printable document/image:
      if (!detectedFormat) {
        const preview = buffer.toString('utf8', 0, Math.min(256, buffer.length)).trim().toLowerCase();
        if (preview.startsWith('<!doctype') || preview.includes('<html')) {
          return { success: false, error: 'Downloaded file is an HTML web page rather than a printable document.' };
        }
        if (preview.startsWith('{') || preview.startsWith('[')) {
          return { success: false, error: 'Downloaded file is a JSON payload rather than a printable document.' };
        }
        return { success: false, error: 'Downloaded file content does not match genuine document/image binary signatures (expected PDF, PNG, JPEG, or WEBP).' };
      }

      const extensionByFormat: Record<string, string> = {
        pdf: '.pdf',
        jpeg: '.jpg',
        png: '.png',
        webp: '.webp'
      };

      const formatByMime: Record<string, 'pdf' | 'jpeg' | 'png' | 'webp'> = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpeg',
        'image/png': 'png',
        'image/webp': 'webp'
      };

      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
      if (contentType && formatByMime[contentType] && formatByMime[contentType] !== detectedFormat) {
        logger.warn('NETWORK', `Declared Content-Type (${contentType}) differed from binary payload signature (${detectedFormat}). Using verified binary payload.`);
      }

      const osTemp = os.tmpdir();
      const tempDir = path.join(osTemp, 'PrintFlow_Spool');
      const existedBefore = fs.existsSync(tempDir);

      if (!existedBefore) {
        logger.info('NETWORK', `Spool directory does not exist yet. Creating: ${tempDir} (os.tmpdir: ${osTemp})`);
        fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });
      }

      const existedAfter = fs.existsSync(tempDir);
      logger.info('NETWORK', `Spool directory status for ${jobId}:`, {
        osTmpDir: osTemp,
        resolvedTempDir: tempDir,
        existedBeforeCreation: existedBefore,
        existsNow: existedAfter
      });

      const filePath = path.join(
        tempDir,
        `${M2MCrypto.sanitizeFilename(jobId)}_${crypto.randomUUID()}${extensionByFormat[detectedFormat]}`
      );
      fs.writeFileSync(filePath, buffer, { flag: 'wx', mode: 0o600 });
      const fileSavedSuccessfully = fs.existsSync(filePath);
      const actualSize = fileSavedSuccessfully ? fs.statSync(filePath).size : 0;

      logger.info('NETWORK', `Document download & local disk write complete for ${jobId}:`, {
        targetFilePath: filePath,
        bufferSize: buffer.length,
        diskFileSize: actualSize,
        detectedFormat,
        fileExistsOnDisk: fileSavedSuccessfully
      });

      return { success: true, filePath };
    } catch (err: any) {
      logger.error('NETWORK', `Error downloading document for ${jobId}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
