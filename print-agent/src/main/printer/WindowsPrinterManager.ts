import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { app, BrowserWindow } from 'electron';
import { createRequire } from 'module';
import { DiscoveredPrinter, PrintFileItem, TestPrintResult } from '../../renderer/types/agent.js';
import { PrintSettingsAdapter } from './PrintSettingsAdapter.js';
import { printerCapabilityDetector } from './engine/PrinterCapabilityDetector.js';
import { localVault } from '../storage/LocalDataVault.js';
import { logger } from '../logger/AgentLogger.js';

const execAsync = util.promisify(exec);
const require = createRequire(import.meta.url);

export class WindowsPrinterManager {
  private static instance: WindowsPrinterManager;
  private cachedPrinters: DiscoveredPrinter[] = [];
  private activeScanPromise: Promise<DiscoveredPrinter[]> | null = null;

  private constructor() {}

  public static getInstance(): WindowsPrinterManager {
    if (!WindowsPrinterManager.instance) {
      WindowsPrinterManager.instance = new WindowsPrinterManager();
    }
    return WindowsPrinterManager.instance;
  }

  /**
   * Discovers installed Windows printers using Electron APIs and PowerShell WMI
   * Avoids overlapping scans using an active promise lock.
   */
  public async discoverPrinters(mainWindow?: BrowserWindow | null): Promise<DiscoveredPrinter[]> {
    if (this.activeScanPromise) {
      logger.info('SPOOLER', 'Discovery scan already in progress, returning existing scan operation.');
      return this.activeScanPromise;
    }

    this.activeScanPromise = (async () => {
      try {
        logger.info('SPOOLER', 'Scanning for connected Windows printers...');
        const discoveredByName = new Map<string, DiscoveredPrinter>();
        const existingCacheMap = new Map<string, DiscoveredPrinter>();
        for (const cp of this.cachedPrinters) {
          existingCacheMap.set(cp.name.trim().toLowerCase(), cp);
        }

        // 1. Try Electron native getPrintersAsync if window webContents is active
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

        // 2. Refresh Windows status & driver capabilities via PowerShell WMI
        if (process.platform === 'win32') {
          try {
            const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, DriverName, Default, PrinterStatus, WorkOffline, DetectedErrorState, PortName, PrinterPaperNames, Capabilities, Color | ConvertTo-Json -Depth 3"`;
            const { stdout } = await execAsync(psCommand, { timeout: 12000 });
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

                // Detect rich driver capabilities without hardcoded model assumptions
                const hardware = await printerCapabilityDetector.detectCapabilities(
                  name,
                  item.DriverName,
                  item.PortName
                );

                // Reconcile and compute effective capabilities with persistent local vault
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
          }
        } else {
          // Non-Windows simulation / test environment
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
        logger.info('SPOOLER', `Discovered ${discovered.length} active printer device(s)`);
        return discovered;
      } finally {
        this.activeScanPromise = null;
      }
    })();

    return this.activeScanPromise;
  }

  public getCachedPrinters(): DiscoveredPrinter[] {
    return this.cachedPrinters;
  }

  /**
   * Spools a downloaded file to a target printer using configured settings
   */
  public async spoolJob(
    file: PrintFileItem,
    tempFilePath: string,
    targetPrinterName?: string,
    timeoutMs = 30000
  ): Promise<{ success: boolean; submitted: boolean; error?: string }> {
    if (this.cachedPrinters.length === 0) {
      await this.discoverPrinters();
    }

    const defaultPrinter = this.cachedPrinters.find((p) => p.isDefault)?.name || this.cachedPrinters[0]?.name;
    const requestedName = targetPrinterName || defaultPrinter;

    if (!requestedName) {
      return { success: false, submitted: false, error: 'No Windows printer is configured. Connect a physical printer, then rescan.' };
    }
    if (PrintSettingsAdapter.isVirtualPrinter(requestedName)) {
      return {
        success: false,
        submitted: false,
        error: `"${requestedName}" is a virtual/document printer, not a physical printer. Select a connected shop printer.`
      };
    }

    // Robust printer name resolution: exact, then case-insensitive trimmed, then partial/contains
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
      return {
        success: false,
        submitted: false,
        error: `Printer "${requestedName}" is not available to Windows. Connect it and rescan printers.`
      };
    }
    if (!selectedPrinter.isOnline) {
      return {
        success: false,
        submitted: false,
        error: `Printer "${actualPrinterName}" is offline or disconnected. Reconnect it in Windows, then rescan printers.`
      };
    }

    const effectiveTimeoutMs = Math.max(30000, timeoutMs);

    // 1. Validate print job parameters against physical adapter capabilities and rules
    const { adapterRegistry } = await import('./AdapterRegistry.js');
    const validation = await adapterRegistry.validateJob(actualPrinterName, file, selectedPrinter.driverName);
    if (!validation.isValid) {
      logger.warn('SPOOLER', `Job validation rejected for "${actualPrinterName}": ${validation.error}`);
      return {
        success: false,
        submitted: false,
        error: validation.error || 'Job settings violate printer hardware capabilities or policy.'
      };
    }

    // 2. Dispatch print job through the appropriate modular printer adapter
    const printResult = await adapterRegistry.printJob({
      printerName: actualPrinterName,
      tempFilePath,
      fileItem: file,
      timeoutMs: effectiveTimeoutMs
    });

    if (printResult.success) {
      logger.info('SPOOLER', `Printer adapter (${printResult.adapterName}) confirmed job submission for "${actualPrinterName}"`);
    } else {
      logger.warn('SPOOLER', `Printer adapter (${printResult.adapterName}) reported rejection for "${actualPrinterName}": ${printResult.error}`);
    }

    return {
      success: printResult.success,
      submitted: printResult.submitted,
      error: printResult.error
    };
  }

