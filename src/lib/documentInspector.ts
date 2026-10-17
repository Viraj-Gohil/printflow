/**
 * Server-Authoritative Document & Image Inspector
 *
 * Requirements:
 * - Validate binary structure and headers (magic bytes)
 * - Detect and reject encrypted/password-protected PDFs
 * - Reject malformed or truncated PDFs
 * - Extract authoritative PDF page counts (never trust client claims)
 * - Enforce maximum upload size and page count limits
 * - Verify image content and enforce explicit 1-page-per-image print semantics
 * - Compute cryptographic SHA-256 checksums
 */

import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { verifyFileSignature } from './security';

export interface DocumentInspectionResult {
  isValid: boolean;
  error?: string;
  mimeType?: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
  pageCount?: number;
  sizeBytes?: number;
  sha256?: string;
  isEncrypted?: boolean;
}

export const MAX_ALLOWED_PAGES = 500;
export const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Inspects a PDF buffer to extract verified page count and structural integrity.
 */
export function inspectPdf(buffer: Buffer): {
  isValid: boolean;
  pageCount?: number;
  error?: string;
  isEncrypted?: boolean;
} {
  if (buffer.length < 32) {
    return { isValid: false, error: 'PDF file is truncated or too small to be a valid document.' };
  }

  // 1. Validate %PDF- header within the first 1024 bytes
  const headerSlice = buffer.subarray(0, Math.min(1024, buffer.length)).toString('latin1');
  const headerMatch = headerSlice.match(/%PDF-(\d+\.\d+)/);
  if (!headerMatch) {
    return { isValid: false, error: 'Malformed PDF: Missing %PDF- header.' };
  }

  // 2. Validate %%EOF marker within the last 4096 bytes
  const tailLength = Math.min(4096, buffer.length);
  const tailSlice = buffer.subarray(buffer.length - tailLength).toString('latin1');
  if (!tailSlice.includes('%%EOF')) {
    return { isValid: false, error: 'Malformed PDF: Missing %%EOF terminal marker (file may be truncated).' };
  }

  const contentStr = buffer.toString('latin1');

  // 3. Detect Encryption (/Encrypt dictionary)
  // An encrypted PDF cannot be parsed or printed without credentials
  if (/\/Encrypt\s+(\d+\s+\d+\s+R|<<)/.test(contentStr)) {
    return {
      isValid: false,
      isEncrypted: true,
      error: 'Password-protected or encrypted PDF documents cannot be processed. Please provide an unencrypted PDF.'
    };
  }

  // 4. Extract Page Count
  // Method A: Look for /Type /Pages ... /Count N (the page tree root)
  // In well-formed PDFs, the page tree root contains the total page count for all children
  let detectedCount: number | null = null;

  // Search for dictionaries having /Type /Pages and /Count <int>
  const pagesMatches = Array.from(contentStr.matchAll(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/g));
  if (pagesMatches.length > 0) {
    // Find the maximum /Count among /Type /Pages nodes (the root is >= any intermediate nodes)
    const counts = pagesMatches.map((m) => parseInt(m[1], 10)).filter((n) => !isNaN(n) && n > 0);
    if (counts.length > 0) {
      detectedCount = Math.max(...counts);
    }
  }

  // Also check alternative order: /Count <int> ... /Type /Pages
  if (detectedCount === null) {
    const revMatches = Array.from(contentStr.matchAll(/\/Count\s+(\d+)[\s\S]*?\/Type\s*\/Pages\b/g));
    if (revMatches.length > 0) {
      const counts = revMatches.map((m) => parseInt(m[1], 10)).filter((n) => !isNaN(n) && n > 0);
      if (counts.length > 0) {
        detectedCount = Math.max(...counts);
      }
    }
  }

  // Method B: Fallback count individual leaf /Type /Page (excluding /Type /Pages)
  if (detectedCount === null || detectedCount === 0) {
    const pageLeafMatches = Array.from(contentStr.matchAll(/\/Type\s*\/Page\b(?!\s*s)/g));
    if (pageLeafMatches.length > 0) {
      detectedCount = pageLeafMatches.length;
    }
  }

  // Method C: If uncompressed detection did not find a valid page count,
  // inspect compressed object streams (/ObjStm) and FlateDecode streams.
  if (detectedCount === null || detectedCount === 0) {
    let maxStreamCount: number | null = null;
    let leafCountInStreams = 0;
    let searchPos = 0;
    const maxDecompressedBytes = MAX_DOCUMENT_SIZE_BYTES;
    let totalDecompressedBytes = 0;

    while (searchPos < buffer.length) {
      const streamMarker = Buffer.from('stream');
      const streamIdx = buffer.indexOf(streamMarker, searchPos);
      if (streamIdx === -1) break;

      // Find where stream binary payload actually starts (after stream\r\n or stream\n)
      let dataStart = streamIdx + 6;
      if (dataStart < buffer.length && buffer[dataStart] === 0x0d) dataStart++;
      if (dataStart < buffer.length && buffer[dataStart] === 0x0a) dataStart++;

      // Find corresponding endstream marker
      const endstreamMarker = Buffer.from('endstream');
      const endstreamIdx = buffer.indexOf(endstreamMarker, dataStart);
      if (endstreamIdx === -1) break;

      let dataEnd = endstreamIdx;
      while (dataEnd > dataStart && (buffer[dataEnd - 1] === 0x0a || buffer[dataEnd - 1] === 0x0d)) {
        dataEnd--;
      }

      if (dataEnd > dataStart) {
        const streamSlice = buffer.subarray(dataStart, dataEnd);
        let decompressed: Buffer | null = null;
        try {
          decompressed = zlib.inflateSync(streamSlice, { maxOutputLength: 20 * 1024 * 1024 });
        } catch {
          try {
            decompressed = zlib.inflateRawSync(streamSlice, { maxOutputLength: 20 * 1024 * 1024 });
          } catch {
            // Not a valid zlib/deflate stream, ignore safely
          }
        }

        if (decompressed) {
          totalDecompressedBytes += decompressed.length;
          if (totalDecompressedBytes > maxDecompressedBytes) {
            return { isValid: false, error: 'PDF decompressed streams exceed safe memory ceiling.' };
          }
          const decompStr = decompressed.toString('latin1');

          // Look for /Type /Pages /Count in decompressed stream
          const sPagesMatches = Array.from(decompStr.matchAll(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/g));
          for (const m of sPagesMatches) {
            const n = parseInt(m[1], 10);
            if (!isNaN(n) && n > 0) {
              maxStreamCount = maxStreamCount === null ? n : Math.max(maxStreamCount, n);
            }
          }

          const sRevMatches = Array.from(decompStr.matchAll(/\/Count\s+(\d+)[\s\S]*?\/Type\s*\/Pages\b/g));
          for (const m of sRevMatches) {
            const n = parseInt(m[1], 10);
            if (!isNaN(n) && n > 0) {
              maxStreamCount = maxStreamCount === null ? n : Math.max(maxStreamCount, n);
            }
          }

          // Count /Type /Page in decompressed stream
          const sLeafMatches = Array.from(decompStr.matchAll(/\/Type\s*\/Page\b(?!\s*s)/g));
          leafCountInStreams += sLeafMatches.length;
        }
      }

      searchPos = endstreamIdx + 9;
    }

    if (maxStreamCount !== null && maxStreamCount > 0) {
      detectedCount = maxStreamCount;
    } else if (leafCountInStreams > 0) {
      detectedCount = leafCountInStreams;
    }
  }

  if (detectedCount === null || detectedCount <= 0) {
    return { isValid: false, error: 'Malformed PDF: Could not determine valid page count.' };
  }

  if (detectedCount > MAX_ALLOWED_PAGES) {
    return {
      isValid: false,
      error: `PDF exceeds maximum allowed page ceiling of ${MAX_ALLOWED_PAGES} pages (document has ${detectedCount} pages).`
    };
  }

  return { isValid: true, pageCount: detectedCount, isEncrypted: false };
}

