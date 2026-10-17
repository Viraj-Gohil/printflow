import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import {
  Printer,
  Clock,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  QrCode,
  SlidersHorizontal,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  ChevronRight,
  Copy,
  ExternalLink,
  Share2,
  Sparkles
} from 'lucide-react';
import { PrintStatus } from '../../types';

export const ShopDashboard: React.FC = () => {
  const {
    activeShop,
    printJobs,
    printers,
    plans,
    navigate,
    updateJobStatus,
    showToast,
    simulateCustomerPrintJob
  } = useApp();
  const [copied, setCopied] = useState(false);

  const currentPlan = plans.find((p) => p.id === activeShop.planId) || plans[0];
  const shopJobs = printJobs.filter((j) => j.shopId === activeShop.id);
  const queuedJobs = shopJobs.filter((j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED');
  const printingJobs = shopJobs.filter((j) => j.printStatus === 'PRINTING' || j.printStatus === 'DOWNLOADING');
  const completedJobs = shopJobs.filter((j) => j.printStatus === 'COMPLETED');
  const failedJobs = shopJobs.filter((j) => j.printStatus === 'FAILED' || j.printStatus === 'CANCELLED' || j.printStatus === 'REQUIRES_ATTENTION');

  const todayRevenue = shopJobs
    .filter((j) => j.paymentStatus === 'SUCCESS')
    .reduce((sum, j) => sum + j.totalAmount, 0);

  const shopPrinters = printers.filter((p) => p.shopId === activeShop.id);
  const onlinePrinters = shopPrinters.filter((p) => p.isEnabled && p.status === 'ONLINE');

  const customerPortalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/s/${activeShop.slug}`
    : `/s/${activeShop.slug}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(customerPortalUrl);
    setCopied(true);
    showToast('Customer Link Copied!', `URL for ${activeShop.name} copied to clipboard`, 'info', 3000);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. SHOP CUSTOMER SCAN & ORDERING PORTAL LINK BANNER */}
      <div className="bg-white rounded-2xl border border-blue-200/90 p-4 sm:p-5 shadow-xs relative overflow-hidden bg-linear-to-r from-blue-50/70 via-white to-indigo-50/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Shop Customer QR & Ordering Link
                </h3>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ● Ready for Customers
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Customers scan this QR code or open this link at your counter to upload files, choose print options, and pay via UPI.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">Customer Link:</span>
                <code className="text-xs font-mono font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs select-all">
                  {customerPortalUrl}
                </code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={handleCopyLink}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-blue-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Customer Link'}</span>
            </button>

            <button
              onClick={() => navigate(`/s/${activeShop.slug}`)}
              className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-white" />
              <span>Open Customer View</span>
            </button>

            <button
              onClick={() => navigate('/shop/qr-codes')}
              className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>Print Tabletop Stand</span>
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Today's Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">₹{todayRevenue.toFixed(2)}</p>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" />
            Direct UPI Settlement
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Queue (Pending)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">{queuedJobs.length}</p>
          <span className="text-[11px] text-amber-600 font-medium mt-1 block">Awaiting print agent</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Printing Now</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-blue-600 font-mono">{printingJobs.length}</p>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">Active on trays</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Completed Today</span>
            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">{completedJobs.length}</p>
          <span className="text-[11px] text-green-600 font-medium mt-1 block">100% delivered</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Printers Online</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">
            {onlinePrinters.length} / {shopPrinters.length}
          </p>
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span className="text-slate-500 font-medium">Max {currentPlan.printerLimit} ({currentPlan.name})</span>
            <button
              onClick={() => navigate('/shop/printers')}
              className="text-blue-600 font-bold hover:underline cursor-pointer"
            >
              Hardware →
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 bg-linear-to-r from-blue-600 to-indigo-700 rounded-2xl text-white shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold">Fast Actions for Counter Operators</h3>
          <p className="text-xs text-blue-100 mt-0.5">
            Download your countertop QR flyer, configure per-page prices, or check printer agent status.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/shop/qr-codes')}
            className="px-3 py-2 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Generate Counter QR</span>
          </button>
          <button
            onClick={() => navigate('/shop/pricing')}
            className="px-3 py-2 bg-blue-500/30 hover:bg-blue-500/50 text-white font-semibold text-xs rounded-xl border border-white/20 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Edit Pricing</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Live Print Queue</h2>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Real-Time Listening
                </span>
              </div>
              <p className="text-xs text-slate-500">Orders placed by customers via counter QR scan appear here instantly</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {import.meta.env.DEV && (
              <button
                onClick={() => simulateCustomerPrintJob()}
                className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                title="Generate a sample test print order"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>+ Test Order</span>
              </button>
            )}
            <button
              onClick={() => navigate('/shop/print-jobs')}
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 rounded-xl flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Document / Settings</th>
                <th className="py-3 px-4">Assigned Printer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shopJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">No Orders in Live Queue</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          When customers scan your counter QR code, orders flow here automatically.
                        </p>
                      </div>
                      {import.meta.env.DEV && (
                        <button
                          onClick={() => simulateCustomerPrintJob()}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Send Sample Test Order</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                shopJobs.slice(0, 6).map((job) => {
                const firstFile = job.files[0];
                return (
                  <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{job.id}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 block">{job.customerName}</span>
                      <span className="text-[11px] text-slate-400">{job.customerPhone || 'Walk-in Guest'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-slate-900 truncate max-w-[180px]">{firstFile?.fileName || 'Document'}</p>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <span>{firstFile?.paperSize || 'A4'}</span>
                        <span>·</span>
                        <span>{firstFile?.color === 'COLOR' ? 'Color' : 'B&W'}</span>
                        <span>·</span>
                        <span>{firstFile?.copies} cop.</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-700 font-medium">{job.assignedPrinterName || 'Auto-Dispatch'}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      ₹{job.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          job.printStatus === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : job.printStatus === 'PRINTING'
                            ? 'bg-blue-50 text-blue-700 animate-pulse'
                            : job.printStatus === 'QUEUED'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {job.printStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {job.printStatus === 'QUEUED' && (
                        <button
                          onClick={() => updateJobStatus(job.id, 'PRINTING')}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-2xs"
                        >
                          Send to Print
                        </button>
                      )}
                      {job.printStatus === 'PRINTING' && (
                        <button
                          onClick={() => updateJobStatus(job.id, 'COMPLETED')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs"
                        >
                          Mark Ready
                        </button>
                      )}
                      {job.printStatus === 'COMPLETED' && (
                        <span className="text-[11px] text-slate-400">Delivered</span>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
