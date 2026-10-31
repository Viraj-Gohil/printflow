import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import {
  UniversalErrorCode,
  UniversalPrintRequest,
  UniversalPrintResult
} from '../types/printing.js';
import { windowsPrintEngine } from './WindowsPrintEngine.js';
import { spoolerMonitor } from './SpoolerMonitor.js';
import { logger } from '../../logger/AgentLogger.js';

export class PDFPrintEngine {
  private static instance: PDFPrintEngine;

  private readonly DEFAULT_DPI = 200;
  private readonly DRAFT_DPI = 150;
  private readonly CACHE_DIR = path.join(os.tmpdir(), 'PrintFlow_Cache', 'pdf_pages');

  private constructor() {
    try {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true, mode: 0o700 });
    } catch {}
  }

  public static getInstance(): PDFPrintEngine {
    if (!PDFPrintEngine.instance) {
      PDFPrintEngine.instance = new PDFPrintEngine();
    }
    return PDFPrintEngine.instance;
  }

  /**
   * Parses page range string (e.g., "1-3, 5, 8-10") into an array of 1-based page numbers.
   */
  public parsePageRange(pageRangeStr: string | undefined, totalPages: number): number[] {
    if (!pageRangeStr || !pageRangeStr.trim() || pageRangeStr.trim().toUpperCase() === 'ALL') {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set<number>();
    const parts = pageRangeStr.split(',').map((p) => p.trim()).filter(Boolean);

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((s) => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
          for (let p = start; p <= Math.min(end, totalPages); p++) {
            pages.add(p);
          }
        }
      } else {
        const single = parseInt(part, 10);
        if (!isNaN(single) && single >= 1 && single <= totalPages) {
          pages.add(single);
        }
      }
    }

    const sorted = Array.from(pages).sort((a, b) => a - b);
    return sorted.length > 0 ? sorted : Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  /**
   * Renders PDF pages to high-resolution PNG images in parallel with caching and adaptive DPI, then prints them.
   */
  public async printPdf(request: UniversalPrintRequest): Promise<UniversalPrintResult> {
    const startTime = Date.now();
    const result: UniversalPrintResult = {
      success: false,
      submitted: false,
      jobId: request.jobId,
      printerName: request.printerName,
      format: 'PDF',
      totalPages: 0,
      copies: request.copies || 1,
      executionDurationMs: 0,
      stageReached: 'VALIDATED'
    };

    if (!fs.existsSync(request.filePath)) {
      result.errorCode = 'FILE_NOT_FOUND';
      result.errorMessage = `PDF file not found: ${request.filePath}`;
      result.executionDurationMs = Date.now() - startTime;
      result.stageReached = 'FAILED';
      return result;
    }

    const stat = fs.statSync(request.filePath);
    if (stat.size === 0) {
      result.errorCode = 'INVALID_FILE_CONTENT';
      result.errorMessage = 'PDF file is empty (0 bytes).';
      result.executionDurationMs = Date.now() - startTime;
      result.stageReached = 'FAILED';
      return result;
    }

    const targetDpi = request.printQuality === 'DRAFT' ? this.DRAFT_DPI : this.DEFAULT_DPI;
    const renderScale = targetDpi / 72;
    const enableCache = request.enableCache !== false; // enabled by default for maximum speed

    // Isolated temporary directory for rendered page PNGs
    const safeJobId = request.jobId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const jobTempDir = path.join(
      os.tmpdir(),
      'PrintFlow_Spool',
      `pdf_${safeJobId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    );

    const renderedImagePaths: string[] = [];
    let loadingTask: any = null;

    try {
      fs.mkdirSync(jobTempDir, { recursive: true, mode: 0o700 });

      // Read PDF buffer
      const pdfBytes = fs.readFileSync(request.filePath);
      if (pdfBytes.length < 5 || !pdfBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
        result.errorCode = 'INVALID_FILE_CONTENT';
        result.errorMessage = 'File does not have a valid %PDF- header signature.';
        result.executionDurationMs = Date.now() - startTime;
        result.stageReached = 'FAILED';
        return result;
      }

      const fileHash = enableCache
        ? crypto.createHash('sha256').update(pdfBytes).digest('hex')
        : '';

      request.onProgress?.('RENDERING', 10);

      // Load through PDF.js
      const uint8Data = new Uint8Array(pdfBytes);
      loadingTask = getDocument({
        data: uint8Data,
        useSystemFonts: true,
        stopAtErrors: false
      });

      let pdfDoc: any;
      try {
        pdfDoc = await loadingTask.promise;
      } catch (loadErr: any) {
        const errMsg = loadErr?.message || String(loadErr);
        if (loadErr?.name === 'PasswordException' || errMsg.toLowerCase().includes('password')) {
          result.errorCode = 'PDF_PASSWORD_REQUIRED';
          result.errorMessage = 'Password-protected or encrypted PDF documents cannot be printed without a password.';
        } else {
          result.errorCode = 'PDF_RENDER_FAILED';
          result.errorMessage = `Failed to parse PDF: ${errMsg}`;
        }
        result.executionDurationMs = Date.now() - startTime;
        result.stageReached = 'FAILED';
        return result;
      }

      const totalDocumentPages = pdfDoc.numPages;
      if (totalDocumentPages <= 0) {
        result.errorCode = 'INVALID_FILE_CONTENT';
        result.errorMessage = 'PDF document contains 0 pages.';
        result.executionDurationMs = Date.now() - startTime;
        result.stageReached = 'FAILED';
        return result;
      }

      const pagesToRender = this.parsePageRange(request.pageRange, totalDocumentPages);
      result.totalPages = pagesToRender.length;

      logger.info('SPOOLER', `Rendering ${pagesToRender.length} PDF page(s) at ${targetDpi} DPI (Parallelized & Cached) for job ${request.jobId}...`);

      // Prepare ordered array to hold image paths
      const pagePathsMap: string[] = new Array(pagesToRender.length);

      // Render pages in parallel chunks (concurrency limit of 4 for optimal CPU & memory utilization)
      const CONCURRENCY_LIMIT = 4;
      for (let batchStart = 0; batchStart < pagesToRender.length; batchStart += CONCURRENCY_LIMIT) {
        const batchSlice = pagesToRender.slice(batchStart, batchStart + CONCURRENCY_LIMIT);

        await Promise.all(
          batchSlice.map(async (pageNum, batchIdx) => {
            const absoluteIdx = batchStart + batchIdx;
            const pageImagePath = path.join(jobTempDir, `page_${String(pageNum).padStart(4, '0')}.png`);
            const cacheKey = fileHash ? path.join(this.CACHE_DIR, `${fileHash}_p${pageNum}_${targetDpi}.png`) : '';

            // 1. Check cache
            if (enableCache && cacheKey && fs.existsSync(cacheKey)) {
              try {
                fs.copyFileSync(cacheKey, pageImagePath);
                pagePathsMap[absoluteIdx] = pageImagePath;
                return;
              } catch {}
            }

            // 2. Render via PDF.js + Canvas
            const page = await pdfDoc.getPage(pageNum);
            try {
              const viewport = page.getViewport({ scale: renderScale });
              const width = Math.max(1, Math.round(viewport.width));
              const height = Math.max(1, Math.round(viewport.height));

              const canvas = createCanvas(width, height);
              const ctx = canvas.getContext('2d');

              await page.render({
                canvasContext: ctx as any,
                viewport
              }).promise;

              const pngBuffer = canvas.toBuffer('image/png');
              fs.writeFileSync(pageImagePath, pngBuffer);

              // Save to cache
              if (enableCache && cacheKey) {
                try {
                  fs.writeFileSync(cacheKey, pngBuffer);
                } catch {}
              }

              pagePathsMap[absoluteIdx] = pageImagePath;
            } finally {
              try {
                if (typeof (page as any).cleanup === 'function') {
                  (page as any).cleanup();
                }
              } catch {}
            }
          })
        );

        const percent = Math.round(10 + ((batchStart + batchSlice.length) / pagesToRender.length) * 40);
        request.onProgress?.('RENDERING', percent);
      }

      for (const pPath of pagePathsMap) {
        if (pPath) renderedImagePaths.push(pPath);
      }

      result.stageReached = 'RENDERED';
      request.onProgress?.('SUBMITTING', 60);

      // Submit rendered pages to Windows native printing
      const nativeResult = await windowsPrintEngine.executeNativePrint({
        jobId: request.jobId,
        printerName: request.printerName,
        imagePaths: renderedImagePaths,
        copies: request.copies,
        paperSize: request.paperSize,
        orientation: request.orientation,
        colorMode: request.colorMode,
        duplex: request.copies ? (pagesToRender.length > 1) : false,
        scalingMode: request.scalingMode || 'FIT_TO_PAGE',
        timeoutMs: request.timeoutMs
      });

      if (!nativeResult.success) {
        return {
          ...nativeResult,
          format: 'PDF',
          totalPages: pagesToRender.length
        };
      }

      request.onProgress?.('SPOOLER_TRACKING', 85);

      // Track active spooler despooling
      const spoolerCheck = await spoolerMonitor.trackJobUntilDespooled(
        request.printerName,
        Math.min(45000, request.timeoutMs || 45000)
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
        format: 'PDF',
        totalPages: pagesToRender.length,
        copies: request.copies || 1,
        executionDurationMs: Date.now() - startTime,
        stageReached: 'SPOOLED'
      };
    } catch (err: any) {
      logger.error('SPOOLER', `PDF rendering or print pipeline failed for job ${request.jobId}: ${err?.message || err}`);
      result.errorCode = 'PDF_RENDER_FAILED';
      result.errorMessage = err instanceof Error ? err.message : 'Unknown PDF rendering error.';
      result.executionDurationMs = Date.now() - startTime;
      result.stageReached = 'FAILED';
      return result;
    } finally {
      if (loadingTask) {
        try {
          if (typeof loadingTask.destroy === 'function') {
            await loadingTask.destroy();
          }
        } catch {}
      }

      for (const imgPath of renderedImagePaths) {
        try {
          if (fs.existsSync(imgPath)) {
            fs.unlinkSync(imgPath);
          }
        } catch {}
      }
      try {
        if (fs.existsSync(jobTempDir)) {
          fs.rmSync(jobTempDir, { recursive: true, force: true });
        }
      } catch {}
    }
  }
}

export const pdfPrintEngine = PDFPrintEngine.getInstance();
