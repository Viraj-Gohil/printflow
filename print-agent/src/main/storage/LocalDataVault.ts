import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AgentConfig, PrintJobItem, QueueMetrics } from '../../renderer/types/agent.js';
import { safeVault } from './SafeStorageVault.js';
import { logger } from '../logger/AgentLogger.js';

const DEFAULT_CONFIG: AgentConfig = {
  serverUrl: '',
  shopId: '',
  shopSlug: '',
  agentId: '',
  authToken: '',
  deviceName: '',
  pollIntervalMs: 5000,
  autoStartOnBoot: false,
  selectedPrinterName: undefined,
  disabledPrinterNames: [],
  allowColorFallback: true,
  spoolerTimeoutMs: 30000
};

const CONFIG_VERSION = 1;

export class LocalDataVault {
  private static instance: LocalDataVault;
  private configFilePath: string;
  private jobsFilePath: string;
  private stateFilePath: string;
  private config: AgentConfig;
  private jobs: Map<string, PrintJobItem> = new Map();
  private lastHeartbeatAt: string | null = null;
  private lastSyncAt: string | null = null;
  private credentialStorageSecure = true;

  private constructor() {
    let basePath: string;
    try {
      basePath = app ? app.getPath('userData') : path.join(process.cwd(), '.printflow_agent');
    } catch {
      basePath = path.join(process.cwd(), '.printflow_agent');
    }

    if (!fs.existsSync(basePath)) {
      try {
        fs.mkdirSync(basePath, { recursive: true });
      } catch {
        // Ignore
      }
    }

    this.configFilePath = path.join(basePath, 'config.json');
    this.jobsFilePath = path.join(basePath, 'jobs_queue.json');
    this.stateFilePath = path.join(basePath, 'agent_state.json');
    this.config = { ...DEFAULT_CONFIG };
    this.loadAgentState();
    this.loadJobs();
  }

  public reloadConfig(): void {
    this.config = this.loadConfig();
    if (this.config.authToken && !this.credentialStorageSecure) {
      try {
        this.saveConfig({});
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown credential migration error';
        logger.error('AUTH', 'Could not migrate the saved credential to OS-backed encryption; the device must be paired again.', { error: message });
        this.config = { ...this.config, authToken: '' };
        try {
          this.writeConfigFile(this.config);
        } catch (writeError) {
          const writeMessage = writeError instanceof Error ? writeError.message : 'Unknown storage error';
          logger.error('STORAGE', 'Could not remove a legacy plaintext credential from configuration.', { error: writeMessage });
        }
      }
    }
  }

  public static getInstance(): LocalDataVault {
    if (!LocalDataVault.instance) {
      LocalDataVault.instance = new LocalDataVault();
    }
    return LocalDataVault.instance;
  }

