import fs from 'fs';
import path from 'path';
import {
  PrintFileFormat,
  UniversalErrorCode,
  UniversalPrintRequest,
  UniversalPrintResult
} from '../types/printing.js';
import { ImagePrintEngine } from './ImagePrintEngine.js';
import { PDFPrintEngine } from './PDFPrintEngine.js';
import { logger } from '../../logger/AgentLogger.js';

export class UniversalPrintService {
  private static instance: UniversalPrintService;
  private readonly imageEngine: ImagePrintEngine;
  private readonly pdfEngine: PDFPrintEngine;

  private constructor() {
    this.imageEngine = ImagePrintEngine.getInstance();
    this.pdfEngine = PDFPrintEngine.getInstance();
  }

  public static getInstance(): UniversalPrintService {
    if (!UniversalPrintService.instance) {
      UniversalPrintService.instance = new UniversalPrintService();
    }
    return UniversalPrintService.instance;
  }

  /**
   * Sniffs the file format using binary signatures (magic bytes)
   * with fallback to file extension when headers are ambiguous.
   */
  public detectFormat(filePath: string): PrintFileFormat {
    if (!fs.existsSync(filePath)) {
      return 'UNKNOWN';
    }

    try {
      const headerBuffer = Buffer.alloc(16);
      const fd = fs.openSync(filePath, 'r');
      try {
        fs.readSync(fd, headerBuffer, 0, 16, 0);
      } finally {
        fs.closeSync(fd);
      }

      // Check PDF: starts with "%PDF-"
      if (headerBuffer.length >= 5 && headerBuffer.subarray(0, 5).toString('ascii') === '%PDF-') {
        return 'PDF';
      }

      // Check PNG: 89 50 4E 47 0D 0A 1A 0A
      if (
        headerBuffer.length >= 8 &&
        headerBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ) {
        return 'PNG';
      }

      // Check JPEG: FF D8 FF
      if (
        headerBuffer.length >= 3 &&
        headerBuffer[0] === 0xff &&
        headerBuffer[1] === 0xd8 &&
        headerBuffer[2] === 0xff
      ) {
        return 'JPG';
      }

      // Extension fallback if header check didn't match
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.pdf') return 'PDF';
      if (ext === '.jpg' || ext === '.jpeg') return 'JPG';
      if (ext === '.png') return 'PNG';

      return 'UNKNOWN';
    } catch (err: any) {
      logger.warn('SPOOLER', `Error detecting file format for ${filePath}: ${err.message}`);
      return 'UNKNOWN';
    }
  }

  /**
   * Universal print dispatcher: validates parameters, detects format,
   * routes to the appropriate native engine, and returns a structured result.
   */
  public async printFile(request: UniversalPrintRequest): Promise<UniversalPrintResult> {
    const startTime = Date.now();

    logger.info('SPOOLER', `Dispatching universal print job ${request.jobId} to printer "${request.printerName}"`, {
      file: request.filePath,
      copies: request.copies || 1,
      paperSize: request.paperSize || 'A4',
      orientation: request.orientation || 'PORTRAIT',
      colorMode: request.colorMode || 'BW'
    });

    // 1. Basic validation
    if (!request.filePath || !fs.existsSync(request.filePath)) {
      return {
        success: false,
        submitted: false,
        jobId: request.jobId,
        printerName: request.printerName,
        format: 'UNKNOWN',
        totalPages: 0,
        copies: request.copies || 1,
        errorCode: 'FILE_NOT_FOUND',
        errorMessage: `Print target file does not exist: ${request.filePath}`,
        executionDurationMs: Date.now() - startTime,
        stageReached: 'FAILED'
      };
    }

    if (!request.printerName || !request.printerName.trim()) {
      return {
        success: false,
        submitted: false,
        jobId: request.jobId,
        printerName: '',
        format: 'UNKNOWN',
        totalPages: 0,
        copies: request.copies || 1,
        errorCode: 'PRINTER_NOT_FOUND',
        errorMessage: 'Target printer name was not specified.',
        executionDurationMs: Date.now() - startTime,
        stageReached: 'FAILED'
      };
    }

    // 2. Format detection
    const format = this.detectFormat(request.filePath);
    if (format === 'UNKNOWN') {
      return {
        success: false,
        submitted: false,
        jobId: request.jobId,
        printerName: request.printerName,
        format: 'UNKNOWN',
        totalPages: 0,
        copies: request.copies || 1,
        errorCode: 'UNSUPPORTED_FILE_TYPE',
        errorMessage: `Unsupported file format. Universal Windows Print Engine supports JPG, JPEG, PNG, and PDF documents.`,
        executionDurationMs: Date.now() - startTime,
        stageReached: 'FAILED'
      };
    }

    request.onProgress?.('VALIDATING', 10);

    // 3. Dispatch to engine
    try {
      if (format === 'PDF') {
        return await this.pdfEngine.printPdf(request);
      } else {
        return await this.imageEngine.printImage(request, format);
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      logger.error('SPOOLER', `Unhandled error during universal print for ${request.jobId}: ${err.message}`);
      return {
        success: false,
        submitted: false,
        jobId: request.jobId,
        printerName: request.printerName,
        format,
        totalPages: 0,
        copies: request.copies || 1,
        errorCode: 'PRINT_SUBMISSION_FAILED',
        errorMessage: err.message || 'Fatal error during print processing.',
        executionDurationMs: duration,
        stageReached: 'FAILED'
      };
    }
  }
}

export const universalPrintService = UniversalPrintService.getInstance();
