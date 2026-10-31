import { execFile } from 'child_process';
import util from 'util';
import { SpoolerJobStatus } from '../types/printing.js';
import { logger } from '../../logger/AgentLogger.js';

const execFileAsync = util.promisify(execFile);

export class SpoolerMonitor {
  private static instance: SpoolerMonitor;

  private constructor() {}

  public static getInstance(): SpoolerMonitor {
    if (!SpoolerMonitor.instance) {
      SpoolerMonitor.instance = new SpoolerMonitor();
    }
    return SpoolerMonitor.instance;
  }

  /**
   * Queries active Windows Print Spooler jobs for a target printer.
   */
  public async getActiveJobs(printerName: string): Promise<SpoolerJobStatus[]> {
    if (process.platform !== 'win32') {
      return [];
    }

    const safePrinterName = printerName.replace(/'/g, "''");
    const script = `
$ErrorActionPreference = 'SilentlyContinue'
$jobs = Get-CimInstance Win32_PrintJob | Where-Object {
    $_.Name -like "*${safePrinterName}*" -or $_.Caption -like "*${safePrinterName}*"
} | Select-Object JobId, Document, Name, JobStatus, Status, TotalPages, PagesPrinted

if ($jobs) {
    @($jobs) | ConvertTo-Json -Depth 2 -Compress
} else {
    "[]"
}
`.trim();

    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: 8000 }
      );

      const trimmed = (stdout || '').trim();
      if (!trimmed || trimmed === '[]') {
        return [];
      }

      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];

      return list.map((item: any) => {
        const statusText = String(item.JobStatus || item.Status || '');
        const hasError = /error|paperout|blocked|userintervention|degraded|offline/i.test(statusText);
        return {
          found: true,
          jobId: Number(item.JobId) || undefined,
          status: statusText || 'QUEUED',
          isDespooled: false,
          hasError,
          errorMessage: hasError ? statusText : undefined,
          pagesPrinted: Number(item.PagesPrinted) || 0,
          totalPages: Number(item.TotalPages) || 0
        };
      });
    } catch (err: any) {
      logger.warn('SPOOLER', `Spooler monitor query notice: ${err?.message || err}`);
      return [];
    }
  }

  /**
   * Actively polls the Windows spooler until the job has completed despooling or an error is detected.
   */
  public async trackJobUntilDespooled(
    printerName: string,
    timeoutMs = 30000,
    pollIntervalMs = 1500
  ): Promise<{ completed: boolean; error?: string; statusDetail?: string }> {
    if (process.platform !== 'win32') {
      return { completed: true };
    }

    const startTime = Date.now();
    let initialJobsObserved = false;

    while (Date.now() - startTime < timeoutMs) {
      const activeJobs = await this.getActiveJobs(printerName);

      if (activeJobs.length > 0) {
        initialJobsObserved = true;
        // Check if any job on this printer reported a physical hardware/driver error
        const errored = activeJobs.find((j) => j.hasError);
        if (errored) {
          logger.warn('SPOOLER', `Spooler reported error on printer "${printerName}": ${errored.errorMessage}`);
          return {
            completed: false,
            error: `Spooler error: ${errored.errorMessage || 'Printer queue reported hardware error'}`,
            statusDetail: errored.status
          };
        }
      } else {
        // If we previously observed jobs in the spooler and now none exist, it has despooled successfully!
        // If none existed at all after a short grace period (e.g. 3s), the fast spooler already completed handoff.
        if (initialJobsObserved || (Date.now() - startTime > 3000)) {
          logger.info('SPOOLER', `Job successfully despooled on printer "${printerName}" (transferred to hardware buffer).`);
          return { completed: true, statusDetail: 'DESPOOLED' };
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    // If timeout reached while still in spooler
    const finalCheck = await this.getActiveJobs(printerName);
    if (finalCheck.length > 0) {
      logger.info('SPOOLER', `Job remains in spooler for printer "${printerName}" after timeout (still printing large job).`);
      return { completed: true, statusDetail: 'SPOOLING_IN_PROGRESS' };
    }

    return { completed: true, statusDetail: 'COMPLETED' };
  }
}

export const spoolerMonitor = SpoolerMonitor.getInstance();
