export type PrintFileFormat = 'PDF' | 'JPG' | 'JPEG' | 'PNG' | 'UNKNOWN';

export type PrintOrientation = 'PORTRAIT' | 'LANDSCAPE' | 'AUTO';

export type PrintScalingMode = 'FIT_TO_PAGE' | 'ACTUAL_SIZE' | 'FILL_PAGE';

export type UniversalErrorCode =
  | 'FILE_NOT_FOUND'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'INVALID_FILE_CONTENT'
  | 'FILE_TOO_LARGE'
  | 'PRINTER_NOT_FOUND'
  | 'PRINTER_NOT_READY'
  | 'POWERSHELL_EXECUTION_FAILED'
  | 'IMAGE_RENDER_FAILED'
  | 'PDF_RENDER_FAILED'
  | 'PDF_PASSWORD_REQUIRED'
  | 'PRINT_SUBMISSION_FAILED'
  | 'PRINT_TIMEOUT'
  | 'SPOOLER_ERROR'
  | 'UNSUPPORTED_PRINTER_SETTING';

export interface UniversalPrintRequest {
  jobId: string;
  shopId?: string;
  filePath: string;
  printerId?: string;
  printerName: string;
  copies?: number;
  paperSize?: string; // 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal'
  orientation?: PrintOrientation;
  colorMode?: 'BW' | 'COLOR';
  scalingMode?: PrintScalingMode;
  pageRange?: string; // e.g. "1-3, 5"
  printQuality?: 'DRAFT' | 'STANDARD' | 'HIGH';
  enableCache?: boolean;
  timeoutMs?: number;
  onProgress?: (stage: 'VALIDATING' | 'RENDERING' | 'SUBMITTING' | 'SPOOLER_TRACKING', percent?: number) => void;
}

export interface UniversalPrintResult {
  success: boolean;
  submitted: boolean;
  jobId: string;
  printerName: string;
  format: PrintFileFormat;
  totalPages: number;
  copies: number;
  spoolerJobId?: number;
  errorCode?: UniversalErrorCode;
  errorMessage?: string;
  exitCode?: number;
  executionDurationMs: number;
  stageReached: 'VALIDATED' | 'RENDERED' | 'SUBMITTED' | 'SPOOLED' | 'FAILED';
}

export interface RenderedPageInfo {
  pageNumber: number;
  imagePath: string;
  widthPx: number;
  heightPx: number;
  orientation: 'PORTRAIT' | 'LANDSCAPE';
}

export interface SpoolerJobStatus {
  found: boolean;
  jobId?: number;
  status?: string;
  isDespooled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  pagesPrinted?: number;
  totalPages?: number;
}