  /**
   * Generates and executes a test print to verify hardware connectivity
   */
  public async executeTestPrint(printerName: string): Promise<TestPrintResult> {
    if (this.cachedPrinters.length === 0) {
      await this.discoverPrinters();
    }
    let printer = this.cachedPrinters.find((item) => item.name === printerName);
    if (!printer && printerName) {
      const lower = printerName.trim().toLowerCase();
      printer = this.cachedPrinters.find((item) => item.name.trim().toLowerCase() === lower);
    }
    if (!printer && printerName) {
      const lower = printerName.trim().toLowerCase();
      printer = this.cachedPrinters.find(
        (item) => item.name.trim().toLowerCase().includes(lower) || lower.includes(item.name.trim().toLowerCase())
      );
    }
    const resolvedName = printer ? printer.name : printerName;

    if (PrintSettingsAdapter.isVirtualPrinter(resolvedName)) {
      return {
        success: false,
        printerName: resolvedName,
        message: `"${resolvedName}" is a virtual/document printer, not a physical printer.`
      };
    }
    if (!printer || !printer.isOnline) {
      return {
        success: false,
        printerName: resolvedName,
        message: `Printer "${resolvedName}" is offline or disconnected. Reconnect it in Windows, then rescan printers.`
      };
    }
    logger.info('SPOOLER', `Initiating test print on device: ${resolvedName}`);
    const tempDir = os.tmpdir();
    const testDocPath = path.join(tempDir, `printflow_test_${Date.now()}.pdf`);

    const testPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 120 >> stream
BT
/F1 16 Tf
50 780 Td
(PrintFlow Cloud Desktop Agent - Hardware Diagnostic Test) Tj
0 -30 Td
(Printer Device: ${printerName}) Tj
0 -20 Td
(Timestamp: ${new Date().toLocaleString()}) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000236 00000 n 
0000000406 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
485
%%EOF`;

    try {
      fs.writeFileSync(testDocPath, testPdf, 'utf8');
      const testFileItem: PrintFileItem = {
        id: 'test_file',
        fileName: 'PrintFlow_Diagnostic_Test.pdf',
        pageCount: 1,
        copies: 1,
        colorMode: 'BW',
        paperSize: 'A4',
        duplex: false
      };

      const result = await this.spoolJob(testFileItem, testDocPath, printerName);
      
      // Clean up temp test file
      setTimeout(() => {
        try {
          if (fs.existsSync(testDocPath)) fs.unlinkSync(testDocPath);
        } catch {
          // Ignore
        }
      }, 5000);

      if (result.success) {
        return {
          success: true,
          printerName,
          message: `Windows confirmed the test page printed on ${printerName}.`
        };
      } else {
        return {
          success: false,
          printerName,
          message: result.error || 'Failed to dispatch test print to printer.'
        };
      }
    } catch (err: any) {
      return {
        success: false,
        printerName,
        message: `Test print error: ${err.message}`
      };
    }
  }
}

export const printerManager = WindowsPrinterManager.getInstance();
