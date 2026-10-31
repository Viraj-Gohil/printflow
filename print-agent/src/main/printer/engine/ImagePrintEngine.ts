import fs from 'fs';
import {
  PrintFileFormat,
  UniversalErrorCode,
  UniversalPrintRequest,
  UniversalPrintResult
} from '../types/printing.js';
import { windowsPrintEngine } from './WindowsPrintEngine.js';
import { spoolerMonitor } from './SpoolerMonitor.js';
import { logger } from '../../logger/AgentLogger.js';

export class ImagePrintEngine {
  private static instance: ImagePrintEngine;

  private constructor() {}

  public static getInstance(): ImagePrintEngine {
    if (!ImagePrintEngine.instance) {
      ImagePrintEngine.instance = new ImagePrintEngine();
    }
    return ImagePrintEngine.instance;
  }

  /**
   * Validates image format from binary magic bytes (never trusts extension alone).
   */
  public detectImageFormat(buffer: Buffer): 'JPG' | 'JPEG' | 'PNG' | null {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return 'PNG';
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'JPG';
    }
    return null;
  }

  /**
   * Processes and prints an image file (JPG, JPEG, PNG) through the Windows native engine.
   */
  public async printImage(request: UniversalPrintRequest, detectedFormat: 'JPG' | 'JPEG' | 'PNG'): Promise<UniversalPrintResult> {
    const startTime = Date.now();
    const result: UniversalPrintResult = {
      success: false,
      submitted: false,
      jobId: request.jobId,
      printerName: request.printerName,
      format: detectedFormat,
      totalPages: 1,
      copies: request.copies || 1,
      executionDurationMs: 0,
      stageReached: 'VALIDATED'
    };

    if (!fs.existsSync(request.filePath)) {
      result.errorCode = 'FILE_NOT_FOUND';
      result.errorMessage = `Image file not found: ${request.filePath}`;
      result.executionDurationMs = Date.now() - startTime;
      result.stageReached = 'FAILED';
      return result;
    }

    const stat = fs.statSync(request.filePath);
    if (stat.size === 0) {
      result.errorCode = 'INVALID_FILE_CONTENT';
      result.errorMessage = 'Image file is empty (0 bytes).';
      result.executionDurationMs = Date.now() - startTime;
      result.stageReached = 'FAILED';
      return result;
    }

    if (stat.size > 80 * 1024 * 1024) {
      result.errorCode = 'FILE_TOO_LARGE';
      result.errorMessage = 'Image file size exceeds maximum 80 MB limit.';
      result.executionDurationMs = Date.now() - startTime;
      result.stageReached = 'FAILED';
      return result;
    }

    // Double check binary signature
    const headerBuffer = Buffer.alloc(16);
    const fd = fs.openSync(request.filePath, 'r');
    try {
      fs.readSync(fd, headerBuffer, 0, 16, 0);
    } finally {
      fs.closeSync(fd);
    }

    const verifiedFormat = this.detectImageFormat(headerBuffer);
    if (!verifiedFormat) {
      result.errorCode = 'INVALID_FILE_CONTENT';
      result.errorMessage = 'File contents do not match genuine JPG, JPEG, or PNG image headers.';
      result.executionDurationMs = Date.now() - startTime;
      result.stageReached = 'FAILED';
      return result;
    }

    request.onProgress?.('SUBMITTING', 50);

    // Dispatch directly to WindowsPrintEngine
    const nativeResult = await windowsPrintEngine.executeNativePrint({
      jobId: request.jobId,
      printerName: request.printerName,
      imagePaths: [request.filePath],
      copies: request.copies,
      paperSize: request.paperSize,
      orientation: request.orientation,
      colorMode: request.colorMode,
      duplex: false, // Single image is always single-sided
      scalingMode: request.scalingMode || 'FIT_TO_PAGE',
      timeoutMs: request.timeoutMs
    });

    if (!nativeResult.success) {
      return {
        ...nativeResult,
        format: verifiedFormat,
        totalPages: 1
      };
    }

    request.onProgress?.('SPOOLER_TRACKING', 80);

    // Track active spooler despooling
    const spoolerCheck = await spoolerMonitor.trackJobUntilDespooled(
      request.printerName,
      Math.min(30000, request.timeoutMs || 30000)
    );

    if (!spoolerCheck.completed) {
      return {
        ...nativeResult,
        success: false,
        errorCode: 'SPOOLER_ERROR',
        errorMessage: spoolerCheck.error || 'Spooler reported error while despooling document.',
        executionDurationMs: Date.now() - startTime,
        stageReached: 'SUBMITTED'
      };
    }

    request.onProgress?.('SPOOLER_TRACKING', 100);

    return {
      success: true,
      submitted: true,
      jobId: request.jobId,
      printerName: request.printerName,
      format: verifiedFormat,
      totalPages: 1,
      copies: request.copies || 1,
      executionDurationMs: Date.now() - startTime,
      stageReached: 'SPOOLED'
    };
  }
}

export const imagePrintEngine = ImagePrintEngine.getInstance();
