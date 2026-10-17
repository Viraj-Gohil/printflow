import fs from 'fs';
import path from 'path';
import os from 'os';
import { localVault } from '../storage/LocalDataVault.js';
import { logger } from '../logger/AgentLogger.js';

export class CrashRecoveryManager {
  /**
   * Scans local vault for jobs left in intermediate states during an unexpected shutdown
   */
  public static performStartupRecovery(): void {
    logger.info('RECOVERY', 'Running system startup check & recovery audit...');
    const allJobs = localVault.getAllJobs();

    let pendingDownloadRecoveryCount = 0;
    let attentionCount = 0;
    for (const job of allJobs) {
      if (job.printStatus === 'DOWNLOADING') {
        logger.warn('RECOVERY', `Job ${job.id} download was interrupted; it will be reset with the backend after authentication.`);
        pendingDownloadRecoveryCount++;
      } else if (job.printStatus === 'PRINTING') {
        logger.warn('RECOVERY', `Job ${job.id} was interrupted during printing and requires operator confirmation.`);
        job.printStatus = 'MANUAL_ATTENTION';
        job.retrySafe = false;
        job.errorMessage = 'The previous print outcome is uncertain. Check the printer output before deciding whether to reprint.';
        job.updatedAt = new Date().toISOString();
        localVault.saveJob(job);
        attentionCount++;
      }
    }

    if (pendingDownloadRecoveryCount === 0 && attentionCount === 0) {
      logger.info('RECOVERY', 'No interrupted jobs detected. Queue integrity verified clean.');
    } else if (pendingDownloadRecoveryCount > 0 || attentionCount > 0) {
      if (pendingDownloadRecoveryCount > 0) {
        logger.info('RECOVERY', `${pendingDownloadRecoveryCount} interrupted download(s) are waiting for backend queue recovery.`);
      }
      if (attentionCount > 0) {
      logger.warn('RECOVERY', `${attentionCount} interrupted print job(s) require operator confirmation.`);
      }
    }

    // Clean up old temporary spool files
    this.cleanStaleSpoolFiles();
  }

  private static cleanStaleSpoolFiles(): void {
    try {
      const spoolDir = path.join(os.tmpdir(), 'PrintFlow_Spool');
      if (fs.existsSync(spoolDir)) {
        const files = fs.readdirSync(spoolDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const file of files) {
          const filePath = path.join(spoolDir, file);
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch {
      // Ignore cleanup error
    }
  }
}
