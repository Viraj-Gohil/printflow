import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import {
  CreditCard,
  IndianRupee,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Download,
  ShieldCheck
} from 'lucide-react';
import { Transaction } from '../../types';

export const ShopPayments: React.FC = () => {
  const { activeShop, transactions, refundTransaction } = useApp();

  const [refundTargetId, setRefundTargetId] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);

  const shopTxns = transactions.filter((t) => t.shopId === activeShop.id);
  const totalRevenue = shopTxns
    .filter((t) => t.status === 'SUCCESS' && t.type === 'PRINT_JOB')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleRefund = (id: string) => {
    refundTransaction(id);
    setRefundTargetId(null);
    setRefundSuccess(`Transaction ${id} refunded successfully.`);
    setTimeout(() => setRefundSuccess(null), 3500);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Gross Print Revenue</span>
          <p className="text-2xl font-extrabold font-mono text-slate-900 mt-1">₹{totalRevenue.toFixed(2)}</p>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            100% Direct Payouts to Shop Account
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Active Gateway</span>
          <p className="text-base font-bold text-slate-900 mt-2 truncate">
            {activeShop.razorpaySettings?.keyId || 'Direct UPI Settlement'}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Mode: {activeShop.razorpaySettings?.isTestMode ? 'Test Sandbox' : 'Production Live'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Shop UPI VPA</span>
          <p className="text-base font-bold text-slate-900 mt-2 font-mono truncate">
            {activeShop.razorpaySettings?.upiId || 'N/A'}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Auto-capture: {activeShop.razorpaySettings?.autoCapture ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {refundSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{refundSuccess}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Payment Transactions</h2>
            <p className="text-xs text-slate-500">
              Customer UPI, card, and counter payments settled directly to your shop
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Txn ID / Order</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shopTxns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                shopTxns.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-bold text-slate-900 block">{t.id}</span>
                      <span className="text-[11px] text-blue-600">{t.orderId}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      ₹{t.amount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {t.paymentMethod}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.type === 'PRINT_JOB'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {t.type === 'PRINT_JOB' ? 'Customer Print' : 'SaaS Plan Fee'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700'
                            : t.status === 'REFUNDED'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {t.status === 'SUCCESS' && t.type === 'PRINT_JOB' && (
                        <button
                          onClick={() => setRefundTargetId(t.id)}
                          className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {refundTargetId && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Initiate Customer Refund?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will mark the payment as <strong>REFUNDED</strong> and cancel the print job. The Razorpay webhook will trigger funds back to customer UPI / card.
            </p>
            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={() => setRefundTargetId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRefund(refundTargetId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
