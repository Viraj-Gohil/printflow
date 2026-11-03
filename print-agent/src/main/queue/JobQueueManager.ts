import fs from 'fs';
import { PrintJobItem, PrinterQueueState, PrinterQueueItem } from '../../renderer/types/agent.js';
import { ApiClient } from '../api/ApiClient.js';
import { WindowsPrinterManager } from '../printer/WindowsPrinterManager.js';
import { localVault } from '../storage/LocalDataVault.js';
import { outboxManager } from '../storage/OutboxManager.js';
import { logger } from '../logger/AgentLogger.js';

export class JobQueueManager {
  private apiClient: ApiClient;
  private printerManager: WindowsPrinterManager;
  private activeJobs = new Map<string, PrintJobItem>(); // jobId -> job
  private printerProcessing = new Map<string, boolean>(); // printerName -> isProcessing
  private printerPaused = new Map<string, boolean>(); // printerName -> isPaused
  private physicalDeviceProcessing = new Map<string, string>(); // physicalDeviceId -> jobId
  private onJobUpdateListener?: (job: PrintJobItem) => void;
  private onQueueStateChangeListener?: (queues: PrinterQueueState[]) => void;
  private activeDownloadsCount = 0;
  private maxConcurrentDownloads = 3;

  constructor(apiClient: ApiClient, printerManager: WindowsPrinterManager) {
    this.apiClient = apiClient;
    this.printerManager = printerManager;
    outboxManager.setApiClient(apiClient);
  }

  public setOnJobUpdateListener(listener: (job: PrintJobItem) => void): void {
    this.onJobUpdateListener = listener;
  }

  public setOnQueueStateChangeListener(listener: (queues: PrinterQueueState[]) => void): void {
    this.onQueueStateChangeListener = listener;
  }

  public getPhysicalDeviceId(printerName: string): string {
    const cached = this.printerManager.getCachedPrinters().find((p) => p.name === printerName);
    if (cached) {
      const port = (cached.portName || '').trim().toUpperCase();
      const driver = (cached.driverName || '').trim().toUpperCase();
      if (port && port !== 'PORTPROMPT:' && port !== 'NUL:') {
        return `HW:${driver}:${port}`;
      }
    }
    return `PRN:${printerName.trim().toUpperCase()}`;
  }

  public reloadPendingJobs(): void {
    const allStored = localVault.getAllJobs();
    for (const job of allStored) {
      if (['QUEUED', 'ASSIGNED', 'DOWNLOADING', 'PRINTING', 'PAUSED'].includes(job.printStatus)) {
        if (job.printStatus === 'DOWNLOADING' || job.printStatus === 'PRINTING') {
          // If spooling was not confirmed, reset to QUEUED for safe retry
          if (!job.spoolSubmittedAt) {
            job.printStatus = 'QUEUED';
          } else {
            job.printStatus = 'AWAITING_RECONCILIATION';
            job.errorMessage = 'Agent restarted after spool submission; physical verification required.';
          }
        }
        this.activeJobs.set(job.id, job);
      }
    }
    this.notifyQueueStateChanged();
    void this.dispatchQueue();
  }

  public markManualAttention(job: PrintJobItem, message: string): void {
    job.printStatus = 'MANUAL_ATTENTION';
    job.retrySafe = false;
    job.errorMessage = message;
    job.updatedAt = new Date().toISOString();
    this.notify(job);
  }

  public isProcessingJob(): boolean {
    return Array.from(this.printerProcessing.values()).some((v) => v) || this.activeJobs.size > 0;
  }

