import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadMigrations } from '../src/db/migrations';
import {
  inspectPdf,
  inspectDocument,
  MAX_ALLOWED_PAGES,
  MAX_DOCUMENT_SIZE_BYTES
} from '../src/lib/documentInspector';
import {
  MockStorageService,
  SupabaseStorageService,
  buildObjectPath,
  DEFAULT_STORAGE_BUCKET
} from '../src/lib/storage/supabaseStorage';
import {
  DurableGuestCheckoutRepository,
  FilePrintConfig
} from '../src/db/guestCheckoutRepository';

const validUuid1 = '11111111-1111-4111-8111-111111111111';
const validUuid2 = '22222222-2222-4222-8222-222222222222';
const validJobId = '33333333-3333-4333-8333-333333333333';
const validFileId = '44444444-4444-4444-8444-444444444444';

// Sample synthetic documents for test isolation
const VALID_1PAGE_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n164\n%%EOF\n',
  'latin1'
);

const VALID_3PAGE_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>\nendobj\n3 0 obj\n<< /Type /Page >>\nendobj\n4 0 obj\n<< /Type /Page >>\nendobj\n5 0 obj\n<< /Type /Page >>\nendobj\nxref\n0 6\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
  'latin1'
);

const ENCRYPTED_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 >>\nendobj\n3 0 obj\n<< /Filter /Standard /V 2 /R 3 /Encrypt 4 0 R >>\nendobj\ntrailer\n<< /Encrypt 3 0 R >>\n%%EOF',
  'latin1'
);

const MALFORMED_PDF_NO_EOF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nsome corrupted content without end of file marker',
  'latin1'
);

const MALFORMED_PDF_NO_HEADER = Buffer.from(
  'Not A PDF Header at all. random binary or text content\n%%EOF',
  'latin1'
);

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

const VALID_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0xff, 0xd9
]);

const EXECUTABLE_FILE = Buffer.from(
  'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00This program cannot be run in DOS mode.'
);

// ============================================================================
// 1. MIGRATIONS VALIDATION (PHASE 3)
// ============================================================================
async function testPhase3Migrations() {
  const migrations = await loadMigrations();
  const phase3Migration = migrations.find((m) => m.filename === '004_phase3_storage_and_guest_checkout.sql');
  assert.ok(phase3Migration, '004_phase3_storage_and_guest_checkout.sql must exist');
  assert.equal(phase3Migration.id, '004');
  assert.ok(/^[a-f0-9]{64}$/.test(phase3Migration.checksum), 'Migration must have sha256 checksum');
  assert.ok(phase3Migration.sql.includes('storage_bucket'), 'Must add storage_bucket column');
  assert.ok(phase3Migration.sql.includes('idx_uploaded_files_retention_expiry'), 'Must index retention_expires_at');
  assert.ok(phase3Migration.sql.includes('idx_guest_checkout_capabilities_token_hash'), 'Must index guest_checkout_capabilities');
  console.log('  ✅ PASS: Phase 3 migration 004 verified and valid');
}

