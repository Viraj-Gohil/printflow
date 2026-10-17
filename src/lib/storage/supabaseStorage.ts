/**
 * Private Supabase Storage Provider for PrintFlow
 *
 * Requirements:
 * - Scoped private bucket ('print-documents' by default)
 * - Server-authoritative object paths: shops/{shopId}/jobs/{jobId}/files/{fileId}.ext
 * - Service-role key used strictly on backend; never exposed to browser or Electron
 * - Short-lived signed URLs (15-60 minutes) or authenticated streaming
 * - No permanent public URLs
 * - Fail-closed error handling (no silent in-memory or database BYTEA fallback)
 * - Pluggable StorageProvider interface for offline unit testing and integration tests
 */

import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

export interface StorageUploadInput {
  shopId: string;
  jobId: string;
  fileId: string;
  extension: string;
  buffer: Buffer;
  contentType: string;
}

export interface StorageUploadResult {
  bucket: string;
  objectPath: string;
  sizeBytes: number;
  sha256: string;
}

export interface SignedUrlResult {
  signedUrl: string;
  expiresAt: Date;
}

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  download(objectPath: string): Promise<Buffer>;
  createSignedUrl(objectPath: string, expiresInSeconds?: number): Promise<SignedUrlResult>;
  delete(objectPaths: string[]): Promise<void>;
  isConfigured(): boolean;
}

/**
 * Standard server-generated object path:
 * shops/<shopId>/jobs/<jobId>/files/<fileId>.<ext>
 * Guarantees compliance with database CHECK constraint: object_path LIKE 'shops/%/jobs/%/files/%'
 */
export function buildObjectPath(shopId: string, jobId: string, fileId: string, extension: string): string {
  const cleanExt = extension.replace(/^\./, '').toLowerCase() || 'bin';
  return `shops/${shopId}/jobs/${jobId}/files/${fileId}.${cleanExt}`;
}

export const DEFAULT_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'print-documents';
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 900; // 15 minutes

/**
 * Production Supabase Storage Service
 */
export class SupabaseStorageService implements StorageProvider {
  private client: SupabaseClient | null = null;
  private readonly bucket: string;

  constructor(bucket = DEFAULT_STORAGE_BUCKET, supabaseUrl?: string, serviceRoleKey?: string) {
    this.bucket = bucket;
    const url = supabaseUrl !== undefined ? supabaseUrl : process.env.SUPABASE_URL;
    const key = serviceRoleKey !== undefined ? serviceRoleKey : process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && key) {
      this.client = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error(
        'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.'
      );
    }
    return this.client;
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const client = this.requireClient();
    const objectPath = buildObjectPath(input.shopId, input.jobId, input.fileId, input.extension);
    const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');

    const { error } = await client.storage.from(this.bucket).upload(objectPath, input.buffer, {
      contentType: input.contentType,
      upsert: true
    });

    if (error) {
      throw new Error(`Supabase Storage upload failed for ${objectPath}: ${error.message}`);
    }

    return {
      bucket: this.bucket,
      objectPath,
      sizeBytes: input.buffer.length,
      sha256
    };
  }

  async download(objectPath: string): Promise<Buffer> {
    const client = this.requireClient();
    const { data, error } = await client.storage.from(this.bucket).download(objectPath);

    if (error || !data) {
      throw new Error(`Supabase Storage download failed for ${objectPath}: ${error?.message || 'File not found'}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async createSignedUrl(objectPath: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<SignedUrlResult> {
    const client = this.requireClient();
    const { data, error } = await client.storage.from(this.bucket).createSignedUrl(objectPath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to generate signed URL for ${objectPath}: ${error?.message || 'Unknown error'}`);
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return {
      signedUrl: data.signedUrl,
      expiresAt
    };
  }

  async delete(objectPaths: string[]): Promise<void> {
    if (objectPaths.length === 0) return;
    const client = this.requireClient();
    const { error } = await client.storage.from(this.bucket).remove(objectPaths);
    if (error) {
      throw new Error(`Failed to delete storage objects: ${error.message}`);
    }
  }
}

/**
 * In-memory Mock Storage Service for unit testing and offline development
 */
export class MockStorageService implements StorageProvider {
  private readonly storage = new Map<string, { buffer: Buffer; contentType: string }>();
  public readonly bucket: string;

  constructor(bucket = 'mock-print-documents') {
    this.bucket = bucket;
  }

  isConfigured(): boolean {
    return true;
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const objectPath = buildObjectPath(input.shopId, input.jobId, input.fileId, input.extension);
    const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');

    this.storage.set(objectPath, {
      buffer: input.buffer,
      contentType: input.contentType
    });

    return {
      bucket: this.bucket,
      objectPath,
      sizeBytes: input.buffer.length,
      sha256
    };
  }

  async download(objectPath: string): Promise<Buffer> {
    const entry = this.storage.get(objectPath);
    if (!entry) {
      throw new Error(`MockStorage: Object not found at ${objectPath}`);
    }
    return entry.buffer;
  }

  async createSignedUrl(objectPath: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<SignedUrlResult> {
    if (!this.storage.has(objectPath)) {
      throw new Error(`MockStorage: Object not found at ${objectPath}`);
    }
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return {
      signedUrl: `https://storage.mock.local/${this.bucket}/${objectPath}?token=${token}&expires=${expiresAt.getTime()}`,
      expiresAt
    };
  }

  async delete(objectPaths: string[]): Promise<void> {
    for (const p of objectPaths) {
      this.storage.delete(p);
    }
  }

  has(objectPath: string): boolean {
    return this.storage.has(objectPath);
  }

  clear(): void {
    this.storage.clear();
  }
}

// Global active storage provider instance
let activeStorageProvider: StorageProvider = new SupabaseStorageService();

export function getStorageProvider(): StorageProvider {
  return activeStorageProvider;
}

export function setStorageProvider(provider: StorageProvider): void {
  activeStorageProvider = provider;
}

