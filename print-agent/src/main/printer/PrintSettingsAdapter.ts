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
      $documentName = [System.IO.Path]::GetFileName($filePath)
      $deadline = [DateTime]::UtcNow.AddSeconds(${timeoutSeconds})
      try {
        if ($printer -match 'Microsoft Print to PDF|Microsoft XPS Document Writer|OneNote|Fax|Adobe PDF|Foxit PDF|PDFCreator|Print to PDF') {
          throw "Printer '$printer' is a virtual/document printer, not a physical printer. Select a connected shop printer."
        }
        if (-not (Test-Path -LiteralPath $filePath)) {
          throw 'The downloaded print document is missing.'
        }
        try {
          $printerInfo = Get-Printer -Name $printer -ErrorAction Stop
        } catch {
          throw "Printer '$printer' is not installed or available to Windows. Reconnect it, then rescan printers."
        }
        if ($printerInfo.PrinterStatus -match 'Offline') {
          throw "Printer '$printer' is offline or disconnected. Reconnect it in Windows, then rescan printers."
        }
        if ($printerInfo.PrinterStatus -match 'Error|NotAvailable|Paused|PaperOut|PaperJam|DoorOpen|UserIntervention|NoToner') {
          throw "Printer '$printer' is not ready ($($printerInfo.PrinterStatus)). Resolve the printer issue, then retry."
        }
        $existingJobIds = @(
          Get-PrintJob -PrinterName $printer -ErrorAction Stop |
            ForEach-Object { [int]$_.ID }
        )
        try {
          if (-not (Test-Path -LiteralPath $sumatra)) {
            throw 'The bundled Windows print engine is missing.'
          }
          $arguments = '-print-to "' + $printer + '" -silent -print-settings "' + $settings + '" "' + $filePath + '"'
          Start-Process -FilePath $sumatra -ArgumentList $arguments -ErrorAction Stop | Out-Null
        } catch {
          throw "Windows could not send the document to printer '$printer'. Check the printer and its driver."
        }
        $submitted = $true
        $printJob = $null
        while ([DateTime]::UtcNow -lt $deadline -and -not $printJob) {
          $printJob = Get-PrintJob -PrinterName $printer -ErrorAction Stop |
            Where-Object { $_.DocumentName -eq $documentName -and $existingJobIds -notcontains [int]$_.ID } |
            Sort-Object ID |
            Select-Object -First 1
          if (-not $printJob) { Start-Sleep -Milliseconds 500 }
        }
        if (-not $printJob) {
          throw "Windows did not add '$documentName' to the '$printer' print queue."
        }
        $printJobId = [int]$printJob.ID
        while ([DateTime]::UtcNow -lt $deadline) {
          $printJob = Get-PrintJob -PrinterName $printer -ID $printJobId -ErrorAction SilentlyContinue
          if (-not $printJob) {
            throw "Windows removed the print job before confirming it printed."
          }
          if ($printJob.IsInError -or $printJob.IsOffline -or $printJob.IsPaperOut -or $printJob.IsPaused) {
            throw "Printer '$printer' reported a problem while printing. Check paper, connection, and printer status."
          }
          if ($printJob.IsPrinted -or $printJob.IsCompleted -or $printJob.JobStatus -match 'Printed|Completed') {
            [PSCustomObject]@{ success = $true; submitted = $true; error = $null } | ConvertTo-Json -Compress
            exit 0
          }
          Start-Sleep -Milliseconds 500
        }
        throw "Timed out waiting for printer '$printer' to confirm printing."
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
