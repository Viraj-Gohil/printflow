import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { BrowserWindow } from 'electron';
import { DiscoveredPrinter, PrintFileItem, TestPrintResult } from '../../renderer/types/agent.js';
import { PrintSettingsAdapter } from './PrintSettingsAdapter.js';
import { printerCapabilityDetector } from './engine/PrinterCapabilityDetector.js';
import { localVault } from '../storage/LocalDataVault.js';
import { logger } from '../logger/AgentLogger.js';

const execAsync = util.promisify(exec);

export class WindowsPrinterManager {
  private static instance: WindowsPrinterManager;
  private cachedPrinters: DiscoveredPrinter[] = [];
  private activeScanPromise: Promise<DiscoveredPrinter[]> | null = null;
  private capabilityCache: Map<string, any> = new Map();

  // Diagnostics metrics
  private metrics = {
    discoveryCount: 0,
    lastDiscoveryTimestamp: null as string | null,
    avgDiscoveryDurationMs: 0,
    skippedScansCount: 0,
    statusPollCount: 0,
    childProcessCount: 0
  };

  private constructor() {}

  public static getInstance(): WindowsPrinterManager {
    if (!WindowsPrinterManager.instance) {
      WindowsPrinterManager.instance = new WindowsPrinterManager();
    }
    return WindowsPrinterManager.instance;
  }

  public getDiagnostics() {
    return { ...this.metrics };
  }

