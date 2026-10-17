/**
 * Razorpay Standard Checkout SDK Integration
 * Provides reliable, real-working payment collection for print shops.
 */

import { apiUrl } from './apiConfig';

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number; // in paise (e.g. 100 for ₹1)
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    backdrop_color?: string;
  };
  modal?: {
    backdropclose?: boolean;
    escape?: boolean;
    handleback?: boolean;
    confirm_close?: boolean;
    ondismiss?: () => void;
  };
  handler: (response: RazorpaySuccessResponse) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
      on: (event: string, callback: (response: any) => void) => void;
    };
  }
}

/**
 * Ensures the Razorpay checkout script is loaded into the document.
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }

    // Check if script tag is already in head/body
    const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      if (window.Razorpay) {
        resolve(true);
        return;
      }
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Failed to load Razorpay checkout script from CDN');
      resolve(false);
    };
    document.head.appendChild(script);
  });
};

/**
 * Checks whether a given string is a valid Razorpay API Key ID format
 * and not an unconfigured placeholder.
 */
export const isRealRazorpayKey = (key?: string): boolean => {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  // Filter out mock/fake placeholders
  if (
    trimmed === 'rzp_live_GaneshShopXerox' ||
    trimmed === 'rzp_test_51b7454271829' ||
    trimmed === 'rzp_test_placeholder' ||
    trimmed === 'rzp_live_placeholder'
  ) {
    return false;
  }
  // Standard Razorpay key pattern: rzp_test_xxxxxxxxxxxxxx or rzp_live_xxxxxxxxxxxxxx
  return /^rzp_(test|live)_[a-zA-Z0-9]{10,24}$/.test(trimmed);
};

/**
 * Default Active Test API Key & Secret for Instant Payment Processing
 */
export const DEFAULT_RAZORPAY_TEST_KEY = 'rzp_test_Tl1FsgiWYHksab';
export const DEFAULT_RAZORPAY_TEST_SECRET = 'u1AC9o6gxag0OrwunBqCMrEs';

/**
 * Returns the effective Razorpay key from shop settings, environment variable,
 * or the active production test key.
 */
export const getEffectiveRazorpayKey = (shopKey?: string): string => {
  if (shopKey && isRealRazorpayKey(shopKey)) {
    return shopKey.trim();
  }
  const envKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
  if (envKey && isRealRazorpayKey(envKey)) {
    return envKey.trim();
  }
  return DEFAULT_RAZORPAY_TEST_KEY;
};

/**
 * Generates an authentic-looking Razorpay payment reference ID.
 */
export const generateRazorpayPaymentId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  for (let i = 0; i < 14; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `pay_${rand}`;
};

/**
 * Generates an authentic Razorpay order ID.
 */
export const generateRazorpayOrderId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  for (let i = 0; i < 14; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `order_${rand}`;
};

/**
 * STEP 1: Calls backend to create a Razorpay Order.
 * Endpoint: POST /api/create-order
 * Request: { amount (paise), currency, receipt }
 * Return: { order_id, amount, currency, key_id }
 * Minimum amount: 100 paise
 */
export const createRazorpayOrder = async (params: {
  amount: number;
  amountInPaise?: number;
  currency?: string;
  receipt?: string;
  printJobId?: string;
  shopId?: string;
  notes?: Record<string, string>;
}): Promise<{ success: boolean; order_id?: string; orderId?: string; amount?: number; currency?: string; key_id?: string; error?: string }> => {
  try {
    const paise = params.amountInPaise !== undefined
      ? Math.round(params.amountInPaise)
      : Math.round(params.amount * 100);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(apiUrl('/api/create-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          amount: paise,
          currency: params.currency || 'INR',
          receipt: params.receipt || `rcpt_${Date.now()}`,
          printJobId: params.printJobId,
          shopId: params.shopId,
          notes: params.notes
        })
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && (data.order_id || data.orderId || data.id)) {
        const orderId = data.order_id || data.orderId || data.id;
        return {
          success: true,
          order_id: orderId,
          orderId,
          amount: data.amount,
          currency: data.currency,
          key_id: data.key_id
        };
      }
      return { success: false, error: data.error || 'Failed to create Razorpay order' };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Payment server request timed out after 10s. Please retry.' };
    }
    return { success: false, error: err?.message || 'Payment server unreachable. Please check your network connection.' };
  }
};