/**
 * Inspects image buffer integrity (JPEG, PNG, WEBP).
 * Explicit rule: Every validated image corresponds to exactly 1 printed page.
 */
export function inspectImage(
  buffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
): { isValid: boolean; error?: string; pageCount: number } {
  if (buffer.length < 16) {
    return { isValid: false, error: 'Image file is too small or truncated.', pageCount: 0 };
  }

  if (mimeType === 'image/png') {
    // PNG must have IHDR chunk right after the 8-byte signature
    if (buffer.length < 24) {
      return { isValid: false, error: 'Malformed PNG: File is truncated.', pageCount: 0 };
    }
    const chunkType = buffer.subarray(12, 16).toString('ascii');
    if (chunkType !== 'IHDR') {
      return { isValid: false, error: 'Malformed PNG: Missing IHDR chunk header.', pageCount: 0 };
    }
  } else if (mimeType === 'image/jpeg') {
    // JPEG starts with SOI 0xFFD8 and must contain at least one valid marker (e.g. 0xFF)
    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
      return { isValid: false, error: 'Malformed JPEG: Invalid SOI marker.', pageCount: 0 };
    }
    // Verify file ends with EOI (0xFFD9) or has valid marker structure
    const hasEoi = buffer[buffer.length - 2] === 0xFF && buffer[buffer.length - 1] === 0xD9;
    if (!hasEoi && buffer.length < 64) {
      return { isValid: false, error: 'Malformed JPEG: Missing valid EOI terminal marker.', pageCount: 0 };
    }
  } else if (mimeType === 'image/webp') {
    // WEBP format: RIFF + 4 bytes size + WEBP
    if (buffer.length < 16) {
      return { isValid: false, error: 'Malformed WEBP: File truncated.', pageCount: 0 };
    }
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    if (riff !== 'RIFF' || webp !== 'WEBP') {
      return { isValid: false, error: 'Malformed WEBP: Invalid RIFF/WEBP container format.', pageCount: 0 };
    }
  }

  // Rule: exactly 1 page per image
  return { isValid: true, pageCount: 1 };
}

