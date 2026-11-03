import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { JobPrintStatus } from '../../renderer/types/agent.js';
import { ApiClient } from '../api/ApiClient.js';
import { logger } from '../logger/AgentLogger.js';

const require = createRequire(import.meta.url);
let app: any = null;
try {
  const electron = require('electron');
  app = electron?.app || null;
} catch {
  app = null;
}

export type OutboxEventType =
  | 'document_download_started'
  | 'document_download_completed'
  | 'printer_queue_started'
  | 'print_submission_started'
  | 'spooler_submission_accepted'
  | 'spooler_job_id_received'
  | 'spooler_job_completed'
  | 'backend_status_sync_failed'
  | 'reconciliation_completed'
  | 'status_sync';

export interface OutboxItem {
  id: string;
  jobId: string;
  eventType: OutboxEventType;
  status: JobPrintStatus | 'QUEUED' | 'DOWNLOADING' | 'PRINTING' | 'SUBMITTED_TO_SPOOLER' | 'COMPLETED' | 'FAILED' | 'REQUIRES_ATTENTION' | 'AWAITING_RECONCILIATION';
  spoolerJobId?: string | number;
  printerName?: string;
  errorMessage?: string;
  retrySafe?: boolean;
  pagesPrinted?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  nextAttemptAt: number;
  attemptCount: number;
}

export class OutboxManager {
  private static instance: OutboxManager;
  private filePath: string;
  private items: Map<string, OutboxItem> = new Map();
  private apiClient: ApiClient | null = null;
  private isFlushing = false;
  private timer: NodeJS.Timeout | null = null;

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
      } catch {}
    }

    this.filePath = path.join(basePath, 'status_outbox.json');
    this.loadFromDisk();
  }

  public static getInstance(): OutboxManager {
    if (!OutboxManager.instance) {
      OutboxManager.instance = new OutboxManager();
    }
    return OutboxManager.instance;
  }

  public setApiClient(client: ApiClient): void {
    this.apiClient = client;
    this.startWorker();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.items.clear();
          for (const item of list) {
            this.items.set(item.id, item);
          }
          logger.info('STORAGE', `Loaded ${this.items.size} pending status outbox items from disk.`);
        }
      }
    } catch (err: any) {
      logger.error('STORAGE', `Failed to load outbox from ${this.filePath}: ${err?.message || err}`);
    }
  }

  private saveToDisk(): void {
    try {
      const list = Array.from(this.items.values());
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(list, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err: any) {
      logger.error('STORAGE', `Failed to save outbox to ${this.filePath}: ${err?.message || err}`);
    }
  }

  /**
   * Enqueue a durable status update event for backend synchronization.
   */
  public enqueue(item: Omit<OutboxItem, 'id' | 'createdAt' | 'nextAttemptAt' | 'attemptCount'>): OutboxItem {
    const fullItem: OutboxItem = {
      ...item,
      id: `${item.jobId}_${item.status}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      nextAttemptAt: Date.now(), // eligible immediately
      attemptCount: 0
    };

    // If an item for this exact jobId and terminal status exists, update it to the latest
    this.items.set(fullItem.id, fullItem);
    this.saveToDisk();

    logger.info('NETWORK', `[Outbox] Enqueued durable status update for job ${fullItem.jobId}: status=${fullItem.status}, event=${fullItem.eventType}`);

    // Trigger immediate flush attempt if client available
    void this.flush();

    return fullItem;
  }

  public startWorker(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    // Check outbox every 3 seconds
    this.timer = setInterval(() => {
      void this.flush();
    }, 3000);
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public stopWorker(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getPendingCount(): number {
    return this.items.size;
  }

  public hasPendingJobSync(jobId: string): boolean {
    for (const item of this.items.values()) {
      if (item.jobId === jobId) return true;
    }
    return false;
  }

  /**
   * Flushes eligible pending items to backend.
   */
  public async flush(): Promise<void> {
    if (this.isFlushing || !this.apiClient || this.items.size === 0) {
      return;
    }

    this.isFlushing = true;
    const now = Date.now();

    try {
      const eligibleItems = Array.from(this.items.values())
        .filter((item) => item.nextAttemptAt <= now)
        .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);

      for (const item of eligibleItems) {
        try {
          const res = await this.apiClient.updateJobStatus(
            item.jobId,
            item.status as any,
            item.errorMessage,
            item.printerName,
            item.retrySafe,
            item.pagesPrinted,
            item.spoolerJobId
          );

          if (res.success) {
            logger.info('NETWORK', `[Outbox] Successfully synchronized status ${item.status} for job ${item.jobId} to backend (attempts: ${item.attemptCount + 1}).`);
            this.items.delete(item.id);
            this.saveToDisk();
          } else {
            this.handleSyncFailure(item, res.error || 'Server rejected status update');
          }
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          this.handleSyncFailure(item, errMsg);
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private handleSyncFailure(item: OutboxItem, reason: string): void {
    item.attemptCount++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, bounded at 30s
    const delayMs = Math.min(30000, 1000 * Math.pow(2, Math.min(item.attemptCount, 5)));
    item.nextAttemptAt = Date.now() + delayMs;
    this.saveToDisk();

    logger.warn('NETWORK', `[Outbox] Local print status preserved; backend sync failed for job ${item.jobId} (attempt ${item.attemptCount}): ${reason}. Next retry in ${Math.round(delayMs / 1000)}s.`);
  }
}

export const outboxManager = OutboxManager.getInstance();