// ============================================================================
// 2. DOCUMENT & PDF INSPECTION TESTS
// ============================================================================
async function testDocumentInspection() {
  // 1-page PDF
  const pdf1 = inspectPdf(VALID_1PAGE_PDF);
  assert.equal(pdf1.isValid, true);
  assert.equal(pdf1.pageCount, 1);
  assert.equal(pdf1.isEncrypted, false);

  // 3-page PDF
  const pdf3 = inspectPdf(VALID_3PAGE_PDF);
  assert.equal(pdf3.isValid, true);
  assert.equal(pdf3.pageCount, 3);

  // Full inspectDocument for 1-page PDF
  const docPdf = inspectDocument(VALID_1PAGE_PDF, 'invoice.pdf');
  assert.equal(docPdf.isValid, true);
  assert.equal(docPdf.mimeType, 'application/pdf');
  assert.equal(docPdf.pageCount, 1);
  assert.equal(docPdf.sizeBytes, VALID_1PAGE_PDF.length);
  assert.ok(docPdf.sha256);
  assert.equal(docPdf.sha256, crypto.createHash('sha256').update(VALID_1PAGE_PDF).digest('hex'));

  // Encrypted PDF rejection
  const encResult = inspectPdf(ENCRYPTED_PDF);
  assert.equal(encResult.isValid, false);
  assert.equal(encResult.isEncrypted, true);
  assert.match(encResult.error || '', /encrypted|password-protected/i);

  const docEnc = inspectDocument(ENCRYPTED_PDF, 'secret.pdf');
  assert.equal(docEnc.isValid, false);
  assert.equal(docEnc.isEncrypted, true);

  // Malformed PDF (no EOF)
  const noEof = inspectPdf(MALFORMED_PDF_NO_EOF);
  assert.equal(noEof.isValid, false);
  assert.match(noEof.error || '', /%%EOF/);

  // Malformed PDF (no header)
  const noHeader = inspectPdf(MALFORMED_PDF_NO_HEADER);
  assert.equal(noHeader.isValid, false);
  assert.match(noHeader.error || '', /%PDF-/);

  // Rejection of executable
  const exeResult = inspectDocument(EXECUTABLE_FILE, 'malware.exe');
  assert.equal(exeResult.isValid, false);
  assert.match(exeResult.error || '', /binary signature|genuine document/i);

  // Empty buffer rejection
  const emptyResult = inspectDocument(Buffer.alloc(0), 'empty.pdf');
  assert.equal(emptyResult.isValid, false);

  console.log('  ✅ PASS: PDF inspection, encryption detection, and malformed rejection verified');
}

// ============================================================================
// 3. IMAGE PRINT SEMANTICS TESTS
// ============================================================================
async function testImageInspection() {
  // PNG image: strictly 1 page
  const pngDoc = inspectDocument(VALID_PNG, 'photo.png');
  assert.equal(pngDoc.isValid, true);
  assert.equal(pngDoc.mimeType, 'image/png');
  assert.equal(pngDoc.pageCount, 1, 'Images must strictly evaluate to exactly 1 page');
  assert.equal(pngDoc.sizeBytes, VALID_PNG.length);
  assert.ok(pngDoc.sha256);

  // JPEG image: strictly 1 page
  const jpegDoc = inspectDocument(VALID_JPEG, 'scan.jpg');
  assert.equal(jpegDoc.isValid, true);
  assert.equal(jpegDoc.mimeType, 'image/jpeg');
  assert.equal(jpegDoc.pageCount, 1, 'Images must strictly evaluate to exactly 1 page');
  assert.equal(jpegDoc.sizeBytes, VALID_JPEG.length);

  // Corrupted / truncated image rejection
  const corruptedPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // Header only, no chunks
  const badImg = inspectDocument(corruptedPng, 'bad.png');
  assert.equal(badImg.isValid, false);

  console.log('  ✅ PASS: Image inspection enforces explicit 1-page-per-image print semantics');
}

