import React, { useState, useMemo } from 'react';
import { useApp } from '../../lib/store';
import {
  CreditCard,
  Search,
  Filter,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Eye,
  X,
  Receipt,
  RotateCcw,
  Store,
  DollarSign,
  ShieldCheck
} from 'lucide-react';
import { Transaction } from '../../types';
import { RazorpayCheckoutModal } from '../payment/RazorpayCheckoutModal';

export const AdminPayments: React.FC = () => {
  const { transactions, shops, adminRazorpay, refundTransaction, showToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedGateway, setSelectedGateway] = useState<string>('ALL');
  const [selectedTxModal, setSelectedTxModal] = useState<Transaction | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);

  // Computed Financial Metrics
  const { totalGMV, platformEarnings, shopPayouts, successCount, successRate, refundedGMV } = useMemo(() => {
    let gmv = 0;
    let earnings = 0;
    let payouts = 0;
    let success = 0;
    let refunded = 0;

    (transactions || []).forEach((t) => {
      if (t.status === 'SUCCESS') {
        success++;
        gmv += t.amount;
        const fee = t.platformFee || t.amount * ((adminRazorpay.platformFeePercent || 2.5) / 100);
        earnings += fee;
        payouts += t.amount - fee;
      } else if (t.status === 'REFUNDED') {
        refunded += t.amount;
      }
    });

    const rate = transactions.length > 0 ? ((success / transactions.length) * 100).toFixed(1) : '100';

    return {
      totalGMV: gmv,
      platformEarnings: earnings,
      shopPayouts: payouts,
      successCount: success,
      successRate: rate,
      refundedGMV: refunded
    };
  }, [transactions, adminRazorpay]);

  // Filter Transactions
  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter((tx) => {
      const matchesSearch =
        tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.orderCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.gatewayPaymentId || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (selectedStatus !== 'ALL' && tx.status !== selectedStatus) return false;
      if (selectedType !== 'ALL' && tx.type !== selectedType) return false;
      if (selectedGateway !== 'ALL' && tx.paymentGateway !== selectedGateway) return false;

      return true;
    });
  }, [transactions, searchQuery, selectedStatus, selectedType, selectedGateway]);

  const handleRefund = (tx: Transaction) => {
    if (confirm(`Are you sure you want to refund ₹${tx.amount.toFixed(2)} for ${tx.id}?`)) {
      refundTransaction(tx.id);
      showToast('Refund Processed', `Payment ₹${tx.amount.toFixed(2)} refunded successfully.`, 'info');
      setSelectedTxModal(null);
    }
  };

  const handleExportCSV = () => {
    const csvRows = [
      ['Transaction ID', 'Order Code', 'Shop Name', 'Customer', 'Gross Amount', 'Platform Fee', 'Net Payout', 'Status', 'Gateway', 'Created At'],
      ...filteredTransactions.map((t) => [
        `"${t.id}"`,
        `"${t.orderCode || '-'}"`,
        `"${t.shopName}"`,
        `"${t.customerName || 'Walk-in'}"`,
        t.amount.toFixed(2),
        (t.platformFee || t.amount * 0.02).toFixed(2),
        (t.amount - (t.platformFee || t.amount * 0.02)).toFixed(2),
        t.status,
        t.paymentGateway || 'RAZORPAY',
        `"${new Date(t.createdAt).toISOString()}"`
      ])
    ];
    const blob = new Blob([csvRows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `printflow-platform-payments.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Platform</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>Billing & Revenue</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-purple-700">Platform Payments</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Platform Payments & Settlements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time ledger of print order payments, platform revenue commissions, and merchant settlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCheckoutModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Test Razorpay Checkout</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Ledger CSV</span>
          </button>
        </div>
      </div>

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Gross Processed (GMV)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">
            ₹{totalGMV.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" />
            {successCount} settled transactions
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Platform Fee Cut</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-purple-900 font-mono">
            ₹{platformEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            {adminRazorpay.platformFeePercent}% standard platform fee rate
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Shop Merchant Payouts</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">
            ₹{shopPayouts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-blue-600 font-medium mt-1 block">
            Direct UPI settlements to shop accounts
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Gateway Success Rate</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">
            {successRate}%
          </p>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Refunded: ₹{refundedGMV.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search by ID, order code, shop, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="PRINT_JOB">Customer Print Orders</option>
            <option value="SAAS_SUBSCRIPTION">SaaS Subscriptions</option>
          </select>

          {/* Gateway Filter */}
          <select
            value={selectedGateway}
            onChange={(e) => setSelectedGateway(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
          >
            <option value="ALL">All Gateways</option>
            <option value="RAZORPAY">Razorpay Live / Test</option>
            <option value="DEMO">Demo UPI Simulation</option>
          </select>

          <span className="text-xs text-slate-500 font-medium ml-auto md:ml-2">
            Showing {filteredTransactions.length} of {transactions.length}
          </span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Transaction / Order</th>
                <th className="py-3 px-4">Shop Tenant</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Type & Method</th>
                <th className="py-3 px-4">Gross Amount</th>
                <th className="py-3 px-4">Platform Fee</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    No transactions match your search filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const fee = tx.platformFee || tx.amount * 0.02;
                  const isSuccess = tx.status === 'SUCCESS';
                  const isRefunded = tx.status === 'REFUNDED';
                  const isPending = tx.status === 'PENDING';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-mono font-bold text-slate-900 block">{tx.id}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {tx.orderCode || 'ORDER-INIT'} • {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block">{tx.shopName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{tx.shopId}</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        {tx.customerName || 'Counter Customer'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 block w-fit mb-0.5">
                          {tx.type === 'SAAS_SUBSCRIPTION' ? 'SaaS Fee' : 'Print Order'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {tx.paymentMethod || 'UPI Intent'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        ₹{tx.amount.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-purple-700 font-semibold">
                        ₹{fee.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isRefunded
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSuccess
                                ? 'bg-emerald-500'
                                : isRefunded
                                ? 'bg-indigo-500'
                                : isPending
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          />
                          {tx.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedTxModal(tx)}
                          className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                          title="View Payment Breakdown"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Details Drawer / Modal */}
      {selectedTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-600" />
                <span>Transaction Financial Breakdown</span>
              </h3>
              <button
                onClick={() => setSelectedTxModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction ID:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedTxModal.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gateway Ref:</span>
                  <span className="font-mono text-purple-700">
                    {selectedTxModal.gatewayPaymentId || selectedTxModal.gatewayReference || 'rzp_pay_99210'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="text-slate-700">{new Date(selectedTxModal.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <div>
                  <span className="text-slate-500 text-[10px] block">Shop Tenant</span>
                  <strong className="text-slate-900">{selectedTxModal.shopName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Customer</span>
                  <strong className="text-slate-900">{selectedTxModal.customerName || 'Walk-in'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Payment Gateway</span>
                  <strong className="text-slate-900">{selectedTxModal.paymentGateway || 'RAZORPAY'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Payment Method</span>
                  <strong className="text-slate-900">{selectedTxModal.paymentMethod || 'UPI QR'}</strong>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Gross Payment:</span>
                  <span className="font-mono font-bold text-slate-900">₹{selectedTxModal.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-purple-700">
                  <span>Platform Fee (Commission):</span>
                  <span className="font-mono font-bold">
                    -₹{(selectedTxModal.platformFee || selectedTxModal.amount * 0.02).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-100 pt-2 text-sm">
                  <span>Net Shop Merchant Payout:</span>
                  <span className="font-mono">
                    ₹{(selectedTxModal.amount - (selectedTxModal.platformFee || selectedTxModal.amount * 0.02)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-4">
              {selectedTxModal.status === 'SUCCESS' && (
                <button
                  onClick={() => handleRefund(selectedTxModal)}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Issue Refund</span>
                </button>
              )}
              <button
                onClick={() => setSelectedTxModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Razorpay Checkout Modal */}
      <RazorpayCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        defaultAmountInRupees={499}
        orderDescription="PrintFlow Cloud SaaS Subscription"
      />
    </div>
  );
};
