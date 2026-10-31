import { BrowserWindow } from 'electron';
import { AgentConfig, AgentConnectionStatus, DiscoveredPrinter, PrintJobItem } from '../../renderer/types/agent.js';
import { localVault } from '../storage/LocalDataVault.js';
import { ApiClient } from '../api/ApiClient.js';
import { WindowsPrinterManager } from '../printer/WindowsPrinterManager.js';
import { JobQueueManager } from '../queue/JobQueueManager.js';
import { CrashRecoveryManager } from '../recovery/CrashRecoveryManager.js';
import { logger } from '../logger/AgentLogger.js';

export class PrintAgentService {
  private static instance: PrintAgentService;
  private apiClient: ApiClient;
  private printerManager: WindowsPrinterManager;
  private queueManager: JobQueueManager;
  private currentStatus: AgentConnectionStatus = 'CONNECTING';
  private heartbeatInProgress = false;
  private pollingInProgress = false;
  private pairingInProgress = false;
  private backgroundLoopsActive = false;
  private configRevision = 0;
  private heartbeatTimer?: NodeJS.Timeout;
  private pollingTimer?: NodeJS.Timeout;
  private pollFailureCount = 0;
  private mainWindow?: BrowserWindow | null;
  private onStatusChangeListener?: (status: AgentConnectionStatus) => void;
  private revocationReason: string | null = null;

  private constructor() {
    const config = localVault.getConfig();
    this.apiClient = new ApiClient(config);
    this.printerManager = WindowsPrinterManager.getInstance();
    this.queueManager = new JobQueueManager(this.apiClient, this.printerManager);
  }

  public static getInstance(): PrintAgentService {
    if (!PrintAgentService.instance) {
      PrintAgentService.instance = new PrintAgentService();
    }
    return PrintAgentService.instance;
  }

  public setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  public setOnStatusChangeListener(listener: (status: AgentConnectionStatus) => void): void {
    this.onStatusChangeListener = listener;
  }

  public setOnJobUpdateListener(listener: (job: PrintJobItem) => void): void {
    this.queueManager.setOnJobUpdateListener(listener);
  }

  private setStatus(status: AgentConnectionStatus): void {
    this.currentStatus = status;
    if (this.onStatusChangeListener) {
      this.onStatusChangeListener(status);
    }
  }

  private isScanningPrinters = false;
  private printerScanTimer?: NodeJS.Timeout;
  private syncedPrinterCache: Map<string, string> = new Map();
  private pendingReconciliation = true;