// ============================================================================
// 4. STORAGE PROVIDER TESTS (MOCK & CONSTRAINTS)
// ============================================================================
async function testStorageProvider() {
  // Path building constraint
  const objectPath = buildObjectPath(validUuid1, validJobId, validFileId, 'pdf');
  assert.equal(objectPath, `shops/${validUuid1}/jobs/${validJobId}/files/${validFileId}.pdf`);
  assert.ok(objectPath.startsWith('shops/'), 'Must start with shops/');
  assert.ok(objectPath.includes('/jobs/'), 'Must include /jobs/');
  assert.ok(objectPath.includes('/files/'), 'Must include /files/');

  // MockStorageService operations
  const mockStorage = new MockStorageService();
  assert.equal(mockStorage.isConfigured(), true);
  assert.equal(mockStorage.bucket, 'mock-print-documents');

  // Upload
  const uploadRes = await mockStorage.upload({
    shopId: validUuid1,
    jobId: validJobId,
    fileId: validFileId,
    extension: 'pdf',
    buffer: VALID_1PAGE_PDF,
    contentType: 'application/pdf'
  });
  assert.equal(uploadRes.objectPath, objectPath);
  assert.equal(uploadRes.sizeBytes, VALID_1PAGE_PDF.length);
  assert.equal(uploadRes.sha256, crypto.createHash('sha256').update(VALID_1PAGE_PDF).digest('hex'));

  // Download
  const downloaded = await mockStorage.download(objectPath);
  assert.deepEqual(downloaded, VALID_1PAGE_PDF);

  // Signed URL
  const signedRes = await mockStorage.createSignedUrl(objectPath, 900);
  assert.ok(signedRes.signedUrl.includes(objectPath));
  assert.ok(signedRes.expiresAt > new Date());

  // Fail-closed download on non-existent object
  await assert.rejects(() => mockStorage.download('shops/nonexistent/file.pdf'), /Object not found/i);

  // Deletion
  await mockStorage.delete([objectPath]);
  await assert.rejects(() => mockStorage.download(objectPath), /not found/);

  // Fail-closed SupabaseStorageService when unconfigured
  const unconfiguredService = new SupabaseStorageService('print-documents', '', '');
  assert.equal(unconfiguredService.isConfigured(), false);
  await assert.rejects(
    () =>
      unconfiguredService.upload({
        shopId: validUuid1,
        jobId: validJobId,
        fileId: validFileId,
        extension: 'pdf',
        buffer: VALID_1PAGE_PDF,
        contentType: 'application/pdf'
      }),
    /SUPABASE_SERVICE_ROLE_KEY/i
  );

  console.log('  ✅ PASS: Storage provider upload, download, signed URL, and fail-closed behavior verified');
}

// ============================================================================
// 5. GUEST CHECKOUT REPOSITORY INPUT VALIDATION & SECURITY
// ============================================================================
async function testGuestRepositoryInputValidation() {
  const mockDb = {
    connect: async () => {
      throw new Error('Database connection unexpectedly opened during pure input validation');
    }
  };
  const repo = new DurableGuestCheckoutRepository(mockDb as any);

  // verifyGuestToken validation
  await assert.rejects(() => repo.verifyGuestToken('not-a-uuid', 'gct_123456789012345678901234'), /UUID/);
  await assert.rejects(() => repo.verifyGuestToken(validJobId, ''), /invalid/);
  await assert.rejects(() => repo.verifyGuestToken(validJobId, 'short'), /invalid/);

  // persistUploadedFileMetadata validation
  await assert.rejects(
    () =>
      repo.persistUploadedFileMetadata({
        jobId: 'bad-uuid',
        shopId: validUuid1,
        fileId: validFileId,
        objectPath: `shops/${validUuid1}/jobs/${validJobId}/files/${validFileId}.pdf`,
        originalFilename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'a'.repeat(64),
        verifiedPageCount: 1
      }),
    /UUID/
  );

  // Object path isolation constraint violation
  await assert.rejects(
    () =>
      repo.persistUploadedFileMetadata({
        jobId: validJobId,
        shopId: validUuid1,
        fileId: validFileId,
        objectPath: `shops/${validUuid2}/jobs/${validJobId}/files/${validFileId}.pdf`, // Shop mismatch
        originalFilename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'a'.repeat(64),
        verifiedPageCount: 1
      }),
    /isolation constraint/
  );

  // Invalid SHA-256
  await assert.rejects(
    () =>
      repo.persistUploadedFileMetadata({
        jobId: validJobId,
        shopId: validUuid1,
        fileId: validFileId,
        objectPath: `shops/${validUuid1}/jobs/${validJobId}/files/${validFileId}.pdf`,
        originalFilename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'invalid-sha256',
        verifiedPageCount: 1
      }),
    /sha256/
  );

  // Non-positive page count
  await assert.rejects(
    () =>
      repo.persistUploadedFileMetadata({
        jobId: validJobId,
        shopId: validUuid1,
        fileId: validFileId,
        objectPath: `shops/${validUuid1}/jobs/${validJobId}/files/${validFileId}.pdf`,
        originalFilename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'a'.repeat(64),
        verifiedPageCount: 0
      }),
    /verifiedPageCount/
  );

  // calculateAuthoritativeQuote validation
  await assert.rejects(() => repo.calculateAuthoritativeQuote('bad-uuid', validUuid1, []), /UUID/);
  await assert.rejects(() => repo.calculateAuthoritativeQuote(validJobId, validUuid1, []), /At least one/);

  console.log('  ✅ PASS: Guest repository input validation and path isolation fail-fast verified');
}