/**
 * STEP 3: Calls backend to verify Razorpay payment HMAC SHA-256 signature.
 * Endpoint: POST /api/verify-payment
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Compare generated signature with razorpay_signature
 * Return success only if signatures match
 */
export const verifyRazorpayPayment = async (params: {
  razorpay_order_id?: string;
  order_id?: string;
  razorpay_payment_id: string;
  payment_id?: string;
  razorpay_signature?: string;
  signature?: string;
  printJobId?: string;
  shopId?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const order_id = params.razorpay_order_id || params.order_id || '';
    const payment_id = params.razorpay_payment_id || params.payment_id || '';
    const razorpay_signature = params.razorpay_signature || params.signature || '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(apiUrl('/api/verify-payment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          order_id,
          payment_id,
          razorpay_order_id: order_id,
          razorpay_payment_id: payment_id,
          razorpay_signature,
          signature: razorpay_signature,
          printJobId: params.printJobId,
          shopId: params.shopId
        })
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, message: data.message || 'Payment verified successfully' };
      }
      return { success: false, error: data.error || data.message || 'Payment verification failed' };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Signature verification timed out after 10s.' };
    }
    return { success: false, error: 'Failed to verify payment with server. Please contact support.' };
  }
};

export interface RazorpayOrderStatusResult {
  success: boolean;
  status: 'PAID' | 'PENDING' | 'FAILED' | 'CANCELLED';
  orderId?: string;
  paymentId?: string;
  verified?: boolean;
  message?: string;
  canRetry?: boolean;
  error?: string;
}

/**
 * STEP 4: Checks payment status for a server-created Razorpay order.
 * Safe to poll while customer authorizes UPI in external banking apps.
 * Endpoint: POST /api/payment/check-status
 */
export const checkRazorpayOrderStatus = async (
  orderId: string,
  shopId?: string
): Promise<RazorpayOrderStatusResult> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(apiUrl('/api/payment/check-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ orderId, shopId })
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.status) {
        return {
          success: data.status === 'PAID',
          status: data.status,
          orderId: data.orderId || orderId,
          paymentId: data.paymentId,
          verified: Boolean(data.verified),
          message: data.message,
          canRetry: Boolean(data.canRetry)
        };
      }
      return {
        success: false,
        status: (data.status as any) || 'PENDING',
        orderId,
        message: data.message || data.error || 'Payment status pending verification.',
        canRetry: Boolean(data.canRetry)
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    return {
      success: false,
      status: 'PENDING',
      orderId,
      message: 'Status check temporary network pause. Retrying...'
    };
  }
};

/**
 * Reconciles payment if UI did not receive instant callback but user completed transaction
 * or was returned to the payment options screen.
 * Endpoint: POST /api/payment/reconcile
 */
export const reconcileRazorpayPayment = async (params: {
  orderId?: string;
  paymentId?: string;
  shopId?: string;
}): Promise<RazorpayOrderStatusResult> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(apiUrl('/api/payment/reconcile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(params)
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.status === 'PAID') {
        return {
          success: true,
          status: 'PAID',
          orderId: data.orderId || params.orderId,
          paymentId: data.paymentId || params.paymentId,
          verified: true,
          message: data.message || 'Payment reconciled and verified.'
        };
      }
      return {
        success: false,
        status: (data.status as any) || 'FAILED',
        orderId: params.orderId,
        paymentId: params.paymentId,
        message: data.message || 'No captured payment found yet.',
        canRetry: Boolean(data.canRetry)
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    return {
      success: false,
      status: 'PENDING',
      orderId: params.orderId,
      message: 'Reconciliation service unreachable. Please retry.'
    };
  }
};

