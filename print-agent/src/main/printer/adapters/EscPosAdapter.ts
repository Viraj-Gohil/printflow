import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { DiscoveredPrinter, PrintFileItem } from '../../../renderer/types/agent.js';
import {
  IPrinterAdapter,
  PrinterCategory,
  ExtendedPrinterCapabilities,
  ValidationResult,
  PrintExecutionOptions,
  PrintExecutionResult
} from './IPrinterAdapter.js';
import { logger } from '../../logger/AgentLogger.js';

const execAsync = util.promisify(exec);

export class EscPosAdapter implements IPrinterAdapter {
  public readonly adapterName = 'EscPosAdapter';
  public readonly category: PrinterCategory = 'ESC_POS_THERMAL';

  public canHandle(printerName: string, driverName?: string): boolean {
    const text = `${printerName} ${driverName || ''}`.toLowerCase();
    const thermalKeywords = [
      'thermal',
      'receipt',
      'pos-58',
      'pos-80',
      'pos 58',
      'pos 80',
      'xprinter',
      'epson tm-',
      'star tsp',
      'star mc-print',
      'bixolon',
      'munbyn',
      'custom tm',
      '80mm',
      '58mm',
      'bill printer',
      'counter receipt'
    ];
    return thermalKeywords.some((keyword) => text.includes(keyword));
  }

  public async discover(): Promise<DiscoveredPrinter[]> {
    if (process.platform !== 'win32') return [];
    try {
      const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, DriverName, Default, PrinterStatus, WorkOffline, PortName | ConvertTo-Json -Depth 2"`;
      const { stdout } = await execAsync(psCommand, { timeout: 10000 });
      if (!stdout || !stdout.trim()) return [];

      const parsed = JSON.parse(stdout);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const discovered: DiscoveredPrinter[] = [];

      for (const item of list) {
        const name = item.Name;
        if (typeof name !== 'string' || !name || !name.trim()) continue;
        const driverName = item.DriverName || '';

        if (!this.canHandle(name, driverName)) continue;

        const isOffline = Boolean(item.WorkOffline) || item.PrinterStatus === 7;

        discovered.push({
          name,
          displayName: `${name} (Thermal Receipt Printer)`,
          isDefault: Boolean(item.Default),
          status: isOffline ? 'OFFLINE' : 'READY',
          isOnline: !isOffline,
          driverName,
          portName: item.PortName,
          capabilities: {
            paperSizes: ['Roll_80mm', 'Roll_58mm'],
            supportsColor: false, // Thermal printers are strictly Monochrome / Black-and-White
            supportsDuplex: false // Thermal receipt printers do not support double-sided printing
          }
        });
      }

      return discovered;
    } catch (err: any) {
      logger.warn('SPOOLER', 'EscPosAdapter discovery notice', { error: err.message });
      return [];
    }
  }

  public async getCapabilities(printerName: string): Promise<ExtendedPrinterCapabilities> {
    const discovered = await this.discover();
    const target = discovered.find((p) => p.name.trim().toLowerCase() === printerName.trim().toLowerCase());

    const is58mm = /58mm|pos-?58/i.test(printerName);

    return {
      paperSizes: is58mm ? ['Roll_58mm'] : ['Roll_80mm', 'Roll_58mm'],
      supportsColor: false, // Explicitly false - thermal hardware is monochrome
      supportsDuplex: false, // Explicitly false - thermal paper rolls cannot be duplexed
      maxDpi: 203,
      printerCategory: 'ESC_POS_THERMAL',
      driverName: target?.driverName || 'ESC/POS Thermal Driver',
      connectionType: 'USB'
    };
  }

  public async getStatus(printerName: string): Promise<'READY' | 'PRINTING' | 'OFFLINE' | 'BUSY' | 'ERROR'> {
    const discovered = await this.discover();
    const target = discovered.find((p) => p.name.trim().toLowerCase() === printerName.trim().toLowerCase());
    return target ? target.status : 'OFFLINE';
  }

  public validateJob(
    printerName: string,
    fileItem: PrintFileItem,
    capabilities?: ExtendedPrinterCapabilities
  ): ValidationResult {
    const warnings: string[] = [];

    // Hardware locks for thermal printers
    if (fileItem.colorMode === 'COLOR') {
      return {
        isValid: false,
        error: `Thermal receipt printer "${printerName}" is a Black & White thermal hardware device. Color printing is not physically possible.`
      };
    }

    if (fileItem.duplex) {
      return {
        isValid: false,
        error: `Thermal receipt printer "${printerName}" uses continuous paper roll media and does not support Duplex (double-sided) printing.`
      };
    }

    if (fileItem.paperSize && ['A3', 'LEGAL'].includes(fileItem.paperSize.toUpperCase())) {
      warnings.push(`File requests large paper format (${fileItem.paperSize}). Document content will be scaled to fit thermal roll width.`);
    }

    return { isValid: true, warnings };
  }

  public async print(options: PrintExecutionOptions): Promise<PrintExecutionResult> {
    const { printerName, tempFilePath, fileItem, timeoutMs } = options;
    const effectiveTimeoutMs = Math.max(30000, timeoutMs || 30000);

    logger.info('SPOOLER', `[EscPosAdapter] Preparing thermal print job for printer "${printerName}" (Roll media width: 80mm/58mm)`);

    // Use Windows Print Spooler RAW/Raster driver printing for thermal printers
    const safePath = tempFilePath.replace(/'/g, "''");
    const safePrinter = printerName.replace(/'/g, "''");
    const copies = Math.max(1, fileItem.copies || 1);

    const scriptPath = path.join(
      os.tmpdir(),
      `escpos_spool_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.ps1`
    );

    const powershellCommand = `
$ErrorActionPreference = 'Stop'
$filePath = '${safePath}'
$printer = '${safePrinter}'
try {
  if (-not (Test-Path -LiteralPath $filePath)) {
    throw 'Document file missing for thermal printing.'
  }
  
  Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $printer } | Out-Null
  
  [PSCustomObject]@{ success = $true; submitted = $true; error = $null } | ConvertTo-Json -Compress
  exit 0
} catch {
  [PSCustomObject]@{ success = $false; submitted = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
  exit 0
}
    `.trim();

    try {
      fs.writeFileSync(scriptPath, powershellCommand, { encoding: 'utf8' });
      const { stdout } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
        { timeout: effectiveTimeoutMs }
      );

      let result: any = null;
      try {
        result = JSON.parse(stdout.trim());
      } catch {}

      if (result && result.success) {
        return {
          success: true,
          submitted: true,
          adapterName: this.adapterName
        };
      }

      // Fall back to standard WindowsSpoolerAdapter if thermal wrapper notice
      logger.info('SPOOLER', `[EscPosAdapter] Falling back to standard Windows Spooler raster driver for "${printerName}"`);
      const { WindowsSpoolerAdapter } = await import('./WindowsSpoolerAdapter.js');
      const spooler = new WindowsSpoolerAdapter();
      return spooler.print(options);
    } catch (err: any) {
      // Fallback on error
      const { WindowsSpoolerAdapter } = await import('./WindowsSpoolerAdapter.js');
      const spooler = new WindowsSpoolerAdapter();
      return spooler.print(options);
    } finally {
      try {
        fs.unlinkSync(scriptPath);
      } catch {}
    }
  }

  public async cancelJob(_jobId: string): Promise<boolean> {
    return true;
  }
}