  private notifyPrinterScanning(isScanning: boolean): void {
    this.isScanningPrinters = isScanning;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('event:printer-scanning', isScanning);
    }
  }

  public getIsScanningPrinters(): boolean {
    return this.isScanningPrinters;
  }

  /**
   * Evaluates changes between currently discovered printers and previously synced cache.
   */
  private detectPrinterChanges(currentPrinters: any[]): {
    hasChanges: boolean;
    events: Array<{
      printerName: string;
      eventType: 'PRINTER_ADDED' | 'PRINTER_REMOVED' | 'STATUS_CHANGED' | 'CONFIG_CHANGED';
      changedFields: string[];
    }>;
    currentPrinterMap: Map<string, { printer: any; stateKey: string }>;
  } {
    const events: Array<{
      printerName: string;
      eventType: 'PRINTER_ADDED' | 'PRINTER_REMOVED' | 'STATUS_CHANGED' | 'CONFIG_CHANGED';
      changedFields: string[];
    }> = [];

    const currentPrinterMap = new Map<string, { printer: any; stateKey: string }>();

    for (const printer of currentPrinters) {
      const key = printer.name.trim().toLowerCase();
      const stateObj = {
        name: printer.name,
        status: printer.status,
        isOnline: Boolean(printer.isOnline),
        isDefault: Boolean(printer.isDefault),
        driverName: printer.driverName || '',
        portName: printer.portName || '',
        capabilities: printer.capabilities || {},
        isRegistered: Boolean(printer.isRegistered),
        isEnabled: Boolean(printer.isEnabled)
      };
      const stateKey = JSON.stringify(stateObj);
      currentPrinterMap.set(key, { printer, stateKey });

      const cachedStateKey = this.syncedPrinterCache.get(key);
      if (!cachedStateKey) {
        events.push({
          printerName: printer.name,
          eventType: 'PRINTER_ADDED',
          changedFields: ['new_device_detected']
        });
      } else if (cachedStateKey !== stateKey) {
        const changedFields: string[] = [];
        try {
          const oldObj = JSON.parse(cachedStateKey);
          if (oldObj.status !== stateObj.status) changedFields.push(`status (${oldObj.status} -> ${stateObj.status})`);
          if (oldObj.isOnline !== stateObj.isOnline) changedFields.push(`isOnline (${oldObj.isOnline} -> ${stateObj.isOnline})`);
          if (oldObj.isDefault !== stateObj.isDefault) changedFields.push(`isDefault (${oldObj.isDefault} -> ${stateObj.isDefault})`);
          if (oldObj.isRegistered !== stateObj.isRegistered) changedFields.push(`isRegistered (${oldObj.isRegistered} -> ${stateObj.isRegistered})`);
          if (oldObj.isEnabled !== stateObj.isEnabled) changedFields.push(`isEnabled (${oldObj.isEnabled} -> ${stateObj.isEnabled})`);
          if (JSON.stringify(oldObj.capabilities) !== JSON.stringify(stateObj.capabilities)) changedFields.push('capabilities');
          if (oldObj.driverName !== stateObj.driverName) changedFields.push('driverName');
          if (oldObj.portName !== stateObj.portName) changedFields.push('portName');
        } catch {
          changedFields.push('state_mismatch');
        }

        const isStatusChange = changedFields.some((f) => f.startsWith('status') || f.startsWith('isOnline'));
        events.push({
          printerName: printer.name,
          eventType: isStatusChange ? 'STATUS_CHANGED' : 'CONFIG_CHANGED',
          changedFields: changedFields.length > 0 ? changedFields : ['configuration_updated']
        });
      }
    }

    // Check for removed printers
    for (const [cachedKey, cachedStateKey] of this.syncedPrinterCache.entries()) {
      if (!currentPrinterMap.has(cachedKey)) {
        let origName = cachedKey;
        try {
          const parsed = JSON.parse(cachedStateKey);
          if (parsed.name) origName = parsed.name;
        } catch {}
        events.push({
          printerName: origName,
          eventType: 'PRINTER_REMOVED',
          changedFields: ['device_removed']
        });
      }
    }

    return {
      hasChanges: events.length > 0,
      events,
      currentPrinterMap
    };
  }

  /**
   * Initializes agent lifecycle, recovery audit, and background sync
   */
  public async start(): Promise<void> {
    logger.info('AGENT', 'Starting PrintFlow Windows Desktop Agent Service...');

    // 1. Crash recovery audit
    CrashRecoveryManager.performStartupRecovery();

    // 2. Discover local printers automatically on app startup with initial reconciliation
    try {
      this.pendingReconciliation = true;
      await this.rescanPrinters(true);
    } catch (error) {
      logger.warn('SPOOLER', `Initial printer discovery completed with notice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const config = localVault.getConfig();
    this.apiClient.updateConfig(config);
    if (!config.serverUrl || !config.shopId || !config.agentId || !config.authToken) {
      this.setStatus('OFFLINE');
      logger.info('AUTH', 'Agent setup is required before connecting to PrintFlow.');
      return;
    }

    // 3. Initial heartbeat & sync
    await this.triggerHeartbeat();

    // 4. Initial job poll
    await this.pollPendingJobs();

    // 5. Start background periodic loops
    this.startBackgroundLoops();
  }

  public stop(): void {
    this.backgroundLoopsActive = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollingTimer) clearTimeout(this.pollingTimer);
    if (this.printerScanTimer) clearInterval(this.printerScanTimer);
    this.setStatus('OFFLINE');
    logger.info('AGENT', 'PrintFlow Agent service stopped.');
  }

  private startBackgroundLoops(): void {
    this.backgroundLoopsActive = true;
    const config = localVault.getConfig();
    const interval = Math.max(3000, config.pollIntervalMs || 5000);

    // Clear existing
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollingTimer) clearTimeout(this.pollingTimer);
    if (this.printerScanTimer) clearInterval(this.printerScanTimer);

    // Heartbeat loop (every 10s)
    this.heartbeatTimer = setInterval(() => {
      this.triggerHeartbeat();
    }, 10000);

    // Automatic background printer hardware status refresh (every 20s)
    this.printerScanTimer = setInterval(() => {
      if (this.backgroundLoopsActive && !this.isScanningPrinters) {
        this.rescanPrinters(false).catch(() => {});
      }
    }, 20000);

    // Job polling loop
    this.pollFailureCount = 0;
    this.scheduleNextPoll(interval);
  }

  private scheduleNextPoll(delay: number): void {
    if (!this.backgroundLoopsActive) return;
    if (this.pollingTimer) clearTimeout(this.pollingTimer);
    this.pollingTimer = setTimeout(async () => {
      try {
        const result = await this.pollPendingJobs();
        if (result.success) {
          this.pollFailureCount = 0;
        } else {
          this.pollFailureCount = Math.min(this.pollFailureCount + 1, 5);
        }
      } catch (error) {
        this.pollFailureCount = Math.min(this.pollFailureCount + 1, 5);
        logger.error('NETWORK', 'Scheduled queue polling failed unexpectedly', {
          error: error instanceof Error ? error.message : 'Unknown polling error'
        });
      }
      if (!this.backgroundLoopsActive) return;
      const configuredInterval = Math.max(3000, localVault.getConfig().pollIntervalMs || 5000);
      const backoff = Math.min(configuredInterval * (2 ** this.pollFailureCount), 60000);
      this.scheduleNextPoll(this.pollFailureCount ? backoff : configuredInterval);
    }, delay);
  }

  public async getShopInfo(): Promise<{ success: boolean; shopInfo?: import('../../renderer/types/agent.js').ShopDetails; error?: string }> {
    const res = await this.apiClient.getShopInfo();
    if (res.success && res.shopInfo) {
      localVault.saveConfig({
        printerLimit: res.shopInfo.printerLimit,
        shopSlug: res.shopInfo.shopSlug,
        shopId: res.shopInfo.shopId,
        shopDetails: res.shopInfo
      });
      if (!res.shopInfo.isOperational) {
        this.setStatus('RESTRICTED');
      }
    }
    return res;
  }

  public async triggerHeartbeat(): Promise<{ success: boolean; status?: string }> {
    if (this.heartbeatInProgress || this.pairingInProgress) return { success: false };
    this.heartbeatInProgress = true;
    const requestRevision = this.configRevision;
    const shouldResumeQueue = this.currentStatus !== 'ONLINE';
    try {
      const res = await this.apiClient.sendHeartbeat();
      if (requestRevision !== this.configRevision) return { success: false };
      if (res.success) {
        localVault.recordSuccessfulHeartbeat();
        
        // Refresh shop and subscription details
        const infoRes = await this.apiClient.getShopInfo();
        if (infoRes.success && infoRes.shopInfo) {
          localVault.saveConfig({
            printerLimit: infoRes.shopInfo.printerLimit,
            shopSlug: infoRes.shopInfo.shopSlug,
            shopId: infoRes.shopInfo.shopId,
            shopDetails: infoRes.shopInfo
          });

          if (!infoRes.shopInfo.isOperational) {
            this.setStatus('RESTRICTED');
            logger.warn('AUTH', infoRes.shopInfo.restrictionReason || 'Shop operational status restricted.');
            return { success: true, status: 'RESTRICTED' };
          }
        }

        this.setStatus('ONLINE');
        if (shouldResumeQueue) {
          this.pendingReconciliation = true;
          await this.recoverInterruptedDownloads();
          this.queueManager.reloadPendingJobs();
          // Perform full printer reconciliation on initial connect or reconnect
          this.rescanPrinters(true).catch((err) => {
            logger.warn('SPOOLER', `Reconnect printer reconciliation notice: ${err instanceof Error ? err.message : err}`);
          });
        }
        return { success: true, status: res.status };
      }

      if (res.sessionReplaced || res.code === 'SESSION_REPLACED' || res.error?.includes('replaced by another device')) {
        await this.handleSessionReplaced(res.error || 'This agent session has been replaced by another device.');
        return { success: false, status: 'REVOKED' };
      }

      this.setStatus('ERROR');
      logger.warn('NETWORK', `Heartbeat ping failed: ${res.error}`);
      return { success: false };
    } finally {
      this.heartbeatInProgress = false;
    }
  }

  public async pollPendingJobs(): Promise<{ success: boolean; newJobsCount: number; error?: string }> {
    if (this.pairingInProgress) return { success: false, newJobsCount: 0, error: 'Device pairing is in progress.' };
    if (this.currentStatus === 'RESTRICTED' || this.currentStatus === 'UNAUTHORIZED' || this.currentStatus === 'REVOKED') {
      return { success: false, newJobsCount: 0, error: 'Shop account or device session is currently restricted or revoked.' };
    }
    if (this.pollingInProgress) return { success: false, newJobsCount: 0, error: 'A queue check is already running.' };
    this.pollingInProgress = true;
    const requestRevision = this.configRevision;
    try {
      const res = await this.apiClient.fetchPendingJobs();
      if (requestRevision !== this.configRevision) {
        return { success: false, newJobsCount: 0, error: 'Device configuration changed during the queue check.' };
      }

      if (!res.success) {
        if (res.sessionReplaced || res.code === 'SESSION_REPLACED' || res.error?.includes('replaced by another device')) {
          await this.handleSessionReplaced(res.error || 'This agent session has been replaced by another device.');
          return { success: false, newJobsCount: 0, error: res.error };
        }
        logger.warn('NETWORK', `Could not fetch the print queue: ${res.error || 'backend request failed'}`);
        return { success: false, newJobsCount: 0, error: res.error || 'The backend request failed.' };
      }

      localVault.recordSuccessfulSync();
      let newCount = 0;
      if (Array.isArray(res.jobs) && res.jobs.length > 0) {
        for (const remoteJob of res.jobs) {
          const existing = localVault.getJob(remoteJob.id);
          if (!existing || existing.printStatus === 'QUEUED') {
            this.queueManager.enqueueJob(remoteJob);
            newCount++;
          }
        }
      }
      return { success: true, newJobsCount: newCount };
    } finally {
      this.pollingInProgress = false;
    }
  }

  private async recoverInterruptedDownloads(): Promise<void> {
    const interruptedJobs = localVault.getAllJobs().filter((job) => job.printStatus === 'DOWNLOADING');
    for (const job of interruptedJobs) {
      const result = await this.apiClient.updateJobStatus(job.id, 'QUEUED');
      if (!result.success) {
        const message = 'Download was interrupted before printing, but the backend queue could not be safely reset. Check the job in PrintFlow before taking further action.';
        this.queueManager.markManualAttention(job, message);
        logger.warn('RECOVERY', `Could not reset interrupted download ${job.id} in the backend: ${result.error || 'status update failed'}`);
        continue;
      }
      job.printStatus = 'QUEUED';
      job.errorMessage = 'Recovered after an interrupted download.';
      job.retryCount = (job.retryCount || 0) + 1;
      job.retrySafe = undefined;
      job.updatedAt = new Date().toISOString();
      localVault.saveJob(job);
      logger.info('RECOVERY', `Interrupted download ${job.id} was safely returned to the backend queue.`);
    }

    const interruptedPrints = localVault.getAllJobs().filter((job) => job.printStatus === 'MANUAL_ATTENTION');
    for (const job of interruptedPrints) {
      const result = await this.apiClient.updateJobStatus(
        job.id,
        'REQUIRES_ATTENTION',
        job.errorMessage || 'The previous print outcome is uncertain. Check the printer output before reprinting.',
        job.printerName,
        false
      );
      if (!result.success) {
        logger.error('RECOVERY', `Could not persist the uncertain print outcome for ${job.id}: ${result.error || 'backend rejected the update'}`);
      }
    }
  }

  public async rescanPrinters(forceSync = false): Promise<DiscoveredPrinter[]> {
    this.notifyPrinterScanning(true);
    try {
      const printers = await this.printerManager.discoverPrinters(this.mainWindow);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('event:printers-updated', printers);
      }

      const config = localVault.getConfig();
      if (!config.agentId || !config.authToken) return printers;

      try {
        const entitlement = await this.apiClient.getPrinterEntitlements();
        if (entitlement.success && entitlement.printerLimit !== undefined) {
          let registeredNames = config.registeredPrinterNames;
          const ownRegisteredCount = entitlement.agentRegisteredCount ?? (registeredNames ? registeredNames.length : 0);
          const otherRegisteredCount = Math.max(0, (entitlement.registeredCount ?? ownRegisteredCount) - ownRegisteredCount);
          const agentCapacity = Math.max(0, entitlement.printerLimit - otherRegisteredCount);

          if (!registeredNames || registeredNames.length === 0) {
            // Auto-register preferred physical printer (e.g. HP LaserJet P1007 or default online printer) if capacity allows
            const preferred =
              config.selectedPrinterName ||
              printers.find((p) => p.isOnline && !/pdf|xps|onenote|fax/i.test(p.name))?.name ||
              printers.find((p) => p.isDefault && p.isOnline)?.name ||
              printers.find((p) => p.isOnline)?.name;
            registeredNames = preferred && agentCapacity > 0 ? [preferred] : [];
          }

          registeredNames = registeredNames.slice(0, agentCapacity);
          localVault.saveConfig({
            printerLimit: entitlement.printerLimit,
            registeredPrinterNames: registeredNames,
            selectedPrinterName: config.selectedPrinterName || registeredNames[0] || ''
          });
          this.apiClient.updateConfig(localVault.getConfig());

          // Send ALL discovered printers to the backend with their real registration & enablement state.
          const syncPayload = printers.map((printer) => ({
            ...printer,
            isRegistered: (registeredNames || []).includes(printer.name),
            isEnabled: !(config.disabledPrinterNames || []).includes(printer.name)
          }));

          // Evaluate event-driven delta between current state and previously synced cache
          const diff = this.detectPrinterChanges(syncPayload);

          if (forceSync || this.pendingReconciliation || diff.hasChanges) {
            logger.info('SPOOLER', `Executing printer hardware sync with backend (forceSync: ${forceSync}, pendingReconciliation: ${this.pendingReconciliation}, eventCount: ${diff.events.length})`, {
              eventDetails: diff.events.map((e) => `${e.printerName}: [${e.eventType}] fields: (${e.changedFields.join(', ')})`),
              totalPrinters: syncPayload.length
            });

            const syncRes = await this.apiClient.syncPrinters(syncPayload as any);
            if (syncRes.success) {
              this.syncedPrinterCache.clear();
              for (const [key, value] of diff.currentPrinterMap.entries()) {
                this.syncedPrinterCache.set(key, value.stateKey);
              }
              this.pendingReconciliation = false;
              logger.info('SPOOLER', `Successfully synchronized ${syncPayload.length} printer(s) with backend.`, {
                syncedCount: syncPayload.length,
                eventsProcessed: diff.events.map((e) => `${e.printerName}:${e.eventType}`)
              });
            } else {
              this.pendingReconciliation = true;
              logger.warn('SPOOLER', `Printer hardware sync API request failed: ${syncRes.error}. Queued for retry on next scan or heartbeat reconciliation.`);
            }
          } else {
            logger.info('SPOOLER', 'Background printer hardware scan complete: No printer state or configuration changes detected. Skipped backend API request.');
          }
        }
      } catch (syncErr: any) {
        this.pendingReconciliation = true;
        logger.warn('SPOOLER', 'Printer backend sync notice during rescan', { error: syncErr?.message || syncErr });
      }

      return printers;
    } finally {
      this.notifyPrinterScanning(false);
    }
  }

  public async setPrinterRegistered(
    printerName: string,
    registered: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const config = localVault.getConfig();
    const printers = this.printerManager.getCachedPrinters();
    const printer = printers.find((item) => item.name === printerName);
    if (!printer || !printer.isOnline) return { success: false, error: 'Only an available physical printer can be registered.' };
    const entitlement = await this.apiClient.getPrinterEntitlements();
    if (!entitlement.success || entitlement.printerLimit === undefined) {
      return { success: false, error: entitlement.error || 'Could not verify the shop printer plan.' };
    }
    const existingNames = config.registeredPrinterNames || [];
    const ownRegisteredCount = entitlement.agentRegisteredCount ?? existingNames.length;
    const otherRegisteredCount = Math.max(0, (entitlement.registeredCount ?? ownRegisteredCount) - ownRegisteredCount);
    const agentCapacity = Math.max(0, entitlement.printerLimit - otherRegisteredCount);
    const current = existingNames.slice(0, agentCapacity);
    const alreadyRegistered = existingNames.includes(printerName);
    if (alreadyRegistered === registered && existingNames.length <= agentCapacity) return { success: true };
    const next = registered ? [...current, printerName] : current.filter((name) => name !== printerName);
    if (registered && next.length > agentCapacity) {
      return {
        success: false,
        error: `${entitlement.planName || 'Current'} plan has room for ${agentCapacity} printer(s) on this agent after other shop devices are counted.`
      };
    }

    // Call backend registration endpoint first to validate and persist
    const regResult = await this.apiClient.registerPrinter(printerName, registered);
    if (!regResult.success) {
      return { success: false, error: regResult.error || 'Backend rejected printer registration update.' };
    }

    localVault.saveConfig({
      registeredPrinterNames: next,
      printerLimit: entitlement.printerLimit,
      selectedPrinterName: next.includes(config.selectedPrinterName || '') ? config.selectedPrinterName : (next[0] || '')
    });
    this.apiClient.updateConfig(localVault.getConfig());

    // Trigger explicit sync to refresh backend and synced printer cache
    await this.rescanPrinters(true);
    return { success: true };
  }

  public async setPrinterEnabled(
    printerName: string,
    enabled: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const config = localVault.getConfig();
    const currentDisabled = new Set(config.disabledPrinterNames || []);
    if (enabled) {
      currentDisabled.delete(printerName);
    } else {
      currentDisabled.add(printerName);
    }
    const nextDisabled = Array.from(currentDisabled);
    localVault.saveConfig({ disabledPrinterNames: nextDisabled });
    this.apiClient.updateConfig(localVault.getConfig());

    // Trigger explicit sync to refresh backend and synced printer cache
    await this.rescanPrinters(true);
    return { success: true };
  }

  public async savePrinterOwnerConfig(
    printerName: string,
    ownerConfig: Partial<import('../../renderer/types/capabilities.js').OwnerPrinterConfiguration>
  ): Promise<{ success: boolean; config?: import('../../renderer/types/capabilities.js').StoredPrinterConfig; error?: string }> {
    try {
      const updated = localVault.updateOwnerConfig(printerName, ownerConfig);
      await this.apiClient.updatePrinterOwnerConfig(printerName, updated.owner, updated.effective);
      await this.rescanPrinters(true);
      return { success: true, config: updated };
    } catch (err: any) {
      logger.error('SPOOLER', `Failed saving owner config for "${printerName}": ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  public async resetPrinterConfig(
    printerName: string
  ): Promise<{ success: boolean; config?: import('../../renderer/types/capabilities.js').StoredPrinterConfig; error?: string }> {
    try {
      const reset = localVault.resetPrinterConfig(printerName);
      await this.apiClient.updatePrinterOwnerConfig(printerName, reset.owner, reset.effective);
      await this.rescanPrinters(true);
      return { success: true, config: reset };
    } catch (err: any) {
      logger.error('SPOOLER', `Failed resetting config for "${printerName}": ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  public async testPrint(printerName: string) {
    const config = localVault.getConfig();
    if (
      (config.disabledPrinterNames || []).includes(printerName) ||
      !(config.registeredPrinterNames || []).includes(printerName)
    ) {
      return { success: false, printerName, message: 'Register and enable this printer for the PrintFlow Agent before testing it.' };
    }
    return this.printerManager.executeTestPrint(printerName);
  }

  public async reprintJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    return this.queueManager.retryJob(jobId);
  }

  public cancelJob(jobId: string): { success: boolean; error?: string } {
    const ok = this.queueManager.cancelJob(jobId);
    return { success: ok, error: ok ? undefined : 'Job not found.' };
  }

  public async pairDevice(pairingData: {
    serverUrl: string;
    shopId: string;
    authToken: string;
    deviceName?: string;
  }): Promise<{ success: boolean; error?: string }> {
    this.configRevision++;
    this.pairingInProgress = true;
    try {
      const res = await this.apiClient.pairDevice(pairingData);
      if (!res.success) return { success: false, error: res.error };

      try {
        localVault.saveConfig({
          serverUrl: pairingData.serverUrl.trim().replace(/\/+$/, ''),
          shopId: res.shopId || pairingData.shopId,
          shopSlug: (res.shopId || pairingData.shopId).replace(/^shop_/, '').replace(/_/g, '-'),
          authToken: pairingData.authToken,
          agentId: res.agentId || '',
          deviceName: pairingData.deviceName || 'PrintFlow Counter'
        });
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unable to save credentials securely' };
      }

      const newConfig = localVault.getConfig();
      this.apiClient.updateConfig(newConfig);
      const entitlement = await this.apiClient.getPrinterEntitlements();
      if (!entitlement.success || entitlement.printerLimit === undefined) {
        return { success: false, error: entitlement.error || 'Could not verify the shop printer plan.' };
      }
      const discovered = this.printerManager.getCachedPrinters();
      const preferred = newConfig.selectedPrinterName || discovered.find((printer) => printer.isDefault && printer.isOnline)?.name;
      const registeredPrinterNames =
        newConfig.registeredPrinterNames ||
        (preferred && discovered.some((printer) => printer.name === preferred && printer.isOnline) ? [preferred] : []);
      localVault.saveConfig({ printerLimit: entitlement.printerLimit, registeredPrinterNames });
      this.apiClient.updateConfig(localVault.getConfig());
      this.configRevision++;
      this.pairingInProgress = false;
      this.startBackgroundLoops();
      const heartbeat = await this.triggerHeartbeat();
      if (!heartbeat.success) {
        return { success: false, error: 'Token was accepted during pairing, but the agent heartbeat could not be verified.' };
      }
      try {
        await this.rescanPrinters();
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Could not sync registered printers.' };
      }

      return { success: true };
    } finally {
      this.pairingInProgress = false;
    }
  }

  public updateConfig(partial: Partial<AgentConfig>): { success: boolean; error?: string } {
    try {
      localVault.saveConfig(partial);
      const newConfig = localVault.getConfig();
      this.apiClient.updateConfig(newConfig);
      this.configRevision++;
      this.startBackgroundLoops();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unable to save agent settings' };
    }
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    const result = await this.triggerHeartbeat();
    return result.success
      ? { success: true }
      : { success: false, error: 'Authenticated connection check failed. Check the backend URL and device credentials.' };
  }

  public async disconnectDevice(): Promise<{ success: boolean; error?: string }> {
    logger.info('AUTH', 'Initiating secure agent disconnect from shop...');
    try {
      const config = localVault.getConfig();
      if (config.authToken && config.agentId) {
        await this.apiClient.disconnectDevice();
      }
    } catch (err: any) {
      logger.warn('AUTH', `Backend disconnect notification error: ${err.message}`);
    }

    // Stop background polling and heartbeat loops
    this.stop();

    // Safely handle currently printing or downloading jobs: never mark unfinished job as completed!
    const activeJobs = localVault.getAllJobs().filter(
      (job) => job.printStatus === 'PRINTING' || job.printStatus === 'DOWNLOADING'
    );
    for (const job of activeJobs) {
      job.printStatus = 'REQUIRES_ATTENTION';
      job.errorMessage = 'Printing stopped: agent was disconnected from counter PC. Verify physical output.';
      job.updatedAt = new Date().toISOString();
      localVault.saveJob(job);
      logger.warn('SPOOLER', `Job ${job.id} interrupted due to agent disconnect; marked REQUIRES_ATTENTION.`);
    }

    try {
      localVault.resetConfig();
      this.apiClient.updateConfig(localVault.getConfig());
      this.configRevision++;
      this.setStatus('DISCONNECTED');
      logger.info('AUTH', 'Agent device disconnected successfully. Stored credentials purged.');
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unable to purge agent settings.' };
    }
  }

  public resetConfig(): { success: boolean; error?: string } {
    if (this.queueManager.isProcessingJob()) {
      return { success: false, error: 'Wait for the active download or print operation to finish before resetting settings.' };
    }
    try {
      this.stop();
      localVault.resetConfig();
      this.apiClient.updateConfig(localVault.getConfig());
      this.configRevision++;
      this.setStatus('OFFLINE');
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unable to reset agent settings.' };
    }
  }

  public async handleSessionReplaced(reason: string = 'This agent session has been replaced by another device.'): Promise<void> {
    logger.warn('AUTH', `Session handover detected: ${reason}. Halting active loops and safely stopping print processing.`);

    // 1. Immediately stop background polling and heartbeat loops
    this.stop();

    // 2. Safely handle currently printing/downloading jobs: never mark unfinished job as completed or blind reprint
    const activeJobs = localVault.getAllJobs().filter(
      (job) => job.printStatus === 'PRINTING' || job.printStatus === 'DOWNLOADING'
    );
    for (const job of activeJobs) {
      job.printStatus = 'REQUIRES_ATTENTION';
      job.errorMessage = 'Printing stopped: agent session was replaced by another device. Verify physical print output before resuming.';
      job.updatedAt = new Date().toISOString();
      localVault.saveJob(job);
      logger.warn('SPOOLER', `Job ${job.id} interrupted due to session handover; marked REQUIRES_ATTENTION.`);
    }

    // 3. Clear active auth credentials in local vault so old session cannot reconnect automatically
    localVault.saveConfig({
      authToken: '',
      hasStoredCredentials: false
    });
    this.apiClient.updateConfig(localVault.getConfig());
    this.configRevision++;

    // 4. Update status to REVOKED and save revocation message
    this.revocationReason = reason;
    this.setStatus('REVOKED');
  }

  public getStatus(): { status: AgentConnectionStatus; lastHeartbeat: string | null; error?: string } {
    return {
      status: this.currentStatus,
      lastHeartbeat: localVault.getLastHeartbeatAt(),
      error: this.currentStatus === 'REVOKED'
        ? (this.revocationReason || 'This agent session has been replaced by another device.')
        : undefined
    };
  }
}

export const agentService = PrintAgentService.getInstance();
