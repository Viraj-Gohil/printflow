/**
 * Durable Guest Checkout & File Metadata Repository for Neon PostgreSQL
 *
 * Implements:
 * - Server-authoritative guest session creation with scoped high-entropy tokens
 * - Cryptographic token hashing (SHA-256) stored in guest_checkout_capabilities
 * - Verified file metadata persistence in public.uploaded_files
 * - Server-authoritative quote calculation based on verified page counts and Neon pricing rules
 * - Parameterized queries, explicit transaction boundaries, and fail-closed error handling
 */

import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DurableDatabase } from './durableCheckoutRepository';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ensureUuid = (name: string, value: string) => {
  if (!UUID_REGEX.test(value)) throw new Error(`${name} must be a valid UUID.`);
};

export interface GuestCheckoutSession {
  jobId: string;
  orderCode: string;
  trackingToken: string;
  guestToken: string;
  expiresAt: Date;
  shop: {
    id: string;
    slug: string;
    name: string;
    isOpen: boolean;
    minOrderAmount: number;
  };
}

export interface UploadedFileRecord {
  id: string;
  jobId: string;
  shopId: string;
  objectPath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  verifiedPageCount: number;
  uploadState: 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'FAILED' | 'DELETED';
  storageBucket: string;
  retentionExpiresAt: Date;
  createdAt: Date;
}

export interface FilePrintConfig {
  fileId: string;
  colorMode: 'BW' | 'COLOR';
  paperSize: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';
  sides: 'SINGLE' | 'DOUBLE';
  copies: number;
  pagesToPrint?: string;
}

export interface AuthoritativeQuote {
  quoteId: string;
  jobId: string;
  shopId: string;
  currency: 'INR';
  amountMinor: number;
  totalAmountRupees: number;
  expiresAt: Date;
  breakdown: Array<{
    fileId: string;
    filename: string;
    verifiedPageCount: number;
    colorMode: string;
    paperSize: string;
    sides: string;
    copies: number;
    pricePerPageMinor: number;
    lineTotalMinor: number;
  }>;
}

export class DurableGuestCheckoutRepository {
  constructor(private readonly database: DurableDatabase) {}

