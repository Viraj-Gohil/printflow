import type { Pool, PoolClient } from 'pg';

export interface CheckoutQuoteInput { jobId: string; shopId: string; currency: 'INR'; amountMinor: number; pricingSnapshot: Record<string, unknown>; expiresAt: Date; }
export interface PaymentOrderInput { jobId: string; shopId: string; providerOrderId: string; providerAccountRef: string; amountMinor: number; idempotencyKey: string; }
export interface DurableDatabase { connect(): Promise<PoolClient>; }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ensureUuid = (name: string, value: string) => { if (!UUID.test(value)) throw new Error(`${name} must be a UUID.`); };
const ensureMinor = (value: number) => { if (!Number.isSafeInteger(value) || value <= 0) throw new Error('amountMinor must be a positive integer.'); };

export class DurableCheckoutRepository {
  constructor(private readonly database: DurableDatabase) {}
  async createQuote(input: CheckoutQuoteInput): Promise<void> {
    ensureUuid('jobId', input.jobId); ensureUuid('shopId', input.shopId); ensureMinor(input.amountMinor);
    if (!(input.expiresAt instanceof Date) || input.expiresAt <= new Date()) throw new Error('Quote expiry must be in the future.');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO public.print_checkout_quotes (job_id, shop_id, currency, amount_minor, pricing_snapshot, expires_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)`, [input.jobId, input.shopId, input.currency, input.amountMinor, JSON.stringify(input.pricingSnapshot), input.expiresAt]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async createPaymentOrder(input: PaymentOrderInput): Promise<void> {
    ensureUuid('jobId', input.jobId); ensureUuid('shopId', input.shopId); ensureUuid('idempotencyKey', input.idempotencyKey); ensureMinor(input.amountMinor);
    if (!/^order_[A-Za-z0-9_]+$/.test(input.providerOrderId)) throw new Error('providerOrderId has an invalid Razorpay format.');
    if (!input.providerAccountRef || input.providerAccountRef.length > 128) throw new Error('providerAccountRef is invalid.');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO public.payment_orders (job_id, shop_id, purpose, provider, provider_order_id, provider_account_ref, currency, amount_minor, status, idempotency_key)
        VALUES ($1, $2, 'PRINT_JOB', 'RAZORPAY', $3, $4, 'INR', $5, 'CREATED', $6)`, [input.jobId, input.shopId, input.providerOrderId, input.providerAccountRef, input.amountMinor, input.idempotencyKey]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}

export type DurableCheckoutPool = Pool;