  private loadConfig(): AgentConfig {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Configuration must be a JSON object.');
        }
        const stored = parsed as Record<string, unknown>;
        const version = stored.configVersion === undefined ? 0 : stored.configVersion;
        if (version !== 0 && version !== CONFIG_VERSION) {
          throw new Error(`Unsupported configuration version: ${String(version)}`);
        }
        if (stored.encryptedToken !== undefined && typeof stored.encryptedToken !== 'string') {
          throw new Error('Stored encrypted credential has an invalid format.');
        }
        const authToken = typeof stored.encryptedToken === 'string'
          ? safeVault.decryptSecret(stored.encryptedToken)
          : typeof stored.authToken === 'string'
            ? stored.authToken
            : '';
        this.credentialStorageSecure = Boolean(stored.encryptedToken) || !authToken;
        const config: AgentConfig = {
          ...DEFAULT_CONFIG,
          serverUrl: typeof stored.serverUrl === 'string' ? stored.serverUrl : DEFAULT_CONFIG.serverUrl,
          shopId: typeof stored.shopId === 'string' ? stored.shopId : DEFAULT_CONFIG.shopId,
          shopSlug: typeof stored.shopSlug === 'string' ? stored.shopSlug : DEFAULT_CONFIG.shopSlug,
          agentId: typeof stored.agentId === 'string' ? stored.agentId : DEFAULT_CONFIG.agentId,
          authToken,
          deviceName: typeof stored.deviceName === 'string' ? stored.deviceName : DEFAULT_CONFIG.deviceName,
          pollIntervalMs: this.validNumber(stored.pollIntervalMs, 3000, 10000)
            ? stored.pollIntervalMs
            : DEFAULT_CONFIG.pollIntervalMs,
          autoStartOnBoot: typeof stored.autoStartOnBoot === 'boolean'
            ? stored.autoStartOnBoot
            : DEFAULT_CONFIG.autoStartOnBoot,
          selectedPrinterName: typeof stored.selectedPrinterName === 'string'
            ? stored.selectedPrinterName
            : undefined,
          disabledPrinterNames: Array.isArray(stored.disabledPrinterNames)
            ? stored.disabledPrinterNames.filter((name): name is string => typeof name === 'string')
            : [],
          registeredPrinterNames: Array.isArray(stored.registeredPrinterNames)
            ? stored.registeredPrinterNames.filter((name): name is string => typeof name === 'string')
            : undefined,
          printerLimit: typeof stored.printerLimit === 'number' &&
            Number.isSafeInteger(stored.printerLimit) &&
            stored.printerLimit >= 0
            ? stored.printerLimit
            : undefined,
          allowColorFallback: typeof stored.allowColorFallback === 'boolean'
            ? stored.allowColorFallback
            : DEFAULT_CONFIG.allowColorFallback,
          spoolerTimeoutMs: this.validNumber(stored.spoolerTimeoutMs, 5000, 120000)
            ? stored.spoolerTimeoutMs
            : DEFAULT_CONFIG.spoolerTimeoutMs
        };
        return config;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown configuration error';
      logger.warn('AGENT', 'Could not load existing config, using defaults', { error: message });
    }
    return { ...DEFAULT_CONFIG };
  }

  private validNumber(value: unknown, minimum: number, maximum: number): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
  }

  private loadAgentState(): void {
    try {
      if (!fs.existsSync(this.stateFilePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8')) as Record<string, unknown>;
      this.lastHeartbeatAt = this.validTimestamp(parsed.lastHeartbeatAt) ? parsed.lastHeartbeatAt : null;
      this.lastSyncAt = this.validTimestamp(parsed.lastSyncAt) ? parsed.lastSyncAt : null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown state error';
      logger.warn('STORAGE', 'Could not load saved agent status timestamps', { error: message });
    }
  }

  private validTimestamp(value: unknown): value is string {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
  }

  private persistAgentState(): void {
    try {
      fs.writeFileSync(
        this.stateFilePath,
        JSON.stringify({ lastHeartbeatAt: this.lastHeartbeatAt, lastSyncAt: this.lastSyncAt }, null, 2),
        'utf8'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown state storage error';
      logger.error('STORAGE', 'Could not persist agent status timestamps', { error: message });
    }
  }

  public recordSuccessfulHeartbeat(timestamp = new Date().toISOString()): void {
    this.lastHeartbeatAt = timestamp;
    this.persistAgentState();
  }

  public recordSuccessfulSync(timestamp = new Date().toISOString()): void {
    this.lastSyncAt = timestamp;
    this.persistAgentState();
  }

  public getLastHeartbeatAt(): string | null {
    return this.lastHeartbeatAt;
  }

  public getConfig(): AgentConfig {
    return { ...this.config };
  }

  public getPublicConfig(): AgentConfig {
    return {
      serverUrl: this.config.serverUrl,
      shopId: this.config.shopId,
      shopSlug: this.config.shopSlug,
      agentId: this.config.agentId,
      authToken: '',
      deviceName: this.config.deviceName,
      pollIntervalMs: this.config.pollIntervalMs,
      autoStartOnBoot: this.config.autoStartOnBoot,
      selectedPrinterName: this.config.selectedPrinterName,
      disabledPrinterNames: [...(this.config.disabledPrinterNames || [])],
      registeredPrinterNames: [...(this.config.registeredPrinterNames || [])],
      printerLimit: this.config.printerLimit,
      allowColorFallback: this.config.allowColorFallback,
      spoolerTimeoutMs: this.config.spoolerTimeoutMs,
      hasStoredCredentials: Boolean(this.config.authToken),
      credentialStorageStatus: !this.config.authToken
        ? 'NONE'
        : this.credentialStorageSecure
          ? 'SECURE'
          : 'LEGACY'
    };
  }

  private writeConfigFile(config: AgentConfig): void {
    const toPersist: Omit<AgentConfig, 'authToken'> & {
      authToken?: string;
      encryptedToken?: string;
      configVersion: number;
    } = {
      ...config,
      configVersion: CONFIG_VERSION
    };
    if (toPersist.authToken) {
      toPersist.encryptedToken = safeVault.encryptSecret(toPersist.authToken);
      delete toPersist.authToken;
    }
    const temporaryPath = `${this.configFilePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(toPersist, null, 2), 'utf8');
    fs.renameSync(temporaryPath, this.configFilePath);
  }

  public saveConfig(newConfig: Partial<AgentConfig>): void {
    const previousConfig = this.config;
    this.config = { ...this.config, ...newConfig };
    try {
      this.writeConfigFile(this.config);
      this.credentialStorageSecure = true;
      logger.info('AGENT', 'Agent configuration updated and persisted securely');
    } catch (error) {
      this.config = previousConfig;
      const message = error instanceof Error ? error.message : 'Unknown storage error';
      logger.error('AGENT', 'Failed to save configuration securely', { error: message });
      throw new Error(`Could not securely save agent configuration: ${message}`);
    }
  }

  public resetConfig(): void {
    const previousConfig = this.config;
    this.config = { ...DEFAULT_CONFIG };
    try {
      fs.writeFileSync(
        `${this.configFilePath}.tmp`,
        JSON.stringify({ ...DEFAULT_CONFIG, configVersion: CONFIG_VERSION }, null, 2),
        'utf8'
      );
      fs.renameSync(`${this.configFilePath}.tmp`, this.configFilePath);
      this.credentialStorageSecure = true;
      this.lastHeartbeatAt = null;
      this.lastSyncAt = null;
      this.persistAgentState();
      logger.info('AGENT', 'Agent settings and credentials were reset');
    } catch (error) {
      this.config = previousConfig;
      const message = error instanceof Error ? error.message : 'Unknown storage error';
      logger.error('AGENT', 'Failed to reset agent settings', { error: message });
      throw new Error(`Could not reset agent settings: ${message}`);
    }
  }

  private loadJobs(): void {
    try {
      if (fs.existsSync(this.jobsFilePath)) {
        const raw = fs.readFileSync(this.jobsFilePath, 'utf8');
        const list: PrintJobItem[] = JSON.parse(raw);
        for (const j of list) {
          this.jobs.set(j.id, j);
        }
      }
    } catch (err: any) {
      logger.warn('RECOVERY', 'Could not load saved jobs queue', { error: err.message });
    }
  }

  public persistJobs(): void {
    const temporaryPath = `${this.jobsFilePath}.tmp`;
    try {
      const arr = Array.from(this.jobs.values());
      fs.writeFileSync(temporaryPath, JSON.stringify(arr, null, 2), 'utf8');
      fs.renameSync(temporaryPath, this.jobsFilePath);
    } catch (err: any) {
      if (fs.existsSync(temporaryPath)) {
        try {
          fs.unlinkSync(temporaryPath);
        } catch (cleanupError) {
          logger.error('STORAGE', 'Failed to clean up incomplete local queue state', {
            error: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error'
          });
        }
      }
      logger.error('STORAGE', 'Failed to save jobs queue', { error: err.message });
    }
  }

  public saveJob(job: PrintJobItem): void {
    this.jobs.set(job.id, job);
    this.persistJobs();
  }

  public getJob(id: string): PrintJobItem | undefined {
    return this.jobs.get(id);
  }

  public getAllJobs(): PrintJobItem[] {
    return Array.from(this.jobs.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public clearCompletedJobs(): void {
    for (const [id, job] of this.jobs.entries()) {
      if (job.printStatus === 'COMPLETED' || job.printStatus === 'CANCELLED') {
        this.jobs.delete(id);
      }
    }
    this.persistJobs();
  }

  public getMetrics(): QueueMetrics {
    const all = Array.from(this.jobs.values());
    const queued = all.filter((j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED').length;
    const printing = all.filter((j) => j.printStatus === 'DOWNLOADING' || j.printStatus === 'PRINTING').length;
    const completed = all.filter((j) => j.printStatus === 'COMPLETED').length;
    const failed = all.filter((j) => j.printStatus === 'FAILED').length;

    return {
      totalJobs: all.length,
      queuedJobs: queued,
      printingJobs: printing,
      completedJobs: completed,
      failedJobs: failed,
      manualAttentionJobs: all.filter((j) => j.printStatus === 'MANUAL_ATTENTION').length,
      uptimeSeconds: Math.floor(process.uptime()),
      lastSyncAt: this.lastSyncAt
    };
  }
}

export const localVault = LocalDataVault.getInstance();