  public pausePrinterQueue(printerName: string): boolean {
    const name = printerName.trim();
    this.printerPaused.set(name, true);
    logger.info('QUEUE', `Printer queue "${name}" was PAUSED by shop operator.`);
    
    // Mark waiting jobs for this printer as PAUSED
    for (const job of this.activeJobs.values()) {
      if (job.printerName === name && (job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED')) {
        job.printStatus = 'PAUSED';
        job.updatedAt = new Date().toISOString();
        localVault.saveJob(job);
      }
    }
    this.notifyQueueStateChanged();
    return true;
  }

  public resumePrinterQueue(printerName: string): boolean {
    const name = printerName.trim();
    this.printerPaused.set(name, false);
    logger.info('QUEUE', `Printer queue "${name}" was RESUMED.`);
    
    // Reset PAUSED jobs for this printer back to QUEUED
    for (const job of this.activeJobs.values()) {
      if (job.printerName === name && job.printStatus === 'PAUSED') {
        job.printStatus = 'QUEUED';
        job.updatedAt = new Date().toISOString();
        localVault.saveJob(job);
      }
    }
    this.notifyQueueStateChanged();
    void this.dispatchQueue();
    return true;
  }

  public isPrinterQueuePaused(printerName: string): boolean {
    return Boolean(this.printerPaused.get(printerName.trim()));
  }

  public getPrinterQueues(): PrinterQueueState[] {
    const config = localVault.getConfig();
    const registeredNames = config.registeredPrinterNames || [];
    const discoveredPrinters = this.printerManager.getCachedPrinters();
    const allStoredJobs = localVault.getAllJobs();

    // Include registered printers + any cached printers
    const targetPrinters = discoveredPrinters.filter(p => registeredNames.includes(p.name) || registeredNames.length === 0);

    return targetPrinters.map((printer) => {
      const isPaused = Boolean(this.printerPaused.get(printer.name));
      const physicalDeviceId = this.getPhysicalDeviceId(printer.name);
      
      const printerJobs = Array.from(this.activeJobs.values()).filter(j => j.printerName === printer.name);
      
      const currentJob = printerJobs.find(j => 
        j.printStatus === 'PRINTING' || j.printStatus === 'DOWNLOADING' || j.printStatus === 'SUBMITTED_TO_SPOOLER'
      );

      const waitingJobsList = printerJobs
        .filter(j => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED' || j.printStatus === 'PAUSED')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const waitingQueue: PrinterQueueItem[] = waitingJobsList.map((job, idx) => ({
        queuePosition: idx + 1,
        job
      }));

      const completedCount = allStoredJobs.filter(j => j.printerName === printer.name && j.printStatus === 'COMPLETED').length;
      const failedCount = allStoredJobs.filter(j => j.printerName === printer.name && (j.printStatus === 'FAILED' || j.printStatus === 'CANCELLED')).length;

      let status: 'READY' | 'PRINTING' | 'OFFLINE' | 'PAUSED' | 'BUSY' | 'ERROR' = 'READY';
      if (!printer.isOnline || printer.status === 'OFFLINE') {
        status = 'OFFLINE';
      } else if (isPaused) {
        status = 'PAUSED';
      } else if (currentJob) {
        status = 'PRINTING';
      } else if (printer.status === 'BUSY' || printer.status === 'ERROR') {
        status = printer.status;
      }

      return {
        printerName: printer.name,
        displayName: printer.displayName || printer.name,
        isOnline: printer.isOnline,
        status,
        isQueuePaused: isPaused,
        physicalDeviceId,
        capabilities: {
          paperSizes: printer.capabilities?.paperSizes || ['A4'],
          supportsColor: printer.capabilities?.supportsColor ?? null,
          supportsDuplex: printer.capabilities?.supportsDuplex ?? null
        },
        currentJob,
        waitingQueue,
        completedCount,
        failedCount
      };
    });
  }

  private notifyQueueStateChanged(): void {
    if (this.onQueueStateChangeListener) {
      try {
        const queues = this.getPrinterQueues();
        this.onQueueStateChangeListener(queues);
      } catch {
        // Ignore listener errors
      }
    }
  }

  private notify(job: PrintJobItem): void {
    localVault.saveJob(job);
    this.notifyQueueStateChanged();
    if (this.onJobUpdateListener) {
      try {
        this.onJobUpdateListener(job);
      } catch {
        // Ignore IPC listener error
      }
    }
  }

  public enqueueJob(job: PrintJobItem): void {
    const existing = this.activeJobs.get(job.id);
    if (!existing || existing.printStatus !== 'COMPLETED') {
      this.activeJobs.set(job.id, job);
      this.notify(job);
      void this.dispatchQueue();
    }
  }

  public enqueueJobs(jobs: PrintJobItem[]): void {
    for (const j of jobs) {
      this.enqueueJob(j);
    }
  }

  /**
   * Smart Automatic Load Balancing routing algorithm:
   * Selects best eligible online registered printer based on strategy,
   * capabilities, availability, pause state, and least estimated workload.
   */
  private selectEligiblePrinter(job: PrintJobItem): string | null {
    const config = localVault.getConfig();
    const registeredNames = config.registeredPrinterNames || [];
    const disabledNames = config.disabledPrinterNames || [];
    const lbEnabled = config.loadBalancingEnabled !== false;
    const strategy = config.loadBalancingStrategy || 'CAPABILITY_LEAST_WORKLOAD';

    const availablePrinters = this.printerManager.getCachedPrinters().filter((printer) =>
      printer.isOnline &&
      registeredNames.includes(printer.name) &&
      !disabledNames.includes(printer.name) &&
      !this.printerPaused.get(printer.name) &&
      printer.status !== 'OFFLINE'
    );

    if (availablePrinters.length === 0) return null;

    // 1. Comprehensive capability compatibility check
    const canPrintJob = (printer: (typeof availablePrinters)[number]) =>
      job.files.every((file) => {
        const requestedSize = (file.paperSize || 'A4').toUpperCase();
        const printerSizes = (printer.capabilities.paperSizes || ['A4']).map((s) => s.toUpperCase());
        const sizeMatches = printerSizes.length === 0 || printerSizes.includes(requestedSize);
        const colorMatches = file.colorMode !== 'COLOR' || printer.capabilities.supportsColor !== false;
        const duplexMatches = !file.duplex || printer.capabilities.supportsDuplex !== false;
        return sizeMatches && colorMatches && duplexMatches;
      });

    const compatiblePrinters = availablePrinters.filter(canPrintJob);
    if (compatiblePrinters.length === 0) return null;

    // If load balancing is disabled or strategy is MANUAL, prioritize selectedPrinterName if compatible
    if (!lbEnabled || strategy === 'MANUAL_ASSIGNMENT') {
      if (config.selectedPrinterName) {
        const preferred = compatiblePrinters.find((p) => p.name === config.selectedPrinterName);
        if (preferred) {
          job.assignmentReason = `Assigned to preferred printer "${preferred.name}" (Manual Assignment).`;
          return preferred.name;
        }
      }
    }

    // Calculate active job counts and pending workload pages for each compatible printer
    const printerWorkloadPages = new Map<string, number>();
    const printerJobCounts = new Map<string, number>();
    for (const p of compatiblePrinters) {
      printerWorkloadPages.set(p.name, 0);
      printerJobCounts.set(p.name, 0);
    }

    for (const j of this.activeJobs.values()) {
      if (j.printerName && printerWorkloadPages.has(j.printerName) && ['PRINTING', 'DOWNLOADING', 'ASSIGNED', 'QUEUED'].includes(j.printStatus)) {
        const pages = j.files.reduce((acc, f) => acc + ((f.pageCount || 1) * (f.copies || 1)), 0);
        printerWorkloadPages.set(j.printerName, (printerWorkloadPages.get(j.printerName) || 0) + pages);
        printerJobCounts.set(j.printerName, (printerJobCounts.get(j.printerName) || 0) + 1);
      }
    }

    // Sort compatible printers according to selected load balancing strategy
    compatiblePrinters.sort((a, b) => {
      const workloadA = printerWorkloadPages.get(a.name) || 0;
      const workloadB = printerWorkloadPages.get(b.name) || 0;
      const countA = printerJobCounts.get(a.name) || 0;
      const countB = printerJobCounts.get(b.name) || 0;

      if (strategy === 'LEAST_QUEUE') {
        if (countA !== countB) return countA - countB;
        if (workloadA !== workloadB) return workloadA - workloadB;
      } else if (strategy === 'LEAST_WORKLOAD') {
        if (workloadA !== workloadB) return workloadA - workloadB;
        if (countA !== countB) return countA - countB;
      } else if (strategy === 'FASTEST_AVAILABLE') {
        const isReadyA = a.status === 'READY' ? 0 : 1;
        const isReadyB = b.status === 'READY' ? 0 : 1;
        if (isReadyA !== isReadyB) return isReadyA - isReadyB;
        if (workloadA !== workloadB) return workloadA - workloadB;
      } else {
        // Default: CAPABILITY_LEAST_WORKLOAD
        if (workloadA !== workloadB) return workloadA - workloadB;
        if (countA !== countB) return countA - countB;
      }

      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });

    const selected = compatiblePrinters[0];
    if (selected) {
      const wLoad = printerWorkloadPages.get(selected.name) || 0;
      const qCount = printerJobCounts.get(selected.name) || 0;
      const colorDesc = selected.capabilities.supportsColor ? 'Colour' : 'B&W';
      const paperDesc = selected.capabilities.paperSizes?.join(', ') || 'A4';
      job.assignmentReason = `Assigned to "${selected.name}" (${colorDesc}, ${paperDesc}) using ${strategy} strategy (Active Queue: ${qCount} jobs, Workload: ${wLoad} pages).`;
    }

    return selected?.name || null;
  }

  /**
   * Dispatches pending jobs to their respective printer queues concurrently.
   */
  public async dispatchQueue(): Promise<void> {
    const pendingJobs = Array.from(this.activeJobs.values()).filter(
      (j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED'
    );

    if (pendingJobs.length === 0) return;

    for (const job of pendingJobs) {
      const printerName = this.selectEligiblePrinter(job);
      if (!printerName) continue; // Keep queued until a compatible printer comes online

      job.printerName = printerName;
      if (!this.printerProcessing.get(printerName) && !this.printerPaused.get(printerName)) {
        this.printerProcessing.set(printerName, true);
        void this.processPrinterQueue(printerName);
      }
    }
  }

  /**
   * Processes the queue for a specific printer sequentially (concurrency = 1 per physical printer)
   * while allowing other physical printers to run concurrently.
   */
  private async processPrinterQueue(printerName: string): Promise<void> {
    try {
      while (true) {
        if (this.printerPaused.get(printerName)) break;

        // Find next queued job assigned to this printer
        const nextJob = Array.from(this.activeJobs.values()).find(
          (j) => (j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED') && j.printerName === printerName
        );

        if (!nextJob) break;

        await this.executeJobProcessing(nextJob, printerName);
      }
    } finally {
      this.printerProcessing.set(printerName, false);
      this.notifyQueueStateChanged();
    }
  }

  private async executeJobProcessing(job: PrintJobItem, printerName: string): Promise<void> {
    logger.info('AGENT', `Starting processing for print order ${job.id} on printer "${printerName}"`);
    const tempFilePaths: string[] = [];
    let spoolAttempted = false;
    const physicalId = this.getPhysicalDeviceId(printerName);

    // Enforce physical-device lock across logical printer aliases
    while (this.physicalDeviceProcessing.has(physicalId) && this.physicalDeviceProcessing.get(physicalId) !== job.id) {
      logger.info('QUEUE', `Physical hardware "${physicalId}" is active; waiting for lock release...`);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    this.physicalDeviceProcessing.set(physicalId, job.id);

    try {
      // 1. Claim on cloud backend atomically if not already claimed
      if (job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED') {
        const claimResult = await this.apiClient.claimJob(job.id);
        if (!claimResult.success) {
          logger.warn('AGENT', `Could not claim job ${job.id} from cloud: ${claimResult.error}`);
          this.activeJobs.delete(job.id);
          return;
        }
        if (claimResult.job) Object.assign(job, claimResult.job);
      }

      // 2. Mark DOWNLOADING
      job.printStatus = 'DOWNLOADING';
      job.downloadProgress = 0;
      job.printerName = printerName;
      job.updatedAt = new Date().toISOString();
      this.notify(job);

      outboxManager.enqueue({
        jobId: job.id,
        eventType: 'document_download_started',
        status: 'DOWNLOADING',
        printerName
      });

      if (!job.files || job.files.length === 0) throw new Error('Print job contains no documents.');

      // 3. Throttle concurrent downloads to prevent memory exhaustion
      while (this.activeDownloadsCount >= this.maxConcurrentDownloads) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      this.activeDownloadsCount++;
      try {
        for (let i = 0; i < job.files.length; i++) {
          const file = job.files[i];
          const downloadResult = await this.apiClient.downloadDocument(job.id, file.downloadUrl || file.fileUrl);
          if (!downloadResult.success || !downloadResult.filePath) {
            throw new Error(downloadResult.error || `Failed to download ${file.fileName}.`);
          }
          tempFilePaths.push(downloadResult.filePath);

          const exists = fs.existsSync(downloadResult.filePath);
          const sizeBytes = exists ? fs.statSync(downloadResult.filePath).size : 0;
          logger.info('AGENT', `Downloaded & verified document local storage for ${job.id}:`, {
            originalFileName: file.fileName,
            absoluteFilePath: downloadResult.filePath,
            sizeBytes,
            fileExistsBeforePrinting: exists
          });

          job.downloadProgress = Math.round(((i + 1) / job.files.length) * 100);
          this.notify(job);
        }
      } finally {
        this.activeDownloadsCount--;
      }

      outboxManager.enqueue({
        jobId: job.id,
        eventType: 'document_download_completed',
        status: 'DOWNLOADING',
        printerName
      });

      // 4. Mark PRINTING (Spooling to Windows Printer)
      job.printStatus = 'PRINTING';
      job.printProgress = undefined;
      job.updatedAt = new Date().toISOString();
      this.notify(job);

      outboxManager.enqueue({
        jobId: job.id,
        eventType: 'print_submission_started',
        status: 'PRINTING',
        printerName
      });

      const config = localVault.getConfig();
      let pagesPrinted = 0;

      for (let i = 0; i < job.files.length; i++) {
        const file = job.files[i];
        const spoolResult = await this.printerManager.spoolJob(
          file,
          tempFilePaths[i],
          printerName,
          config.spoolerTimeoutMs
        );
        spoolAttempted = spoolAttempted || spoolResult.submitted;
        if (spoolResult.spoolerJobId) {
          job.spoolerJobId = spoolResult.spoolerJobId;
        }

        if (!spoolResult.success && !spoolResult.submitted) {
          throw new Error(spoolResult.error || `Windows spooler rejected ${file.fileName}.`);
        }
        pagesPrinted += file.pageCount * file.copies;
      }

      // 5. Physical print succeeded! Immediately persist completion locally
      job.spoolSubmittedAt = new Date().toISOString();
      job.printStatus = 'COMPLETED';
      job.errorMessage = undefined;
      job.retrySafe = false;
      job.pagesPrinted = pagesPrinted;
      job.updatedAt = new Date().toISOString();
      this.notify(job);

      // Queue durable status synchronization to backend
      outboxManager.enqueue({
        jobId: job.id,
        eventType: 'spooler_job_completed',
        status: 'COMPLETED',
        spoolerJobId: job.spoolerJobId,
        printerName,
        retrySafe: false,
        pagesPrinted
      });

      logger.info('AGENT', `Physical printing successfully completed for job ${job.id} on "${printerName}". Spooler Job ID: ${job.spoolerJobId || 'assigned'}`);
      this.activeJobs.delete(job.id);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown print error';
      logger.error('AGENT', `Print pipeline error for job ${job.id} on "${printerName}": ${errorMessage}`);

      if (spoolAttempted) {
        job.printStatus = 'AWAITING_RECONCILIATION';
        job.errorMessage = `Document submitted to printer. Verification required: ${errorMessage}`;
        job.retrySafe = false;
      } else {
        job.printStatus = 'FAILED';
        job.errorMessage = errorMessage;
        job.retrySafe = true;
      }

      job.updatedAt = new Date().toISOString();
      this.notify(job);

      // Enqueue the terminal status into outbox
      outboxManager.enqueue({
        jobId: job.id,
        eventType: spoolAttempted ? 'spooler_submission_accepted' : 'backend_status_sync_failed',
        status: job.printStatus,
        spoolerJobId: job.spoolerJobId,
        errorMessage: job.errorMessage,
        printerName,
        retrySafe: job.retrySafe
      });

      if (spoolAttempted) {
        this.activeJobs.delete(job.id); // Prevent re-execution loop
      }
    } finally {
      if (this.physicalDeviceProcessing.get(physicalId) === job.id) {
        this.physicalDeviceProcessing.delete(physicalId);
      }
      // Clean up temp files safely
      for (const filePath of tempFilePaths) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info('AGENT', `Deleted temporary spool file after print execution: ${filePath}`);
          }
        } catch (unlinkErr: any) {
          logger.warn('AGENT', `Notice during temp file deletion (${filePath}): ${unlinkErr?.message || unlinkErr}`);
        }
      }
    }
  }

  public async retryJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    const job = localVault.getJob(jobId) || this.activeJobs.get(jobId);
    if (!job || job.printStatus !== 'FAILED' || job.retrySafe !== true) {
      return { success: false, error: 'Job is not eligible for retry. Only failures before printing can be retried safely.' };
    }

    const reset = await this.apiClient.updateJobStatus(job.id, 'QUEUED', undefined, undefined, true);
    if (!reset.success) {
      return { success: false, error: reset.error || 'Backend could not return job to queue.' };
    }

    job.printStatus = 'QUEUED';
    job.errorMessage = undefined;
    job.retrySafe = undefined;
    job.retryCount = (job.retryCount || 0) + 1;
    job.updatedAt = new Date().toISOString();
    this.activeJobs.set(job.id, job);
    this.enqueueJob(job);
    return { success: true };
  }

  public cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId) || localVault.getJob(jobId);
    if (!job || !['QUEUED', 'ASSIGNED'].includes(job.printStatus)) return false;

    job.printStatus = 'CANCELLED';
    job.errorMessage = 'Cancelled by shop operator at desktop terminal.';
    job.updatedAt = new Date().toISOString();
    this.notify(job);
    this.activeJobs.delete(jobId);
    return true;
  }
}
