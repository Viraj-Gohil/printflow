import assert from 'node:assert/strict';
import { PrintSettingsAdapter } from '../print-agent/src/main/printer/PrintSettingsAdapter';

console.log('=== TEST SUITE: Windows Printer Spooler & Queue Fix ===');

// 1. Printer Name Matching & Sanitization
const targetName = 'HP LaserJet P1007';
const file = {
  id: 'test-file-1',
  fileName: 'invoice.pdf',
  pageCount: 1,
  copies: 1,
  colorMode: 'BW' as const,
  paperSize: 'A4' as const,
  duplex: false
};

const args = PrintSettingsAdapter.adaptSettings(
  file,
  targetName,
  'C:\\Users\\Admin\\AppData\\Local\\Temp\\PrintFlow_Spool\\PRT-BF66E6D166.pdf',
  30000,
  'C:\\PrintFlow\\SumatraPDF.exe'
);

// 2. Validate PowerShell Script Architecture
assert.equal(args.printerName, 'HP LaserJet P1007');
assert.match(args.powershellCommand, /Win32_Printer/);
assert.match(args.powershellCommand, /Get-CimInstance/);
assert.match(args.powershellCommand, /Win32_PrintJob/);
assert.match(args.powershellCommand, /Start-Process -FilePath \$sumatra -ArgumentList \$argList -Wait -PassThru/);
assert.match(args.powershellCommand, /ConvertTo-Json -Compress/);

// Ensure it checks for offline and hardware error states
assert.match(args.powershellCommand, /DetectedErrorState/);
assert.match(args.powershellCommand, /WorkOffline/);

// Ensure it handles case-insensitivity in PowerShell matching
assert.match(args.powershellCommand, /\$printer\.Trim\(\)\.ToLower\(\)/);

// 3. Virtual Printer Detection
assert.equal(PrintSettingsAdapter.isVirtualPrinter('HP LaserJet P1007'), false);
assert.equal(PrintSettingsAdapter.isVirtualPrinter('Microsoft Print to PDF'), true);
assert.equal(PrintSettingsAdapter.isVirtualPrinter('OneNote (Desktop)'), true);
assert.equal(PrintSettingsAdapter.isVirtualPrinter('Fax'), true);

// 4. Ensure script length is clean and compact
assert.ok(args.powershellCommand.length < 4000, `PowerShell command is concise (${args.powershellCommand.length} chars)`);

// 5. Test Settings Mapping
const colorA3Duplex = PrintSettingsAdapter.adaptSettings(
  {
    ...file,
    copies: 3,
    colorMode: 'COLOR',
    paperSize: 'A3',
    duplex: true
  },
  'HP LaserJet P1007',
  'C:\\Temp\\doc.pdf',
  30000,
  'C:\\PrintFlow\\SumatraPDF.exe'
);
assert.match(colorA3Duplex.powershellCommand, /color,duplexlong,paper=A3,3x/);

console.log('✓ All Windows Printer Spooler & Queue tests passed successfully.');
