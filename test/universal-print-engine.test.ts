import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { UniversalPrintService } from '../print-agent/src/main/printer/engine/UniversalPrintService.js';
import { ImagePrintEngine } from '../print-agent/src/main/printer/engine/ImagePrintEngine.js';
import { PDFPrintEngine } from '../print-agent/src/main/printer/engine/PDFPrintEngine.js';
import { WindowsPrintEngine } from '../print-agent/src/main/printer/engine/WindowsPrintEngine.js';

console.log('=== STARTING UNIVERSAL WINDOWS PRINT ENGINE VERIFICATION TEST SUITE ===');

const testDir = path.join(os.tmpdir(), `printflow_test_${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

async function runTests() {
  const universalService = UniversalPrintService.getInstance();
  const imageEngine = ImagePrintEngine.getInstance();
  const pdfEngine = PDFPrintEngine.getInstance();
  const winPrintEngine = WindowsPrintEngine.getInstance();

  // TEST 1: Binary Image Magic-Byte Sniffing
  console.log('\n[TEST 1] Testing Image Binary Format Detection...');
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const jpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const textHeader = Buffer.from('This is a text file not an image');

  assert.strictEqual(imageEngine.detectImageFormat(pngHeader), 'PNG', 'PNG header detected');
  assert.strictEqual(imageEngine.detectImageFormat(jpgHeader), 'JPG', 'JPG header detected');
  assert.strictEqual(imageEngine.detectImageFormat(textHeader), null, 'Non-image header rejected');
  console.log('  ✓ Image binary format detection passed.');

  // TEST 2: File Format Detection in UniversalPrintService
  console.log('\n[TEST 2] Testing UniversalPrintService File Sniffing...');
  const testPngPath = path.join(testDir, 'test_image.png');
  fs.writeFileSync(testPngPath, Buffer.concat([pngHeader, Buffer.alloc(100, 1)]));

  const testJpgPath = path.join(testDir, 'test_image.jpg');
  fs.writeFileSync(testJpgPath, Buffer.concat([jpgHeader, Buffer.alloc(100, 2)]));

  const testTxtPath = path.join(testDir, 'test_doc.txt');
  fs.writeFileSync(testTxtPath, Buffer.from('Hello plain text'));

  assert.strictEqual(universalService.detectFormat(testPngPath), 'PNG', 'PNG file detected');
  assert.strictEqual(universalService.detectFormat(testJpgPath), 'JPG', 'JPG file detected');
  assert.strictEqual(universalService.detectFormat(testTxtPath), 'UNKNOWN', 'Plain text detected as UNKNOWN');
  console.log('  ✓ Universal file format sniffing passed.');

  // TEST 3: Unsupported File Rejection & Standardized Error Code
  console.log('\n[TEST 3] Testing Unsupported File Type Rejection...');
  const unsupportedResult = await universalService.printFile({
    jobId: 'job_test_invalid_fmt',
    filePath: testTxtPath,
    printerName: 'Any Windows Printer'
  });
  assert.strictEqual(unsupportedResult.success, false, 'Unsupported file returned failure');
  assert.strictEqual(unsupportedResult.errorCode, 'UNSUPPORTED_FILE_TYPE', 'Correct error code UNSUPPORTED_FILE_TYPE');
  console.log('  ✓ Unsupported file handling passed.');

  // TEST 4: Missing File Handling & Standardized Error Code
  console.log('\n[TEST 4] Testing Missing File Rejection...');
  const missingResult = await universalService.printFile({
    jobId: 'job_test_missing_file',
    filePath: path.join(testDir, 'does_not_exist.pdf'),
    printerName: 'Any Windows Printer'
  });
  assert.strictEqual(missingResult.success, false, 'Missing file returned failure');
  assert.strictEqual(missingResult.errorCode, 'FILE_NOT_FOUND', 'Correct error code FILE_NOT_FOUND');
  console.log('  ✓ Missing file handling passed.');

  // TEST 5: Missing Printer Name Handling
  console.log('\n[TEST 5] Testing Empty Printer Rejection...');
  const emptyPrinterResult = await universalService.printFile({
    jobId: 'job_test_no_printer',
    filePath: testPngPath,
    printerName: ''
  });
  assert.strictEqual(emptyPrinterResult.success, false, 'Empty printer returned failure');
  assert.strictEqual(emptyPrinterResult.errorCode, 'PRINTER_NOT_FOUND', 'Correct error code PRINTER_NOT_FOUND');
  console.log('  ✓ Empty printer handling passed.');

  // TEST 6: PDF Page Range Parser
  console.log('\n[TEST 6] Testing PDF Page Range Parser...');
  const range1 = pdfEngine.parsePageRange('1-3, 5, 8-10', 10);
  assert.deepStrictEqual(range1, [1, 2, 3, 5, 8, 9, 10], 'Complex page range parsed');

  const range2 = pdfEngine.parsePageRange(undefined, 4);
  assert.deepStrictEqual(range2, [1, 2, 3, 4], 'Undefined page range defaults to all pages');

  const range3 = pdfEngine.parsePageRange('ALL', 3);
  assert.deepStrictEqual(range3, [1, 2, 3], 'ALL page range parsed');

  const range4 = pdfEngine.parsePageRange('2', 5);
  assert.deepStrictEqual(range4, [2], 'Single page parsed');
  console.log('  ✓ PDF page range parsing passed.');

  // TEST 7: PDF.js & Canvas Multi-Page Document Rendering
  console.log('\n[TEST 7] Testing PDF.js & Canvas Real PDF Rendering at 200 DPI...');
  // Valid PDF 1.4 minimal 2-page document
  const multiPagePdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R >> endobj
4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R >> endobj
5 0 obj << /Length 44 >> stream
q 1 0 0 1 50 750 cm /F1 12 Tf (Page 1) Tj Q
endstream endobj
6 0 obj << /Length 44 >> stream
q 1 0 0 1 50 750 cm /F1 12 Tf (Page 2) Tj Q
endstream endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000121 00000 n 
0000000215 00000 n 
0000000309 00000 n 
0000000404 00000 n 
trailer << /Size 7 /Root 1 0 R >>
startxref
499
%%EOF`;

  const testPdfPath = path.join(testDir, 'sample_multipage.pdf');
  fs.writeFileSync(testPdfPath, multiPagePdf, 'utf8');

  // Verify format detection
  assert.strictEqual(universalService.detectFormat(testPdfPath), 'PDF', 'PDF signature detected');

  // Verify PDF.js + Canvas rasterization at 200 DPI
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');

  const pdfBytes = fs.readFileSync(testPdfPath);
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBytes),
    useSystemFonts: true,
    stopAtErrors: false
  });
  const pdfDoc = await loadingTask.promise;
  assert.strictEqual(pdfDoc.numPages, 2, 'PDF has 2 pages');

  const page1 = await pdfDoc.getPage(1);
  const viewport = page1.getViewport({ scale: 200 / 72 });
  assert(viewport.width > 1000, `Page width scaled to 200 DPI: ${viewport.width}`);
  assert(viewport.height > 1000, `Page height scaled to 200 DPI: ${viewport.height}`);

  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  await page1.render({ canvasContext: ctx as any, canvas: canvas as any, viewport }).promise;

  const pngBuf = canvas.toBuffer('image/png');
  assert(pngBuf.length > 500, 'Page rendered to non-empty PNG buffer');
  assert.strictEqual(imageEngine.detectImageFormat(pngBuf), 'PNG', 'Rendered page produces genuine PNG');
  console.log(`  ✓ PDF rasterized successfully (${Math.round(viewport.width)}x${Math.round(viewport.height)} px, ${pngBuf.length} bytes).`);

  // TEST 8: PowerShell Script Generation in WindowsPrintEngine
  console.log('\n[TEST 8] Testing PowerShell Script Generation & Dynamic Parameters...');
  const psScript = winPrintEngine.generatePowerShellScript({
    jobId: 'job_test_script',
    printerName: 'Brother MFC-L2710DW',
    imagePaths: ['C:\\temp\\page1.png', 'C:\\temp\\page2.png'],
    copies: 2,
    paperSize: 'A4',
    orientation: 'PORTRAIT',
    colorMode: 'BW',
    scalingMode: 'FIT_TO_PAGE'
  });

  assert(psScript.includes('Brother MFC-L2710DW'), 'Target printer name included in script');
  assert(psScript.includes('System.Drawing.Printing.PrintDocument'), 'Uses .NET PrintDocument');
  assert(psScript.includes('[Math]::Min($scaleX, $scaleY)'), 'Calculates proportional scaling (aspect ratio)');
  assert(psScript.includes('$e.Graphics.DrawImage'), 'Draws image onto graphics context');
  assert(psScript.includes('$e.HasMorePages'), 'Supports multi-page streaming via HasMorePages');
  assert(psScript.includes('$doc.Dispose()'), 'Disposes .NET resources cleanly');
  assert(psScript.includes('ConvertTo-Json'), 'Outputs structured JSON result for caller');
  console.log('  ✓ PowerShell script structure and parameter injection passed.');

  // TEST 9: Dynamic Printer Verification (No Hardcoded Models)
  console.log('\n[TEST 9] Testing Dynamic Printer Parameter Handling...');
  const testPrinterNames = [
    'Canon PIXMA G3020',
    'Epson EcoTank L3250',
    'HP LaserJet Pro M404dn',
    'Samsung ML-2165 Series'
  ];

  for (const name of testPrinterNames) {
    const script = winPrintEngine.generatePowerShellScript({
      jobId: 'job_test_dynamic',
      printerName: name,
      imagePaths: ['C:\\temp\\test.png'],
      copies: 1,
      paperSize: 'Letter',
      orientation: 'LANDSCAPE',
      colorMode: 'COLOR'
    });
    assert(script.includes(name), `Script correctly targets dynamic printer "${name}"`);
  }
  console.log('  ✓ Dynamic printer verification passed for HP, Canon, Epson, Brother, Samsung.');

  // Clean up test files
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  console.log('\n=== ALL UNIVERSAL PRINT ENGINE TESTS PASSED SUCCESSFULLY! ===\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
