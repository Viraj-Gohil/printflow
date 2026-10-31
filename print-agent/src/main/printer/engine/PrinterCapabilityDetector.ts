import { exec } from 'child_process';
import util from 'util';
import {
  HardwareCapabilities,
  HardwarePaperSize,
  CapabilityStatus
} from '../../../renderer/types/capabilities.js';
import { logger } from '../../logger/AgentLogger.js';

const execAsync = util.promisify(exec);

// Standard Paper Dimensions in Millimeters for standard well-known sizes
const STANDARD_PAPER_DIMENSIONS_MM: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
  LETTER: { width: 215.9, height: 279.4 },
  LEGAL: { width: 215.9, height: 355.6 },
  EXECUTIVE: { width: 184.1, height: 266.7 },
  B5: { width: 176, height: 250 },
  ROLL_80MM: { width: 80, height: 297 },
  ROLL_58MM: { width: 58, height: 297 }
};

export class PrinterCapabilityDetector {
  private static instance: PrinterCapabilityDetector;

  private constructor() {}

  public static getInstance(): PrinterCapabilityDetector {
    if (!PrinterCapabilityDetector.instance) {
      PrinterCapabilityDetector.instance = new PrinterCapabilityDetector();
    }
    return PrinterCapabilityDetector.instance;
  }

