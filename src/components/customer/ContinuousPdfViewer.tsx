import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ZoomIn, ZoomOut, RotateCcw, Loader2, AlertCircle } from 'lucide-react';

// Configure worker src for pdfjs-dist in browser
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface ContinuousPdfViewerProps {
  fileUrl: string;
  fileName?: string;
  colorMode?: 'BW' | 'COLOR';
}

interface PageState {
  pageNum: number;
  width: number;
  height: number;
  rendered: boolean;
  rendering: boolean;
}

export const ContinuousPdfViewer: React.FC<ContinuousPdfViewerProps> = ({
  fileUrl,
  fileName,
  colorMode = 'COLOR'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageStates, setPageStates] = useState<Map<number, PageState>>(new Map());

  // Track page heights and widths for scaling and placeholder spacing
  const pageDimensionsRef = useRef<Map<number, { width: number; height: number }>>(new Map());
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTasksRef = useRef<Map<number, any>>(new Map());

  // Load PDF document
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setNumPages(0);
    setPageStates(new Map());

    async function loadPdf() {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: fileUrl,
          withCredentials: false
        });
        const pdfDoc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdfDoc;
        const total = pdfDoc.numPages;
        setNumPages(total);

        // Pre-fetch page 1 viewport to establish base dimensions
        const initialStates = new Map<number, PageState>();
        const dimsMap = new Map<number, { width: number; height: number }>();

        for (let i = 1; i <= total; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          dimsMap.set(i, { width: viewport.width, height: viewport.height });
          initialStates.set(i, {
            pageNum: i,
            width: viewport.width,
            height: viewport.height,
            rendered: false,
            rendering: false
          });
        }

        if (isCancelled) return;
        pageDimensionsRef.current = dimsMap;
        setPageStates(initialStates);
        setIsLoading(false);
      } catch (err: any) {
        if (!isCancelled) {
          setIsLoading(false);
          setLoadError(err?.message || 'Failed to load PDF document for preview.');
        }
      }
    }

    void loadPdf();

    return () => {
      isCancelled = true;
      if (pdfDocRef.current) {
        try {
          (pdfDocRef.current as any).destroy?.();
        } catch {}
      }
    };
  }, [fileUrl]);

  // Render a specific page onto its canvas
  const renderPage = useCallback(async (pageNum: number, currentScale: number) => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc) return;

    const existingTask = renderTasksRef.current.get(pageNum);
    if (existingTask) {
      try {
        existingTask.cancel();
      } catch {}
      renderTasksRef.current.delete(pageNum);
    }

    const canvas = canvasRefs.current.get(pageNum);
    if (!canvas) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const renderContext = {
        canvasContext: context,
        canvas,
        viewport
      };

      const renderTask = page.render(renderContext as any);
      renderTasksRef.current.set(pageNum, renderTask);

      await renderTask.promise;
      renderTasksRef.current.delete(pageNum);

      setPageStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(pageNum);
        if (existing) {
          next.set(pageNum, {
            ...existing,
            width: viewport.width,
            height: viewport.height,
            rendered: true,
            rendering: false
          });
        }
        return next;
      });
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    }
  }, []);

  // Unrender / clean up canvas when page leaves viewport to free memory
  const unrenderPage = useCallback((pageNum: number) => {
    const existingTask = renderTasksRef.current.get(pageNum);
    if (existingTask) {
      try {
        existingTask.cancel();
      } catch {}
      renderTasksRef.current.delete(pageNum);
    }

    const canvas = canvasRefs.current.get(pageNum);
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
    }

    setPageStates((prev) => {
      const next = new Map(prev);
      const existing = next.get(pageNum);
      if (existing && existing.rendered) {
        next.set(pageNum, {
          ...existing,
          rendered: false,
          rendering: false
        });
      }
      return next;
    });
  }, []);

  // IntersectionObserver for lazy rendering and page tracking
  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNumAttr = entry.target.getAttribute('data-page-num');
          if (!pageNumAttr) return;
          const pageNum = parseInt(pageNumAttr, 10);

          if (entry.isIntersecting) {
            setCurrentPage(pageNum);
            const state = pageStates.get(pageNum);
            if (state && !state.rendered && !state.rendering) {
              void renderPage(pageNum, scale);
            }
          } else {
            // Unrender if far outside viewport (lazy memory reclamation)
            const state = pageStates.get(pageNum);
            if (state && state.rendered) {
              // Keep nearby pages if desired, or unrender
              // For strict memory saving on 500-page PDFs, unrender when out of view
              unrenderPage(pageNum);
            }
          }
        });
      },
      {
        root: container,
        rootMargin: '300px 0px', // preload buffer
        threshold: 0.05
      }
    );

    const pageElements = container.querySelectorAll('.pdf-page-container');
    pageElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [numPages, scale, pageStates, renderPage, unrenderPage]);

  // Handle zoom changes
  const handleZoomIn = () => {
    setScale((prev) => Math.min(2.5, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  };

  const handleZoomReset = () => {
    setScale(1.0);
  };

  if (isLoading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center gap-3 bg-slate-100 rounded-2xl text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-bold">Loading PDF document ({fileName || 'Document'})...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center gap-3 bg-red-50 rounded-2xl text-red-600 p-6 text-center">
        <AlertCircle className="w-8 h-8" />
        <p className="text-xs font-bold">{loadError}</p>
        <p className="text-[11px] text-red-400">The file is preserved for original printing.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/80 shadow-xl">
      {/* Viewer Toolbar: Zoom Controls & Page Indicator */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 text-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 bg-blue-600/30 text-blue-400 rounded-lg border border-blue-500/30 font-mono">
            Page {currentPage} of {numPages}
          </span>
          <span className="text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-xs">
            {fileName || 'Document.pdf'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 rounded-lg cursor-pointer transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-300 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 2.5}
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 rounded-lg cursor-pointer transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors ml-1"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Continuous Vertical Scrolling Viewport */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 flex flex-col items-center gap-6 bg-slate-900/90 relative scroll-smooth ${
          colorMode === 'BW' ? 'grayscale' : ''
        }`}
        style={{ maxHeight: '460px' }}
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
          const dims = pageDimensionsRef.current.get(pageNum) || { width: 600, height: 850 };
          const scaledWidth = Math.round(dims.width * scale);
          const scaledHeight = Math.round(dims.height * scale);
          const state = pageStates.get(pageNum);

          return (
            <div
              key={pageNum}
              data-page-num={pageNum}
              className="pdf-page-container bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-300 relative flex items-center justify-center transition-all"
              style={{
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
                minHeight: `${scaledHeight}px`
              }}
            >
              {(!state || !state.rendered) && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400 text-xs font-mono">
                  <span>Page {pageNum}</span>
                </div>
              )}
              <canvas
                ref={(el) => {
                  if (el) {
                    canvasRefs.current.set(pageNum, el);
                  } else {
                    canvasRefs.current.delete(pageNum);
                  }
                }}
                className="w-full h-full object-contain block"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
