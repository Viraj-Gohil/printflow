/**
 * Shared singleton instances of the Neon business and payment repositories.
 *
 * These are initialized lazily using the same PostgreSQL pool as paymentStorage.ts
 * so there is exactly one connection pool for the entire server process.
 *
 * All consumers must handle the case where DATABASE_URL is not set:
 * - isNeonDatabaseConfigured() returns false
 * - Calling any repository method throws because the underlying pool is null
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { NeonBusinessRepository } from './neonRepositories';
import { DurableCheckoutRepository } from './durableCheckoutRepository';
import { DurableGuestCheckoutRepository } from './guestCheckoutRepository';
import { DurablePaymentRepository } from './durablePaymentRepository';

export function isValidDatabaseUrl(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  const url = rawUrl.replace(/^['"]|['"]$/g, '').trim();
  if (!url) return false;

  if (
    url.includes('@HOST/') ||
    url.includes('@HOST:') ||
    url.endsWith('@HOST') ||
    url.includes('USER:PASSWORD') ||
    url.includes('YOUR_DATABASE_URL') ||
    url.includes('your-database-url') ||
    url.includes('placeholder')
  ) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === 'host' ||
      host === 'user' ||
      host === 'password' ||
      host === 'dbname' ||
      host === 'your_host' ||
      host === 'your-host'
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

dotenv.config({ override: true });

const DEFAULT_SUPABASE_DATABASE_URL = 'postgresql://postgres:wAz7k6AQBmfQ0QjG@db.rikchucpmlhvkfkmtojl.supabase.co:5432/postgres';
const rawDatabaseUrl = (process.env.DATABASE_URL || DEFAULT_SUPABASE_DATABASE_URL).trim();
const DATABASE_URL = isValidDatabaseUrl(rawDatabaseUrl) ? rawDatabaseUrl.replace(/^['"]|['"]$/g, '').trim() : DEFAULT_SUPABASE_DATABASE_URL;

let _sharedPool: Pool | null = null;
let _overridePoolConfigured: boolean | null = null;

if (DATABASE_URL && DATABASE_URL.length > 0) {
  try {
    _sharedPool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });
    _sharedPool.on('error', (err) => {
      console.warn('[repositoryFactory] Idle PostgreSQL client warning (handled):', err?.message || err);
    });
  } catch (err) {
    console.warn('[repositoryFactory] Failed to create shared PostgreSQL pool:', err);
    _sharedPool = null;
  }
}

/**
 * Returns true when the shared Neon pool is available.
 * Import this instead of re-reading DATABASE_URL throughout the codebase.
 */
export const isSharedPoolConfigured = (): boolean => {
  if (_overridePoolConfigured !== null) return _overridePoolConfigured;
  return _sharedPool !== null;
};

export function setPoolConfiguredForTest(val: boolean | null): void {
  _overridePoolConfigured = val;
}

/**
 * Returns the shared pool, or throws a descriptive error for fail-closed behavior.
 */
export function requireSharedPool(): Pool {
  if (!_sharedPool) {
    throw new Error('DATABASE_URL is required. Configure Neon PostgreSQL and restart the server.');
  }
  return _sharedPool;
}

/**
 * Lazily-created singleton NeonBusinessRepository.
 */
let _businessRepo: NeonBusinessRepository | null = null;
export function getBusinessRepository(): NeonBusinessRepository {
  if (!_businessRepo) {
    _businessRepo = new NeonBusinessRepository(requireSharedPool());
  }
  return _businessRepo;
}
export function setBusinessRepository(repo: NeonBusinessRepository | null): void {
  _businessRepo = repo;
}

/**
 * Lazily-created singleton DurableCheckoutRepository.
 */
let _checkoutRepo: DurableCheckoutRepository | null = null;
export function getCheckoutRepository(): DurableCheckoutRepository {
  if (!_checkoutRepo) {
    _checkoutRepo = new DurableCheckoutRepository(requireSharedPool());
  }
  return _checkoutRepo;
}
export function setCheckoutRepository(repo: DurableCheckoutRepository | null): void {
  _checkoutRepo = repo;
}

/**
 * Lazily-created singleton DurableGuestCheckoutRepository.
 */
let _guestCheckoutRepo: DurableGuestCheckoutRepository | null = null;
export function getGuestCheckoutRepository(): DurableGuestCheckoutRepository {
  if (!_guestCheckoutRepo) {
    _guestCheckoutRepo = new DurableGuestCheckoutRepository(requireSharedPool());
  }
  return _guestCheckoutRepo;
}
export function setGuestCheckoutRepository(repo: DurableGuestCheckoutRepository | null): void {
  _guestCheckoutRepo = repo;
}

/**
 * Lazily-created singleton DurablePaymentRepository for Phase 4.
 */
let _paymentRepo: DurablePaymentRepository | null = null;
export function getPaymentRepository(): DurablePaymentRepository {
  if (!_paymentRepo) {
    _paymentRepo = new DurablePaymentRepository(requireSharedPool());
  }
  return _paymentRepo;
}
export function setPaymentRepository(repo: DurablePaymentRepository | null): void {
  _paymentRepo = repo;
}

/**
 * Gracefully drains and closes the shared Neon PostgreSQL pool.
 * Used during server shutdown (SIGTERM / SIGINT).
 */
export async function closeSharedPool(): Promise<void> {
  if (_sharedPool) {
    await _sharedPool.end();
    _sharedPool = null;
  }
}

