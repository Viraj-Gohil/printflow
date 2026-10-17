import type { PoolClient } from 'pg';
import type { DurableDatabase } from './durableCheckoutRepository';

export interface DurableShop {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  address: string;
  phone: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  isOpen: boolean;
  businessHours?: string;
  logoUrl?: string;
  primaryColor?: string;
  minOrderAmount: number;
  autoAccept: boolean;
  currentPlanId?: string;
}

export interface DurablePricingRule {
  id: string;
  shopId: string;
  paperSize: string;
  colorMode: 'BW' | 'COLOR';
  sides: 'SINGLE' | 'DOUBLE';
  pricePerPageMinor: number;
  isActive: boolean;
}

export interface CreatePricingRuleInput {
  shopId: string;
  paperSize: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';
  colorMode: 'BW' | 'COLOR';
  sides: 'SINGLE' | 'DOUBLE';
  pricePerPageMinor: number;
}

export interface DraftPrintJobInput {
  shopId: string;
  customerName: string;
  customerPhone?: string;
  totalAmountMinor: number;
  quote: {
    currency: 'INR';
    pricingSnapshot: Record<string, unknown>;
    expiresAt: Date;
  };
  expiresAt: Date;
}

export interface WebhookEventInput {
  providerEventId: string;
  eventType: string;
  payloadSha256: string;
  shopId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuid = (name: string, value: string) => {
  if (!UUID.test(value)) throw new Error(`${name} must be a UUID.`);
};
const nonEmpty = (name: string, value: string, max: number) => {
  if (!value || !value.trim() || value.length > max) throw new Error(`${name} is invalid.`);
};

const VALID_PAPER_SIZES = new Set(['A4', 'A3', 'A5', 'Letter', 'Legal']);
const VALID_COLOR_MODES = new Set(['BW', 'COLOR']);
const VALID_SIDES = new Set(['SINGLE', 'DOUBLE']);

/**
 * PostgreSQL-only read/write repository. It deliberately contains no fallback storage.
 * All methods throw on database errors — callers must handle 503 responses.
 */
export class NeonBusinessRepository {
  constructor(private readonly database: DurableDatabase) {}

  // ─── Shops ───────────────────────────────────────────────────────────────────

  async findActiveShopBySlug(slug: string): Promise<DurableShop | null> {
    if (!/^[a-z0-9-]{2,80}$/.test(slug)) throw new Error('shop slug is invalid.');
    const client = await this.database.connect();
    try {
      const result = await client.query<DurableShop>(
        `SELECT id::text, slug, name, tagline, address, phone, email, status,
                is_open AS "isOpen", business_hours AS "businessHours",
                logo_url AS "logoUrl", primary_color AS "primaryColor",
                min_order_amount::float * 100 AS "minOrderAmount",
                auto_accept AS "autoAccept",
                current_plan_id::text AS "currentPlanId"
         FROM public.shops WHERE slug = $1 AND status = 'ACTIVE' LIMIT 1`,
        [slug]
      );
      return result.rowCount ? result.rows[0] : null;
    } finally {
      client.release();
    }
  }

  async findShopById(shopId: string): Promise<DurableShop | null> {
    uuid('shopId', shopId);
    const client = await this.database.connect();
    try {
      const result = await client.query<DurableShop>(
        `SELECT id::text, slug, name, tagline, address, phone, email, status,
                is_open AS "isOpen", business_hours AS "businessHours",
                logo_url AS "logoUrl", primary_color AS "primaryColor",
                min_order_amount::float * 100 AS "minOrderAmount",
                auto_accept AS "autoAccept",
                current_plan_id::text AS "currentPlanId"
         FROM public.shops WHERE id = $1 LIMIT 1`,
        [shopId]
      );
      return result.rowCount ? result.rows[0] : null;
    } finally {
      client.release();
    }
  }