// ============================================================================
// 6. GUEST CHECKOUT SESSION CREATION & TOKEN HASHING
// ============================================================================
async function testGuestCheckoutSessionFlow() {
  const executedQueries: Array<{ text: string; values?: any[] }> = [];

  const mockClient = {
    query: async (queryTextOrConfig: any, values?: any[]) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      const vals = values || (typeof queryTextOrConfig === 'object' ? queryTextOrConfig.values : undefined);
      executedQueries.push({ text, values: vals });

      if (text.includes('SELECT id::text, slug, name, status, is_open')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: validUuid1,
              slug: 'fast-print',
              name: 'Fast Print Shop',
              status: 'ACTIVE',
              is_open: true,
              min_order_amount: 5.0,
              file_retention_days: 7
            }
          ]
        };
      }
      if (text.includes('INSERT INTO public.print_jobs')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO public.guest_checkout_capabilities')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO public.print_job_events')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
    release: () => {}
  };

  const mockDb = {
    connect: async () => mockClient
  };

  const repo = new DurableGuestCheckoutRepository(mockDb as any);
  const session = await repo.createGuestCheckoutSession({
    shopSlugOrId: 'fast-print',
    customerName: 'Aarav Patel',
    customerPhone: '+919876543210',
    expiresInMinutes: 45
  });

  assert.ok(session.jobId);
  assert.ok(session.orderCode.startsWith('PRT-'));
  assert.ok(session.trackingToken.startsWith('trk_'));
  assert.ok(session.guestToken.startsWith('gct_'));
  assert.equal(session.shop.id, validUuid1);
  assert.equal(session.shop.slug, 'fast-print');
  assert.equal(session.shop.minOrderAmount, 5.0);

  // Verify that the capability token inserted into PostgreSQL is SHA-256 hashed, NOT raw token
  const capabilityInsert = executedQueries.find((q) => q.text.includes('INSERT INTO public.guest_checkout_capabilities'));
  assert.ok(capabilityInsert, 'Must insert into guest_checkout_capabilities');
  const storedHash = capabilityInsert.values?.[1];
  const expectedHash = crypto.createHash('sha256').update(session.guestToken).digest('hex');
  assert.equal(storedHash, expectedHash, 'Database must store SHA-256 hash of token, never raw guest token');
  assert.notEqual(storedHash, session.guestToken, 'Raw token must not match stored hash');

  console.log('  ✅ PASS: Guest checkout session creation and SHA-256 token hashing verified');
}

