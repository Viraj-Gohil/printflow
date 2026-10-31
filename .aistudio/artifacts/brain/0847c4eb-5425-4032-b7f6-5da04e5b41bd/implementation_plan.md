# Universal Windows Native Print Engine Integration

Integrate the verified standalone Windows printing engine into the PrintFlow Electron Desktop Agent. The new architecture replaces external SumatraPDF binaries with a driver-independent, native Windows printing pipeline powered by .NET `System.Drawing.Printing.PrintDocument`, PDF.js (`pdfjs-dist/legacy`), `@napi-rs/canvas`, and PowerShell 5.1. It provides first-class support for PDF, JPG, JPEG, and PNG files with active Windows Spooler tracking and dynamic printer discovery.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user and guide this architectural implementation:

- **Confirmed Decision 1 (Print Engine Core)**: Fully replace the SumatraPDF (`pdf-to-printer`) dependency with the native .NET `System.Drawing.Printing` and PDF.js canvas rendering engine.
- **Confirmed Decision 2 (Rendering Resolution)**: Use a balanced 200 DPI scale factor (200 / 72 ≈ 2.778×) for PDF page rasterization, balancing crisp text and line art with fast rendering and low memory overhead on counter PCs.
- **Confirmed Decision 3 (Queue & Spooler Tracking)**: Track print jobs through active Windows Print Spooler polling (`Win32_PrintJob`), holding job status in `SPOOLER_TRACKING` until the document has despooled or completed before confirming completion to the backend.

---

## 1. Overview & Core Concept

### What It Does
The PrintFlow Electron Desktop Agent runs on shop counter PCs running Windows 10/11. It automatically claims paid print jobs from the cloud backend, downloads verified documents, validates them against physical hardware capabilities (e.g. monochrome vs. color, A4 vs. roll media), renders PDF/image pages, and prints them via native Windows GDI/Print Spooler APIs using PowerShell and .NET.

### Target Audience
Print shop operators, cyber café owners, and copy-center staff who require fast, reliable, crash-resilient printing on diverse physical hardware without installing third-party document viewers.

### Key Value
- **Zero Third-Party Viewer Dependents**: Eliminates SumatraPDF subprocess crashes and path issues.
- **Multi-Format Support**: Direct printing for PDF documents and JPG/JPEG/PNG image files with proportional centering and printable margin calculations.
- **Hardware-Agnostic**: Works across HP, Canon, Epson, Brother, and Samsung desktop/office printers, as well as ESC/POS receipt printers.
- **Active Spooler Observability**: Confirms when print jobs have safely transferred to physical hardware buffers.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Background Job Execution**:
   - The agent claims a paid job from the backend.
   - The queue item transitions through granular, observable stages: `PENDING` → `DOWNLOADING` → `RENDERING` → `SUBMITTING` → `SPOOLER_TRACKING` → `COMPLETED`.
   - If Windows Spooler reports a paper jam, offline state, or door open, the item transitions to `MANUAL_ATTENTION` with actionable advice without duplicate physical reprints.
2. **Shop Operator Queue UI**:
   - In `QueueView`, operators see live badge indicators for rendering progress, file format badges (`PDF`, `PNG`, `JPG`), target printer, and spooler job IDs.
   - Operators can trigger safe re-prints for pre-spool failures or test-prints directly through the native pipeline.
3. **Printers UI**:
   - In `PrintersView`, operators view discovered physical printers, active hardware capabilities (Color, Duplex, Paper Sizes), and live status.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: PDF.js & Canvas Page Rasterization vs. Direct Spooling
- **Chosen Approach**: Use `pdfjs-dist/legacy` and `@napi-rs/canvas` to render each PDF page into temporary PNGs, which are submitted sequentially into a multi-page .NET `PrintDocument`.
- **Why**: Windows Print Spooler has no native PDF parser without external applications. Rasterizing through high-performance native canvas ensures identical layout, vector text rendering, and exact page dimensions across all printer drivers.
- **Alternatives Considered**: SumatraPDF (had path resolution and command-line length limitations) and headless Chromium printing (heavy memory footprint in Electron).

### Decision 2: PowerShell 5.1 with .NET System.Drawing.Printing
- **Chosen Approach**: Write a consolidated, temporary `.ps1` script invoked via `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <scriptPath>`.
- **Why**: Bypasses `cmd.exe` 8,191-character command line limitations, works out-of-the-box on every Windows 10/11 system without requiring extra runtimes, and directly controls page margins, portrait/landscape orientation, copies, and duplex modes.