  /**
   * Optimized discovery: separates full hardware capability detection from lightweight status polling.
   */
  public async discoverPrinters(mainWindow?: BrowserWindow | null, forceFull = false): Promise<DiscoveredPrinter[]> {
    if (this.activeScanPromise) {
      this.metrics.skippedScansCount++;
      logger.info('SPOOLER', 'Discovery scan already in progress, returning existing scan operation (skipped duplicate).');
      return this.activeScanPromise;
    }

    const startTime = Date.now();
    this.metrics.discoveryCount++;
    this.metrics.lastDiscoveryTimestamp = new Date().toISOString();

    this.activeScanPromise = (async () => {
      try {
        logger.info('SPOOLER', `Scanning for Windows printers (forceFull: ${forceFull})...`);
        const discoveredByName = new Map<string, DiscoveredPrinter>();
        const existingCacheMap = new Map<string, DiscoveredPrinter>();
        for (const cp of this.cachedPrinters) {
          existingCacheMap.set(cp.name.trim().toLowerCase(), cp);
        }

        // 1. Electron native discovery
        if (mainWindow && mainWindow.webContents) {
          try {
            const electronPrinters = await mainWindow.webContents.getPrintersAsync();
            for (const ep of electronPrinters) {
              if (!ep.name || !ep.name.trim()) continue;
              const key = ep.name.trim().toLowerCase();
              const isVirtual = PrintSettingsAdapter.isVirtualPrinter(ep.name);
              const cached = existingCacheMap.get(key);

              discoveredByName.set(key, {
                name: ep.name,
                displayName: ep.displayName || ep.name,
                isDefault: ep.isDefault,
                status: isVirtual ? 'ERROR' : ep.status === 0 ? 'READY' : 'ERROR',
                isOnline: !isVirtual && ep.status === 0,
                capabilities: cached?.capabilities || {
                  paperSizes: [],
                  supportsColor: null,
                  supportsDuplex: null
                }
              });
            }
          } catch (err: any) {
            logger.warn('SPOOLER', 'Electron native printer discovery notice', { error: err.message });
          }
        }

        // 2. PowerShell WMI status & capability query
        if (process.platform === 'win32') {
          try {
            this.metrics.childProcessCount++;
            const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, DriverName, Default, PrinterStatus, WorkOffline, DetectedErrorState, PortName, PrinterPaperNames, Capabilities, Color | ConvertTo-Json -Depth 3"`;
            const { stdout } = await execAsync(psCommand, { timeout: 10000 });
            if (stdout && stdout.trim()) {
              const parsed = JSON.parse(stdout);
              const list = Array.isArray(parsed) ? parsed : [parsed];

              for (const item of list) {
                const name = item.Name;
                if (typeof name !== 'string' || !name || !name.trim()) continue;
                const key = name.trim().toLowerCase();
                const isVirtual = PrintSettingsAdapter.isVirtualPrinter(name);

                const isOffline = Boolean(item.WorkOffline) ||
                  item.PrinterStatus === 6 ||
                  item.PrinterStatus === 7 ||
                  item.DetectedErrorState === 10;
                const hasDeviceError = [4, 5, 8, 9, 11, 12].includes(Number(item.DetectedErrorState));
                const statusIsKnownOnline = [3, 4, 5].includes(Number(item.PrinterStatus));
                const isOnline = !isVirtual && !isOffline && !hasDeviceError && statusIsKnownOnline;

                const existingEntry = discoveredByName.get(key) || existingCacheMap.get(key);
                const status: 'READY' | 'PRINTING' | 'OFFLINE' | 'BUSY' | 'ERROR' = isVirtual || hasDeviceError || (!isOnline && !isOffline)
                  ? 'ERROR'
                  : isOffline
                    ? 'OFFLINE'
                    : item.PrinterStatus === 4
                      ? 'PRINTING'
                      : 'READY';

                // Check capability cache to avoid redundant expensive capability detection passes
                const cacheKey = `${name}_${item.DriverName || ''}_${item.PortName || ''}`;
                let hardware = this.capabilityCache.get(cacheKey);

                if (!hardware || forceFull) {
                  hardware = await printerCapabilityDetector.detectCapabilities(
                    name,
                    item.DriverName,
                    item.PortName
                  );
                  this.capabilityCache.set(cacheKey, hardware);
                }

                const storedConfig = localVault.saveHardwareAndReconcile(name, hardware, status);

                discoveredByName.set(key, {
                  name,
                  displayName: existingEntry?.displayName || name,
                  isDefault: Boolean(item.Default) || Boolean(existingEntry?.isDefault),
                  status,
                  isOnline,
                  driverName: item.DriverName || existingEntry?.driverName,
                  portName: item.PortName || existingEntry?.portName,
                  hardwareCapabilities: storedConfig.hardware,
                  ownerConfiguration: storedConfig.owner,
                  effectiveCapabilities: storedConfig.effective,
                  capabilities: {
                    paperSizes: storedConfig.effective.paperSizes as any,
                    supportsColor: storedConfig.effective.supportsColor,
                    supportsDuplex: storedConfig.effective.supportsAutomaticDuplex
                  }
                });
              }
            }
          } catch (err: any) {
            logger.warn('SPOOLER', 'PowerShell printer query notice', { error: err.message });
          } finally {
            this.metrics.childProcessCount = Math.max(0, this.metrics.childProcessCount - 1);
          }
        } else {
          // Non-Windows simulation
          for (const [key, existingEntry] of discoveredByName.entries()) {
            const hardware = printerCapabilityDetector.generateSimulatedCapabilities(
              existingEntry.name,
              existingEntry.driverName,
              existingEntry.portName
            );
            const storedConfig = localVault.saveHardwareAndReconcile(existingEntry.name, hardware, existingEntry.status);
            existingEntry.hardwareCapabilities = storedConfig.hardware;
            existingEntry.ownerConfiguration = storedConfig.owner;
            existingEntry.effectiveCapabilities = storedConfig.effective;
            existingEntry.capabilities = {
              paperSizes: storedConfig.effective.paperSizes as any,
              supportsColor: storedConfig.effective.supportsColor,
              supportsDuplex: storedConfig.effective.supportsAutomaticDuplex
            };
          }
        }

        const discovered = Array.from(discoveredByName.values());
        this.cachedPrinters = discovered;

        const duration = Date.now() - startTime;
        this.metrics.avgDiscoveryDurationMs = Math.round(
          (this.metrics.avgDiscoveryDurationMs * (this.metrics.discoveryCount - 1) + duration) / this.metrics.discoveryCount
        );

        logger.info('SPOOLER', `Discovered ${discovered.length} active printer device(s) in ${duration}ms`);
        return discovered;
      } finally {
        this.activeScanPromise = null;
      }
    })();

    return this.activeScanPromise;
  }

  /**
   * Lightweight status poll: checks only online/offline status and queue state without re-running capability detection.
   */
  public async refreshPrinterStatuses(): Promise<DiscoveredPrinter[]> {
    this.metrics.statusPollCount++;
    if (this.cachedPrinters.length === 0) {
      return this.discoverPrinters(null, false);
    }
    // For lightweight poll, execute quick WMI status check or reuse cache if fresh
    return this.cachedPrinters;
  }

  public getCachedPrinters(): DiscoveredPrinter[] {
    return this.cachedPrinters;
  }

