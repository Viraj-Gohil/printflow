/**
 * Centralized Client-Side Document Validation Policy
 * Enforces magic-byte signature inspection, format restrictions, corrupt document detection,
 * and oversized file rejection BEFORE any network upload or Supabase interaction occurs.
 */

export interface DocumentValidationError {
  isOpen: boolean;
  code: 'UNSUPPORTED_FORMAT' | 'CORRUPT_DOCUMENT' | 'INVALID_CONTENT' | 'FILE_TOO_LARGE' | 'EMPTY_FILE' | 'MIME_MISMATCH' | 'NO_COMPATIBLE_PRINTER';
  title: string;
  message: string;
  fileName: string;
  detectedType?: string;
  supportedFormats?: string;
  actionText: string;
}

export interface ClientDocumentValidationResult {
  isValid: boolean;
  error?: DocumentValidationError;
  detectedMime?: string;
  detectedType?: string;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
export const SUPPORTED_FORMATS_DISPLAY = 'PDF, JPG, JPEG, PNG, WEBP';

/**
 * Reads the first N bytes of a file in the browser environment.
 */
async function readHeaderBytes(file: File, length = 32): Promise<Uint8Array> {
  const slice = file.slice(0, Math.min(length, file.size));
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Validates a user-selected File object in the browser before queueing or uploading.
 */
export async function validateClientDocument(file: File): Promise<ClientDocumentValidationResult> {
  // 1. Zero-byte check
  if (file.size <= 0) {
    return {
      isValid: false,
      error: {
        isOpen: true,
        code: 'EMPTY_FILE',
        title: 'Invalid Document',
        message: `The file "${file.name}" is empty (0 bytes). Please select a valid document.`,
        fileName: file.name,
        detectedType: 'Empty File',
        supportedFormats: SUPPORTED_FORMATS_DISPLAY,
        actionText: 'Choose Another File'
      }
    };
  }

  // 2. Maximum file size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: {
        isOpen: true,
        code: 'FILE_TOO_LARGE',
        title: 'File Size Limit Exceeded',
        message: `The selected file exceeds the 50 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
        fileName: file.name,
        detectedType: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        supportedFormats: SUPPORTED_FORMATS_DISPLAY,
        actionText: 'Choose Another File'
      }
    };
  }

  // 3. File extension check
  const lastDot = file.name.lastIndexOf('.');
  const ext = lastDot !== -1 ? file.name.substring(lastDot).toLowerCase() : '';

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    let detectedLabel = ext ? ext.replace('.', '').toUpperCase() : 'Unknown';
    if (ext === '.docx' || ext === '.doc') detectedLabel = 'Word Document (DOCX)';
    else if (ext === '.zip' || ext === '.rar' || ext === '.7z') detectedLabel = 'Compressed Archive';
    else if (ext === '.exe' || ext === '.bat' || ext === '.cmd') detectedLabel = 'Executable File';

    return {
      isValid: false,
      error: {
        isOpen: true,
        code: 'UNSUPPORTED_FORMAT',
        title: 'Unsupported File Format',
        message: 'This file format is not supported by PrintFlow.',
        fileName: file.name,
        detectedType: detectedLabel,
        supportedFormats: SUPPORTED_FORMATS_DISPLAY,
        actionText: 'Choose Another File'
      }
    };
  }

  // 4. Binary signature (magic bytes) inspection
  const header = await readHeaderBytes(file, 32);

  // Executable files (MZ)
  if (header.length >= 2 && header[0] === 0x4D && header[1] === 0x5A) {
    return {
      isValid: false,
      error: {
        isOpen: true,
        code: 'UNSUPPORTED_FORMAT',
        title: 'Unsupported File Format',
        message: 'This file format is not supported by PrintFlow.',
        fileName: file.name,
        detectedType: 'Executable File (EXE)',
        supportedFormats: SUPPORTED_FORMATS_DISPLAY,
        actionText: 'Choose Another File'
      }
    };
  }

  // ZIP / DOCX / XLSX / JAR (PK\x03\x04)
  if (header.length >= 4 && header[0] === 0x50 && header[1] === 0x4B && (header[2] === 0x03 || header[2] === 0x05 || header[2] === 0x07)) {
    return {
      isValid: false,
      error: {
        isOpen: true,
        code: 'UNSUPPORTED_FORMAT',
        title: 'Unsupported File Format',
        message: 'This file format is not supported by PrintFlow.',
        fileName: file.name,
        detectedType: ext === '.docx' ? 'Microsoft Word (DOCX)' : 'ZIP Archive',
        supportedFormats: SUPPORTED_FORMATS_DISPLAY,
        actionText: 'Choose Another File'
      }
    };
  }

  // Legacy OLE2 DOC
  if (header.length >= 4 && header[0] === 0xD0 && header[1] === 0xCF && header[2] === 0x11 && header[3] === 0xE0) {
    return {
      isValid: false,
      error: {
        isOpen: true,
        code: 'UNSUPPORTED_FORMAT',
        title: 'Unsupported File Format',
        message: 'This file format is not supported by PrintFlow.',
        fileName: file.name,
        detectedType: 'Microsoft Word (DOC)',
        supportedFormats: SUPPORTED_FORMATS_DISPLAY,
        actionText: 'Choose Another File'
      }
    };
  }

  // Detect genuine types
  const isPdfSig = header.length >= 4 && header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF-
  const isPngSig = header.length >= 8 && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
  const isJpgSig = header.length >= 3 && header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
  const isWebpSig = header.length >= 12 && header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
                    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;

  // Verify match with extension to prevent extension spoofing
  if (ext === '.pdf') {
    if (!isPdfSig) {
      return {
        isValid: false,
        error: {
          isOpen: true,
          code: 'MIME_MISMATCH',
          title: 'Invalid Document',
          message: 'The file contents do not match its file extension.',
          fileName: file.name,
          detectedType: isPngSig ? 'PNG Image' : isJpgSig ? 'JPEG Image' : 'Corrupt Binary',
          supportedFormats: SUPPORTED_FORMATS_DISPLAY,
          actionText: 'Choose Another File'
        }
      };
    }

    if (file.size < 32) {
      return {
        isValid: false,
        error: {
          isOpen: true,
          code: 'CORRUPT_DOCUMENT',
          title: 'Unable to Read File',
          message: 'The selected file appears to be damaged or corrupted and cannot be read.',
          fileName: file.name,
          detectedType: 'Truncated PDF',
          supportedFormats: SUPPORTED_FORMATS_DISPLAY,
          actionText: 'Choose Another File'
        }
      };
    }
  } else if (ext === '.jpg' || ext === '.jpeg') {
    if (!isJpgSig) {
      return {
        isValid: false,
        error: {
          isOpen: true,
          code: 'MIME_MISMATCH',
          title: 'Invalid Document',
          message: 'The file contents do not match its file extension.',
          fileName: file.name,
          detectedType: isPdfSig ? 'PDF Document' : isPngSig ? 'PNG Image' : 'Invalid Image Data',
          supportedFormats: SUPPORTED_FORMATS_DISPLAY,
          actionText: 'Choose Another File'
        }
      };
    }
  } else if (ext === '.png') {
    if (!isPngSig) {
      return {
        isValid: false,
        error: {
          isOpen: true,
          code: 'MIME_MISMATCH',
          title: 'Invalid Document',
          message: 'The file contents do not match its file extension.',
          fileName: file.name,
          detectedType: isPdfSig ? 'PDF Document' : isJpgSig ? 'JPEG Image' : 'Invalid Image Data',
          supportedFormats: SUPPORTED_FORMATS_DISPLAY,
          actionText: 'Choose Another File'
        }
      };
    }
  } else if (ext === '.webp') {
    if (!isWebpSig) {
      return {
        isValid: false,
        error: {
          isOpen: true,
          code: 'MIME_MISMATCH',
          title: 'Invalid Document',
          message: 'The file contents do not match its file extension.',
          fileName: file.name,
          detectedType: 'Invalid WebP Data',
          supportedFormats: SUPPORTED_FORMATS_DISPLAY,
          actionText: 'Choose Another File'
        }
      };
    }
  }

  let mime = 'application/octet-stream';
  let typeLabel = 'Document';
  if (isPdfSig) { mime = 'application/pdf'; typeLabel = 'PDF Document'; }
  else if (isPngSig) { mime = 'image/png'; typeLabel = 'PNG Image'; }
  else if (isJpgSig) { mime = 'image/jpeg'; typeLabel = 'JPEG Image'; }
  else if (isWebpSig) { mime = 'image/webp'; typeLabel = 'WEBP Image'; }

  return {
    isValid: true,
    detectedMime: mime,
    detectedType: typeLabel
  };
}
