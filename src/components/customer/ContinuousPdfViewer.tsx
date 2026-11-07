import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  X
} from 'lucide-react';

// Configure worker src for pdfjs-dist in browser
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface ContinuousPdfViewerProps {
  fileBlob?: Blob | File | null;
  fileUrl?: string;
  fileName?: string;
  colorMode?: 'BW' | 'COLOR';
  onRetry?: () => void;
  onClose?: () => void;
}

export const ContinuousPdfViewer: React.FC<ContinuousPdfViewerProps> = ({
  fileBlob,
  fileUrl,
  fileName = 'Document.pdf',
  colorMode = 'COLOR',
  onRetry,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<any>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<'custom' | 'width' | 'page'>('width');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<{
    type: 'NETWORK' | 'EXPIRED' | 'CORRUPT' | 'RENDER' | 'GENERAL';
    message: string;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Raw page dimension cache
  const basePageDimRef = useRef<{ width: number; height: number }>({ width: 595.28, height: 841.89 });

  // 1. Load PDF Document from fileBlob (in-memory, guaranteed no network fetch) or fileUrl
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setNumPages(0);
    setCurrentPage(1);

    async function loadPdf() {
      try {
        let dataBuffer: Uint8Array | null = null;

        // Path A: Direct Blob/File from memory (Best, 100% resilient, zero network fetch)
        if (fileBlob) {
          try {
            const arrayBuffer = await fileBlob.arrayBuffer();
            dataBuffer = new Uint8Array(arrayBuffer);
          } catch (blobErr: any) {
            console.warn('[EasyToPrint PDF Viewer] Failed to read fileBlob arrayBuffer:', blobErr);
          }
        }

        // Path B: Blob URL / Data URL / Remote URL
        if (!dataBuffer && fileUrl) {
          if (fileUrl.startsWith('data:')) {
            const res = await fetch(fileUrl);
            const arrayBuffer = await res.arrayBuffer();
            dataBuffer = new Uint8Array(arrayBuffer);
          } else if (fileUrl.startsWith('blob:')) {
            try {
              const res = await fetch(fileUrl);
              if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                dataBuffer = new Uint8Array(arrayBuffer);
              }
            } catch (blobFetchErr) {
              console.warn('[EasyToPrint PDF Viewer] Blob fetch failed, will try direct URL loader:', blobFetchErr);
            }
          } else {
            // Remote URL (e.g. Supabase signed URL)
            try {
              const res = await fetch(fileUrl);
              if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                dataBuffer = new Uint8Array(arrayBuffer);
              }
            } catch (netErr) {
              console.warn('[EasyToPrint PDF Viewer] Network fetch failed, will fallback to pdfjs URL loader:', netErr);
            }
          }
        }

        if (isCancelled) return;

        let pdfDoc: pdfjsLib.PDFDocumentProxy;

        if (dataBuffer && dataBuffer.byteLength > 0) {
          const loadingTask = pdfjsLib.getDocument({
            data: dataBuffer,
            cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
            cMapPacked: true
          });
          pdfDoc = await loadingTask.promise;
        } else if (fileUrl) {
          const loadingTask = pdfjsLib.getDocument({
            url: fileUrl,
            withCredentials: false,
            cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
            cMapPacked: true
          });
          pdfDoc = await loadingTask.promise;
        } else {
          throw new Error('No valid PDF data or URL was provided to the viewer.');
        }

        if (isCancelled) return;

        pdfDocRef.current = pdfDoc;
        const total = pdfDoc.numPages || 1;
        setNumPages(total);

        // Fetch page 1 dimensions to calculate initial fit
        const firstPage = await pdfDoc.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1.0 });
        basePageDimRef.current = { width: viewport.width, height: viewport.height };

        // Calculate initial Fit to Width
        if (containerRef.current) {
          const availableWidth = containerRef.current.clientWidth - 48; // padding
          if (availableWidth > 0 && viewport.width > 0) {
            const calculatedScale = Math.min(1.6, Math.max(0.5, availableWidth / viewport.width));
            setScale(+calculatedScale.toFixed(2));
          }
        }

        setIsLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        console.error('[EasyToPrint PDF Viewer] Error loading PDF:', err);
        setIsLoading(false);

        const errMsg = String(err?.message || err || '');
        let errorType: 'NETWORK' | 'EXPIRED' | 'CORRUPT' | 'RENDER' | 'GENERAL' = 'GENERAL';

        if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('404')) {
          errorType = 'NETWORK';
        } else if (errMsg.includes('token') || errMsg.includes('expired') || errMsg.includes('401') || errMsg.includes('403')) {
          errorType = 'EXPIRED';
        } else if (errMsg.includes('Invalid PDF') || errMsg.includes('corrupt') || errMsg.includes('format')) {
          errorType = 'CORRUPT';
        }

        setLoadError({
          type: errorType,
          message: 'Your document is saved, but its preview could not be loaded.'
        });
      }
    }

    void loadPdf();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
      if (pdfDocRef.current) {
        try {
          (pdfDocRef.current as any).destroy?.();
        } catch {}
      }
    };
  }, [fileBlob, fileUrl, reloadKey]);

  // 2. Render Current Page onto Canvas with High-DPI support
  const renderCurrentPage = useCallback(async () => {
    const pdfDoc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdfDoc || !canvas) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {}
      renderTaskRef.current = null;
    }

    setIsRenderingPage(true);

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext('2d');
      if (!context) return;

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderContext: any = {
        canvasContext: context,
        transform,
        viewport
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
      setIsRenderingPage(false);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error(`[EasyToPrint PDF Viewer] Render failed on page ${currentPage}:`, err);
        setIsRenderingPage(false);
      }
    }
  }, [currentPage, scale]);

  useEffect(() => {
    if (!isLoading && pdfDocRef.current) {
      void renderCurrentPage();
    }
  }, [isLoading, currentPage, scale, renderCurrentPage]);

  // Page Navigation Handlers
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage((prev) => prev + 1);
  };

  // Zoom Controls
  const handleZoomIn = () => {
    setFitMode('custom');
    setScale((prev) => Math.min(2.5, +(prev + 0.2).toFixed(2)));
  };

  const handleZoomOut = () => {
    setFitMode('custom');
    setScale((prev) => Math.max(0.4, +(prev - 0.2).toFixed(2)));
  };

  const handleZoomReset = () => {
    setFitMode('custom');
    setScale(1.0);
  };

  const handleFitWidth = () => {
    if (!containerRef.current) return;
    setFitMode('width');
    const containerWidth = containerRef.current.clientWidth - 48;
    const baseWidth = basePageDimRef.current.width || 595.28;
    if (containerWidth > 0 && baseWidth > 0) {
      setScale(+(containerWidth / baseWidth).toFixed(2));
    }
  };

  const handleFitPage = () => {
    if (!containerRef.current) return;
    setFitMode('page');
    const containerWidth = containerRef.current.clientWidth - 48;
    const containerHeight = containerRef.current.clientHeight - 48;
    const baseWidth = basePageDimRef.current.width || 595.28;
    const baseHeight = basePageDimRef.current.height || 841.89;

    if (containerWidth > 0 && containerHeight > 0 && baseWidth > 0 && baseHeight > 0) {
      const scaleW = containerWidth / baseWidth;
      const scaleH = containerHeight / baseHeight;
      setScale(+Math.min(scaleW, scaleH).toFixed(2));
    }
  };

  const handleRetry = () => {
    setLoadError(null);
    setReloadKey((k) => k + 1);
    if (onRetry) onRetry();
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="w-full h-[360px] sm:h-[420px] flex flex-col items-center justify-center gap-3 bg-[#F7F8F7] rounded-2xl border border-[#E1E7E1] text-[#646B65]">
        <div className="w-12 h-12 rounded-2xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center shadow-xs">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs font-bold text-[#111111]">Preparing document preview...</p>
        <p className="text-[11px] text-[#646B65] max-w-xs text-center truncate px-4">
          {fileName}
        </p>
      </div>
    );
  }

  // Error State
  if (loadError) {
    return (
      <div className="w-full h-[360px] sm:h-[420px] flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-red-200 p-6 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-extrabold text-[#111111]">Unable to Load Document Preview</h4>
          <p className="text-xs text-[#646B65] max-w-sm">{loadError.message}</p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2 bg-[#00B32D] hover:bg-[#008F25] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Preview</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F7F8F7] hover:bg-[#E1E7E1] text-[#111111] font-bold text-xs rounded-xl border border-[#E1E7E1] transition-all cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full flex flex-col bg-[#1E232A] rounded-2xl overflow-hidden border border-[#2E3742] shadow-xl transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 rounded-2xl' : 'h-[400px] sm:h-[440px]'
      }`}
    >
      {/* Top Toolbar: Navigation & Zoom Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-[#14181D] border-b border-[#2E3742] text-slate-200">
        {/* Left: Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg bg-[#252C35] hover:bg-[#323B47] disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-[#252C35] text-white border border-[#323B47] whitespace-nowrap">
            Page {currentPage} of {numPages}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages}
            className="p-1.5 rounded-lg bg-[#252C35] hover:bg-[#323B47] disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Center/Right: Zoom & Fit Controls */}
        <div className="flex items-center gap-1">
          {/* Fit Width */}
          <button
            type="button"
            onClick={handleFitWidth}
            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
              fitMode === 'width' ? 'bg-[#00B32D] text-white' : 'bg-[#252C35] hover:bg-[#323B47] text-slate-300'
            }`}
            title="Fit to Width"
          >
            Fit Width
          </button>

          {/* Fit Page */}
          <button
            type="button"
            onClick={handleFitPage}
            className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
              fitMode === 'page' ? 'bg-[#00B32D] text-white' : 'bg-[#252C35] hover:bg-[#323B47] text-slate-300'
            }`}
            title="Fit to Page"
          >
            Fit Page
          </button>

          <div className="h-4 w-px bg-[#323B47] mx-1 hidden sm:block" />

          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.4}
            className="p-1.5 rounded-lg bg-[#252C35] hover:bg-[#323B47] disabled:opacity-30 text-white cursor-pointer transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-mono font-bold text-slate-200 w-11 text-center">
            {Math.round(scale * 100)}%
          </span>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 2.5}
            className="p-1.5 rounded-lg bg-[#252C35] hover:bg-[#323B47] disabled:opacity-30 text-white cursor-pointer transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Reset Zoom */}
          <button
            type="button"
            onClick={handleZoomReset}
            className="p-1.5 rounded-lg bg-[#252C35] hover:bg-[#323B47] text-slate-400 hover:text-white cursor-pointer transition-colors"
            title="Reset Zoom (100%)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-1.5 rounded-lg bg-[#252C35] hover:bg-[#323B47] text-slate-300 hover:text-white cursor-pointer transition-colors ml-1 hidden sm:block"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Preview'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-[#181C22] relative select-none"
      >
        <div
          className={`relative bg-white shadow-2xl rounded-sm transition-transform duration-100 ${
            colorMode === 'BW' ? 'grayscale contrast-125' : ''
          }`}
          style={{
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)'
          }}
        >
          {isRenderingPage && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 transition-opacity">
              <Loader2 className="w-6 h-6 animate-spin text-[#00B32D]" />
            </div>
          )}
          <canvas ref={canvasRef} className="block max-w-none" />
        </div>
      </div>

      {/* Bottom Status Strip */}
      <div className="px-3 py-1.5 bg-[#14181D] border-t border-[#2E3742] flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate max-w-[220px] sm:max-w-md font-mono">{fileName}</span>
        <span className="font-bold text-[#00B32D]">
          {colorMode === 'BW' ? 'B&W Simulation Active' : 'Colour Mode'}
        </span>
      </div>
    </div>
  );
};
