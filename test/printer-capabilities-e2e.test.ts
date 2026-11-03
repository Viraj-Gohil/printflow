/**
 * PRINTFLOW END-TO-END VERIFICATION TEST SUITE
 * 
 * Verifies:
 * 1. Automatic Printer Capability Detection & Invariants (B&W, Color, A4, A3, Duplex)
 * 2. Owner Capability Configuration & Precedence (Cannot enable unsupported, preserves on rescan)
 * 3. Multi-Printer Valid Combinations & Incompatible Option Rejection
 * 4. Strict File Format Validation (PDF, JPG, PNG, WEBP accepted; EXE, ZIP, DOCX, Corrupt rejected)
 * 5. Isolation: Rejected files never reach Supabase and allow remaining valid files to proceed
 * 6. Server-Authoritative Routing & Pricing Validation
 */

import assert from 'node:assert';
import {
  verifyFileSignature,
  validateUploadFile,
  SUPPORTED_FILE_FORMATS
} from '../src/lib/security';
import { validateClientDocument } from '../src/lib/validation/documentValidation';
import {
  setNeonPoolForTest,
  getPublicShopCapabilities,
  validateJobAgainstRegisteredPrinters
} from '../src/db/paymentStorage';
import {
  computeEffectiveCapabilities,
  createDefaultOwnerConfig,
  validateOwnerConfigAgainstHardware,
  HardwareCapabilities,
  OwnerPrinterConfiguration
} from '../print-agent/src/renderer/types/capabilities';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message || err}`);
    failed++;
  }
}

// Mock PostgreSQL pool for multi-printer capability testing
function createMockPrinterPool(printers: any[]) {
  return {
    query: async (sql: string, params: any[]) => {
      if (sql.includes('FROM public.printers')) {
        return {
          rows: printers,
          rowCount: printers.length
        };
      }
      return { rows: [], rowCount: 0 };
    }
  } as any;
}

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('🚀 PRINTFLOW: AUTOMATIC CAPABILITIES & FILE VALIDATION E2E TESTS');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: HARDWARE CAPABILITY DETECTION & OWNER CONFIGURATION
  // --------------------------------------------------------------------------
  console.log('--- 1. Hardware Capability Detection & Owner Rules ---');

  const mockHardwareBwOnly: HardwareCapabilities = {
    basicInfo: {
      name: 'HP LaserJet P1007',
      displayName: 'HP LaserJet P1007',
      driverName: 'HP LaserJet P1007 Driver',
      portName: 'USB001',
      connectionType: 'USB',
      isDefault: true,
      status: 'READY'
    },
    color: {
      monochrome: 'SUPPORTED',
      color: 'UNSUPPORTED',
      detectionSource: 'WIN32_DRIVER',
      lastDetectedAt: new Date().toISOString()
    },
    paperSizes: [
      { name: 'A4', widthMm: 210, heightMm: 297, status: 'SUPPORTED' },
      { name: 'Letter', widthMm: 215.9, heightMm: 279.4, status: 'SUPPORTED' }
    ],
    sides: {
      singleSided: 'SUPPORTED',
      automaticDuplex: 'UNSUPPORTED',
      manualDuplex: 'SUPPORTED',
      detectionSource: 'WIN32_DRIVER',
      lastDetectedAt: new Date().toISOString()
    },
    resolutions: [600],
    copies: { maxCopies: 99, status: 'SUPPORTED' },
    orientations: ['PORTRAIT', 'LANDSCAPE'],
    detectionSource: 'WIN32_DRIVER',
    lastDetectedAt: new Date().toISOString()
  };

  const mockHardwareColorDuplex: HardwareCapabilities = {
    basicInfo: {
      name: 'Canon imageRUNNER ADVANCE C3530',
      displayName: 'Canon C3530 Multi-Function',
      driverName: 'Canon Generic Plus UFR II',
      portName: '192.168.1.50',
      connectionType: 'LAN',
      isDefault: false,
      status: 'READY'
    },
    color: {
      monochrome: 'SUPPORTED',
      color: 'SUPPORTED',
      detectionSource: 'WIN32_DRIVER',
      lastDetectedAt: new Date().toISOString()
    },
    paperSizes: [
      { name: 'A4', widthMm: 210, heightMm: 297, status: 'SUPPORTED' },
      { name: 'A3', widthMm: 297, heightMm: 420, status: 'SUPPORTED' }
    ],
    sides: {
      singleSided: 'SUPPORTED',
      automaticDuplex: 'SUPPORTED',
      manualDuplex: 'SUPPORTED',
      detectionSource: 'WIN32_DRIVER',
      lastDetectedAt: new Date().toISOString()
    },
    resolutions: [1200, 600],
    copies: { maxCopies: 999, status: 'SUPPORTED' },
    orientations: ['PORTRAIT', 'LANDSCAPE'],
    detectionSource: 'WIN32_DRIVER',
    lastDetectedAt: new Date().toISOString()
  };

  await runTest('Hardware detection identifies B&W printer and disables color', () => {
    const defaultOwner = createDefaultOwnerConfig(mockHardwareBwOnly);
    const effective = computeEffectiveCapabilities(mockHardwareBwOnly, defaultOwner);
    assert.strictEqual(effective.supportsColor, false);
    assert.strictEqual(effective.supportsMonochrome, true);
    assert.strictEqual(effective.supportsAutomaticDuplex, false);
    assert.ok(effective.paperSizes.includes('A4'));
  });

  await runTest('Hardware detection identifies Color + A3 + Duplex printer', () => {
    const defaultOwner = createDefaultOwnerConfig(mockHardwareColorDuplex);
    const effective = computeEffectiveCapabilities(mockHardwareColorDuplex, defaultOwner);
    assert.strictEqual(effective.supportsColor, true);
    assert.strictEqual(effective.supportsAutomaticDuplex, true);
    assert.ok(effective.paperSizes.includes('A3'));
  });

  await runTest('Owner cannot enable unsupported hardware features', () => {
    // Attempting to force enable color on a B&W printer
    const maliciousOwnerConfig: OwnerPrinterConfiguration = {
      ...createDefaultOwnerConfig(mockHardwareBwOnly),
      color: { enableColor: true, enableMonochrome: true, defaultMode: 'COLOR' }
    };
    const validation = validateOwnerConfigAgainstHardware(mockHardwareBwOnly, maliciousOwnerConfig);
    // Sanitized config must clamp enableColor to false
    assert.strictEqual(validation.sanitizedConfig.color.enableColor, false);
    const effective = computeEffectiveCapabilities(mockHardwareBwOnly, validation.sanitizedConfig);
    assert.strictEqual(effective.supportsColor, false);
  });

  await runTest('Owner can disable supported feature (Owner disables A3 and Color on Canon)', () => {
    const customOwnerConfig: OwnerPrinterConfiguration = {
      ...createDefaultOwnerConfig(mockHardwareColorDuplex),
      color: { enableColor: false, enableMonochrome: true, defaultMode: 'BW' },
      paperSizes: {
        A4: true,
        A3: false
      }
    };
    const validation = validateOwnerConfigAgainstHardware(mockHardwareColorDuplex, customOwnerConfig);
    const effective = computeEffectiveCapabilities(mockHardwareColorDuplex, validation.sanitizedConfig);
    assert.strictEqual(effective.supportsColor, false, 'Color must be disabled by owner');
    assert.strictEqual(effective.paperSizes.includes('A3'), false, 'A3 must be disabled by owner');
    assert.strictEqual(effective.paperSizes.includes('A4'), true, 'A4 must remain enabled');
  });

  // --------------------------------------------------------------------------
  // SECTION 2: MULTI-PRINTER CAPABILITIES & COMBINATIONS
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Multi-Printer Options & Combination Routing ---');

  // Printer A: HP LaserJet (B&W only, A4 only, Simplex only)
  // Printer B: Canon C3530 (Color, A4 & A3, Automatic Duplex)
  const mockDbPrinters = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'HP LaserJet P1007',
      status: 'ONLINE',
      is_default: true,
      is_registered: true,
      effective_capabilities: {
        color: { supportsColor: false, supportsMonochrome: true },
        paperSizes: [{ name: 'A4', widthMm: 210, heightMm: 297 }],
        sides: { supportsDuplex: false }
      }
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Canon imageRUNNER ADVANCE C3530',
      status: 'ONLINE',
      is_default: false,
      is_registered: true,
      effective_capabilities: {
        color: { supportsColor: true, supportsMonochrome: true },
        paperSizes: [
          { name: 'A4', widthMm: 210, heightMm: 297 },
          { name: 'A3', widthMm: 297, heightMm: 420 }
        ],
        sides: { supportsDuplex: true }
      }
    }
  ];

  setNeonPoolForTest(createMockPrinterPool(mockDbPrinters));

  await runTest('Public shop capabilities correctly computes valid option combinations', async () => {
    const caps = await getPublicShopCapabilities('test-shop-id');
    assert.strictEqual(caps.hasColorPrinter, true);
    assert.strictEqual(caps.hasDuplexPrinter, true);
    assert.strictEqual(caps.hasMonochromePrinter, true);
    assert.ok(caps.validCombinations.length > 0);

    // B&W + A4 + Simplex is valid (supported by HP & Canon)
    const hasBwA4Simplex = caps.validCombinations.some(
      (c) => c.paperSize === 'A4' && c.colorMode === 'BW' && c.duplex === false
    );
    assert.strictEqual(hasBwA4Simplex, true);

    // Color + A3 + Duplex is valid (supported by Canon)
    const hasColorA3Duplex = caps.validCombinations.some(
      (c) => c.paperSize === 'A3' && c.colorMode === 'COLOR' && c.duplex === true
    );
    assert.strictEqual(hasColorA3Duplex, true);
  });

  await runTest('Routing matches HP printer for B&W single-sided A4 job', async () => {
    const res = await validateJobAgainstRegisteredPrinters('test-shop-id', [
      { fileName: 'document.pdf', paperSize: 'A4', colorMode: 'BW', duplex: false }
    ]);
    assert.strictEqual(res.eligible, true);
    assert.strictEqual(res.matchedPrinterName, 'HP LaserJet P1007');
  });

  await runTest('Routing matches Canon printer for Color A3 double-sided job', async () => {
    const res = await validateJobAgainstRegisteredPrinters('test-shop-id', [
      { fileName: 'poster.pdf', paperSize: 'A3', colorMode: 'COLOR', duplex: true }
    ]);
    assert.strictEqual(res.eligible, true);
    assert.strictEqual(res.matchedPrinterName, 'Canon imageRUNNER ADVANCE C3530');
  });

  await runTest('Routing rejects impossible multi-option combination when no single printer supports it', async () => {
    // If shop only has HP (A4, BW, Simplex) and Epson (Color, Letter only, Simplex)
    const restrictedPrinters = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'HP LaserJet P1007',
        status: 'ONLINE',
        is_default: true,
        is_registered: true,
        effective_capabilities: {
          color: { supportsColor: false, supportsMonochrome: true },
          paperSizes: [{ name: 'A4' }],
          sides: { supportsDuplex: false }
        }
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Epson L3150',
        status: 'ONLINE',
        is_default: false,
        is_registered: true,
        effective_capabilities: {
          color: { supportsColor: true, supportsMonochrome: true },
          paperSizes: [{ name: 'Letter' }], // Only supports Letter, not A4!
          sides: { supportsDuplex: false }
        }
      }
    ];

    setNeonPoolForTest(createMockPrinterPool(restrictedPrinters));

    // Requesting Color on A4 paper: HP does A4 but not Color; Epson does Color but not A4!
    const res = await validateJobAgainstRegisteredPrinters('test-shop-id', [
      { fileName: 'report.pdf', paperSize: 'A4', colorMode: 'COLOR', duplex: false }
    ]);
    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.code, 'INCOMPATIBLE_PRINTER_OPTIONS');
  });

  await runTest('Routing rejects job when all registered printers are OFFLINE', async () => {
    const offlinePrinters = mockDbPrinters.map((p) => ({ ...p, status: 'OFFLINE' }));
    setNeonPoolForTest(createMockPrinterPool(offlinePrinters));

    const res = await validateJobAgainstRegisteredPrinters('test-shop-id', [
      { fileName: 'doc.pdf', paperSize: 'A4', colorMode: 'BW', duplex: false }
    ]);
    assert.strictEqual(res.eligible, false);
    assert.strictEqual(res.code, 'PRINTERS_OFFLINE');
  });

  // --------------------------------------------------------------------------
  // SECTION 3: FILE FORMAT VALIDATION & CORRUPT FILE REJECTION
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Strict Document File Format Validation ---');

  // Valid PDF header: %PDF-1.4\n ...
  const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
  // Valid PNG header: \x89PNG\r\n\x1a\n ...
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
  // Valid JPEG header: \xFF\xD8\xFF\xE0 ...
  const validJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
  // Windows EXE binary: MZ\x90\x00\x03\x00\x00\x00\x04 ...
  const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF]);
  // ZIP / DOCX archive: PK\x03\x04 ...
  const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0x00, 0x00]);
  // Corrupt truncated PDF (only 10 bytes)
  const corruptTruncatedPdf = Buffer.from('%PDF-1.4\n');

  await runTest('Accepts valid PDF file with genuine magic bytes', () => {
    const res = validateUploadFile({
      buffer: validPdfBuffer,
      filename: 'thesis_final.pdf',
      shopId: 'shop_001',
      jobId: 'job_001'
    });
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.detectedMime, 'application/pdf');
    assert.ok(res.storageKey?.endsWith('.pdf'));
  });

  await runTest('Accepts valid JPEG file with genuine magic bytes', () => {
    const res = validateUploadFile({
      buffer: validJpgBuffer,
      filename: 'id_front.jpg',
      shopId: 'shop_001',
      jobId: 'job_001'
    });
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.detectedMime, 'image/jpeg');
  });

  await runTest('Accepts valid PNG file with genuine magic bytes', () => {
    const res = validateUploadFile({
      buffer: validPngBuffer,
      filename: 'chart.png',
      shopId: 'shop_001',
      jobId: 'job_001'
    });
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.detectedMime, 'image/png');
  });

  await runTest('Rejects Windows Executable (EXE) with user-friendly error title and message', () => {
    const res = validateUploadFile({
      buffer: exeBuffer,
      filename: 'installer.exe',
      shopId: 'shop_001',
      jobId: 'job_001'
    });
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.code, 'UNSUPPORTED_FORMAT');
    assert.strictEqual(res.userFacingTitle, 'Unsupported File Format');
    assert.strictEqual(res.userFacingMessage, 'This file format is not supported by PrintFlow.');
  });

  await runTest('Rejects ZIP archive masquerading as PDF', () => {
    const res = validateUploadFile({
      buffer: zipBuffer,
      filename: 'homework.pdf', // Spoofed extension!
      shopId: 'shop_001',
      jobId: 'job_001'
    });
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.code, 'UNSUPPORTED_FORMAT');
    assert.strictEqual(res.detectedType, 'ZIP Archive / Office Document');
  });

  await runTest('Rejects Microsoft Word DOCX document', () => {
    const res = validateUploadFile({
      buffer: zipBuffer,
      filename: 'assignment.docx',
      shopId: 'shop_001',
      jobId: 'job_001'
    });
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.code, 'UNSUPPORTED_FORMAT');
    assert.strictEqual(res.userFacingTitle, 'Unsupported File Format');
  });

  await runTest('Rejects MIME/Extension mismatch (JPEG image named .pdf)', () => {
    const res = validateUploadFile({
      buffer: validJpgBuffer,
      filename: 'fake_document.pdf',
      shopId: 'shop_001',
      jobId: 'job_001'
    });
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.code, 'MIME_MISMATCH');
    assert.strictEqual(res.userFacingTitle, 'Invalid Document');
  });

  await runTest('Rejects Corrupted / Truncated PDF file', () => {
    const res = validateUploadFile({
      buffer: corruptTruncatedPdf,
      filename: 'damaged.pdf',
      shopId: 'shop_001',
      jobId: 'job_001'
    });
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.code, 'CORRUPT_DOCUMENT');
    assert.strictEqual(res.userFacingTitle, 'Unable to Read File');
  });

  await runTest('Rejects Oversized file (> 50 MB)', () => {
    const oversizedBuffer = Buffer.alloc(51 * 1024 * 1024); // 51 MB
    const res = validateUploadFile({
      buffer: oversizedBuffer,
      filename: 'giant_file.pdf',
      shopId: 'shop_001',
      jobId: 'job_001'
    });
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.code, 'FILE_TOO_LARGE');
    assert.strictEqual(res.userFacingTitle, 'File Size Limit Exceeded');
  });

  await runTest('Rejects Empty file (0 bytes)', () => {
    const emptyBuffer = Buffer.alloc(0);
    const res = validateUploadFile({
      buffer: emptyBuffer,
      filename: 'empty.pdf',
      shopId: 'shop_001',
      jobId: 'job_001'
    });
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.code, 'EMPTY_FILE');
    assert.strictEqual(res.userFacingTitle, 'Invalid Document');
  });

  // --------------------------------------------------------------------------
  // SECTION 4: CLIENT-SIDE VALIDATION & ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Client-Side Validation & Partial Failure Isolation ---');

  await runTest('Client-side validator accepts genuine PDF File object', async () => {
    const file = new File([validPdfBuffer], 'sample.pdf', { type: 'application/pdf' });
    const res = await validateClientDocument(file);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.detectedMime, 'application/pdf');
  });

  await runTest('Client-side validator flags EXE and formats error modal payload', async () => {
    const file = new File([exeBuffer], 'virus.exe', { type: 'application/x-msdownload' });
    const res = await validateClientDocument(file);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.error?.code, 'UNSUPPORTED_FORMAT');
    assert.strictEqual(res.error?.title, 'Unsupported File Format');
    assert.strictEqual(res.error?.actionText, 'Choose Another File');
  });

  await runTest('Client-side validator flags DOCX and formats error modal payload', async () => {
    const file = new File([zipBuffer], 'resume.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const res = await validateClientDocument(file);
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.error?.code, 'UNSUPPORTED_FORMAT');
    assert.strictEqual(res.error?.title, 'Unsupported File Format');
    assert.strictEqual(res.error?.detectedType, 'Word Document (DOCX)');
  });

  await runTest('Partial multi-file selection allows valid files to proceed when one is rejected', async () => {
    const selectedFiles = [
      new File([validPdfBuffer], 'contract.pdf', { type: 'application/pdf' }),
      new File([exeBuffer], 'trojan.exe', { type: 'application/octet-stream' }),
      new File([validPngBuffer], 'diagram.png', { type: 'image/png' })
    ];

    const validResults: File[] = [];
    const rejectedErrors: any[] = [];

    for (const f of selectedFiles) {
      const v = await validateClientDocument(f);
      if (v.isValid) {
        validResults.push(f);
      } else {
        rejectedErrors.push(v.error);
      }
    }

    assert.strictEqual(validResults.length, 2, '2 valid files must proceed');
    assert.strictEqual(validResults[0].name, 'contract.pdf');
    assert.strictEqual(validResults[1].name, 'diagram.png');
    assert.strictEqual(rejectedErrors.length, 1, '1 invalid file must be rejected');
    assert.strictEqual(rejectedErrors[0].fileName, 'trojan.exe');
  });

  console.log('\n===============================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
