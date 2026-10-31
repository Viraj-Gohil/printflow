import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { createRequire } from 'module';
import { DiscoveredPrinter, PrintFileItem } from '../../../renderer/types/agent.js';

const require = createRequire(import.meta.url);
let app: any = null;
try {
  const electron = require('electron');
  app = electron?.app || null;
} catch {
  app = null;
}
import {
  IPrinterAdapter,
  PrinterCategory,
  ExtendedPrinterCapabilities,
  ValidationResult,
  PrintExecutionOptions,
  PrintExecutionResult
} from './IPrinterAdapter.js';
import { PrintSettingsAdapter } from '../PrintSettingsAdapter.js';
import { logger } from '../../logger/AgentLogger.js';

const execAsync = util.promisify(exec);

export class WindowsSpoolerAdapter implements IPrinterAdapter {
  public readonly adapterName = 'WindowsSpoolerAdapter';
  public readonly category: PrinterCategory = 'WINDOWS_SPOOLER';

  public canHandle(printerName: string, driverName?: string): boolean {
    if (PrintSettingsAdapter.isVirtualPrinter(printerName)) {
      return false;
    }
    const thermalRegex = /thermal|receipt|pos-?58|pos-?80|xprinter|epson tm-|star (tsp|mc-print)/i;
    const isThermal = thermalRegex.test(`${printerName} ${driverName || ''}`);
    return !isThermal;
  }

  public async discover(): Promise<DiscoveredPrinter[]> {
    if (process.platform !== 'win32') return [];
    try {
      const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, DriverName, Default, PrinterStatus, WorkOffline, DetectedErrorState, PortName, PrinterPaperNames, Capabilities, Color | ConvertTo-Json -Depth 3"`;
      const { stdout } = await execAsync(psCommand, { timeout: 12000 });
      if (!stdout || !stdout.trim()) return [];

      const parsed = JSON.parse(stdout);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const discovered: DiscoveredPrinter[] = [];

      for (const item of list) {
        const name = item.Name;
        if (typeof name !== 'string' || !name || !name.trim()) continue;
        if (PrintSettingsAdapter.isVirtualPrinter(name)) continue;

        const driverName = item.DriverName || '';
        if (!this.canHandle(name, driverName)) continue;

        const isOffline = Boolean(item.WorkOffline) ||
          item.PrinterStatus === 6 ||
          item.PrinterStatus === 7 ||
          item.DetectedErrorState === 10;
        const hasDeviceError = [4, 5, 8, 9, 11, 12].includes(Number(item.DetectedErrorState));
        const statusIsKnownOnline = [3, 4, 5].includes(Number(item.PrinterStatus));
        const isOnline = !isOffline && !hasDeviceError && statusIsKnownOnline;

        const status = hasDeviceError || (!isOnline && !isOffline)
          ? 'ERROR'
          : isOffline
            ? 'OFFLINE'
            : item.PrinterStatus === 4
              ? 'PRINTING'
              : 'READY';

        const isKnownMonoModel = /(laserjet.*(p100|p110|101|102|1005|1020)|p1007|p1008|p1102|1020|1018|lbp2900|monochrome)/i.test(`${name} ${driverName}`);
        const rawColor = item.Color === true || (Array.isArray(item.Capabilities) && item.Capabilities.includes(2));
        const supportsColor = isKnownMonoModel ? false : (typeof item.Color === 'boolean' ? item.Color : (rawColor ? true : null));
        const rawDuplex = Array.isArray(item.Capabilities) && (item.Capabilities.includes(3) || item.Capabilities.includes(13) || item.Capabilities.includes(14));
        const supportsDuplex = isKnownMonoModel ? false : (rawDuplex ? true : null);

        const detectedPaperSizes: Array<'A4' | 'A3' | 'A5' | 'Letter' | 'Legal'> = [];
        if (Array.isArray(item.PrinterPaperNames)) {
          for (const pn of item.PrinterPaperNames) {
            const str = String(pn || '').trim().toUpperCase();
            if (str.includes('A4') && !detectedPaperSizes.includes('A4')) detectedPaperSizes.push('A4');
            else if (str.includes('A3') && !detectedPaperSizes.includes('A3')) detectedPaperSizes.push('A3');
            else if (str.includes('A5') && !detectedPaperSizes.includes('A5')) detectedPaperSizes.push('A5');
            else if (str.includes('LETTER') && !detectedPaperSizes.includes('Letter')) detectedPaperSizes.push('Letter');
            else if (str.includes('LEGAL') && !detectedPaperSizes.includes('Legal')) detectedPaperSizes.push('Legal');
          }
        }
        if (detectedPaperSizes.length === 0) {
          detectedPaperSizes.push('A4');
        }

        discovered.push({
          name,
          displayName: name,
          isDefault: Boolean(item.Default),
          status,
          isOnline,
          driverName,
          portName: item.PortName,
          capabilities: {
            paperSizes: Array.from(new Set(detectedPaperSizes)),
            supportsColor,
            supportsDuplex
          }
        });
      }

      return discovered;
    } catch (err: any) {
      logger.warn('SPOOLER', 'WindowsSpoolerAdapter discovery notice', { error: err.message });
      return [];
    }
  }

