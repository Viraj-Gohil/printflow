import fs from 'fs';
import { PrintJobItem } from '../../renderer/types/agent.js';
import { ApiClient } from '../api/ApiClient.js';
import { WindowsPrinterManager } from '../printer/WindowsPrinterManager.js';
import { localVault } from '../storage/LocalDataVault.js';
import { logger } from '../logger/AgentLogger.js';

export class JobQueueManager {
  private apiClient: ApiClient;
  private printerManager: WindowsPrinterManager;
  private isProcessing = false;
  private queue: PrintJobItem[] = [];
  private onJobUpdateListener?: (job: PrintJobItem) => void;

  constructor(apiClient: ApiClient, printerManager: WindowsPrinterManager) {
    this.apiClient = apiClient;
    this.printerManager = printerManager;
    // Load existing queued jobs from local storage
    this.queue = localVault.getAllJobs().filter((j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED');
  }

  public setOnJobUpdateListener(listener: (job: PrintJobItem) => void): void {
    this.onJobUpdateListener = listener;
  }

  public reloadPendingJobs(): void {
    this.queue = localVault.getAllJobs().filter((job) =>
      job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED'
    );
    void this.processNext();
  }

  public markManualAttention(job: PrintJobItem, message: string): void {
    job.printStatus = 'MANUAL_ATTENTION';
    job.retrySafe = false;
    job.errorMessage = message;
    job.updatedAt = new Date().toISOString();
    this.notify(job);
  }

  public isProcessingJob(): boolean {
    return this.isProcessing;
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
    const existingIndex = this.queue.findIndex((j) => j.id === job.id);
    if (existingIndex >= 0) {
      this.queue[existingIndex] = job;
    } else {
      this.queue.push(job);
    }
    this.notify(job);
    this.processNext();
  }

  public enqueueJobs(jobs: PrintJobItem[]): void {
    for (const j of jobs) {
      this.enqueueJob(j);
    }
  }

  public async processNext(): Promise<void> {
    if (this.isProcessing) return;

    // Find next pending job
    const nextJob = this.queue.find((j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED');
    if (!nextJob) return;

    this.isProcessing = true;
    logger.info('AGENT', `Starting processing for print order: ${nextJob.id}`);

    const tempFilePaths: string[] = [];
    let spoolAttempted = false;

    try {
      // 1. Claim on cloud backend if not already claimed
      if (nextJob.printStatus === 'QUEUED') {
        const claimResult = await this.apiClient.claimJob(nextJob.id);
        if (!claimResult.success) {
          logger.warn('AGENT', `Could not claim job ${nextJob.id} from cloud: ${claimResult.error}`);
          this.queue = this.queue.filter((job) => job.id !== nextJob.id);
          return;
        }
        if (claimResult.job) Object.assign(nextJob, claimResult.job);
      }

      // 2. Mark DOWNLOADING
      nextJob.printStatus = 'DOWNLOADING';
      nextJob.downloadProgress = undefined;
      nextJob.updatedAt = new Date().toISOString();
      this.notify(nextJob);
      const downloading = await this.apiClient.updateJobStatus(nextJob.id, 'DOWNLOADING');
      if (!downloading.success) throw new Error(downloading.error || 'Could not persist the downloading status.');

      if (nextJob.files.length === 0) throw new Error('Print job contains no documents.');

      // 4. Download every document before submitting any of them to the spooler.
      const config = localVault.getConfig();
      const registeredPrinterNames = config.registeredPrinterNames || [];
      const disabledPrinterNames = config.disabledPrinterNames || [];
      const availablePrinters = this.printerManager.getCachedPrinters().filter((printer) =>
        printer.isOnline &&
        registeredPrinterNames.includes(printer.name) &&
        !disabledPrinterNames.includes(printer.name)
      );
      const canPrintJob = (printer: (typeof availablePrinters)[number]) => nextJob.files.every((file) =>
        (file.colorMode !== 'COLOR' || printer.capabilities.supportsColor !== false) &&
        (!file.duplex || printer.capabilities.supportsDuplex !== false) &&
        (printer.capabilities.paperSizes.length === 0 || printer.capabilities.paperSizes.includes(file.paperSize))
      );
      const compatiblePrinters = availablePrinters.filter(canPrintJob);
      nextJob.printerName =
        (config.selectedPrinterName && compatiblePrinters.some((printer) => printer.name === config.selectedPrinterName)
          ? config.selectedPrinterName
          : compatiblePrinters[0]?.name);
      if (!nextJob.printerName) {
        throw new Error('No enabled, registered, online printer supports all of this order’s requested settings.');
      }
      for (const file of nextJob.files) {
        const downloadResult = await this.apiClient.downloadDocument(
          nextJob.id,
          file.downloadUrl || file.fileUrl
        );
        if (!downloadResult.success || !downloadResult.filePath) {
          throw new Error(downloadResult.error || `Failed to download ${file.fileName} from cloud storage.`);
        }
        tempFilePaths.push(downloadResult.filePath);
        nextJob.downloadProgress = Math.round((tempFilePaths.length / nextJob.files.length) * 100);
        this.notify(nextJob);
      }

      // 5. Mark PRINTING and submit each document from the paid order.
      nextJob.printStatus = 'PRINTING';
      nextJob.printProgress = undefined;
      nextJob.updatedAt = new Date().toISOString();
      this.notify(nextJob);
      const printing = await this.apiClient.updateJobStatus(nextJob.id, 'PRINTING', undefined, nextJob.printerName);
      if (!printing.success) throw new Error(printing.error || 'Could not persist the printing status.');
      let pagesPrinted = 0;
      for (let index = 0; index < nextJob.files.length; index++) {
        const file = nextJob.files[index];
        const spoolResult = await this.printerManager.spoolJob(
          file,
          tempFilePaths[index],
          nextJob.printerName,
          config.spoolerTimeoutMs
        );
        spoolAttempted = spoolAttempted || spoolResult.submitted;
        if (!spoolResult.success) {
          throw new Error(spoolResult.error || `Windows printer spooler rejected ${file.fileName}.`);
        }
        pagesPrinted += file.pageCount * file.copies;
      }

      // 6. Mark COMPLETED
      nextJob.printStatus = 'COMPLETED';
      nextJob.printProgress = undefined;
      nextJob.errorMessage = undefined;
      nextJob.retrySafe = false;
      nextJob.pagesPrinted = pagesPrinted;
      nextJob.updatedAt = new Date().toISOString();
      this.notify(nextJob);
      const completed = await this.apiClient.updateJobStatus(
        nextJob.id,
        'COMPLETED',
        undefined,
        nextJob.printerName,
        false,
        pagesPrinted
      );
      if (!completed.success) throw new Error(completed.error || 'Could not persist the completed print outcome.');
      logger.info('AGENT', `Successfully completed physical print job: ${nextJob.id}`);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown print operation error';
      logger.error('AGENT', `Failed to execute print job ${nextJob.id}: ${errorMessage}`);
      nextJob.printStatus = spoolAttempted ? 'MANUAL_ATTENTION' : 'FAILED';
      nextJob.errorMessage = spoolAttempted
        ? `Print outcome may be uncertain. Check printer output before reprinting. ${errorMessage}`
        : errorMessage;
      nextJob.retrySafe = !spoolAttempted;
      nextJob.updatedAt = new Date().toISOString();
      this.notify(nextJob);
      const reported = await this.apiClient.updateJobStatus(
        nextJob.id,
        spoolAttempted ? 'REQUIRES_ATTENTION' : 'FAILED',
        nextJob.errorMessage,
        nextJob.printerName,
        !spoolAttempted
      );
      if (!reported.success) {
        logger.error('NETWORK', `Could not persist the failure outcome for job ${nextJob.id}: ${reported.error || 'backend rejected the update'}`);
      }
    } finally {
      // Clean up temporary local spool file
      for (const tempFilePath of tempFilePaths) {
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch (error) {
          logger.warn('STORAGE', `Could not remove staged print document ${tempFilePath}`, {
            error: error instanceof Error ? error.message : 'Unknown cleanup error'
          });
        }
      }

      this.isProcessing = false;
      // Continue next job in queue with brief cooling pause
      setTimeout(() => this.processNext(), 800);
    }
  }

  public async retryJob(jobId: string): Promise<{ success: boolean; error?: string }> {
    const job = localVault.getJob(jobId);
    if (!job || job.printStatus !== 'FAILED' || job.retrySafe !== true) {
      return { success: false, error: 'This job is not eligible for retry. Only failures known to occur before printing can be retried safely.' };
    }

    const reset = await this.apiClient.updateJobStatus(job.id, 'QUEUED', undefined, undefined, true);
    if (!reset.success) {
      return { success: false, error: reset.error || 'The backend could not safely return this job to the queue.' };
    }

    job.printStatus = 'QUEUED';
    job.errorMessage = undefined;
    job.retrySafe = undefined;
    job.retryCount = (job.retryCount || 0) + 1;
    job.updatedAt = new Date().toISOString();
    this.enqueueJob(job);
    return { success: true };
  }

  public cancelJob(jobId: string): boolean {
    const job = localVault.getJob(jobId);
    if (!job || (job.printStatus !== 'QUEUED' && job.printStatus !== 'ASSIGNED')) return false;

    job.printStatus = 'CANCELLED';
    job.errorMessage = 'Cancelled by shop operator at desktop terminal.';
    job.updatedAt = new Date().toISOString();
    this.notify(job);

    // Remove from in-memory processing queue
    this.queue = this.queue.filter((j) => j.id !== jobId);
    return true;
  }
}