  /**
   * Generates a self-contained PowerShell script querying .NET System.Drawing.Printing.PrinterSettings
   * and WMI Win32_Printer to extract driver-reported capabilities without hardcoded model checks.
   */
  public buildDetectionScript(printerName: string): string {
    const safePrinterName = printerName.replace(/'/g, "''");
    return `
$ErrorActionPreference = 'SilentlyContinue'
$targetPrinter = '${safePrinterName}'

try {
    Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue

    # 1. Query WMI Win32_Printer
    $wmi = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $targetPrinter -or $_.Name.Trim().ToLower() -eq $targetPrinter.Trim().ToLower() } | Select-Object -First 1

    # 2. Query .NET PrinterSettings (Direct Driver Win32 DeviceCapabilities)
    $ps = New-Object System.Drawing.Printing.PrinterSettings
    $ps.PrinterName = $targetPrinter

    $isValid = $ps.IsValid

    # Color capability
    $supportsColor = $null
    if ($isValid) {
        $supportsColor = [bool]$ps.SupportsColor
    } elseif ($wmi -and $wmi.PSObject.Properties['Color']) {
        $supportsColor = [bool]$wmi.Color
    }

    # Duplex capability
    $canDuplex = $null
    if ($isValid) {
        $canDuplex = [bool]$ps.CanDuplex
    } elseif ($wmi -and $wmi.Capabilities) {
        # Win32 Capabilities: 3 = Duplex, 13 = Duplex Auto, 14 = Duplex Manual
        $canDuplex = ($wmi.Capabilities -contains 3 -or $wmi.Capabilities -contains 13)
    }

    # Manual duplex capability check
    $manualDuplex = $false
    if ($wmi -and $wmi.Capabilities -and ($wmi.Capabilities -contains 14)) {
        $manualDuplex = $true
    }

    # Paper Sizes with dimensions
    $paperSizes = @()
    if ($isValid -and $ps.PaperSizes) {
        foreach ($p in $ps.PaperSizes) {
            # Width and Height are in hundredths of an inch (1/100 inch = 0.254 mm)
            $wMm = [math]::Round([double]$p.Width * 0.254, 1)
            $hMm = [math]::Round([double]$p.Height * 0.254, 1)
            $paperSizes += @{
                name = $p.PaperName
                widthMm = $wMm
                heightMm = $hMm
                rawKind = [int]$p.RawKind
            }
        }
    } elseif ($wmi -and $wmi.PrinterPaperNames) {
        foreach ($pName in $wmi.PrinterPaperNames) {
            $paperSizes += @{
                name = [string]$pName
                widthMm = $null
                heightMm = $null
            }
        }
    }

    # Resolutions (DPI)
    $resolutions = @()
    if ($isValid -and $ps.PrinterResolutions) {
        foreach ($r in $ps.PrinterResolutions) {
            if ($r.X -gt 0) {
                $resolutions += [int]$r.X
            }
        }
    }
    $resolutions = $resolutions | Select-Object -Unique

    # Max copies
    $maxCopies = 1
    if ($isValid -and $ps.MaximumCopies -gt 0) {
        $maxCopies = [int]$ps.MaximumCopies
    }

    $result = @{
        found = [bool]($wmi -or $isValid)
        name = $targetPrinter
        driverName = if ($wmi) { [string]$wmi.DriverName } else { "" }
        portName = if ($wmi) { [string]$wmi.PortName } else { "" }
        isDefault = if ($wmi) { [bool]$wmi.Default } else { [bool]$ps.IsDefaultPrinter }
        workOffline = if ($wmi) { [bool]$wmi.WorkOffline } else { $false }
        printerStatus = if ($wmi) { [int]$wmi.PrinterStatus } else { 3 }
        detectedErrorState = if ($wmi) { [int]$wmi.DetectedErrorState } else { 0 }
        supportsColor = $supportsColor
        canDuplex = $canDuplex
        manualDuplex = $manualDuplex
        paperSizes = $paperSizes
        resolutions = $resolutions
        maxCopies = $maxCopies
    }

    $result | ConvertTo-Json -Depth 4 -Compress
} catch {
    @{
        found = $false
        error = $_.Exception.Message
    } | ConvertTo-Json -Compress
}
`;
  }

  /**
   * Automatically detects rich hardware capabilities for a Windows printer.
   */
  public async detectCapabilities(
    printerName: string,
    fallbackDriverName?: string,
    fallbackPortName?: string
  ): Promise<HardwareCapabilities> {
    const now = new Date().toISOString();

    if (process.platform !== 'win32') {
      // Clean non-Windows fallback for test environments or headless verification
      return this.generateSimulatedCapabilities(printerName, fallbackDriverName, fallbackPortName, now);
    }

    try {
      const script = this.buildDetectionScript(printerName);
      const base64Script = Buffer.from(script, 'utf16le').toString('base64');
      const psCommand = `powershell.exe -NoProfile -NonInteractive -STA -EncodedCommand ${base64Script}`;

      const { stdout } = await execAsync(psCommand, { timeout: 15000 });
      const raw = (stdout || '').trim();

      let parsed: any = null;
      for (const line of raw.split(/\r?\n/).reverse()) {
        const trimmed = line.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            parsed = JSON.parse(trimmed);
            break;
          } catch {}
        }
      }

      if (!parsed || !parsed.found) {
        logger.warn('SPOOLER', `Driver capability detection did not locate printer "${printerName}". Using conservative safe profile.`);
        return this.generateConservativeCapabilities(printerName, fallbackDriverName, fallbackPortName, now);
      }

      return this.parseDriverDetectionResult(parsed, printerName, now);
    } catch (err: any) {
      logger.warn('SPOOLER', `Failed executing driver capability detection for "${printerName}": ${err.message}`);
      return this.generateConservativeCapabilities(printerName, fallbackDriverName, fallbackPortName, now);
    }
  }

  /**
   * Normalizes raw driver result into standard HardwareCapabilities object.
   */
  private parseDriverDetectionResult(raw: any, printerName: string, timestamp: string): HardwareCapabilities {
    const isOffline = Boolean(raw.workOffline) || raw.printerStatus === 6 || raw.printerStatus === 7;
    const hasError = [4, 5, 8, 9, 11, 12].includes(Number(raw.detectedErrorState));
    const status: HardwareCapabilities['basicInfo']['status'] =
      hasError ? 'ERROR' : isOffline ? 'OFFLINE' : raw.printerStatus === 4 ? 'PRINTING' : 'READY';

    const portName = raw.portName || '';
    const connectionType: HardwareCapabilities['basicInfo']['connectionType'] =
      /usb/i.test(portName) ? 'USB'
      : /wsd|http|ipp|192\.|10\.|172\.|tcp/i.test(portName) ? 'LAN'
      : /bt|bluetooth/i.test(portName) ? 'BLUETOOTH'
      : /\\\\/i.test(portName) ? 'NETWORK_SHARE'
      : 'UNKNOWN';

    // Parse Color: SUPPORTED, UNSUPPORTED, UNKNOWN
    let colorStatus: CapabilityStatus = 'UNKNOWN';
    if (typeof raw.supportsColor === 'boolean') {
      colorStatus = raw.supportsColor ? 'SUPPORTED' : 'UNSUPPORTED';
    }

    // Parse Duplex: Separate Auto vs Manual!
    let autoDuplexStatus: CapabilityStatus = 'UNKNOWN';
    if (typeof raw.canDuplex === 'boolean') {
      autoDuplexStatus = raw.canDuplex ? 'SUPPORTED' : 'UNSUPPORTED';
    }

    let manualDuplexStatus: CapabilityStatus = 'UNKNOWN';
    if (typeof raw.manualDuplex === 'boolean') {
      manualDuplexStatus = raw.manualDuplex ? 'SUPPORTED' : 'UNSUPPORTED';
    }

    // Parse Paper Sizes
    const parsedPaperSizes: HardwarePaperSize[] = [];
    const seenNames = new Set<string>();

    if (Array.isArray(raw.paperSizes) && raw.paperSizes.length > 0) {
      for (const item of raw.paperSizes) {
        const name = this.normalizePaperSizeName(item.name || '');
        if (!name || seenNames.has(name.toUpperCase())) continue;
        seenNames.add(name.toUpperCase());

        let widthMm = item.widthMm ? Math.round(Number(item.widthMm)) : undefined;
        let heightMm = item.heightMm ? Math.round(Number(item.heightMm)) : undefined;

        if (!widthMm || !heightMm) {
          const standard = STANDARD_PAPER_DIMENSIONS_MM[name.toUpperCase()];
          if (standard) {
            widthMm = standard.width;
            heightMm = standard.height;
          }
        }

        parsedPaperSizes.push({
          name,
          widthMm,
          heightMm,
          status: 'SUPPORTED'
        });
      }
    }

    // Guarantee common standard paper size detection if not explicitly parsed
    if (parsedPaperSizes.length === 0) {
      parsedPaperSizes.push({
        name: 'A4',
        widthMm: 210,
        heightMm: 297,
        status: 'SUPPORTED'
      });
    }

    // Resolutions (DPI)
    const resolutions: number[] = Array.isArray(raw.resolutions) && raw.resolutions.length > 0
      ? raw.resolutions.map(Number).filter((n: number) => !isNaN(n) && n > 0).sort((a: number, b: number) => a - b)
      : [600];

    const maxCopies = typeof raw.maxCopies === 'number' && raw.maxCopies > 0 ? raw.maxCopies : 999;

    return {
      basicInfo: {
        name: printerName,
        displayName: printerName,
        driverName: raw.driverName || 'Windows Print Driver',
        portName,
        connectionType,
        isDefault: Boolean(raw.isDefault),
        status,
        manufacturer: this.detectManufacturer(printerName, raw.driverName),
        model: raw.driverName || printerName
      },
      color: {
        monochrome: 'SUPPORTED',
        color: colorStatus,
        detectionSource: 'WIN32_DEVMODE_DC_COLORDEVICE',
        lastDetectedAt: timestamp
      },
      paperSizes: parsedPaperSizes,
      sides: {
        singleSided: 'SUPPORTED',
        automaticDuplex: autoDuplexStatus,
        manualDuplex: manualDuplexStatus,
        detectionSource: 'WIN32_DEVICE_CAPABILITIES_DC_DUPLEX',
        lastDetectedAt: timestamp
      },
      resolutions,
      copies: {
        maxCopies,
        status: 'SUPPORTED'
      },
      orientations: ['PORTRAIT', 'LANDSCAPE'],
      detectionSource: 'WMI_AND_DOTNET_PRINT_SETTINGS',
      lastDetectedAt: timestamp
    };
  }

  /**
   * Normalizes paper size name to standard representation (e.g. "Letter", "A4", "A3", "A5").
   */
  public normalizePaperSizeName(rawName: string): string {
    const trimmed = (rawName || '').trim();
    const upper = trimmed.toUpperCase();

    if (upper === 'A4' || upper.includes('A4')) return 'A4';
    if (upper === 'A3' || upper.includes('A3')) return 'A3';
    if (upper === 'A5' || upper.includes('A5')) return 'A5';
    if (upper === 'A6' || upper.includes('A6')) return 'A6';
    if (upper === 'LETTER' || upper.includes('LETTER')) return 'Letter';
    if (upper === 'LEGAL' || upper.includes('LEGAL')) return 'Legal';
    if (upper === 'EXECUTIVE' || upper.includes('EXECUTIVE')) return 'Executive';
    if (upper === 'B5' || upper.includes('B5')) return 'B5';
    if (upper.includes('80MM') || upper.includes('ROLL 80')) return 'Roll_80mm';
    if (upper.includes('58MM') || upper.includes('ROLL 58')) return 'Roll_58mm';

    return trimmed || 'A4';
  }

  /**
   * Detects manufacturer without relying on it to infer capabilities.
   */
  public detectManufacturer(printerName: string, driverName?: string): string {
    const combined = `${printerName} ${driverName || ''}`.toUpperCase();
    if (combined.includes('HP') || combined.includes('HEWLETT')) return 'HP';
    if (combined.includes('CANON')) return 'Canon';
    if (combined.includes('EPSON')) return 'Epson';
    if (combined.includes('BROTHER')) return 'Brother';
    if (combined.includes('SAMSUNG')) return 'Samsung';
    if (combined.includes('XEROX')) return 'Xerox';
    if (combined.includes('RICOH')) return 'Ricoh';
    if (combined.includes('KONICA')) return 'Konica Minolta';
    return 'Generic / Other';
  }

  /**
   * Generates conservative default capabilities when driver query fails or returns minimal info.
   */
  public generateConservativeCapabilities(
    printerName: string,
    driverName?: string,
    portName?: string,
    timestamp = new Date().toISOString()
  ): HardwareCapabilities {
    return {
      basicInfo: {
        name: printerName,
        displayName: printerName,
        driverName: driverName || 'Windows Generic Driver',
        portName: portName || '',
        connectionType: 'UNKNOWN',
        isDefault: false,
        status: 'READY',
        manufacturer: this.detectManufacturer(printerName, driverName),
        model: driverName || printerName
      },
      color: {
        monochrome: 'SUPPORTED',
        color: 'UNKNOWN', // Unknown is NOT treated as supported
        detectionSource: 'CONSERVATIVE_FALLBACK',
        lastDetectedAt: timestamp
      },
      paperSizes: [
        { name: 'A4', widthMm: 210, heightMm: 297, status: 'SUPPORTED' }
      ],
      sides: {
        singleSided: 'SUPPORTED',
        automaticDuplex: 'UNKNOWN', // Unknown is NOT treated as supported
        manualDuplex: 'UNKNOWN',
        detectionSource: 'CONSERVATIVE_FALLBACK',
        lastDetectedAt: timestamp
      },
      resolutions: [600],
      copies: {
        maxCopies: 999,
        status: 'SUPPORTED'
      },
      orientations: ['PORTRAIT', 'LANDSCAPE'],
      detectionSource: 'CONSERVATIVE_FALLBACK',
      lastDetectedAt: timestamp
    };
  }

  /**
   * Generates simulated capabilities for test/non-Windows platforms.
   */
  public generateSimulatedCapabilities(
    printerName: string,
    driverName?: string,
    portName?: string,
    timestamp = new Date().toISOString()
  ): HardwareCapabilities {
    const isColor = /color|cmyk|photo|deskjet|inkjet/i.test(`${printerName} ${driverName || ''}`);
    const isDuplex = /duplex|dn|dw|mfp/i.test(`${printerName} ${driverName || ''}`);
    const isA3 = /a3|tabloid|wide/i.test(`${printerName} ${driverName || ''}`);

    const paperSizes: HardwarePaperSize[] = [
      { name: 'A4', widthMm: 210, heightMm: 297, status: 'SUPPORTED' },
      { name: 'A5', widthMm: 148, heightMm: 210, status: 'SUPPORTED' },
      { name: 'Letter', widthMm: 215.9, heightMm: 279.4, status: 'SUPPORTED' }
    ];

    if (isA3) {
      paperSizes.push({ name: 'A3', widthMm: 297, heightMm: 420, status: 'SUPPORTED' });
    }

    return {
      basicInfo: {
        name: printerName,
        displayName: printerName,
        driverName: driverName || 'Windows Generic Driver',
        portName: portName || 'USB001',
        connectionType: 'USB',
        isDefault: false,
        status: 'READY',
        manufacturer: this.detectManufacturer(printerName, driverName),
        model: driverName || printerName
      },
      color: {
        monochrome: 'SUPPORTED',
        color: isColor ? 'SUPPORTED' : 'UNSUPPORTED',
        detectionSource: 'SIMULATED_TEST_DETECTOR',
        lastDetectedAt: timestamp
      },
      paperSizes,
      sides: {
        singleSided: 'SUPPORTED',
        automaticDuplex: isDuplex ? 'SUPPORTED' : 'UNSUPPORTED',
        manualDuplex: 'SUPPORTED',
        detectionSource: 'SIMULATED_TEST_DETECTOR',
        lastDetectedAt: timestamp
      },
      resolutions: [600, 1200],
      copies: {
        maxCopies: 999,
        status: 'SUPPORTED'
      },
      orientations: ['PORTRAIT', 'LANDSCAPE'],
      detectionSource: 'SIMULATED_TEST_DETECTOR',
      lastDetectedAt: timestamp
    };
  }
}

export const printerCapabilityDetector = PrinterCapabilityDetector.getInstance();