  public async getCapabilities(printerName: string, driverName?: string): Promise<ExtendedPrinterCapabilities> {
    const discovered = await this.discover();
    const target = discovered.find((p) => p.name.trim().toLowerCase() === printerName.trim().toLowerCase());

    const combinedName = `${printerName} ${driverName || target?.driverName || ''}`;
    const isKnownMonoModel = /(laserjet.*(p100|p110|101|102|1005|1020)|p1007|p1008|p1102|1020|1018|lbp2900|monochrome)/i.test(combinedName);

    const isNetworkPort = Boolean(target?.portName && /^(192\.|10\.|172\.|http|ipp|wsd|tcp)/i.test(target.portName));
    const isUsb = Boolean(target?.portName && /^usb/i.test(target.portName));

    return {
      paperSizes: target?.capabilities.paperSizes || ['A4'],
      supportsColor: isKnownMonoModel ? false : (target?.capabilities.supportsColor ?? null),
      supportsDuplex: isKnownMonoModel ? false : (target?.capabilities.supportsDuplex ?? null),
      printerCategory: 'WINDOWS_SPOOLER',
      driverName: target?.driverName || driverName || '',
      connectionType: isUsb ? 'USB' : isNetworkPort ? 'LAN' : 'UNKNOWN'
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

    if (capabilities) {
      if (fileItem.colorMode === 'COLOR' && capabilities.supportsColor === false) {
        return {
          isValid: false,
          error: `Printer "${printerName}" is a Monochrome/B&W hardware printer. Color printing is not supported by this printer.`
        };
      }

      if (fileItem.duplex && capabilities.supportsDuplex === false) {
        return {
          isValid: false,
          error: `Printer "${printerName}" does not have hardware duplex unit installed. Double-sided printing is not supported.`
        };
      }

      if (fileItem.paperSize && capabilities.paperSizes && capabilities.paperSizes.length > 0) {
        const uppercaseCaps = capabilities.paperSizes.map((s) => String(s).toUpperCase());
        if (!uppercaseCaps.includes(fileItem.paperSize.toUpperCase())) {
          return {
            isValid: false,
            error: `Paper size "${fileItem.paperSize}" is not enabled or supported by printer "${printerName}" (supported: ${capabilities.paperSizes.join(', ')}).`
          };
        }
      }
    }

    return { isValid: true, warnings };
  }

  public async print(options: PrintExecutionOptions): Promise<PrintExecutionResult> {
    const { printerName, tempFilePath, fileItem, timeoutMs } = options;
    const effectiveTimeoutMs = Math.max(30000, timeoutMs || 30000);

    const packageEntry = require.resolve('pdf-to-printer');
    let packageDirectory = path.dirname(packageEntry);
    if (app && app.isPackaged) {
      packageDirectory = packageDirectory.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
    }

    const sumatraFile = fs.readdirSync(packageDirectory).find((name) => /^SumatraPDF-.+\.exe$/i.test(name));
    if (!sumatraFile) {
      return {
        success: false,
        submitted: false,
        adapterName: this.adapterName,
        error: 'The bundled Windows print engine (SumatraPDF) is missing. Repair or reinstall PrintFlow Agent.'
      };
    }

    const commandArgs = PrintSettingsAdapter.adaptSettings(
      fileItem,
      printerName,
      tempFilePath,
      effectiveTimeoutMs,
      path.join(packageDirectory, sumatraFile)
    );

    logger.info('SPOOLER', `[WindowsSpoolerAdapter] Spooling job to printer "${printerName}"`, {
      copies: commandArgs.copies,
      paperSize: commandArgs.paperSize,
      duplex: commandArgs.duplexMode,
      color: commandArgs.color
    });

    const scriptPath = path.join(
      os.tmpdir(),
      `printflow_spool_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.ps1`
    );
    fs.writeFileSync(scriptPath, commandArgs.powershellCommand, { encoding: 'utf8' });

    try {
      const { stdout, stderr } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
        { timeout: effectiveTimeoutMs + 5000 }
      );

      const lines = (stdout || '')
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      let result: { success?: boolean; submitted?: boolean; error?: string } | null = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          if (lines[i].startsWith('{') && lines[i].endsWith('}')) {
            result = JSON.parse(lines[i]);
            break;
          }
        } catch {}
      }

      if (!result) {
        const detail = (stderr?.trim() || stdout?.trim() || 'Windows spooler script returned invalid output').slice(0, 300);
        return {
          success: false,
          submitted: false,
          adapterName: this.adapterName,
          error: `Windows print submission failed: ${detail}`
        };
      }

      if (!result.success) {
        return {
          success: false,
          submitted: Boolean(result.submitted),
          adapterName: this.adapterName,
          error: result.error || 'Windows spooler reported print rejection.'
        };
      }

      return {
        success: true,
        submitted: true,
        adapterName: this.adapterName
      };
    } catch (err: any) {
      const errDetail = (err.stderr?.trim() || err.stdout?.trim() || err.message || '').slice(0, 300);
      const error = err.killed
        ? `Timed out waiting for printer "${printerName}". Check connection and spooler queue.`
        : errDetail
          ? `Windows print error on "${printerName}": ${errDetail}`
          : `Windows Print Spooler check failed for "${printerName}".`;
      return {
        success: false,
        submitted: Boolean(err.killed),
        adapterName: this.adapterName,
        error
      };
    } finally {
      try {
        fs.unlinkSync(scriptPath);
      } catch {}
    }
  }

  public async cancelJob(_jobId: string): Promise<boolean> {
    // Spooler queue cancellation handled via Win32_PrintJob or queue manager
    return true;
  }
}
