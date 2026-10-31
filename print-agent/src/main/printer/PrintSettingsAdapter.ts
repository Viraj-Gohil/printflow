import { PrintFileItem } from '../../renderer/types/agent.js';
import { M2MCrypto } from '../security/M2MCrypto.js';

export interface SpoolCommandArgs {
  printerName: string;
  filePath: string;
  copies: number;
  duplexMode: 'simplex' | 'duplexlong' | 'duplexshort';
  paperSize: string;
  color: boolean;
  pages?: string;
  powershellCommand: string;
}

export class PrintSettingsAdapter {
  public static isVirtualPrinter(printerName: string): boolean {
    return /microsoft print to pdf|microsoft xps document writer|onenote|fax|adobe pdf|foxit pdf|pdfcreator/i.test(printerName);
  }

  /** Builds a settings-aware SumatraPDF command and waits for the Windows queue outcome. */
  public static adaptSettings(
    file: PrintFileItem,
    targetPrinterName: string,
    tempFilePath: string,
    timeoutMs: number,
    sumatraPdfPath: string
  ): SpoolCommandArgs {
    const safePrinterName = M2MCrypto.sanitizePrinterName(targetPrinterName);
    const copies = Math.max(1, Math.min(file.copies || 1, 999));
    
    // Duplex mapping
    let duplexMode: 'simplex' | 'duplexlong' | 'duplexshort' = 'simplex';
    if (file.duplex) {
      duplexMode = 'duplexlong';
    }

    // Paper size mapping
    const rawSize = (file.paperSize || 'A4').toUpperCase();
    let paperSize = 'A4';
    if (['A4', 'A3', 'A5', 'LETTER', 'LEGAL'].includes(rawSize)) {
      paperSize = rawSize;
    }

    // Color mode
    const color = file.colorMode === 'COLOR';

    // Page range
    const pages = file.pagesToPrint && file.pagesToPrint.trim() ? file.pagesToPrint.trim() : undefined;
    if (pages && !/^\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*$/.test(pages)) {
      throw new Error('The requested page range is invalid.');
    }

    const safePath = tempFilePath.replace(/'/g, "''");
    const safePrinter = safePrinterName.replace(/'/g, "''");
    const safeSumatraPath = sumatraPdfPath.replace(/'/g, "''");
    const settings = [
      pages,
      color ? 'color' : 'monochrome',
      duplexMode,
      `paper=${paperSize}`,
      `${copies}x`
    ].filter(Boolean).join(',');

    const timeoutSeconds = Math.max(30, Math.ceil(timeoutMs / 1000));
    const powershellCommand = `
$ErrorActionPreference = 'Stop'
$submitted = $false
$filePath = '${safePath}'
$printer = '${safePrinter}'
$sumatra = '${safeSumatraPath}'
$settings = '${settings}'
$timeoutSec = ${timeoutSeconds}
try {
  if ($printer -match 'Microsoft Print to PDF|Microsoft XPS Document Writer|OneNote|Fax|Adobe PDF|Foxit PDF|PDFCreator|Print to PDF') {
    throw "Printer '$printer' is a virtual/document printer, not a physical printer. Select a connected shop printer."
  }
  if (-not (Test-Path -LiteralPath $filePath)) {
    throw 'The downloaded print document is missing.'
  }

  # 1. Authoritative Printer Discovery & Health Check via universal WMI/CIM
  $printerInfo = $null
  try {
    $printerInfo = Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -eq $printer -or $_.Name.Trim().ToLower() -eq $printer.Trim().ToLower() } |
      Select-Object -First 1
  } catch {}
  if (-not $printerInfo) {
    try {
      $printerInfo = Get-Printer -Name $printer -ErrorAction SilentlyContinue
    } catch {}
  }
  if (-not $printerInfo) {
    throw "Printer '$printer' is not installed or available to Windows. Reconnect it, then rescan printers."
  }

  $isOffline = $false
  if ($printerInfo.PSObject.Properties['WorkOffline'] -and $printerInfo.WorkOffline) {
    $isOffline = $true
  }
  if ($printerInfo.PSObject.Properties['PrinterStatus'] -and ($printerInfo.PrinterStatus -eq 7 -or "$($printerInfo.PrinterStatus)" -match 'Offline')) {
    $isOffline = $true
  }
  if ($isOffline) {
    throw "Printer '$printer' is offline or disconnected. Reconnect it in Windows, then rescan printers."
  }

  if ($printerInfo.PSObject.Properties['DetectedErrorState'] -and @(4, 5, 8, 9, 11, 12) -contains [int]$printerInfo.DetectedErrorState) {
    $errMap = @{ 4='Paper Low'; 5='Paper Out'; 8='Door Open'; 9='Paper Jam'; 11='User Intervention Required'; 12='Output Bin Full' }
    $reason = $errMap[[int]$printerInfo.DetectedErrorState]
    if (-not $reason) { $reason = "Hardware state $($printerInfo.DetectedErrorState)" }
    throw "Printer '$printer' is not ready ($reason). Resolve the printer issue, then retry."
  }

  # 2. Dispatch Document directly to bundled SumatraPDF
  if (-not (Test-Path -LiteralPath $sumatra)) {
    throw 'The bundled Windows print engine is missing. Repair or reinstall PrintFlow Agent.'
  }

  $argList = @('-print-to', $printer, '-silent')
  if ($settings) {
    $argList += @('-print-settings', $settings)
  }
  $argList += $filePath

  $proc = Start-Process -FilePath $sumatra -ArgumentList $argList -Wait -PassThru -ErrorAction Stop
  if ($proc.ExitCode -ne 0) {
    throw "Windows print engine (SumatraPDF) exited with code $($proc.ExitCode) for printer '$printer'."
  }
  $submitted = $true

  # 3. Post-Spool Queue Verification (Checks for active spooler errors without blocking fast despooling)
  $errorJob = $null
  try {
    $errorJob = Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue |
      Where-Object { ($_.Name -like "*$printer*" -or $_.Caption -like "*$printer*") -and ($_.Status -match 'Error|Degraded' -or $_.JobStatus -match 'Error|PaperOut|Blocked|UserIntervention') } |
      Select-Object -First 1
  } catch {}

  if ($errorJob) {
    $jobErr = if ($errorJob.JobStatus) { $errorJob.JobStatus.Trim() } else { 'Printer reported an error in queue' }
    throw "Printer '$printer' reported an issue during printing: $jobErr. Check paper, toner, and queue."
  }

  # 4. Success confirmation
  [PSCustomObject]@{ success = $true; submitted = $true; error = $null } | ConvertTo-Json -Compress
  exit 0
} catch {
  [PSCustomObject]@{ success = $false; submitted = $submitted; error = $_.Exception.Message } | ConvertTo-Json -Compress
  exit 0
}
    `.trim();

    return {
      printerName: safePrinterName,
      filePath: tempFilePath,
      copies,
      duplexMode,
      paperSize,
      color,
      pages,
      powershellCommand
    };
  }
}
