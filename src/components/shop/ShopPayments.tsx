import React, { useState, useMemo } from 'react';
import { useApp } from '../../lib/store';
import {
  CreditCard,
  RotateCcw,
  CheckCircle2,
  Copy,
  Check,
  Search,
  X,
  FileText,
  Building2,
  QrCode,
  Download,
  RefreshCw
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';

export const ShopPayments: React.FC = () => {
  const { activeShop, transactions, refundTransaction } = useApp();

  const [refundTargetId, setRefundTargetId] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'REFUNDED' | 'PENDING'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Shop-specific transactions from authoritative state
  const shopTxns = useMemo(() => {
    return transactions.filter((t) => t.shopId === activeShop.id);
  }, [transactions, activeShop.id]);

  // Gross Print Revenue calculation
  const totalRevenue = useMemo(() => {
    return shopTxns
      .filter((t) => t.status === 'SUCCESS' && t.type === 'PRINT_JOB')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [shopTxns]);

  // Filtered transactions for display
  const filteredTxns = useMemo(() => {
    return shopTxns.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = t.id.toLowerCase().includes(q);
        const matchesOrder = t.orderId?.toLowerCase().includes(q);
        const matchesMethod = t.paymentMethod?.toLowerCase().includes(q);
        const matchesAmount = t.amount.toString().includes(q);
        if (!matchesId && !matchesOrder && !matchesMethod && !matchesAmount) {
          return false;
        }
      }
      return true;
    });
  }, [shopTxns, statusFilter, searchQuery]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefund = (id: string) => {
    refundTransaction(id);
    setRefundTargetId(null);
    setRefundSuccess(`Transaction ${id} refunded successfully.`);
    setTimeout(() => setRefundSuccess(null), 4000);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  const handleExportCsv = () => {
    const headers = ['Transaction ID', 'Order ID', 'Amount (INR)', 'Payment Method', 'Type', 'Status', 'Date & Time'];
    const rows = filteredTxns.map((t) => [
      t.id,
      t.orderId || '',
      t.amount.toFixed(2),
      t.paymentMethod || 'UPI / Gateway',
      t.type,
      t.status,
      new Date(t.createdAt).toLocaleString('en-IN')
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `printflow_transactions_${activeShop.slug || 'shop'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const targetTxn = useMemo(() => {
    return shopTxns.find((t) => t.id === refundTargetId);
  }, [shopTxns, refundTargetId]);

  // Safe display for gateway (no secrets exposed)
  const gatewayDisplay = useMemo(() => {
    if (!activeShop) return null;
    const keyId = activeShop.razorpaySettings?.keyId;
    if (keyId) {
      return keyId.length > 8 ? `${keyId.slice(0, 8)}••••` : keyId;
    }
    return 'Direct UPI Settlement';
  }, [activeShop]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10 text-slate-800">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Payments & Revenue
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            This page shows the shop's payment transactions and revenue.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh payment records"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {filteredTxns.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              title="Export filtered transactions as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. REVENUE SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Gross Print Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono mb-1 uppercase tracking-[0.06em]">
            <span>Gross Print Revenue</span>
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
          </div>
          {isRefreshing ? (
            <div className="h-8 w-28 bg-slate-100 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
            Direct settlements from customer print orders
          </p>
        </div>

        {/* Active Payment Gateway */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono mb-1 uppercase tracking-[0.06em]">
            <span>Active Payment Gateway</span>
            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
          </div>
          {isRefreshing ? (
            <div className="h-6 w-36 bg-slate-100 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-base font-bold text-slate-900 truncate mt-1" title={gatewayDisplay || undefined}>
              {gatewayDisplay || '—'}
            </p>
          )}
          <p className="text-[11px] text-slate-500 mt-1 font-mono">
            Mode: {activeShop?.razorpaySettings?.isTestMode ? 'Test Sandbox' : 'Production Live'}
          </p>
        </div>

        {/* Settled Transactions */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono mb-1 uppercase tracking-[0.06em]">
            <span>Settled Transactions</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
          </div>
          {isRefreshing ? (
            <div className="h-8 w-24 bg-slate-100 animate-pulse rounded mt-1" />
          ) : (
            <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {shopTxns.filter((t) => t.status === 'SUCCESS').length}
            </p>
          )}
          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
            Verified customer print payments
          </p>
        </div>
      </div>

      {/* 3. ALERTS / FEEDBACK */}
      {refundSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{refundSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setRefundSuccess(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. SEARCH & STATUS FILTER TOOLBAR */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by transaction ID, order ID, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                aria-label="Clear search query"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Status Segmented Control */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs shrink-0">
            {(['ALL', 'SUCCESS', 'REFUNDED', 'PENDING'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'SUCCESS' ? 'Settled' : st === 'REFUNDED' ? 'Refunded' : 'Pending'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. PAYMENT TRANSACTIONS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction / Order ID</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Transaction Type</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isRefreshing ? (
              // Loading Skeleton State
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <div className="h-4 w-32 bg-slate-100 animate-pulse rounded" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-16 bg-slate-100 animate-pulse rounded ml-auto" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-20 bg-slate-100 animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 bg-slate-100 animate-pulse rounded" />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="h-4 w-16 bg-slate-100 animate-pulse rounded mx-auto" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-28 bg-slate-100 animate-pulse rounded" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-12 bg-slate-100 animate-pulse rounded ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredTxns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-700 text-sm">No transactions found</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchQuery || statusFilter !== 'ALL'
                      ? 'No records match your active search filters. Try clearing your parameters.'
                      : 'Settled payments and order transactions will appear here as customers print.'}
                  </p>
                  {(searchQuery || statusFilter !== 'ALL') && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('ALL');
                        }}
                      >
                        Reset Filters
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredTxns.map((t) => {
                const isCopied = copiedId === t.id;

                return (
                  <TableRow key={t.id}>
                    {/* Transaction / Order ID */}
                    <TableCell>
                      <div className="flex flex-col gap-0.5 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 text-xs">{t.id}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(t.id, t.id)}
                            className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                            title="Copy Transaction ID"
                            aria-label={`Copy transaction ID ${t.id}`}
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        {t.orderId && (
                          <span className="text-[10px] text-blue-600 font-medium">
                            Order: {t.orderId}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="text-right">
                      <span className="font-mono font-bold text-slate-900 text-xs tabular-nums">
                        ₹{t.amount.toFixed(2)}
                      </span>
                    </TableCell>

                    {/* Payment Method */}
                    <TableCell>
                      <span className="text-xs text-slate-700 font-medium">
                        {t.paymentMethod || 'UPI / Gateway'}
                      </span>
                    </TableCell>

                    {/* Transaction Type */}
                    <TableCell>
                      <Chip
                        variant={t.type === 'PRINT_JOB' ? 'special' : 'default'}
                        size="sm"
                      >
                        {t.type === 'PRINT_JOB' ? 'Customer Print' : 'SaaS Plan Fee'}
                      </Chip>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      <Chip
                        variant={
                          t.status === 'SUCCESS'
                            ? 'success'
                            : t.status === 'REFUNDED'
                            ? 'muted'
                            : t.status === 'FAILED'
                            ? 'danger'
                            : 'warning'
                        }
                        size="sm"
                        dot
                      >
                        {t.status === 'SUCCESS' ? 'Settled' : t.status === 'REFUNDED' ? 'Refunded' : t.status}
                      </Chip>
                    </TableCell>

                    {/* Date & Time */}
                    <TableCell className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}{' '}
                      <span className="text-slate-400">
                        {new Date(t.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      {t.status === 'SUCCESS' && t.type === 'PRINT_JOB' ? (
                        <button
                          type="button"
                          onClick={() => setRefundTargetId(t.id)}
                          className="px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                          aria-label={`Initiate refund for transaction ${t.id}`}
                        >
                          Refund
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Table Footer */}
        <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 font-mono">
          <span>
            Showing <strong className="text-slate-700 font-semibold">{filteredTxns.length}</strong> of{' '}
            <strong className="text-slate-700 font-semibold">{shopTxns.length}</strong> transactions
          </span>
          <div className="flex items-center gap-3">
            <span>Currency: INR (₹)</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Settled directly via Razorpay Route</span>
          </div>
        </div>
      </div>

      {/* 6. REFUND CONFIRMATION DIALOG */}
      {refundTargetId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Initiate Customer Refund?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                This will mark transaction <strong className="font-mono text-slate-700">{refundTargetId}</strong>{' '}
                {targetTxn ? `(₹${targetTxn.amount.toFixed(2)})` : ''} as <strong>REFUNDED</strong> and cancel the associated print job. Funds will return to customer account.
              </p>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefundTargetId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleRefund(refundTargetId)}
              >
                Confirm Refund
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
