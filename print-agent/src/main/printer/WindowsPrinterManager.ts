import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { app, BrowserWindow } from 'electron';
import { createRequire } from 'module';
import { DiscoveredPrinter, PrintFileItem, TestPrintResult } from '../../renderer/types/agent.js';
import { PrintSettingsAdapter } from './PrintSettingsAdapter.js';
import { logger } from '../logger/AgentLogger.js';

const execAsync = util.promisify(exec);
const require = createRequire(import.meta.url);

export class WindowsPrinterManager {
  private static instance: WindowsPrinterManager;
  private cachedPrinters: DiscoveredPrinter[] = [];

  private constructor() {}

  public static getInstance(): WindowsPrinterManager {
    if (!WindowsPrinterManager.instance) {
      WindowsPrinterManager.instance = new WindowsPrinterManager();
    }
    return WindowsPrinterManager.instance;
  }

  /**
   * Discovers installed Windows printers using Electron APIs and PowerShell WMI
   */
  public async discoverPrinters(mainWindow?: BrowserWindow | null): Promise<DiscoveredPrinter[]> {
    logger.info('SPOOLER', 'Scanning for connected Windows printers...');
    const discoveredByName = new Map<string, DiscoveredPrinter>();

    // 1. Try Electron native getPrintersAsync if window is available
    if (mainWindow && mainWindow.webContents) {
      try {
        const electronPrinters = await mainWindow.webContents.getPrintersAsync();
        for (const ep of electronPrinters) {
          const isVirtual = PrintSettingsAdapter.isVirtualPrinter(ep.name);
          discoveredByName.set(ep.name, {
            name: ep.name,
            displayName: ep.displayName || ep.name,
            isDefault: ep.isDefault,
            status: isVirtual ? 'ERROR' : ep.status === 0 ? 'READY' : 'ERROR',
            isOnline: !isVirtual && ep.status === 0,
            capabilities: {
              paperSizes: [],
              supportsColor: null,
              supportsDuplex: null
            }
          });
        }
      } catch (err: any) {
        logger.warn('SPOOLER', 'Electron native printer discovery failed', { error: err.message });
      }
    }

    // 2. Refresh Windows status so offline queues are not mistaken for connected printers.
    if (process.platform === 'win32') {
      try {
        const psCommand = `powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, DriverName, Default, PrinterStatus, WorkOffline, DetectedErrorState, PortName | ConvertTo-Json"`;
        const { stdout } = await execAsync(psCommand, { timeout: 10000 });
        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of list) {
            const name = item.Name;
            if (typeof name !== 'string' || !name) continue;
            const isVirtual = PrintSettingsAdapter.isVirtualPrinter(name);
            const isOffline = Boolean(item.WorkOffline) ||
              item.PrinterStatus === 6 ||
              item.PrinterStatus === 7 ||
              item.DetectedErrorState === 10;
            const hasDeviceError = [4, 5, 8, 9, 11, 12].includes(Number(item.DetectedErrorState));
            const statusIsKnownOnline = [3, 4, 5].includes(Number(item.PrinterStatus));
            const isOnline = !isVirtual && !isOffline && !hasDeviceError && statusIsKnownOnline;
            const electronPrinter = discoveredByName.get(name);
            const status = isVirtual || hasDeviceError || (!isOnline && !isOffline)
              ? 'ERROR'
              : isOffline
                ? 'OFFLINE'
                : item.PrinterStatus === 4
                  ? 'PRINTING'
                  : 'READY';
            discoveredByName.set(name, {
              name,
              displayName: electronPrinter?.displayName || name,
              isDefault: Boolean(item.Default) || Boolean(electronPrinter?.isDefault),
              status,
              isOnline,
              driverName: item.DriverName || electronPrinter?.driverName,
              portName: item.PortName,
              capabilities: electronPrinter?.capabilities || {
                paperSizes: [],
                supportsColor: null,
                supportsDuplex: null
              }
            });
          }
        }
      } catch (err: any) {
        logger.warn('SPOOLER', 'PowerShell printer query failed', { error: err.message });
      }
    }

    const discovered = Array.from(discoveredByName.values());
    this.cachedPrinters = discovered;
    logger.info('SPOOLER', `Discovered ${discovered.length} active printer device(s)`);
    return discovered;
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
    const printerName = targetPrinterName || this.cachedPrinters.find((p) => p.isDefault)?.name || this.cachedPrinters[0]?.name;

    if (!printerName) {
      return { success: false, submitted: false, error: 'No Windows printer is configured. Connect a physical printer, then rescan.' };
    }
    if (PrintSettingsAdapter.isVirtualPrinter(printerName)) {
      return {
        success: false,
        submitted: false,
        error: `"${printerName}" is a virtual/document printer, not a physical printer. Select a connected shop printer.`
      };
    }
    const selectedPrinter = this.cachedPrinters.find((printer) => printer.name === printerName);
    if (!selectedPrinter) {
      return {
        success: false,
        submitted: false,
        error: `Printer "${printerName}" is not available to Windows. Connect it and rescan printers.`
      };
    }
    if (!selectedPrinter.isOnline) {
      return {
        success: false,
        submitted: false,
        error: `Printer "${printerName}" is offline or disconnected. Reconnect it in Windows, then rescan printers.`
      };
    }

    const effectiveTimeoutMs = Math.max(30000, timeoutMs);
    const packageEntry = require.resolve('pdf-to-printer');
    let packageDirectory = path.dirname(packageEntry);
    if (app.isPackaged) {
      packageDirectory = packageDirectory.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
    }
    const sumatraFile = fs.readdirSync(packageDirectory).find((name) => /^SumatraPDF-.+\.exe$/i.test(name));
    if (!sumatraFile) {
      return { success: false, submitted: false, error: 'The bundled Windows print engine is missing. Repair or reinstall PrintFlow Agent.' };
    }
    const commandArgs = PrintSettingsAdapter.adaptSettings(
      file,
      printerName,
      tempFilePath,
      effectiveTimeoutMs,
      path.join(packageDirectory, sumatraFile)
    );
    const encodedCommand = Buffer.from(commandArgs.powershellCommand, 'utf16le').toString('base64');
    logger.info('SPOOLER', `Spooling document to printer "${printerName}"`, {
      copies: commandArgs.copies,
      paperSize: commandArgs.paperSize,
      duplex: commandArgs.duplexMode,
      color: commandArgs.color
    });

    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(`powershell -NoProfile -EncodedCommand ${encodedCommand}`, {
          timeout: effectiveTimeoutMs + 5000
        });
        const resultLine = stdout.trim().split(/\r?\n/).pop();
        const result = JSON.parse(resultLine || '{}') as { success?: boolean; submitted?: boolean; error?: string };
        if (!result.success) {
          return {
            success: false,
            submitted: Boolean(result.submitted),
            error: result.error || 'Windows could not confirm that the printer completed the job.'
          };
        }
        logger.info('SPOOLER', `Windows confirmed print job completed on ${printerName}`);
        return { success: true, submitted: true };
      } catch (err: any) {
        const error = err.killed
          ? `Timed out waiting for printer "${printerName}". Check its connection and queue before retrying.`
          : 'Windows could not check the printer queue. Verify the Print Spooler service and printer driver.';
        logger.error('SPOOLER', `Windows spooler execution failed for "${printerName}"`);
        return { success: false, submitted: Boolean(err.killed || err.stdout), error };
      }
    }

    return { success: false, submitted: false, error: 'Physical printing is supported only by the Windows desktop agent.' };
  }

  /**
   * Generates and executes a test print to verify hardware connectivity
   */
  public async executeTestPrint(printerName: string): Promise<TestPrintResult> {
    const printer = this.cachedPrinters.find((item) => item.name === printerName);
    if (PrintSettingsAdapter.isVirtualPrinter(printerName)) {
      return {
        success: false,
        printerName,
        message: `"${printerName}" is a virtual/document printer, not a physical printer.`
      };
    }
    if (!printer || !printer.isOnline) {
      return {
        success: false,
        printerName,
        message: `Printer "${printerName}" is offline or disconnected. Reconnect it in Windows, then rescan printers.`
      };
    }
    logger.info('SPOOLER', `Initiating test print on device: ${printerName}`);
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
