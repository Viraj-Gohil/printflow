import assert from 'node:assert/strict';
import { PrintSettingsAdapter } from '../print-agent/src/main/printer/PrintSettingsAdapter';
import { formatPrintError } from '../print-agent/src/renderer/utils/printError';

const file = {
  id: 'file-1',
  fileName: 'report.pdf',
  pageCount: 1,
  copies: 1,
  colorMode: 'BW' as const,
  paperSize: 'A4' as const,
  duplex: false
};

const command = PrintSettingsAdapter.adaptSettings(
  file,
  'Counter Printer',
  'C:\\Temp\\report.pdf',
  30000,
  'C:\\Program Files\\PrintFlow Agent\\SumatraPDF.exe'
).powershellCommand;

assert.match(command, /Get-PrintJob/);
assert.match(command, /\$printJob\.IsPrinted/);
assert.match(command, /\$printJob\.IsCompleted/);
assert.match(command, /\$printJob\.JobStatus -match 'Printed\|Completed'/);
assert.match(command, /Get-Printer -Name/);
assert.match(command, /virtual\/document printer, not a physical printer/);
assert.match(command, /is offline or disconnected/i);
assert.match(command, /SumatraPDF\.exe/);
assert.match(command, /-print-settings/);
assert.match(command, /monochrome,simplex,paper=A4,1x/);
assert.match(command, /success = \$false; submitted = \$submitted; error = \$_.Exception.Message/);
const configuredCommand = PrintSettingsAdapter.adaptSettings(
  { ...file, copies: 2, colorMode: 'COLOR', paperSize: 'A3', duplex: true, pagesToPrint: '1-3,5' },
  'Counter Printer',
  'C:\\Temp\\report.pdf',
  30000,
  'C:\\PrintFlow\\SumatraPDF.exe'
).powershellCommand;
assert.match(configuredCommand, /1-3,5,color,duplexlong,paper=A3,2x/);
assert.throws(() => PrintSettingsAdapter.adaptSettings(
  { ...file, pagesToPrint: "1-2'; Start-Process calc; '" },
  'Counter Printer',
  'C:\\Temp\\report.pdf',
  30000,
  'C:\\PrintFlow\\SumatraPDF.exe'
), /page range is invalid/i);
assert.equal(PrintSettingsAdapter.isVirtualPrinter('Microsoft Print to PDF'), true);
assert.equal(PrintSettingsAdapter.isVirtualPrinter('HP LaserJet Pro MFP'), false);
assert.match(
  formatPrintError('Spooler failure: Command failed: powershell -NoProfile -EncodedCommand ABC\nNo application is associated with the specified file'),
  /no print handler configured for this document type/i
);
assert.equal(formatPrintError('Printer is offline or disconnected.'), 'Printer is offline or disconnected.');
console.log('Print settings adapter printer validation checks passed.');
