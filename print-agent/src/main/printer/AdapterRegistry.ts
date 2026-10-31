import { DiscoveredPrinter, PrintFileItem } from '../../renderer/types/agent.js';
import {
  IPrinterAdapter,
  ExtendedPrinterCapabilities,
  ValidationResult,
  PrintExecutionOptions,
  PrintExecutionResult
} from './adapters/IPrinterAdapter.js';
import { WindowsSpoolerAdapter } from './adapters/WindowsSpoolerAdapter.js';
import { IPPAdapter } from './adapters/IPPAdapter.js';
import { EscPosAdapter } from './adapters/EscPosAdapter.js';
import { logger } from '../logger/AgentLogger.js';

export class AdapterRegistry {
  private static instance: AdapterRegistry;
  private adapters: IPrinterAdapter[] = [];
  private fallbackAdapter: IPrinterAdapter;

  private constructor() {
    // Register specialized adapters in priority order
    this.adapters = [
      new EscPosAdapter(),
      new IPPAdapter(),
      new WindowsSpoolerAdapter()
    ];
    this.fallbackAdapter = this.adapters[this.adapters.length - 1]; // WindowsSpoolerAdapter is standard fallback
  }

  public static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  /** Finds the most specific adapter capable of driving the target printer device */
  public getAdapterForPrinter(printerName: string, driverName?: string, portName?: string): IPrinterAdapter {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(printerName, driverName, portName)) {
        return adapter;
      }
    }
    return this.fallbackAdapter;
  }

  /** Aggregates discovered printers across all registered printer adapters */
  public async discoverAll(): Promise<DiscoveredPrinter[]> {
    const printerMap = new Map<string, DiscoveredPrinter>();

    for (const adapter of this.adapters) {
      try {
        const list = await adapter.discover();
        for (const p of list) {
          const key = p.name.trim().toLowerCase();
          if (!printerMap.has(key)) {
            printerMap.set(key, p);
          }
        }
      } catch (err: any) {
        logger.warn('SPOOLER', `Adapter ${adapter.adapterName} discovery error`, { error: err.message });
      }
    }

    return Array.from(printerMap.values());
  }

  /** Resolves capabilities for a printer device through its registered adapter */
  public async getCapabilities(printerName: string, driverName?: string): Promise<ExtendedPrinterCapabilities> {
    const adapter = this.getAdapterForPrinter(printerName, driverName);
    return adapter.getCapabilities(printerName);
  }

  /** Checks printer live status across registered adapters */
  public async getStatus(printerName: string): Promise<'READY' | 'PRINTING' | 'OFFLINE' | 'BUSY' | 'ERROR'> {
    const adapter = this.getAdapterForPrinter(printerName);
    return adapter.getStatus(printerName);
  }

  /** Validates a print job against hardware capabilities and owner policy */
  public async validateJob(
    printerName: string,
    fileItem: PrintFileItem,
    driverName?: string,
    ownerConfig?: Record<string, any>
  ): Promise<ValidationResult> {
    const adapter = this.getAdapterForPrinter(printerName, driverName);
    const capabilities = await adapter.getCapabilities(printerName, driverName);

    // 1. Adapter validation against physical capabilities
    const adapterResult = adapter.validateJob(printerName, fileItem, capabilities);
    if (!adapterResult.isValid) {
      return adapterResult;
    }

    // 2. Shop owner configuration restrictions validation
    // Owner can restrict enabled options, but can NEVER claim unsupported hardware capabilities
    if (ownerConfig) {
      if (fileItem.colorMode === 'COLOR' && ownerConfig.enableColor === false) {
        return {
          isValid: false,
          error: `Color printing has been disabled by the shop owner for printer "${printerName}". Select Black & White printing.`
        };
      }

      if (fileItem.duplex && ownerConfig.enableDuplex === false) {
        return {
          isValid: false,
          error: `Duplex (double-sided) printing has been disabled by the shop owner for printer "${printerName}".`
        };
      }

      if (
        fileItem.paperSize &&
        Array.isArray(ownerConfig.enabledPaperSizes) &&
        ownerConfig.enabledPaperSizes.length > 0 &&
        !ownerConfig.enabledPaperSizes.map((s: string) => String(s).toUpperCase()).includes(fileItem.paperSize.toUpperCase())
      ) {
        return {
          isValid: false,
          error: `Paper size "${fileItem.paperSize}" is currently disabled for printer "${printerName}" by the shop owner.`
        };
      }
    }

    return { isValid: true, warnings: adapterResult.warnings };
  }

  /** Dispatches a print job to the appropriate printer adapter */
  public async printJob(options: PrintExecutionOptions): Promise<PrintExecutionResult> {
    const adapter = this.getAdapterForPrinter(options.printerName);
    logger.info('SPOOLER', `Routing print job for "${options.printerName}" to adapter: ${adapter.adapterName}`);
    return adapter.print(options);
  }
}

export const adapterRegistry = AdapterRegistry.getInstance();
