import { exec } from 'child_process';
import util from 'util';
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

export class IPPAdapter implements IPrinterAdapter {
  public readonly adapterName = 'IPPAdapter';
  public readonly category: PrinterCategory = 'IPP_NETWORK';

  public canHandle(printerName: string, _driverName?: string, portName?: string): boolean {
    const isIppName = /^ipp:\/\/|^ipps:\/\//i.test(printerName);
    const isIppPort = Boolean(portName && (/ipp|ipps|631|9100/i.test(portName) || /^http:\/\//i.test(portName)));
    return isIppName || isIppPort;
  }

  public async discover(): Promise<DiscoveredPrinter[]> {
    if (process.platform !== 'win32') return [];
    try {
      const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Where-Object { $_.PortName -match 'ipp|ipps|631|9100|http' -or $_.Name -match 'ipp:' } | Select-Object Name, DriverName, Default, PrinterStatus, WorkOffline, PortName, PrinterPaperNames, Capabilities, Color | ConvertTo-Json -Depth 3"`;
      const { stdout } = await execAsync(psCommand, { timeout: 10000 });
      if (!stdout || !stdout.trim()) return [];

      const parsed = JSON.parse(stdout);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const discovered: DiscoveredPrinter[] = [];

      for (const item of list) {
        if (!item.Name) continue;
        const name = item.Name;
        const isOffline = Boolean(item.WorkOffline) || item.PrinterStatus === 7;
        const isOnline = !isOffline;

        discovered.push({
          name,
          displayName: `${name} (IPP Network)`,
          isDefault: Boolean(item.Default),
          status: isOffline ? 'OFFLINE' : 'READY',
          isOnline,
          driverName: item.DriverName || 'IPP Network Driver',
          portName: item.PortName,
          capabilities: {
            paperSizes: ['A4', 'Letter'],
            supportsColor: typeof item.Color === 'boolean' ? item.Color : null,
            supportsDuplex: Array.isArray(item.Capabilities) && (item.Capabilities.includes(3) || item.Capabilities.includes(13))
          }
        });
      }

      return discovered;
    } catch (err: any) {
      logger.warn('SPOOLER', 'IPPAdapter discovery notice', { error: err.message });
      return [];
    }
  }

  public async getCapabilities(printerName: string): Promise<ExtendedPrinterCapabilities> {
    const discovered = await this.discover();
    const target = discovered.find((p) => p.name.trim().toLowerCase() === printerName.trim().toLowerCase());

    return {
      paperSizes: target?.capabilities.paperSizes || ['A4', 'Letter'],
      supportsColor: target?.capabilities.supportsColor ?? null, // UNKNOWN if driver doesn't specify
      supportsDuplex: target?.capabilities.supportsDuplex ?? null,
      printerCategory: 'IPP_NETWORK',
      driverName: target?.driverName || 'IPP Generic Driver',
      connectionType: 'LAN'
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
          error: `IPP Printer "${printerName}" does not support Color printing.`
        };
      }
      if (fileItem.duplex && capabilities.supportsDuplex === false) {
        return {
          isValid: false,
          error: `IPP Printer "${printerName}" does not support Duplex (double-sided) printing.`
        };
      }
    }

    return { isValid: true, warnings };
  }

  public async print(options: PrintExecutionOptions): Promise<PrintExecutionResult> {
    logger.info('SPOOLER', `[IPPAdapter] Delegating IPP network print job to Windows Spooler pipeline for "${options.printerName}"`);
    // Fall back to standard spooling pipeline through IPP port
    const { WindowsSpoolerAdapter } = await import('./WindowsSpoolerAdapter.js');
    const spooler = new WindowsSpoolerAdapter();
    return spooler.print(options);
  }

  public async cancelJob(_jobId: string): Promise<boolean> {
    return true;
  }
}
