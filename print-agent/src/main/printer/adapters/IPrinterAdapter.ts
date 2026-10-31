import { DiscoveredPrinter, PrintFileItem } from '../../../renderer/types/agent.js';

export type PrinterCategory = 'WINDOWS_SPOOLER' | 'IPP_NETWORK' | 'ESC_POS_THERMAL' | 'GENERIC_SPECIALIZED';

export interface ExtendedPrinterCapabilities {
  paperSizes: Array<'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Roll_80mm' | 'Roll_58mm' | string>;
  supportsColor: boolean | null; // null = UNKNOWN
  supportsDuplex: boolean | null; // null = UNKNOWN
  maxDpi?: number | null;
  maxCopies?: number | null;
  connectionType?: 'USB' | 'WIFI' | 'LAN' | 'BLUETOOTH' | 'NETWORK_SHARE' | 'UNKNOWN';
  printerCategory: PrinterCategory;
  driverName?: string;
  rawCapabilities?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  adjustedSettings?: Record<string, any>;
}

export interface PrintExecutionOptions {
  printerName: string;
  tempFilePath: string;
  fileItem: PrintFileItem;
  timeoutMs?: number;
  ownerConfig?: Record<string, any>;
}

export interface PrintExecutionResult {
  success: boolean;
  submitted: boolean;
  error?: string;
  jobId?: string;
  adapterName: string;
}

export interface IPrinterAdapter {
  readonly adapterName: string;
  readonly category: PrinterCategory;

  /** Checks if this adapter can handle the specified printer device */
  canHandle(printerName: string, driverName?: string, portName?: string): boolean;

  /** Discovers all printers managed by this adapter */
  discover(): Promise<DiscoveredPrinter[]>;

  /** Retrieves detailed capabilities for a target printer */
  getCapabilities(printerName: string, driverName?: string): Promise<ExtendedPrinterCapabilities>;

  /** Checks live health/status of a target printer */
  getStatus(printerName: string): Promise<'READY' | 'PRINTING' | 'OFFLINE' | 'BUSY' | 'ERROR'>;

  /** Validates print job settings against hardware capabilities and policies */
  validateJob(printerName: string, fileItem: PrintFileItem, capabilities?: ExtendedPrinterCapabilities): ValidationResult;

  /** Dispatches a print job through this adapter */
  print(options: PrintExecutionOptions): Promise<PrintExecutionResult>;

  /** Cancels a running or queued job if supported */
  cancelJob(jobId: string): Promise<boolean>;
}
