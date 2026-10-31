# Implementation Plan - Print Agent Print Time & PDF Rendering Optimization

## User Objective
Reduce print execution time in the PrintFlow Electron Desktop Agent by optimizing PDF rendering performance, enabling parallel page rendering, adaptive DPI options, and intelligent page image caching.

---

## Proposed Changes

### 1. Print Agent PDF Renderer (`print-agent/src/main/printer/engine/PDFPrintEngine.ts`)
- **Parallel Page Rendering**: Replace the sequential `for` loop over `pagesToRender` with a batched or concurrent `Promise.all` execution pool (e.g., rendering up to 4 pages concurrently using `@napi-rs/canvas`).
- **Render Caching (SHA-256 File Checksum Cache)**:
  - Compute a quick SHA-256 hash of the PDF file content.
  - Store rendered page image buffers or paths in a local LRU/disk cache directory (`PrintFlow_Cache/pdf_pages`) so repeat jobs skip rasterization entirely.
- **Adaptive Resolution / Fast Draft Mode**:
  - Add optional draft quality setting (e.g. 150 DPI instead of 200 DPI for faster rasterization when speed is prioritized).

### 2. Print Request Types & Queue Management (`print-agent/src/main/printer/types/printing.ts` & `JobQueueManager.ts`)
- Pass print speed/quality preferences (`printQuality: 'DRAFT' | 'STANDARD' | 'HIGH'`, `enableCache?: boolean`) through print job requests.

---

## Verification Plan

### Automated Tests
- Create `test/pdf-print-optimization.test.ts` to verify:
  1. Parallel page rendering correctness against sequential baseline.
  2. PDF page cache hit rate (repeat print jobs execute without re-rasterizing).
  3. Page range filtering and checksum integrity.
- Run `npm run agent:build` and `compile_applet`.
