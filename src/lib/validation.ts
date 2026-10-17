/**
 * Comprehensive Validation Utilities for PrintFlow
 * Strictly validates all inputs across authentication, customer print orders, shop settings, and printer configurations.
 */

// Email regex according to standard RFC 5322 compatible pattern
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// 10-digit Indian mobile number format (starts with 6, 7, 8, or 9)
export const PHONE_REGEX = /^[6-9]\d{9}$/;

// UPI ID format (e.g. shopname@okaxis, user@upi, merchant@icici)
export const UPI_ID_REGEX = /^[a-zA-Z0-9._-]{2,49}@[a-zA-Z]{2,30}$/;

// Shop URL Slug format (lowercase alphanumeric and hyphens, 3-40 chars, no consecutive hyphens)
export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// IPv4 Address regex
export const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Email address is required.' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. user@domain.com).' };
  }
  return { isValid: true };
};

export const validatePhone = (phone: string, isRequired = true): { isValid: boolean; error?: string } => {
  const trimmed = phone.trim().replace(/[\s-]/g, '');
  if (!trimmed) {
    if (isRequired) {
      return { isValid: false, error: '10-digit mobile number is required.' };
    }
    return { isValid: true };
  }
  // Remove country code +91 if present
  const cleanPhone = trimmed.startsWith('+91') ? trimmed.slice(3) : trimmed.startsWith('91') && trimmed.length === 12 ? trimmed.slice(2) : trimmed;

  if (!/^\d+$/.test(cleanPhone)) {
    return { isValid: false, error: 'Mobile number must contain digits only.' };
  }
  if (cleanPhone.length !== 10) {
    return { isValid: false, error: `Mobile number must be exactly 10 digits (currently ${cleanPhone.length}).` };
  }
  if (!PHONE_REGEX.test(cleanPhone)) {
    return { isValid: false, error: 'Must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.' };
  }
  return { isValid: true };
};

export const validatePassword = (password: string, fieldName = 'Password'): { isValid: boolean; error?: string } => {
  if (!password) {
    return { isValid: false, error: `${fieldName} is required.` };
  }
  if (password.length < 6) {
    return { isValid: false, error: `${fieldName} must be at least 6 characters long.` };
  }
  if (password.length > 50) {
    return { isValid: false, error: `${fieldName} cannot exceed 50 characters.` };
  }
  return { isValid: true };
};

export const validateShopName = (name: string): { isValid: boolean; error?: string } => {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Shop name is required.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Shop name must be at least 3 characters long.' };
  }
  if (trimmed.length > 60) {
    return { isValid: false, error: 'Shop name cannot exceed 60 characters.' };
  }
  return { isValid: true };
};

export const validateOwnerName = (name: string): { isValid: boolean; error?: string } => {
  const trimmed = name.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Full name is required.' };
  }
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Full name must be at least 2 characters.' };
  }
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
    return { isValid: false, error: 'Name should contain letters and spaces only.' };
  }
  return { isValid: true };
};

export const validateCity = (city: string): { isValid: boolean; error?: string } => {
  const trimmed = city.trim();
  if (!trimmed) {
    return { isValid: false, error: 'City name is required.' };
  }
  if (trimmed.length < 2) {
    return { isValid: false, error: 'City must be at least 2 characters.' };
  }
  return { isValid: true };
};

export const validateUpiId = (upiId: string, isRequired = false): { isValid: boolean; error?: string } => {
  const trimmed = upiId.trim();
  if (!trimmed) {
    if (isRequired) {
      return { isValid: false, error: 'UPI ID is required for instant settlement.' };
    }
    return { isValid: true };
  }
  if (!trimmed.includes('@')) {
    return { isValid: false, error: 'UPI ID must contain "@" (e.g. name@okaxis or shop@upi).' };
  }
  if (!UPI_ID_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Invalid UPI ID format. Should be like "merchant@okhdfcbank" or "shop@upi".' };
  }
  return { isValid: true };
};

export const validatePageRange = (
  rangeStr: string,
  totalDocPages: number
): { isValid: boolean; error?: string; parsedPages?: number[] } => {
  const trimmed = rangeStr.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Custom page range cannot be empty.' };
  }

  // Allowed characters: digits, comma, hyphen, whitespace
  if (!/^[0-9,\s-]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid characters. Use only numbers, commas, and hyphens (e.g. 1-3, 5).'
    };
  }

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { isValid: false, error: 'Please enter at least one page number or range.' };
  }

  const pageSet = new Set<number>();

  for (const part of parts) {
    if (part.includes('-')) {
      const sides = part.split('-');
      if (sides.length !== 2) {
        return { isValid: false, error: `Invalid range format: "${part}". Example: 1-5` };
      }
      const start = parseInt(sides[0].trim(), 10);
      const end = parseInt(sides[1].trim(), 10);

      if (isNaN(start) || isNaN(end)) {
        return { isValid: false, error: `Invalid range values in "${part}".` };
      }
      if (start < 1) {
        return { isValid: false, error: `Page numbers must start from 1 (found ${start}).` };
      }
      if (start > end) {
        return { isValid: false, error: `Range start (${start}) cannot be greater than end (${end}).` };
      }
      if (end > totalDocPages) {
        return {
          isValid: false,
          error: `Page ${end} exceeds total document pages (${totalDocPages}).`
        };
      }
      for (let p = start; p <= end; p++) {
        pageSet.add(p);
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (isNaN(pageNum)) {
        return { isValid: false, error: `Invalid page number: "${part}".` };
      }
      if (pageNum < 1) {
        return { isValid: false, error: `Page number must be at least 1 (found ${pageNum}).` };
      }
      if (pageNum > totalDocPages) {
        return {
          isValid: false,
          error: `Page ${pageNum} exceeds total document pages (${totalDocPages}).`
        };
      }
      pageSet.add(pageNum);
    }
  }

  return { isValid: true, parsedPages: Array.from(pageSet).sort((a, b) => a - b) };
};

export const validatePositivePrice = (
  val: number | string,
  min = 0.5,
  max = 500,
  fieldName = 'Price'
): { isValid: boolean; error?: string } => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number.` };
  }
  if (num < min) {
    return { isValid: false, error: `${fieldName} must be at least ₹${min.toFixed(2)}.` };
  }
  if (num > max) {
    return { isValid: false, error: `${fieldName} cannot exceed ₹${max.toFixed(2)}.` };
  }
  return { isValid: true };
};