// ============================================================================
// 7. GUEST CAPABILITY TOKEN VERIFICATION & EXPIRATION DEFENSE
// ============================================================================
async function testGuestTokenVerification() {
  const sampleToken = 'gct_super_secret_high_entropy_guest_capability_token_12345';
  const sampleHash = crypto.createHash('sha256').update(sampleToken).digest('hex');

  const createMockDb = (rows: any[]) => ({
    connect: async () => ({
      query: async () => ({ rowCount: rows.length, rows }),
      release: () => {}
    })
  });

  // Valid token
  const validDb = createMockDb([
    {
      id: validUuid1,
      job_id: validJobId,
      shop_id: validUuid2,
      payment_status: 'PENDING',
      print_status: 'CREATED',
      expires_at: new Date(Date.now() + 3600000),
      revoked_at: null
    }
  ]);
  const repoValid = new DurableGuestCheckoutRepository(validDb as any);
  const check = await repoValid.verifyGuestToken(validJobId, sampleToken);
  assert.equal(check.valid, true);
  assert.equal(check.jobId, validJobId);
  assert.equal(check.shopId, validUuid2);

  // Expired token rejection
  const expiredDb = createMockDb([
    {
      id: validUuid1,
      job_id: validJobId,
      shop_id: validUuid2,
      payment_status: 'PENDING',
      print_status: 'CREATED',
      expires_at: new Date(Date.now() - 1000), // Expired 1 second ago
      revoked_at: null
    }
  ]);
  const repoExpired = new DurableGuestCheckoutRepository(expiredDb as any);
  await assert.rejects(() => repoExpired.verifyGuestToken(validJobId, sampleToken), /expired/i);

  // Revoked token rejection
  const revokedDb = createMockDb([
    {
      id: validUuid1,
      job_id: validJobId,
      shop_id: validUuid2,
      payment_status: 'PENDING',
      print_status: 'CREATED',
      expires_at: new Date(Date.now() + 3600000),
      revoked_at: new Date(Date.now() - 500) // Revoked
    }
  ]);
  const repoRevoked = new DurableGuestCheckoutRepository(revokedDb as any);
  await assert.rejects(() => repoRevoked.verifyGuestToken(validJobId, sampleToken), /revoked/i);

  // Invalid / mismatched token
  const emptyDb = createMockDb([]);
  const repoMismatch = new DurableGuestCheckoutRepository(emptyDb as any);
  await assert.rejects(() => repoMismatch.verifyGuestToken(validJobId, sampleToken), /invalid or does not match/i);

  console.log('  ✅ PASS: Guest capability token expiration, revocation, and mismatch defense verified');
}

// ============================================================================
// 8. AUTHORITATIVE QUOTE CALCULATION (PRICE & PAGE COUNT INTEGRITY)
// ============================================================================
async function testAuthoritativeQuoteCalculation() {
  const executedQueries: Array<{ text: string; values?: any[] }> = [];

  const mockClient = {
    query: async (queryTextOrConfig: any, values?: any[]) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      const vals = values || (typeof queryTextOrConfig === 'object' ? queryTextOrConfig.values : undefined);
      executedQueries.push({ text, values: vals });

      // 1. Fetch verified files
      if (text.includes('SELECT id::text, original_filename, verified_page_count')) {
        return {
          rowCount: 2,
          rows: [
            {
              id: validFileId,
              original_filename: 'thesis.pdf',
              verified_page_count: 10,
              upload_state: 'VERIFIED'
            },
            {
              id: validUuid2,
              original_filename: 'diagram.png',
              verified_page_count: 1, // 1 page per image
              upload_state: 'VERIFIED'
            }
          ]
        };
      }

      // 2. Fetch shop pricing rules
      if (text.includes('SELECT paper_size, color_mode, sides, price_per_page::float')) {
        return {
          rowCount: 2,
          rows: [
            { paper_size: 'A4', color_mode: 'BW', sides: 'SINGLE', price_per_page: 2.0 }, // ₹2.00 / 200 paise
            { paper_size: 'A4', color_mode: 'COLOR', sides: 'SINGLE', price_per_page: 10.0 } // ₹10.00 / 1000 paise
          ]
        };
      }

      // 3. Fetch shop min_order_amount
      if (text.includes('SELECT min_order_amount::float FROM public.shops')) {
        return {
          rowCount: 1,
          rows: [{ min_order_amount: 15.0 }] // ₹15.00 min order
        };
      }

      // 4. Upsert quote
      if (text.includes('INSERT INTO public.print_checkout_quotes')) {
        return {
          rowCount: 1,
          rows: [{ id: 'quote-uuid-1234' }]
        };
      }

      // 5. Update print_jobs total
      if (text.includes('UPDATE public.print_jobs')) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
    release: () => {}
  };

  const mockDb = {
    connect: async () => mockClient
  };

  const repo = new DurableGuestCheckoutRepository(mockDb as any);

  // Calculate quote for 2 files:
  // - File 1 (10 pages A4 BW SINGLE @ ₹2/page = ₹20 = 2000 paise)
  // - File 2 (1 page A4 COLOR SINGLE @ ₹10/page = ₹10 = 1000 paise)
  // Subtotal = 3000 paise (₹30.00), which exceeds min_order_amount of ₹15.00
  const configs: FilePrintConfig[] = [
    { fileId: validFileId, paperSize: 'A4', colorMode: 'BW', sides: 'SINGLE', copies: 1 },
    { fileId: validUuid2, paperSize: 'A4', colorMode: 'COLOR', sides: 'SINGLE', copies: 1 }
  ];

  const quote = await repo.calculateAuthoritativeQuote(validJobId, validUuid1, configs);

  assert.equal(quote.quoteId, 'quote-uuid-1234');
  assert.equal(quote.currency, 'INR');
  assert.equal(quote.amountMinor, 3000, 'Subtotal should be exactly 3000 paise (₹30)');
  assert.equal(quote.totalAmountRupees, 30.0);
  assert.equal(quote.breakdown.length, 2);
  assert.equal(quote.breakdown[0].verifiedPageCount, 10);
  assert.equal(quote.breakdown[0].pricePerPageMinor, 200);
  assert.equal(quote.breakdown[0].lineTotalMinor, 2000);
  assert.equal(quote.breakdown[1].verifiedPageCount, 1);
  assert.equal(quote.breakdown[1].pricePerPageMinor, 1000);
  assert.equal(quote.breakdown[1].lineTotalMinor, 1000);

  // Verify that the quote was saved in print_checkout_quotes with amountMinor = 3000
  const quoteInsert = executedQueries.find((q) => q.text.includes('INSERT INTO public.print_checkout_quotes'));
  assert.ok(quoteInsert);
  assert.equal(quoteInsert.values?.[2], 3000);

  console.log('  ✅ PASS: Server-authoritative quote calculated from verified page counts and pricing rules');
}

