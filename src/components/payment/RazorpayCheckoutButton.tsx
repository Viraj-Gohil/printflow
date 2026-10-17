import React, { useState } from 'react';
import {
  loadRazorpayScript,
  getEffectiveRazorpayKey,
  createRazorpayOrder,
  verifyRazorpayPayment,
  checkRazorpayOrderStatus,
  reconcileRazorpayPayment,
  RazorpaySuccessResponse
} from '../../lib/razorpay';
import { apiUrl } from '../../lib/apiConfig';
import { CreditCard, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

export interface RazorpayCheckoutButtonProps {
  amountInPaise: number; // e.g. 50000 for ₹500 (minimum 100 paise)
  currency?: string; // default: 'INR'
  receipt?: string;
  name?: string;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, string>;
  flow?: 'subscription' | 'counter_print';
  shopId?: string;
  buttonText?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'purple' | 'emerald' | 'outline';
  themeColor?: string;
  onSuccess?: (payment: {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }) => void;
  onError?: (error: string) => void;
  onDismiss?: () => void;
  disabled?: boolean;
}

export const RazorpayCheckoutButton: React.FC<RazorpayCheckoutButtonProps> = ({
  amountInPaise,
  currency = 'INR',
  receipt,
  name = 'PrintFlow Platform',
  description = 'PrintFlow Cloud Payment',
  customerName,
  customerEmail,
  customerPhone,
  notes,
  flow,
  shopId,
  buttonText,
  className = '',
  variant = 'purple',
  themeColor = '#7c3aed',
  onSuccess,
  onError,
  onDismiss,
  disabled = false
}) => {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<RazorpaySuccessResponse | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);

  const formatAmount = (paise: number) => {
    return (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2
    });
  };

  const handleCheckout = async () => {
    if (disabled || loading) return;

    setErrorState(null);
    setStatusMessage(null);
    setLoading(true);

    try {
      // 1. Ensure Razorpay script is loaded
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady) {
        throw new Error('Failed to load Razorpay SDK. Please check your connection.');
      }

      // 2. Minimum amount validation: 100 paise
      const validPaise = Math.max(100, Math.round(amountInPaise));

      // 3. STEP 1: Call backend endpoint to create order
      // POST /api/create-order
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 10000);

      let orderData: any;
      try {
        const orderRes = await fetch(apiUrl('/api/create-order'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            amount: validPaise,
            currency,
            receipt: receipt || `rcpt_${Date.now()}`,
            notes,
            flow,
            shopId
          })
        });
        clearTimeout(fetchTimeout);

        orderData = await orderRes.json();
        if (!orderRes.ok || (!orderData.order_id && !orderData.orderId && !orderData.id)) {
          throw new Error(orderData.error || 'Failed to initialize order on server');
        }
      } finally {
        clearTimeout(fetchTimeout);
      }

      const orderId = orderData.order_id || orderData.orderId || orderData.id;
      // Authoritative key returned by server matching the exact order account:
      const keyId = orderData.key_id && orderData.key_id.startsWith('rzp_')
        ? orderData.key_id.trim()
        : getEffectiveRazorpayKey(orderData.key_id);

      let modalDismissedOrCompleted = false;
      const watchdog = setTimeout(() => {
        if (!modalDismissedOrCompleted && !document.querySelector('iframe.razorpay-checkout-frame')) {
          setLoading(false);
          const timeoutMsg = 'Checkout window took too long to open. Please tap retry.';
          setErrorState(timeoutMsg);
          if (onError) onError(timeoutMsg);
        }
      }, 12000);

      // 4. STEP 2: Open Razorpay Checkout modal with order_id
      const options = {
        key: keyId,
        amount: validPaise,
        currency,
        name,
        description,
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone
        },
        notes: notes || {},
        theme: {
          color: themeColor
        },
        modal: {
          backdropclose: false,
          escape: true,
          handleback: true,
          confirm_close: true,
          ondismiss: async () => {
            modalDismissedOrCompleted = true;
            clearTimeout(watchdog);

            // Reconcile status before concluding dismiss/cancellation
            try {
              setStatusMessage('Checking payment status...');
              const check = await checkRazorpayOrderStatus(orderId, shopId);
              if (check.status === 'PAID' && check.paymentId) {
                setLoading(false);
                setStatusMessage(`Verified: ${check.paymentId}`);
                if (onSuccess) {
                  onSuccess({
                    razorpay_payment_id: check.paymentId,
                    razorpay_order_id: orderId
                  });
                }
                return;
              }

              const recon = await reconcileRazorpayPayment({ orderId, shopId });
              if (recon.status === 'PAID' && recon.paymentId) {
                setLoading(false);
                setStatusMessage(`Verified: ${recon.paymentId}`);
                if (onSuccess) {
                  onSuccess({
                    razorpay_payment_id: recon.paymentId,
                    razorpay_order_id: orderId
                  });
                }
                return;
              }
            } catch (_) {
              // Ignore reconciliation error on dismiss
            }

            setLoading(false);
            setStatusMessage(null);
            if (onDismiss) onDismiss();
          }
        },
        handler: async (response: RazorpaySuccessResponse) => {
          modalDismissedOrCompleted = true;
          clearTimeout(watchdog);
          // 5. STEP 3: Receive payment ID, order ID, signature and verify on backend
          // POST /api/verify-payment
          setStatusMessage('Verifying payment signature with server...');

          try {
            const verifyRes = await fetch(apiUrl('/api/verify-payment'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: response.razorpay_order_id || orderId,
                payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id || orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                signature: response.razorpay_signature,
                flow,
                shopId,
                notes
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              // Try server reconciliation before failing
              const recon = await reconcileRazorpayPayment({
                orderId: response.razorpay_order_id || orderId,
                paymentId: response.razorpay_payment_id,
                shopId
              });
              if (!recon.success || recon.status !== 'PAID') {
                throw new Error(verifyData.error || verifyData.message || 'Signature verification failed');
              }
            }

            // Payment verified successfully
            setLoading(false);
            setLastPayment(response);
            setStatusMessage(`Verified: ${response.razorpay_payment_id}`);

            if (onSuccess) {
              onSuccess({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id || orderId,
                razorpay_signature: response.razorpay_signature
              });
            }
          } catch (verifyErr: any) {
            setLoading(false);
            const errStr = verifyErr.message || 'Payment verification failed.';
            setErrorState(errStr);
            if (onError) onError(errStr);
          }
        }
      };

      if (!window.Razorpay) {
        clearTimeout(watchdog);
        throw new Error('Razorpay SDK window instance not ready.');
      }

      const rzpInstance = new window.Razorpay(options as any);
      rzpInstance.open();
    } catch (err: any) {
      setLoading(false);
      const errMsg = err?.name === 'AbortError' ? 'Payment request timed out. Please try again.' : (err.message || 'Payment initiation failed');
      setErrorState(errMsg);
      if (onError) onError(errMsg);
    }
  };

  // Variant styling
  const variantClasses = {
    purple: 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-200/50',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-200/50',
    primary: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-200/50',
    secondary: 'bg-slate-900 hover:bg-slate-800 active:bg-black text-white shadow-slate-200/50',
    outline: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-slate-400'
  }[variant];

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={disabled || loading}
        className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses} ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            <span>
              {buttonText || `Pay ${formatAmount(amountInPaise)}`}
            </span>
          </>
        )}
      </button>

      {statusMessage && !errorState && (
        <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          {statusMessage}
        </span>
      )}

      {errorState && (
        <span className="text-[11px] text-red-600 font-medium inline-flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-red-500" />
          {errorState}
        </span>
      )}
    </div>
  );
};