  /**
   * Initializes a durable guest checkout session for a shop.
   * Creates a draft print_job and a scoped guest_checkout_capability token.
   */
  async createGuestCheckoutSession(params: {
    shopSlugOrId: string;
    customerName?: string;
    customerPhone?: string;
    expiresInMinutes?: number;
  }): Promise<GuestCheckoutSession> {
    const { shopSlugOrId, customerName = 'Guest Customer', customerPhone, expiresInMinutes = 60 } = params;

    const client = await this.database.connect();
    try {
      await client.query('BEGIN');

      // 1. Resolve shop by UUID or slug
      const isShopUuid = UUID_REGEX.test(shopSlugOrId);
      const shopResult = await client.query<{
        id: string;
        slug: string;
        name: string;
        status: string;
        is_open: boolean;
        min_order_amount: number;
        file_retention_days: number;
      }>(
        isShopUuid
          ? `SELECT id::text, slug, name, status, is_open, min_order_amount::float AS min_order_amount,
                    file_retention_days
             FROM public.shops WHERE id = $1 LIMIT 1`
          : `SELECT id::text, slug, name, status, is_open, min_order_amount::float AS min_order_amount,
                    file_retention_days
             FROM public.shops WHERE slug = $1 LIMIT 1`,
        [shopSlugOrId]
      );

      if (shopResult.rowCount === 0) {
        throw new Error(`Shop '${shopSlugOrId}' not found.`);
      }

      const shop = shopResult.rows[0];
      if (shop.status !== 'ACTIVE') {
        throw new Error(`Shop '${shop.name}' is currently suspended or inactive.`);
      }
      if (!shop.is_open) {
        throw new Error(`Shop '${shop.name}' is currently closed and not accepting print jobs.`);
      }

      const jobId = crypto.randomUUID();
      const randSuffix = Math.floor(100 + Math.random() * 900);
      const orderCode = `PRT-${Date.now().toString(36).toUpperCase()}-${randSuffix}`;
      const trackingToken = `trk_${crypto.randomBytes(16).toString('hex')}`;
      const guestToken = `gct_${crypto.randomBytes(32).toString('base64url')}`;
      const tokenHash = crypto.createHash('sha256').update(guestToken).digest('hex');

      const now = new Date();
      const sessionExpiry = new Date(now.getTime() + Math.max(15, expiresInMinutes) * 60 * 1000);
      const jobExpiry = new Date(now.getTime() + 24 * 3600 * 1000); // 24 hours job TTL

      // 2. Insert draft print_job
      await client.query(
        `INSERT INTO public.print_jobs
          (id, order_code, tracking_token, shop_id, customer_name, customer_phone,
           files, total_amount, file_status, payment_status, print_status, payment_method, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, 0.00, 'UPLOADING', 'PENDING', 'CREATED', 'RAZORPAY', $7)`,
        [jobId, orderCode, trackingToken, shop.id, customerName.trim().slice(0, 100), customerPhone || null, jobExpiry]
      );

      // 3. Insert capability token hash
      await client.query(
        `INSERT INTO public.guest_checkout_capabilities (job_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [jobId, tokenHash, sessionExpiry]
      );

      // 4. Record audit event
      await client.query(
        `INSERT INTO public.print_job_events (job_id, actor_type, to_status, event_code, metadata)
         VALUES ($1, 'CUSTOMER', 'CREATED', 'GUEST_CHECKOUT_INITIALIZED', $2::jsonb)`,
        [jobId, JSON.stringify({ shopId: shop.id, orderCode })]
      );

      await client.query('COMMIT');

      return {
        jobId,
        orderCode,
        trackingToken,
        guestToken,
        expiresAt: sessionExpiry,
        shop: {
          id: shop.id,
          slug: shop.slug,
          name: shop.name,
          isOpen: shop.is_open,
          minOrderAmount: shop.min_order_amount
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verifies a guest capability token against a jobId.
   * Throws if invalid, expired, or revoked.
   */
  async verifyGuestToken(jobId: string, rawGuestToken: string): Promise<{
    valid: boolean;
    jobId: string;
    shopId: string;
    paymentStatus: string;
    printStatus: string;
  }> {
    ensureUuid('jobId', jobId);
    if (!rawGuestToken || typeof rawGuestToken !== 'string' || rawGuestToken.length < 24) {
      throw new Error('Guest capability token format is invalid.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawGuestToken).digest('hex');
    const client = await this.database.connect();
    try {
      const result = await client.query<{
        id: string;
        job_id: string;
        shop_id: string;
        payment_status: string;
        print_status: string;
        expires_at: Date;
        revoked_at: Date | null;
      }>(
        `SELECT c.id, c.job_id, j.shop_id, j.payment_status, j.print_status, c.expires_at, c.revoked_at
         FROM public.guest_checkout_capabilities c
         JOIN public.print_jobs j ON j.id = c.job_id
         WHERE c.job_id = $1 AND c.token_hash = $2
         LIMIT 1`,
        [jobId, tokenHash]
      );

      if (result.rowCount === 0) {
        throw new Error('Guest capability token is invalid or does not match this print job.');
      }

      const cap = result.rows[0];
      if (cap.revoked_at) {
        throw new Error('Guest capability token has been revoked.');
      }
      if (new Date(cap.expires_at) <= new Date()) {
        throw new Error('Guest capability token has expired. Please initiate a new checkout session.');
      }

      return {
        valid: true,
        jobId: cap.job_id,
        shopId: cap.shop_id,
        paymentStatus: cap.payment_status,
        printStatus: cap.print_status
      };
    } finally {
      client.release();
    }
  }

  /**
   * Persists verified uploaded file metadata into public.uploaded_files
   * and updates the print_jobs record.
   */
  async persistUploadedFileMetadata(params: {
    jobId: string;
    shopId: string;
    fileId: string;
    objectPath: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    verifiedPageCount: number;
    storageBucket?: string;
    retentionDays?: number;
  }): Promise<UploadedFileRecord> {
    ensureUuid('jobId', params.jobId);
    ensureUuid('shopId', params.shopId);
    ensureUuid('fileId', params.fileId);

    if (!params.objectPath.startsWith(`shops/${params.shopId}/jobs/${params.jobId}/files/`)) {
      throw new Error('objectPath violates shop/job isolation constraint.');
    }
    if (!/^[a-f0-9]{64}$/.test(params.sha256)) {
      throw new Error('sha256 must be a 64-character hexadecimal string.');
    }
    if (!Number.isSafeInteger(params.verifiedPageCount) || params.verifiedPageCount < 1) {
      throw new Error('verifiedPageCount must be a positive integer.');
    }
    if (!Number.isSafeInteger(params.sizeBytes) || params.sizeBytes <= 0) {
      throw new Error('sizeBytes must be a positive integer.');
    }

    const retentionDays = params.retentionDays || 7;
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');

      const retentionExpiry = new Date(Date.now() + retentionDays * 24 * 3600 * 1000);
      const bucket = params.storageBucket || 'print-documents';

      // 1. Insert into uploaded_files
      const fileInsert = await client.query<{
        id: string;
        job_id: string;
        shop_id: string;
        object_path: string;
        original_filename: string;
        mime_type: string;
        size_bytes: string;
        sha256: string;
        verified_page_count: number;
        upload_state: UploadedFileRecord['uploadState'];
        storage_bucket: string;
        retention_expires_at: Date;
        created_at: Date;
      }>(
        `INSERT INTO public.uploaded_files
           (id, job_id, shop_id, object_path, original_filename, mime_type,
            size_bytes, sha256, verified_page_count, upload_state, storage_bucket, retention_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'VERIFIED', $10, $11)
         ON CONFLICT (job_id, id) DO UPDATE SET
           upload_state = 'VERIFIED',
           verified_page_count = EXCLUDED.verified_page_count,
           sha256 = EXCLUDED.sha256,
           size_bytes = EXCLUDED.size_bytes
         RETURNING id, job_id, shop_id, object_path, original_filename, mime_type,
                   size_bytes, sha256, verified_page_count, upload_state, storage_bucket,
                   retention_expires_at, created_at`,
        [
          params.fileId,
          params.jobId,
          params.shopId,
          params.objectPath,
          params.originalFilename.slice(0, 255),
          params.mimeType,
          params.sizeBytes,
          params.sha256,
          params.verifiedPageCount,
          bucket,
          retentionExpiry
        ]
      );

      // 2. Append/Update file entry in print_jobs.files JSONB
      const fileMetaEntry = {
        id: params.fileId,
        fileName: params.originalFilename,
        pageCount: params.verifiedPageCount,
        sizeBytes: params.sizeBytes,
        mimeType: params.mimeType,
        sha256: params.sha256,
        objectPath: params.objectPath
      };

      await client.query(
        `UPDATE public.print_jobs
         SET file_status = 'VERIFIED',
             files = (
               SELECT jsonb_agg(DISTINCT elem)
               FROM (
                 SELECT elem FROM jsonb_array_elements(files) elem WHERE elem->>'id' != $2
                 UNION ALL
                 SELECT $3::jsonb AS elem
               ) t
             ),
             updated_at = NOW()
         WHERE id = $1`,
        [params.jobId, params.fileId, JSON.stringify(fileMetaEntry)]
      );

      // 3. Log event
      await client.query(
        `INSERT INTO public.print_job_events (job_id, actor_type, to_status, event_code, metadata)
         VALUES ($1, 'CUSTOMER', 'VERIFIED', 'FILE_UPLOADED_VERIFIED', $2::jsonb)`,
        [params.jobId, JSON.stringify({ fileId: params.fileId, filename: params.originalFilename, pageCount: params.verifiedPageCount })]
      );

      await client.query('COMMIT');

      const row = fileInsert.rows[0];
      return {
        id: row.id,
        jobId: row.job_id,
        shopId: row.shop_id,
        objectPath: row.object_path,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        sizeBytes: parseInt(row.size_bytes, 10),
        sha256: row.sha256,
        verifiedPageCount: row.verified_page_count,
        uploadState: row.upload_state,
        storageBucket: row.storage_bucket,
        retentionExpiresAt: row.retention_expires_at,
        createdAt: row.created_at
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculates an authoritative quote on the server using verified file page counts
   * and current active pricing rules from Neon. Persists quote in print_checkout_quotes.
   */
  async calculateAuthoritativeQuote(
    jobId: string,
    shopId: string,
    fileConfigs: FilePrintConfig[]
  ): Promise<AuthoritativeQuote> {
    ensureUuid('jobId', jobId);
    ensureUuid('shopId', shopId);

    if (!Array.isArray(fileConfigs) || fileConfigs.length === 0) {
      throw new Error('At least one file print configuration is required to calculate quote.');
    }

    const client = await this.database.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch verified files from uploaded_files
      const filesResult = await client.query<{
        id: string;
        original_filename: string;
        verified_page_count: number;
        upload_state: string;
      }>(
        `SELECT id::text, original_filename, verified_page_count, upload_state
         FROM public.uploaded_files
         WHERE job_id = $1 AND shop_id = $2 AND upload_state = 'VERIFIED'`,
        [jobId, shopId]
      );

      if (filesResult.rowCount === 0) {
        throw new Error('No verified files found for this checkout. Please upload your documents first.');
      }

      const filesMap = new Map(filesResult.rows.map((f) => [f.id, f]));

      // 2. Fetch active pricing rules for the shop
      const rulesResult = await client.query<{
        paper_size: string;
        color_mode: string;
        sides: string;
        price_per_page: number;
      }>(
        `SELECT paper_size, color_mode, sides, price_per_page::float
         FROM public.pricing_rules
         WHERE shop_id = $1 AND COALESCE(is_active, true) = true`,
        [shopId]
      );

      // Build quick lookup map: key = `${paperSize}_${colorMode}_${sides}`
      const rulesMap = new Map<string, number>();
      for (const r of rulesResult.rows) {
        const key = `${r.paper_size}_${r.color_mode}_${r.sides}`.toUpperCase();
        rulesMap.set(key, Math.round(r.price_per_page * 100)); // in minor paise
      }

      // Default fallback pricing if a specific permutation is not explicitly listed:
      // A4 BW SINGLE: ₹2 (200 paise), A4 COLOR SINGLE: ₹10 (1000 paise)
      const getDefaultRateMinor = (paperSize: string, colorMode: string, sides: string): number => {
        let base = colorMode === 'COLOR' ? 1000 : 200;
        if (paperSize === 'A3') base *= 2;
        if (sides === 'DOUBLE') base = Math.round(base * 1.5);
        return base;
      };

      let totalAmountMinor = 0;
      const breakdown: AuthoritativeQuote['breakdown'] = [];

      for (const config of fileConfigs) {
        const file = filesMap.get(config.fileId);
        if (!file) {
          throw new Error(`Configured file ID '${config.fileId}' was not found in verified uploads.`);
        }

        const copies = Math.min(Math.max(1, config.copies || 1), 1000);
        const verifiedPages = file.verified_page_count;

        const ruleKey = `${config.paperSize}_${config.colorMode}_${config.sides}`.toUpperCase();
        const pricePerPageMinor = rulesMap.get(ruleKey) || getDefaultRateMinor(config.paperSize, config.colorMode, config.sides);

        const lineTotalMinor = verifiedPages * pricePerPageMinor * copies;
        totalAmountMinor += lineTotalMinor;

        breakdown.push({
          fileId: file.id,
          filename: file.original_filename,
          verifiedPageCount: verifiedPages,
          colorMode: config.colorMode,
          paperSize: config.paperSize,
          sides: config.sides,
          copies,
          pricePerPageMinor,
          lineTotalMinor
        });
      }

      // Check shop minimum order amount
      const shopMin = await client.query<{ min_order_amount: number }>(
        `SELECT min_order_amount::float FROM public.shops WHERE id = $1`,
        [shopId]
      );
      const minOrderMinor = Math.round((shopMin.rows[0]?.min_order_amount || 2.0) * 100);
      if (totalAmountMinor < minOrderMinor) {
        totalAmountMinor = minOrderMinor;
      }

      const quoteExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minute quote TTL

      // 3. Persist quote in public.print_checkout_quotes (upsert)
      const quoteResult = await client.query<{ id: string }>(
        `INSERT INTO public.print_checkout_quotes
           (job_id, shop_id, currency, amount_minor, pricing_snapshot, expires_at)
         VALUES ($1, $2, 'INR', $3, $4::jsonb, $5)
         ON CONFLICT (job_id) DO UPDATE SET
           amount_minor = EXCLUDED.amount_minor,
           pricing_snapshot = EXCLUDED.pricing_snapshot,
           expires_at = EXCLUDED.expires_at,
           quoted_at = NOW()
         RETURNING id::text`,
        [jobId, shopId, totalAmountMinor, JSON.stringify({ breakdown, minOrderMinor }), quoteExpiry]
      );

      // 4. Update print_jobs total_amount
      await client.query(
        `UPDATE public.print_jobs
         SET total_amount = $2::numeric / 100, updated_at = NOW()
         WHERE id = $1`,
        [jobId, totalAmountMinor]
      );

      await client.query('COMMIT');

      return {
        quoteId: quoteResult.rows[0].id,
        jobId,
        shopId,
        currency: 'INR',
        amountMinor: totalAmountMinor,
        totalAmountRupees: totalAmountMinor / 100,
        expiresAt: quoteExpiry,
        breakdown
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Loads all verified uploaded files for a job.
   */
  async getUploadedFiles(jobId: string): Promise<UploadedFileRecord[]> {
    ensureUuid('jobId', jobId);
    const client = await this.database.connect();
    try {
      const result = await client.query<{
        id: string;
        job_id: string;
        shop_id: string;
        object_path: string;
        original_filename: string;
        mime_type: string;
        size_bytes: string;
        sha256: string;
        verified_page_count: number;
        upload_state: UploadedFileRecord['uploadState'];
        storage_bucket: string;
        retention_expires_at: Date;
        created_at: Date;
      }>(
        `SELECT id::text, job_id::text, shop_id::text, object_path, original_filename,
                mime_type, size_bytes, sha256, verified_page_count, upload_state,
                storage_bucket, retention_expires_at, created_at
         FROM public.uploaded_files
         WHERE job_id = $1 AND upload_state != 'DELETED'
         ORDER BY created_at ASC`,
        [jobId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        jobId: row.job_id,
        shopId: row.shop_id,
        objectPath: row.object_path,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        sizeBytes: parseInt(row.size_bytes, 10),
        sha256: row.sha256,
        verifiedPageCount: row.verified_page_count,
        uploadState: row.upload_state,
        storageBucket: row.storage_bucket,
        retentionExpiresAt: row.retention_expires_at,
        createdAt: row.created_at
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Loads a specific uploaded file record by jobId and fileId.
   */
  async getUploadedFileById(jobId: string, fileId: string): Promise<UploadedFileRecord | null> {
    ensureUuid('jobId', jobId);
    ensureUuid('fileId', fileId);

    const client = await this.database.connect();
    try {
      const result = await client.query<{
        id: string;
        job_id: string;
        shop_id: string;
        object_path: string;
        original_filename: string;
        mime_type: string;
        size_bytes: string;
        sha256: string;
        verified_page_count: number;
        upload_state: UploadedFileRecord['uploadState'];
        storage_bucket: string;
        retention_expires_at: Date;
        created_at: Date;
      }>(
        `SELECT id::text, job_id::text, shop_id::text, object_path, original_filename,
                mime_type, size_bytes, sha256, verified_page_count, upload_state,
                storage_bucket, retention_expires_at, created_at
         FROM public.uploaded_files
         WHERE job_id = $1 AND id = $2
         LIMIT 1`,
        [jobId, fileId]
      );

      if (result.rowCount === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        jobId: row.job_id,
        shopId: row.shop_id,
        objectPath: row.object_path,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        sizeBytes: parseInt(row.size_bytes, 10),
        sha256: row.sha256,
        verifiedPageCount: row.verified_page_count,
        uploadState: row.upload_state,
        storageBucket: row.storage_bucket,
        retentionExpiresAt: row.retention_expires_at,
        createdAt: row.created_at
      };
    } finally {
      client.release();
    }
  }

  /**
   * Bounded cleanup for expired files past retention_expires_at.
   * Marks records as DELETED and returns object paths for storage deletion.
   */
  async markExpiredFilesForCleanup(batchSize = 100): Promise<Array<{ id: string; objectPath: string; bucket: string }>> {
    const client = await this.database.connect();
    try {
      const result = await client.query<{ id: string; object_path: string; storage_bucket: string }>(
        `UPDATE public.uploaded_files
         SET upload_state = 'DELETED'
         WHERE id IN (
           SELECT id FROM public.uploaded_files
           WHERE retention_expires_at < NOW() AND upload_state != 'DELETED'
           LIMIT $1
         )
         RETURNING id::text, object_path, storage_bucket`,
        [batchSize]
      );

      return result.rows.map((r) => ({
        id: r.id,
        objectPath: r.object_path,
        bucket: r.storage_bucket
      }));
    } finally {
      client.release();
    }
  }
}

