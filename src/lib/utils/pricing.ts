import { PaperSize, PrintColor, PrintSides, PricingRule, PagesPerSheet } from '../../types';

export const STANDARD_PAPER_SIZES: {
  id: PaperSize;
  name: string;
  dimensions: string;
  category: 'Standard' | 'Architectural' | 'Office';
}[] = [
  { id: 'A4', name: 'A4', dimensions: '210 × 297 mm', category: 'Standard' },
  { id: 'A3', name: 'A3', dimensions: '297 × 420 mm', category: 'Standard' },
  { id: 'A5', name: 'A5', dimensions: '148 × 210 mm', category: 'Standard' },
  { id: 'A6', name: 'A6', dimensions: '105 × 148 mm', category: 'Standard' },
  { id: 'A2', name: 'A2', dimensions: '420 × 594 mm', category: 'Architectural' },
  { id: 'A1', name: 'A1', dimensions: '594 × 841 mm', category: 'Architectural' },
  { id: 'A0', name: 'A0', dimensions: '841 × 1189 mm', category: 'Architectural' },
  { id: 'Legal', name: 'Legal', dimensions: '8.5 × 14 in', category: 'Office' },
  { id: 'Letter', name: 'Letter', dimensions: '8.5 × 11 in', category: 'Office' },
  { id: 'Executive', name: 'Executive', dimensions: '7.25 × 10.5 in', category: 'Office' }
];

export const COLOR_MODES: { id: PrintColor; label: string; badgeColor: string }[] = [
  { id: 'BW', label: 'Black & White', badgeColor: 'bg-slate-100 text-slate-800 border-slate-300' },
  { id: 'COLOR', label: 'Full Color', badgeColor: 'bg-amber-50 text-amber-800 border-amber-300' }
];

export const PRINT_SIDES: { id: PrintSides; label: string; shortLabel: string }[] = [
  { id: 'SINGLE', label: 'Single Sided', shortLabel: 'Single' },
  { id: 'DOUBLE', label: 'Double Sided (Duplex)', shortLabel: 'Duplex' }
];

/**
 * Dynamic price resolution engine:
 * Finds the shop's active configured rule matching (paperSize, color, sides).
 * Falls back to shop defaults or standard sensible defaults.
 */
export function resolveUnitPrice(
  rules: PricingRule[],
  shopId: string,
  paperSize: string,
  color: 'BW' | 'COLOR' = 'BW',
  sides: 'SINGLE' | 'DOUBLE' = 'SINGLE'
): number {
  const normalizedColor: PrintColor = color === 'COLOR' ? 'COLOR' : 'BW';
  const normalizedSides: PrintSides = sides === 'DOUBLE' ? 'DOUBLE' : 'SINGLE';

  // 1. Direct match with active shop rule
  const exactActiveMatch = rules.find(
    (r) =>
      r.shopId === shopId &&
      (r.isActive ?? true) &&
      r.paperSize.toLowerCase() === paperSize.toLowerCase() &&
      (r.color || r.colorMode || 'BW') === normalizedColor &&
      r.sides === normalizedSides
  );
  if (exactActiveMatch && exactActiveMatch.pricePerPage > 0) {
    return exactActiveMatch.pricePerPage;
  }

  // 2. Active rule for this paper size with same color but any sides (duplex ratio 1.75x if single rule found)
  const colorMatch = rules.find(
    (r) =>
      r.shopId === shopId &&
      (r.isActive ?? true) &&
      r.paperSize.toLowerCase() === paperSize.toLowerCase() &&
      (r.color || r.colorMode || 'BW') === normalizedColor
  );
  if (colorMatch && colorMatch.pricePerPage > 0) {
    if (normalizedSides === 'DOUBLE' && colorMatch.sides === 'SINGLE') {
      return Math.round(colorMatch.pricePerPage * 1.75 * 100) / 100;
    }
    return colorMatch.pricePerPage;
  }

  // 3. Fallback to active A4 rule for this shop with same color/sides
  const a4ShopMatch = rules.find(
    (r) =>
      r.shopId === shopId &&
      (r.isActive ?? true) &&
      r.paperSize.toLowerCase() === 'a4' &&
      (r.color || r.colorMode || 'BW') === normalizedColor &&
      r.sides === normalizedSides
  );
  if (a4ShopMatch && a4ShopMatch.pricePerPage > 0) {
    // scale for larger paper sizes if needed
    let multiplier = 1;
    const lower = paperSize.toLowerCase();
    if (lower === 'a3') multiplier = 2.5;
    else if (lower === 'a2') multiplier = 5.0;
    else if (lower === 'a1') multiplier = 10.0;
    else if (lower === 'a0') multiplier = 18.0;
    else if (lower === 'legal') multiplier = 1.3;
    return Math.round(a4ShopMatch.pricePerPage * multiplier * 100) / 100;
  }

  // 4. Default fallback matrix if no rules found
  let baseRate = 2.0; // A4 BW Single
  const pLower = paperSize.toLowerCase();
  if (pLower === 'a3') baseRate = 5.0;
  else if (pLower === 'a5' || pLower === 'a6') baseRate = 1.5;
  else if (pLower === 'a2') baseRate = 20.0;
  else if (pLower === 'a1') baseRate = 40.0;
  else if (pLower === 'a0') baseRate = 75.0;
  else if (pLower === 'legal') baseRate = 3.0;
  else if (pLower === 'executive') baseRate = 2.5;
  else if (pLower.includes('photo') || pLower.includes('4x6')) baseRate = 10.0;

  if (normalizedColor === 'COLOR') {
    baseRate = baseRate * 4.0;
  }
  if (normalizedSides === 'DOUBLE') {
    baseRate = baseRate * 1.75;
  }

  return Math.round(baseRate * 100) / 100;
}

export function calculateEstimatedSheetCount(
  pageCount: number,
  pageSelection: 'ALL' | 'CUSTOM',
  customRange: string | undefined,
  pagesPerSheet: PagesPerSheet,
  sides: PrintSides
): number {
  let effectivePages = pageCount;
  if (pageSelection === 'CUSTOM' && customRange) {
    const parts = customRange.split(',').map((s) => s.trim());
    let customCount = 0;
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          customCount += end - start + 1;
        }
      } else {
        const num = Number(part);
        if (!isNaN(num) && num > 0) {
          customCount += 1;
        }
      }
    }
    if (customCount > 0) {
      effectivePages = Math.min(customCount, pageCount);
    }
  }

  let sheets = Math.ceil(effectivePages / (pagesPerSheet || 1));
  if (sides === 'DOUBLE') {
    sheets = Math.ceil(sheets / 2);
  }
  return Math.max(1, sheets);
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(amount);
}
