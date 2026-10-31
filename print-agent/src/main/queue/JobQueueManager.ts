import fs from 'fs';
import { PrintJobItem } from '../../renderer/types/agent.js';
import { ApiClient } from '../api/ApiClient.js';
import { WindowsPrinterManager } from '../printer/WindowsPrinterManager.js';
import { localVault } from '../storage/LocalDataVault.js';
import { logger } from '../logger/AgentLogger.js';

export class JobQueueManager {
  private apiClient: ApiClient;
  private printerManager: WindowsPrinterManager;
  private activeJobs = new Map<string, PrintJobItem>(); // jobId -> job
  private printerProcessing = new Map<string, boolean>(); // printerName -> isProcessing
  private onJobUpdateListener?: (job: PrintJobItem) => void;
  private activeDownloadsCount = 0;
  private maxConcurrentDownloads = 3;

  // Runtime queue begins empty; authoritative jobs are reconciled from Neon on startup
  constructor(apiClient: ApiClient, printerManager: WindowsPrinterManager) {
    this.apiClient = apiClient;
    this.printerManager = printerManager;
  }

  public setOnJobUpdateListener(listener: (job: PrintJobItem) => void): void {
    this.onJobUpdateListener = listener;
  }

  public reloadPendingJobs(): void {
    const allStored = localVault.getAllJobs();
    for (const job of allStored) {
      if (job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED' || job.printStatus === 'DOWNLOADING') {
        if (job.printStatus === 'DOWNLOADING') {
          job.printStatus = 'QUEUED'; // Reset interrupted download safely
        }
        this.activeJobs.set(job.id, job);
      }
    }
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

  private notify(job: PrintJobItem): void {
    localVault.saveJob(job);
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
   * Intelligent printer routing: selects best eligible online registered printer
   * based on capabilities (color, paper size, duplex) and queue load.
   */
  private selectEligiblePrinter(job: PrintJobItem): string | null {
    const config = localVault.getConfig();
    const registeredNames = config.registeredPrinterNames || [];
    const disabledNames = config.disabledPrinterNames || [];

    const availablePrinters = this.printerManager.getCachedPrinters().filter((printer) =>
      printer.isOnline &&
      registeredNames.includes(printer.name) &&
      !disabledNames.includes(printer.name)
    );

    if (availablePrinters.length === 0) return null;

    // Check capability match for all files in order
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

    // If configured preferred selected printer is compatible and online, prefer it
    if (config.selectedPrinterName && compatiblePrinters.some((p) => p.name === config.selectedPrinterName)) {
      return config.selectedPrinterName;
    }

    // Otherwise, pick the compatible printer with the fewest active jobs assigned to it
    const printerJobCounts = new Map<string, number>();
    for (const p of compatiblePrinters) printerJobCounts.set(p.name, 0);

    for (const j of this.activeJobs.values()) {
      if (j.printerName && printerJobCounts.has(j.printerName) && ['PRINTING', 'DOWNLOADING', 'ASSIGNED'].includes(j.printStatus)) {
        printerJobCounts.set(j.printerName, (printerJobCounts.get(j.printerName) || 0) + 1);
      }
    }

    // Sort by lowest queue count, then default priority
    compatiblePrinters.sort((a, b) => {
      const countA = printerJobCounts.get(a.name) || 0;
      const countB = printerJobCounts.get(b.name) || 0;
      if (countA !== countB) return countA - countB;
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return 0;
    });

    return compatiblePrinters[0]?.name || null;
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
      if (!this.printerProcessing.get(printerName)) {
        this.printerProcessing.set(printerName, true);
        void this.processPrinterQueue(printerName);
      }
    }
  }

  /**
   * Processes the queue for a specific printer sequentially (concurrency = 1 per physical printer)
   * while allowing other printers to run concurrently.
   */
  private async processPrinterQueue(printerName: string): Promise<void> {
    try {
      while (true) {
        // Find next queued job assigned to this printer
        const nextJob = Array.from(this.activeJobs.values()).find(
          (j) => (j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED') && j.printerName === printerName
        );

        if (!nextJob) break;

        await this.executeJobProcessing(nextJob, printerName);
      }
    } finally {
      this.printerProcessing.set(printerName, false);
    }
  }

  private async executeJobProcessing(job: PrintJobItem, printerName: string): Promise<void> {
    logger.info('AGENT', `Starting processing for print order ${job.id} on printer "${printerName}"`);
    const tempFilePaths: string[] = [];
    let spoolAttempted = false;

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

      const downloading = await this.apiClient.updateJobStatus(job.id, 'DOWNLOADING', undefined, printerName);
      if (!downloading.success) throw new Error(downloading.error || 'Could not persist downloading status.');

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

      // 4. Mark PRINTING (Spooling to Windows Printer)
      job.printStatus = 'PRINTING';
      job.printProgress = undefined;
      job.updatedAt = new Date().toISOString();
      this.notify(job);

      const printing = await this.apiClient.updateJobStatus(job.id, 'PRINTING', undefined, printerName);
      if (!printing.success) throw new Error(printing.error || 'Could not persist printing status.');

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
        if (!spoolResult.success) {
          throw new Error(spoolResult.error || `Windows spooler rejected ${file.fileName}.`);
        }
        pagesPrinted += file.pageCount * file.copies;
      }

      // 5. Mark COMPLETED
      job.printStatus = 'COMPLETED';
      job.errorMessage = undefined;
      job.retrySafe = false;
      job.pagesPrinted = pagesPrinted;
      job.updatedAt = new Date().toISOString();
      this.notify(job);

      const completed = await this.apiClient.updateJobStatus(
        job.id,
        'COMPLETED',
        undefined,
        printerName,
        false,
        pagesPrinted
      );
      if (!completed.success) throw new Error(completed.error || 'Could not persist completed print outcome.');

      logger.info('AGENT', `Successfully completed physical print job ${job.id} on "${printerName}"`);
      this.activeJobs.delete(job.id);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown print error';
      logger.error('AGENT', `Failed print job ${job.id} on "${printerName}": ${errorMessage}`);

      job.printStatus = spoolAttempted ? 'MANUAL_ATTENTION' : 'FAILED';
      job.errorMessage = spoolAttempted
        ? `Print outcome uncertain. Check printer output before reprinting. ${errorMessage}`
        : errorMessage;
      job.retrySafe = !spoolAttempted;
      job.updatedAt = new Date().toISOString();
      this.notify(job);

      await this.apiClient.updateJobStatus(
        job.id,
        spoolAttempted ? 'REQUIRES_ATTENTION' : 'FAILED',
        job.errorMessage,
        printerName,
        !spoolAttempted
      ).catch(() => {});

      if (spoolAttempted) {
        this.activeJobs.delete(job.id); // Remove from queue if attention is required to prevent loop
      }
    } finally {
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