### Decision 3: Temporary Page Cleanup Safety
- **Chosen Approach**: Maintain a dedicated temporary spool folder with strict UUID file isolation. Deletion of rendered page PNGs is deferred until the PowerShell `PrintDocument` process exits and releases file handles.

---

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PrintFlow Electron Agent                        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         JobQueueManager                                │
│    Claims orders, downloads files, orchestrates print state machine   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      UniversalPrintService                             │
│     Validates file signatures, coordinates renderers & adapters       │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌─────────────────────────────────────┐  ┌───────────────────────────────┐
│          ImagePrintEngine           │  │        PDFPrintEngine         │
│  JPG, JPEG, PNG image scaling,     │  │  pdfjs-dist/legacy + canvas   │
│  aspect ratio, centering & bounds  │  │  Multi-page PNG rasterization  │
└───────────────────┬─────────────────┘  └───────────┬───────────────────┘
                    │                                │
                    └────────────────┬───────────────┘
                                     │ (Rendered Page PNGs)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        WindowsPrintEngine                              │
│   Generates & executes PowerShell script using .NET PrintDocument      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Windows Spooler Monitor                            │
│  Polls Win32_PrintJob / WMI until job completes or flags attention     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Physical Printer                                │
│          (HP LaserJet P1007, Canon, Epson, Brother, etc.)              │
└────────────────────────────────────────────────────────────────────────┘
```

### Module Responsibilities

1. **`print-agent/src/main/printer/engine/PDFPrintEngine.ts`**:
   - Loads PDF documents using `pdfjs-dist/legacy/build/pdf.mjs`.
   - Iterates pages, renders to `@napi-rs/canvas` at 200 DPI, and saves temporary high-resolution PNG page images.
   - Detects encrypted/password-protected PDFs and returns `PDF_PASSWORD_REQUIRED`.
   - Safely cleans up canvas memory and temporary files after printing.

2. **`print-agent/src/main/printer/engine/ImagePrintEngine.ts`**:
   - Inspects JPG, JPEG, and PNG binary headers and dimensions.
   - Verifies image dimensions and provides bounds/orientation for the print engine.

3. **`print-agent/src/main/printer/engine/WindowsPrintEngine.ts`**:
   - Constructs the PowerShell .NET script utilizing `System.Drawing.Printing.PrintDocument`.
   - Attaches `PrintPage` event handlers to stream images onto page graphics with `AutoFit`, aspect-ratio preservation, and page centering.
   - Applies copies, duplex mode, and paper sizes dynamically.
   - Returns submission confirmation and initial spooler job IDs.

4. **`print-agent/src/main/printer/engine/SpoolerMonitor.ts`**:
   - Queries `Get-CimInstance Win32_PrintJob` for the target printer.
   - Tracks job status through despooling to completion.

5. **`print-agent/src/main/printer/UniversalPrintService.ts`**:
   - Unified entry point `printFile()` accepting `jobId`, `filePath`, `printerName`, `copies`, `paperSize`, `colorMode`, `duplex`.
   - Dispatches to `ImagePrintEngine` or `PDFPrintEngine` + `WindowsPrintEngine`.
   - Standardizes error codes: `FILE_NOT_FOUND`, `UNSUPPORTED_FILE_TYPE`, `INVALID_FILE_CONTENT`, `PRINTER_NOT_FOUND`, `PRINTER_NOT_READY`, `PDF_PASSWORD_REQUIRED`, etc.

6. **`print-agent/src/main/queue/JobQueueManager.ts`**:
   - Updates status transitions to include `RENDERING` and `SPOOLER_TRACKING`.
   - Integrates `UniversalPrintService` in place of old SumatraPDF calls.

---

## 5. Verification Plan

### Automated Build & Test Steps
1. **Dependency Installation**: Install `pdfjs-dist` and `@napi-rs/canvas` in `print-agent`.
2. **Agent Build**: Execute `npm run agent:build` to compile Vite renderer and TypeScript main process.
3. **Applet Compilation**: Run `compile_applet` and `lint_applet` to guarantee complete full-stack type safety.
4. **Automated Universal Print Suite**: Execute `npx tsx test/universal-print-engine.test.ts` covering:
   - PDF multi-page rasterization and orientation handling.
   - Password-protected PDF detection.
   - JPG / JPEG / PNG image aspect ratio and bounds calculation.
   - Dynamic PowerShell .NET script generation.
   - Error code standardization.
   - Queue state machine transitions.