// ============================================================================
// 9. MINIMUM ORDER AMOUNT ENFORCEMENT IN QUOTE
// ============================================================================
async function testMinOrderAmountEnforcement() {
  const mockClient = {
    query: async (queryTextOrConfig: any) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;

      if (text.includes('SELECT id::text, original_filename, verified_page_count')) {
        return {
          rowCount: 1,
          rows: [{ id: validFileId, original_filename: 'small.pdf', verified_page_count: 1, upload_state: 'VERIFIED' }]
        };
      }
      if (text.includes('SELECT paper_size, color_mode, sides, price_per_page::float')) {
        return {
          rowCount: 1,
          rows: [{ paper_size: 'A4', color_mode: 'BW', sides: 'SINGLE', price_per_page: 2.0 }] // ₹2.00
        };
      }
      if (text.includes('SELECT min_order_amount::float FROM public.shops')) {
        return {
          rowCount: 1,
          rows: [{ min_order_amount: 10.0 }] // ₹10.00 min order (1000 paise)
        };
      }
      if (text.includes('INSERT INTO public.print_checkout_quotes')) {
        return { rowCount: 1, rows: [{ id: 'quote-min-order-test' }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release: () => {}
  };

  const repo = new DurableGuestCheckoutRepository({ connect: async () => mockClient } as any);
  const quote = await repo.calculateAuthoritativeQuote(validJobId, validUuid1, [
    { fileId: validFileId, paperSize: 'A4', colorMode: 'BW', sides: 'SINGLE', copies: 1 }
  ]);

  // Line item is 1 page * ₹2 = ₹2 (200 paise), but min order is ₹10 (1000 paise)
  assert.equal(quote.amountMinor, 1000, 'Quote must enforce minimum order amount of 1000 paise (₹10)');
  assert.equal(quote.totalAmountRupees, 10.0);

  console.log('  ✅ PASS: Shop min_order_amount strictly enforced when calculated quote is below threshold');
}

// ============================================================================
// 10. RETENTION AND CLEANUP TESTS
// ============================================================================
async function testRetentionCleanup() {
  const executedQueries: Array<{ text: string; values?: any[] }> = [];

  const mockClient = {
    query: async (queryTextOrConfig: any, values?: any[]) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      const vals = values || (typeof queryTextOrConfig === 'object' ? queryTextOrConfig.values : undefined);
      executedQueries.push({ text, values: vals });

      if (text.includes('UPDATE public.uploaded_files') && text.includes('retention_expires_at < NOW()')) {
        return {
          rowCount: 2,
          rows: [
            { id: validFileId, object_path: `shops/${validUuid1}/jobs/${validJobId}/files/${validFileId}.pdf`, storage_bucket: 'print-documents' },
            { id: validUuid2, object_path: `shops/${validUuid1}/jobs/${validJobId}/files/${validUuid2}.png`, storage_bucket: 'print-documents' }
          ]
        };
      }
      return { rowCount: 0, rows: [] };
    },
    release: () => {}
  };

  const repo = new DurableGuestCheckoutRepository({ connect: async () => mockClient } as any);
  const expired = await repo.markExpiredFilesForCleanup(50);

  assert.equal(expired.length, 2);
  assert.equal(expired[0].id, validFileId);
  assert.equal(expired[1].id, validUuid2);

  const cleanupQuery = executedQueries.find((q) => q.text.includes('retention_expires_at < NOW()'));
  assert.ok(cleanupQuery, 'Must query files past retention expiry');
  assert.equal(cleanupQuery.values?.[0], 50, 'Must enforce bounded limit on batch size');

  console.log('  ✅ PASS: Bounded file retention cleanup transitions expired records and returns storage paths');
}

// ============================================================================
// 11. TRANSACTION ROLLBACK TESTS
// ============================================================================
async function testTransactionRollback() {
  // Session creation rollback if capability insertion fails
  {
    const statements: string[] = [];
    const mockClient = {
      query: async (sqlOrConfig: any) => {
        const text = typeof sqlOrConfig === 'string' ? sqlOrConfig : sqlOrConfig.text;
        statements.push(text.trim().split(' ')[0]);

        if (text.includes('SELECT id::text, slug, name, status, is_open')) {
          return {
            rowCount: 1,
            rows: [{ id: validUuid1, slug: 'shop', name: 'Shop', status: 'ACTIVE', is_open: true, min_order_amount: 5, file_retention_days: 7 }]
          };
        }
        if (text.includes('INSERT INTO public.print_jobs')) {
          return { rowCount: 1, rows: [] };
        }
        if (text.includes('INSERT INTO public.guest_checkout_capabilities')) {
          throw new Error('simulated capability insert failure');
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {}
    };

    const repo = new DurableGuestCheckoutRepository({ connect: async () => mockClient } as any);
    await assert.rejects(
      () => repo.createGuestCheckoutSession({ shopSlugOrId: 'shop' }),
      /simulated capability insert failure/
    );
    assert.deepEqual(
      statements.filter((s) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)),
      ['BEGIN', 'ROLLBACK'],
      'Session creation must roll back on failure'
    );
  }

  // Quote calculation rollback if quote insert fails
  {
    const statements: string[] = [];
    const mockClient = {
      query: async (sqlOrConfig: any) => {
        const text = typeof sqlOrConfig === 'string' ? sqlOrConfig : sqlOrConfig.text;
        statements.push(text.trim().split(' ')[0]);

        if (text.includes('SELECT id::text, original_filename')) {
          return { rowCount: 1, rows: [{ id: validFileId, original_filename: 'doc.pdf', verified_page_count: 2, upload_state: 'VERIFIED' }] };
        }
        if (text.includes('SELECT paper_size, color_mode')) {
          return { rowCount: 1, rows: [{ paper_size: 'A4', color_mode: 'BW', sides: 'SINGLE', price_per_page: 2.0 }] };
        }
        if (text.includes('SELECT min_order_amount')) {
          return { rowCount: 1, rows: [{ min_order_amount: 5.0 }] };
        }
        if (text.includes('INSERT INTO public.print_checkout_quotes')) {
          throw new Error('simulated quote insert failure');
        }
        return { rowCount: 0, rows: [] };
      },
      release: () => {}
    };

    const repo = new DurableGuestCheckoutRepository({ connect: async () => mockClient } as any);
    await assert.rejects(
      () => repo.calculateAuthoritativeQuote(validJobId, validUuid1, [{ fileId: validFileId, paperSize: 'A4', colorMode: 'BW', sides: 'SINGLE', copies: 1 }]),
      /simulated quote insert failure/
    );
    assert.deepEqual(
      statements.filter((s) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s)),
      ['BEGIN', 'ROLLBACK'],
      'Quote calculation must roll back on failure'
    );
  }

  console.log('  ✅ PASS: Explicit transaction rollback verified across guest operations');
}

// ============================================================================
// 12. FAIL-CLOSED DATABASE BEHAVIOR (NO SILENT MEMORY FALLBACK)
// ============================================================================
async function testFailClosedDatabaseBehavior() {
  const failingDb = {
    connect: async () => {
      throw new Error('Neon database unreachable (connection pool exhausted)');
    }
  };
  const repo = new DurableGuestCheckoutRepository(failingDb as any);

  await assert.rejects(() => repo.createGuestCheckoutSession({ shopSlugOrId: 'shop' }), /Neon database unreachable/);
  await assert.rejects(() => repo.verifyGuestToken(validJobId, 'gct_123456789012345678901234'), /Neon database unreachable/);
  await assert.rejects(() => repo.getUploadedFiles(validJobId), /Neon database unreachable/);
  await assert.rejects(
    () =>
      repo.persistUploadedFileMetadata({
        jobId: validJobId,
        shopId: validUuid1,
        fileId: validFileId,
        objectPath: `shops/${validUuid1}/jobs/${validJobId}/files/${validFileId}.pdf`,
        originalFilename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'a'.repeat(64),
        verifiedPageCount: 1
      }),
    /Neon database unreachable/
  );

  console.log('  ✅ PASS: Guest repository fails closed during database outages (never silent memory fallback)');
}

// ============================================================================
// 13. DATABASE SAFETY GATE VERIFICATION
// ============================================================================
async function testDatabaseSafetyGate() {
  const { getVerifiedTestDatabaseUrl } = await import('../src/db/migrations');

  // Must reject missing PRINTFLOW_TEST_DATABASE_URL
  assert.throws(
    () => getVerifiedTestDatabaseUrl({}),
    /PRINTFLOW_TEST_DATABASE_URL is required/
  );

  // Must reject unconfirmed PRINTFLOW_TEST_DATABASE_CONFIRM
  assert.throws(
    () =>
      getVerifiedTestDatabaseUrl({
        PRINTFLOW_TEST_DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
        PRINTFLOW_TEST_DATABASE_CONFIRM: 'WRONG_CONFIRMATION'
      }),
    /Set PRINTFLOW_TEST_DATABASE_CONFIRM=ISOLATED_TEST_DATABASE/
  );

  // Must refuse collision with DATABASE_URL
  assert.throws(
    () =>
      getVerifiedTestDatabaseUrl({
        DATABASE_URL: 'postgresql://prod:secret@ep-cool-fog.neon.tech/printflow',
        PRINTFLOW_TEST_DATABASE_URL: 'postgresql://prod:secret@ep-cool-fog.neon.tech/printflow',
        PRINTFLOW_TEST_DATABASE_CONFIRM: 'ISOLATED_TEST_DATABASE'
      }),
    /Refusing to use DATABASE_URL as a test database target/
  );

  console.log('  ✅ PASS: Migration test runner safety gate strictly verified');
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function runAll() {
  console.log('\n======================================================');
  console.log('Running Phase 3 Private Supabase Storage & Guest Tests');
  console.log('======================================================\n');

  await testPhase3Migrations();
  await testDocumentInspection();
  await testImageInspection();
  await testStorageProvider();
  await testGuestRepositoryInputValidation();
  await testGuestCheckoutSessionFlow();
  await testGuestTokenVerification();
  await testAuthoritativeQuoteCalculation();
  await testMinOrderAmountEnforcement();
  await testRetentionCleanup();
  await testTransactionRollback();
  await testFailClosedDatabaseBehavior();
  await testDatabaseSafetyGate();

  console.log('\n======================================================');
  console.log('All Phase 3 Storage & Guest Checkout Tests PASSED');
  console.log('======================================================\n');
}

runAll().catch((err) => {
  console.error('\n❌ Phase 3 test failure:', err);
  process.exit(1);
});