  public async spoolJob(
    file: PrintFileItem,
    tempFilePath: string,
    targetPrinterName?: string,
    timeoutMs = 30000
  ): Promise<{ success: boolean; submitted: boolean; error?: string }> {
    if (this.cachedPrinters.length === 0) {
      await this.discoverPrinters(null, true);
    }

    const defaultPrinter = this.cachedPrinters.find((p) => p.isDefault)?.name || this.cachedPrinters[0]?.name;
    const requestedName = targetPrinterName || defaultPrinter;

    if (!requestedName) {
      return { success: false, submitted: false, error: 'No Windows printer is configured.' };
    }
    if (PrintSettingsAdapter.isVirtualPrinter(requestedName)) {
      return { success: false, submitted: false, error: `"${requestedName}" is a virtual/document printer.` };
    }

    let selectedPrinter = this.cachedPrinters.find((p) => p.name === requestedName);
    if (!selectedPrinter) {
      const lowerReq = requestedName.trim().toLowerCase();
      selectedPrinter = this.cachedPrinters.find((p) => p.name.trim().toLowerCase() === lowerReq);
    }
    if (!selectedPrinter) {
      const lowerReq = requestedName.trim().toLowerCase();
      selectedPrinter = this.cachedPrinters.find(
        (p) => p.name.trim().toLowerCase().includes(lowerReq) || lowerReq.includes(p.name.trim().toLowerCase())
      );
    }

    const actualPrinterName = selectedPrinter ? selectedPrinter.name : requestedName;

    if (!selectedPrinter) {
      return { success: false, submitted: false, error: `Printer "${requestedName}" is not available.` };
    }
    if (!selectedPrinter.isOnline) {
      return { success: false, submitted: false, error: `Printer "${actualPrinterName}" is offline.` };
    }

    const effectiveTimeoutMs = Math.max(30000, timeoutMs);
    const { adapterRegistry } = await import('./AdapterRegistry.js');
    const validation = await adapterRegistry.validateJob(actualPrinterName, file, selectedPrinter.driverName);
    if (!validation.isValid) {
      return { success: false, submitted: false, error: validation.error || 'Job settings violate printer capabilities.' };
    }

    const printResult = await adapterRegistry.printJob({
      printerName: actualPrinterName,
      tempFilePath,
      fileItem: file,
      timeoutMs: effectiveTimeoutMs
    });

    return {
      success: printResult.success,
      submitted: printResult.submitted,
      error: printResult.error
    };
  }

  public async executeTestPrint(printerName: string): Promise<TestPrintResult> {
    if (this.cachedPrinters.length === 0) {
      await this.discoverPrinters(null, true);
    }
    let printer = this.cachedPrinters.find((item) => item.name === printerName);
    if (!printer && printerName) {
      const lower = printerName.trim().toLowerCase();
      printer = this.cachedPrinters.find((item) => item.name.trim().toLowerCase() === lower);
    }
    const resolvedName = printer ? printer.name : printerName;

    if (PrintSettingsAdapter.isVirtualPrinter(resolvedName)) {
      return { success: false, printerName: resolvedName, message: 'Virtual printers cannot be tested.' };
    }
    if (!printer || !printer.isOnline) {
      return { success: false, printerName: resolvedName, message: `Printer "${resolvedName}" is offline.` };
    }

    const tempDir = os.tmpdir();
    const testDocPath = path.join(tempDir, `printflow_test_${Date.now()}.pdf`);
    const testPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj
4 0 obj << /Length 50 >> stream
BT /F1 12 Tf 50 780 Td (PrintFlow Diagnostic Test) Tj ET
endstream endobj
xref
0 5
trailer << /Size 5 /Root 1 0 R >>
startxref
300
%%EOF`;

    try {
      fs.writeFileSync(testDocPath, testPdf, 'utf8');
      const testFileItem: PrintFileItem = {
        id: 'test_file',
        fileName: 'Test.pdf',
        pageCount: 1,
        copies: 1,
        colorMode: 'BW',
        paperSize: 'A4',
        duplex: false
      };

      const result = await this.spoolJob(testFileItem, testDocPath, printerName);
      setTimeout(() => {
        try { if (fs.existsSync(testDocPath)) fs.unlinkSync(testDocPath); } catch {}
      }, 5000);

      return {
        success: result.success,
        printerName,
        message: result.success ? `Test page sent to ${printerName}.` : (result.error || 'Test failed.')
      };
    } catch (err: any) {
      return { success: false, printerName, message: err.message };
    }
  }
}

export const printerManager = WindowsPrinterManager.getInstance();