/**
 * Master server-side document inspector.
 * Enforces magic-byte verification, checksum calculation, structure parsing,
 * and authoritative page-count determination.
 */
export function inspectDocument(
  buffer: Buffer,
  declaredFilename?: string
): DocumentInspectionResult {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, error: 'Uploaded file is empty (0 bytes).' };
  }

  if (buffer.length > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed limit of ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)}MB.`
    };
  }

  // 1. Detect binary file signature
  const sig = verifyFileSignature(buffer);
  if (!sig.isValid || !sig.mimeType) {
    return {
      isValid: false,
      error: 'File contents do not match genuine document or image binary signatures (only PDF, JPEG, PNG, WEBP are accepted).'
    };
  }

  const mime = sig.mimeType as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // 2. Parse and validate based on MIME type
  if (mime === 'application/pdf') {
    const pdfResult = inspectPdf(buffer);
    if (!pdfResult.isValid) {
      return {
        isValid: false,
        error: pdfResult.error,
        isEncrypted: pdfResult.isEncrypted,
        mimeType: mime,
        sizeBytes: buffer.length,
        sha256
      };
    }
    return {
      isValid: true,
      mimeType: mime,
      pageCount: pdfResult.pageCount,
      sizeBytes: buffer.length,
      sha256
    };
  } else {
    const imgResult = inspectImage(buffer, mime);
    if (!imgResult.isValid) {
      return {
        isValid: false,
        error: imgResult.error,
        mimeType: mime,
        sizeBytes: buffer.length,
        sha256
      };
    }
    return {
      isValid: true,
      mimeType: mime,
      pageCount: imgResult.pageCount,
      sizeBytes: buffer.length,
      sha256
    };
  }
}

