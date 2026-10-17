import React, { useState } from 'react';
import {
  CreditCard,
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
  Info
} from 'lucide-react';
import { loadRazorpayScript, getEffectiveRazorpayKey } from '../../lib/razorpay';

export interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAmountInRupees?: number;
  orderDescription?: string;
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  isOpen,
  onClose,
  defaultAmountInRupees = 499,
  orderDescription = 'PrintFlow SaaS Platform Subscription'
}) => {
  const [amountRupees, setAmountRupees] = useState<number>(defaultAmountInRupees);
  const [customerName, setCustomerName] = useState<string>('Alex Johnson');
  const [customerEmail, setCustomerEmail] = useState<string>('alex@printflow.example.com');
  const [customerPhone, setCustomerPhone] = useState<string>('9876543210');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<Array<{ step: string; status: 'ok' | 'error' | 'pending'; detail: string }>>([]);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    orderId?: string;
    paymentId?: string;
    signature?: string;
    message?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleStartCheckout = async () => {
    setIsLoading(true);
    setVerificationResult(null);
    const newLogs: Array<{ step: string; status: 'ok' | 'error' | 'pending'; detail: string }> = [];

    const amountInPaise = Math.max(100, Math.round(amountRupees * 100));

    try {
      // Step 0: Ensure Razorpay SDK script loaded
      newLogs.push({ step: 'SDK', status: 'pending', detail: 'Loading checkout.js script...' });
      setLogs([...newLogs]);

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK could not be loaded from CDN.');
      }
      newLogs[0] = { step: 'SDK', status: 'ok', detail: 'Razorpay Standard SDK loaded.' };
      setLogs([...newLogs]);

      // Step 1: Call Backend to Create Order
      newLogs.push({
        step: 'Backend Order',
        status: 'pending',
        detail: `Calling POST /api/create-order with ${amountInPaise} paise (₹${amountRupees})...`
      });
      setLogs([...newLogs]);

      const controller = new AbortController();
      const orderTimeout = setTimeout(() => controller.abort(), 10000);

      let orderData: any;
      try {
        const orderResponse = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `rcpt_${Date.now()}`
          })
        });
        clearTimeout(orderTimeout);

        orderData = await orderResponse.json();
        if (!orderResponse.ok || (!orderData.order_id && !orderData.orderId && !orderData.id)) {
          throw new Error(orderData.error || 'Server failed to generate order');
        }
      } finally {
        clearTimeout(orderTimeout);
      }

      const orderId = orderData.order_id || orderData.orderId || orderData.id;
      const keyId = orderData.key_id && orderData.key_id.startsWith('rzp_')
        ? orderData.key_id.trim()
        : getEffectiveRazorpayKey(orderData.key_id);

      newLogs[1] = {
        step: 'Backend Order',
        status: 'ok',
        detail: `Order Created! ID: ${orderId} (${orderData.currency} ${orderData.amount / 100})`
      };
      setLogs([...newLogs]);

      let modalDismissedOrCompleted = false;
      const modalWatchdog = setTimeout(() => {
        if (!modalDismissedOrCompleted && !document.querySelector('iframe.razorpay-checkout-frame')) {
          setIsLoading(false);
          newLogs.push({
            step: 'Modal Launch',
            status: 'error',
            detail: 'Checkout window did not open. Please check popup permissions and try again.'
          });
          setLogs([...newLogs]);
        }
      }, 12000);

      // Step 2: Open Razorpay Modal
      newLogs.push({
        step: 'Modal Launch',
        status: 'pending',
        detail: 'Launching Razorpay checkout iframe modal...'
      });
      setLogs([...newLogs]);

      const options = {
        key: keyId,
        amount: amountInPaise,
        currency: 'INR',
        name: 'PrintFlow Cloud Platform',
        description: orderDescription,
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone
        },
        theme: {
          color: '#7c3aed'
        },
        modal: {
          backdropclose: false,
          escape: true,
          handleback: true,
          confirm_close: true,
          ondismiss: () => {
            modalDismissedOrCompleted = true;
            clearTimeout(modalWatchdog);
            setIsLoading(false);
            newLogs[2] = {
              step: 'Modal Launch',
              status: 'error',
              detail: 'Checkout modal was closed or dismissed by user.'
            };
            setLogs([...newLogs]);
          }
        },
        handler: async (response: any) => {
          modalDismissedOrCompleted = true;
          clearTimeout(modalWatchdog);
          newLogs[2] = {
            step: 'Modal Launch',
            status: 'ok',
            detail: `Payment completed on client. Payment ID: ${response.razorpay_payment_id}`
          };

          // Step 3: Backend Signature Verification
          newLogs.push({
            step: 'Signature Verify',
            status: 'pending',
            detail: 'Sending payment ID, order ID, and signature to POST /api/verify-payment...'
          });
          setLogs([...newLogs]);

          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: response.razorpay_order_id || orderId,
                payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id || orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              newLogs[3] = {
                step: 'Signature Verify',
                status: 'ok',
                detail: 'HMAC-SHA256 signature verified! Payment marked as PAID.'
              };
              setVerificationResult({
                success: true,
                orderId: response.razorpay_order_id || orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                message: verifyData.message || 'Signature verified successfully'
              });
            } else {
              throw new Error(verifyData.error || verifyData.message || 'Signature check failed');
            }
          } catch (verErr: any) {
            newLogs[3] = {
              step: 'Signature Verify',
              status: 'error',
              detail: verErr.message || 'Verification failed'
            };
            setVerificationResult({
              success: false,
              message: verErr.message || 'Signature verification rejected'
            });
          } finally {
            setIsLoading(false);
            setLogs([...newLogs]);
          }
        }
      };

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK window instance not available');
      }

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err: any) {
      setIsLoading(false);
      newLogs.push({
        step: 'Error',
        status: 'error',
        detail: err.message || 'Failed to initialize checkout'
      });
      setLogs([...newLogs]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Razorpay Standard Web Checkout</h3>
              <p className="text-xs text-slate-500">Live order creation & HMAC verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Payment Amount (₹ INR):
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">₹</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amountRupees}
                onChange={(e) => setAmountRupees(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum amount is ₹1.00 (100 paise).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Customer Name:</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Mobile Number:</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Status / Logs Box */}
        {logs.length > 0 && (
          <div className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs space-y-1.5 font-mono max-h-40 overflow-y-auto">
            {logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-sm shrink-0 font-bold ${
                    log.status === 'ok'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : log.status === 'error'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400 animate-pulse'
                  }`}
                >
                  {log.step}
                </span>
                <span className="text-slate-300 break-all">{log.detail}</span>
              </div>
            ))}
          </div>
        )}

        {/* Result banner */}
        {verificationResult && (
          <div
            className={`p-3.5 rounded-xl text-xs border ${
              verificationResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              {verificationResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Payment Successfully Verified!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Verification Failed</span>
                </>
              )}
            </div>
            {verificationResult.success && (
              <div className="text-[11px] space-y-0.5 font-mono text-emerald-800 mt-1">
                <div>Payment ID: {verificationResult.paymentId}</div>
                <div>Order ID: {verificationResult.orderId}</div>
              </div>
            )}
            {verificationResult.message && !verificationResult.success && (
              <p className="text-[11px] text-red-700">{verificationResult.message}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleStartCheckout}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Razorpay...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Launch Razorpay Checkout</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