  /** Lists all shops; admin-only (no tenant filter). */
  async listAllShops(status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING'): Promise<DurableShop[]> {
    const client = await this.database.connect();
    try {
      const result = await client.query<DurableShop>(
        `SELECT id::text, slug, name, tagline, address, phone, email, status,
                is_open AS "isOpen", business_hours AS "businessHours",
                logo_url AS "logoUrl", primary_color AS "primaryColor",
                min_order_amount::float * 100 AS "minOrderAmount",
                auto_accept AS "autoAccept",
                current_plan_id::text AS "currentPlanId"
         FROM public.shops
         WHERE ($1::text IS NULL OR status = $1::text)
         ORDER BY created_at DESC`,
        [status ?? null]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async updateShopStatus(shopId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
    uuid('shopId', shopId);
    if (!['ACTIVE', 'SUSPENDED'].includes(status)) throw new Error('Invalid shop status.');
    const client = await this.database.connect();
    try {
      await client.query(
        `UPDATE public.shops SET status = $2, updated_at = NOW() WHERE id = $1`,
        [shopId, status]
      );
    } finally {
      client.release();
    }
  }

  async updateShopIsOpen(shopId: string, isOpen: boolean): Promise<void> {
    uuid('shopId', shopId);
    const client = await this.database.connect();
    try {
      await client.query(
        `UPDATE public.shops SET is_open = $2, updated_at = NOW() WHERE id = $1`,
        [shopId, isOpen]
      );
    } finally {
      client.release();
    }
  }

  // ─── Memberships ─────────────────────────────────────────────────────────────

  async assertShopMember(shopId: string, userId: string): Promise<void> {
    uuid('shopId', shopId);
    uuid('userId', userId);
    const client = await this.database.connect();
    try {
      const result = await client.query(
        `SELECT 1 FROM public.shop_members WHERE shop_id = $1 AND user_id = $2 LIMIT 1`,
        [shopId, userId]
      );
      if (result.rowCount !== 1) throw new Error('Shop access denied.');
    } finally {
      client.release();
    }
  }

  async getShopMemberRole(shopId: string, userId: string): Promise<'SHOP_OWNER' | 'STAFF' | null> {
    uuid('shopId', shopId);
    uuid('userId', userId);
    const client = await this.database.connect();
    try {
      const result = await client.query<{ role: 'SHOP_OWNER' | 'STAFF' }>(
        `SELECT role FROM public.shop_members WHERE shop_id = $1 AND user_id = $2 LIMIT 1`,
        [shopId, userId]
      );
      return result.rowCount ? result.rows[0].role : null;
    } finally {
      client.release();
    }
  }

  // ─── Pricing Rules ────────────────────────────────────────────────────────────

  async getActivePricingRules(shopId: string): Promise<DurablePricingRule[]> {
    uuid('shopId', shopId);
    const client = await this.database.connect();
    try {
      const result = await client.query(
        `SELECT id::text, shop_id::text AS "shopId", paper_size AS "paperSize",
                color_mode AS "colorMode", sides,
                ROUND(price_per_page * 100)::integer AS "pricePerPageMinor",
                COALESCE(is_active, true) AS "isActive"
         FROM public.pricing_rules
         WHERE shop_id = $1 AND COALESCE(is_active, true) = true
         ORDER BY paper_size, color_mode, sides`,
        [shopId]
      );
      return result.rows as DurablePricingRule[];
    } finally {
      client.release();
    }
  }

  async upsertPricingRule(input: CreatePricingRuleInput): Promise<DurablePricingRule> {
    uuid('shopId', input.shopId);
    if (!VALID_PAPER_SIZES.has(input.paperSize)) throw new Error('Invalid paperSize.');
    if (!VALID_COLOR_MODES.has(input.colorMode)) throw new Error('Invalid colorMode.');
    if (!VALID_SIDES.has(input.sides)) throw new Error('Invalid sides.');
    if (!Number.isSafeInteger(input.pricePerPageMinor) || input.pricePerPageMinor < 0) {
      throw new Error('pricePerPageMinor must be a non-negative integer.');
    }
    const pricePerPage = input.pricePerPageMinor / 100;
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ id: string }>(
        `INSERT INTO public.pricing_rules (shop_id, paper_size, color_mode, sides, price_per_page, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (shop_id, paper_size, color_mode, sides)
         DO UPDATE SET price_per_page = EXCLUDED.price_per_page,
                       is_active = true,
                       updated_at = NOW()
         RETURNING id::text`,
        [input.shopId, input.paperSize, input.colorMode, input.sides, pricePerPage]
      );
      await client.query('COMMIT');
      return {
        id: result.rows[0].id,
        shopId: input.shopId,
        paperSize: input.paperSize,
        colorMode: input.colorMode,
        sides: input.sides,
        pricePerPageMinor: input.pricePerPageMinor,
        isActive: true
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async softDeletePricingRule(ruleId: string, shopId: string): Promise<void> {
    uuid('ruleId', ruleId);
    uuid('shopId', shopId);
    const client = await this.database.connect();
    try {
      await client.query(
        `UPDATE public.pricing_rules SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND shop_id = $2`,
        [ruleId, shopId]
      );
    } finally {
      client.release();
    }
  }

  // ─── Print Jobs ───────────────────────────────────────────────────────────────

  async createDraftPrintJobWithQuote(input: DraftPrintJobInput): Promise<{ jobId: string; quoteId: string }> {
    uuid('shopId', input.shopId);
    nonEmpty('customerName', input.customerName, 100);
    if (input.customerPhone) nonEmpty('customerPhone', input.customerPhone, 30);
    if (!Number.isSafeInteger(input.totalAmountMinor) || input.totalAmountMinor <= 0) {
      throw new Error('totalAmountMinor must be a positive integer.');
    }
    if (
      !(input.expiresAt instanceof Date) ||
      !(input.quote.expiresAt instanceof Date) ||
      input.quote.expiresAt <= new Date() ||
      input.expiresAt <= input.quote.expiresAt
    ) {
      throw new Error('Invalid job or quote expiry.');
    }
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const job = await client.query<{ id: string }>(
        `INSERT INTO public.print_jobs
          (order_code, tracking_token, shop_id, customer_name, customer_phone, files, total_amount,
           file_status, payment_status, print_status, payment_method, expires_at)
         VALUES ('DRAFT-' || replace(uuid_generate_v4()::text, '-', ''),
                 replace(uuid_generate_v4()::text, '-', ''),
                 $1, $2, $3, '[]'::jsonb,
                 $4::numeric / 100, 'UPLOADING', 'PENDING', 'CREATED', 'RAZORPAY', $5)
         RETURNING id::text`,
        [input.shopId, input.customerName, input.customerPhone || null, input.totalAmountMinor, input.expiresAt]
      );
      const quote = await client.query<{ id: string }>(
        `INSERT INTO public.print_checkout_quotes
          (job_id, shop_id, currency, amount_minor, pricing_snapshot, expires_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id::text`,
        [
          job.rows[0].id,
          input.shopId,
          input.quote.currency,
          input.totalAmountMinor,
          JSON.stringify(input.quote.pricingSnapshot),
          input.quote.expiresAt
        ]
      );
      await client.query(
        `INSERT INTO public.print_job_events (job_id, actor_type, to_status, event_code)
         VALUES ($1, 'SYSTEM', 'CREATED', 'JOB_DRAFT_CREATED')`,
        [job.rows[0].id]
      );
      await client.query('COMMIT');
      return { jobId: job.rows[0].id, quoteId: quote.rows[0].id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPrintJobById(jobId: string): Promise<Record<string, unknown> | null> {
    uuid('jobId', jobId);
    const client = await this.database.connect();
    try {
      const result = await client.query(
        `SELECT id::text, order_code AS "orderCode", tracking_token AS "trackingToken",
                shop_id::text AS "shopId", customer_name AS "customerName",
                customer_phone AS "customerPhone", files, total_amount::float * 100 AS "totalAmountMinor",
                file_status AS "fileStatus", payment_status AS "paymentStatus",
                print_status AS "printStatus", payment_method AS "paymentMethod",
                payment_id AS "paymentId", created_at AS "createdAt", updated_at AS "updatedAt",
                expires_at AS "expiresAt"
         FROM public.print_jobs WHERE id = $1 LIMIT 1`,
        [jobId]
      );
      return result.rowCount ? result.rows[0] : null;
    } finally {
      client.release();
    }
  }

  async listPrintJobsByShop(
    shopId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Record<string, unknown>[]> {
    uuid('shopId', shopId);
    const limit = Math.min(options.limit ?? 50, 200);
    const offset = Math.max(options.offset ?? 0, 0);
    const client = await this.database.connect();
    try {
      const result = await client.query(
        `SELECT id::text, order_code AS "orderCode", tracking_token AS "trackingToken",
                customer_name AS "customerName", customer_phone AS "customerPhone",
                total_amount::float * 100 AS "totalAmountMinor",
                payment_status AS "paymentStatus", print_status AS "printStatus",
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM public.print_jobs
         WHERE shop_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [shopId, limit, offset]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  // ─── Webhook Idempotency ──────────────────────────────────────────────────────

  /**
   * Atomically inserts a webhook event record.
   * Returns true if this is the first time this event is seen, false if duplicate.
   * Never throws on constraint violations — returns false instead.
   */
  async recordWebhookEventIdempotent(input: WebhookEventInput): Promise<boolean> {
    if (!input.providerEventId || input.providerEventId.length > 256) {
      throw new Error('providerEventId is invalid.');
    }
    if (!input.eventType || input.eventType.length > 128) {
      throw new Error('eventType is invalid.');
    }
    if (!/^[a-f0-9]{64}$/.test(input.payloadSha256)) {
      throw new Error('payloadSha256 must be a 64-char hex string.');
    }
    const client = await this.database.connect();
    try {
      const result = await client.query(
        `INSERT INTO public.razorpay_webhook_events
           (provider_event_id, event_type, payload_sha256, shop_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (provider_event_id) DO NOTHING
         RETURNING id`,
        [input.providerEventId, input.eventType, input.payloadSha256, input.shopId ?? null]
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  /** Marks a webhook event as successfully processed. */
  async markWebhookEventProcessed(providerEventId: string, error?: string): Promise<void> {
    if (!providerEventId || providerEventId.length > 256) throw new Error('providerEventId is invalid.');
    const client = await this.database.connect();
    try {
      await client.query(
        `UPDATE public.razorpay_webhook_events
         SET processed_at = NOW(), processing_error = $2
         WHERE provider_event_id = $1`,
        [providerEventId, error ?? null]
      );
    } finally {
      client.release();
    }
  }

  // ─── Payment Orders ───────────────────────────────────────────────────────────

  /**
   * Marks a payment_order as PAID and records the transaction atomically.
   * Only call after server-side HMAC verification of the Razorpay signature.
   */
  async recordVerifiedPayment(input: {
    providerOrderId: string;
    providerPaymentId: string;
    providerSignatureHash: string;
    amountMinor: number;
    currency: string;
  }): Promise<void> {
    if (!input.providerOrderId || !/^order_[A-Za-z0-9_]+$/.test(input.providerOrderId)) {
      throw new Error('providerOrderId has an invalid format.');
    }
    if (!input.providerPaymentId || !/^pay_[A-Za-z0-9_]+$/.test(input.providerPaymentId)) {
      throw new Error('providerPaymentId has an invalid format.');
    }
    if (!/^[a-f0-9]{64}$/.test(input.providerSignatureHash)) {
      throw new Error('providerSignatureHash must be a 64-char hex string.');
    }
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new Error('amountMinor must be a positive integer.');
    }
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');

      // 1. Update payment_order status to PAID
      const orderUpdate = await client.query(
        `UPDATE public.payment_orders
         SET status = 'PAID', updated_at = NOW()
         WHERE provider_order_id = $1 AND status = 'CREATED'
         RETURNING id`,
        [input.providerOrderId]
      );

      if ((orderUpdate.rowCount ?? 0) === 0) {
        // Either already PAID (idempotent) or order not found — check which
        const existing = await client.query(
          `SELECT id, status FROM public.payment_orders WHERE provider_order_id = $1`,
          [input.providerOrderId]
        );
        if (existing.rowCount === 0) {
          // No matching order — can't link; skip transaction insert
          await client.query('ROLLBACK');
          return;
        }
        if (existing.rows[0].status === 'PAID') {
          // Already recorded — idempotent success
          await client.query('ROLLBACK');
          return;
        }
        throw new Error(`Payment order ${input.providerOrderId} is in status ${existing.rows[0].status}, cannot mark PAID.`);
      }

      const paymentOrderId = orderUpdate.rows[0].id;

      // 2. Insert transaction (idempotent via unique provider_payment_id)
      await client.query(
        `INSERT INTO public.payment_transactions
           (payment_order_id, provider_payment_id, provider_signature_hash,
            amount_minor, currency, status, verified_at)
         VALUES ($1, $2, $3, $4, $5, 'CAPTURED', NOW())
         ON CONFLICT (provider_payment_id) DO NOTHING`,
        [paymentOrderId, input.providerPaymentId, input.providerSignatureHash,
         input.amountMinor, input.currency]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export type NeonBusinessClient = PoolClient;
