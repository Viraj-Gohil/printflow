import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  Check,
  ArrowLeft,
  AlertCircle,
  RotateCw,
  Store,
  HelpCircle,
  X,
  FileText,
  PackageCheck
} from 'lucide-react';
import { apiUrl } from '../../lib/apiConfig';
import { useApp } from '../../lib/store';

interface TrackingData {
  orderCode: string;
  shopName: string;
  customerName: string;
  paymentStatus: string;
  printStatus: string;
  fileCount: number;
  verifiedPageCount: number;
  createdAt: string;
  updatedAt: string;
  timeline: Array<{
    status: string;
    label: string;
    timestamp: string;
    completed: boolean;
  }>;
}

export const TrackPrintPage: React.FC = () => {
  const { activeShop, navigate } = useApp();
  const [tokenInput, setTokenInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<TrackingData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const shopName = activeShop?.name || 'EasyToPrint Counter';
  const uploadPageSlug = activeShop?.slug || 'printflow-counter';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setTrackingResult(null);

    try {
      const res = await fetch(apiUrl(`/api/public/print-tracking/${encodeURIComponent(tokenInput.trim())}`));
      const data = await res.json();
      if (!res.ok || !data.success || !data.job) {
        throw new Error(data.error || 'Print job not found for this tracking token.');
      }
      setTrackingResult(data.job);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid tracking token or print job not found.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen customer-page w-full flex flex-col font-['Manrope',sans-serif] text-[#111111] overflow-x-hidden">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (Harmonized with Customer Flow Header from Image 2)          */}
      {/* ========================================================================= */}
      <header className="bg-white border-b border-[#E1E7E1] sticky top-0 z-30 shadow-2xs font-['Manrope',sans-serif]">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left Section: [Printer Icon] [Shop Name / EasyToPrint] */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* 1. Printer Icon in square rounded-xl with green accent */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center shrink-0 border border-[#A7F3D0]/70">
              <Printer className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#00B32D]" />
            </div>

            {/* 2 & 3. Vertically Stacked: Dynamic Shop Name + EasyToPrint Brand */}
            <div className="min-w-0 flex-1">
              <span
                className="font-semibold text-xs sm:text-sm md:text-base text-[#111111] leading-tight block truncate"
                title={shopName}
              >
                {shopName}
              </span>
              <span className="text-[10px] sm:text-xs text-[#646B65] font-normal leading-tight block truncate">
                EasyToPrint
              </span>
            </div>
          </div>

          {/* Right Section: [Upload Button] [Info Button] */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Upload Button matching Image 2 button style */}
            <button
              type="button"
              onClick={() => navigate(`/s/${uploadPageSlug}`)}
              className="h-8 sm:h-9 px-2.5 sm:px-3 bg-[#E8F8EC] hover:bg-[#d5f3dc] text-[#008F25] font-medium text-xs rounded-xl border border-[#A7F3D0] transition-colors flex items-center gap-1 sm:gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              title="Back to Document Upload"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#00B32D] shrink-0" />
              <span>Upload</span>
            </button>

            {/* Info Button (?) */}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="h-8 sm:h-9 w-8 sm:w-9 bg-white hover:bg-slate-50 text-[#646B65] font-medium text-xs rounded-xl border border-[#E1E7E1] transition-colors flex items-center justify-center shrink-0 shadow-2xs cursor-pointer"
              title="How Tracking Works"
              aria-label="How Tracking Works"
            >
              <HelpCircle className="w-4 h-4 text-[#646B65] shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT (Harmonized with Customer Upload Page Layout from Image 2)  */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full max-w-md sm:max-w-lg mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 flex flex-col justify-start">
        {/* Page Title & Subtitle */}
        <div className="text-center space-y-1.5 mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#111111] tracking-tight">
            Track Your Print Order
          </h1>
          <p className="text-xs sm:text-sm font-normal text-[#646B65] max-w-sm mx-auto leading-relaxed">
            Enter your tracking token to monitor live printing progress and dispatch queue.
          </p>
        </div>

        {/* Tracking Card (Styled with common card tokens matching Image 2) */}
        <div className="bg-white rounded-3xl border border-[#E1E7E1] shadow-xs p-5 sm:p-7 w-full mb-6 text-center">
          {/* Centered green rounded square icon badge (Identical to Image 2 upload icon container) */}
          <div className="w-14 h-14 rounded-2xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center mx-auto mb-3.5 border border-[#A7F3D0]/70">
            <Search className="w-6 h-6 text-[#00B32D]" />
          </div>

          <h2 className="text-base sm:text-lg font-semibold text-[#111111]">
            Enter Tracking Token
          </h2>
          <p className="text-xs text-[#646B65] mt-1 mb-5">
            Check the real-time status of your printed documents
          </p>

          <form onSubmit={handleSearch} className="space-y-3.5 text-left">
            {/* Input with Search icon */}
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#646B65] pointer-events-none" />
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter tracking token (e.g. tr_...)"
                className="w-full h-11 pl-10 pr-4 bg-[#F7F8F7] hover:bg-[#F0F2F0] focus:bg-white border border-[#E1E7E1] rounded-xl text-xs sm:text-sm font-mono text-[#111111] placeholder:text-[#646B65] focus:outline-none focus:ring-2 focus:ring-[#00B32D] focus:border-transparent transition-all"
              />
            </div>

            {/* Track button (full card width) */}
            <button
              type="submit"
              disabled={isLoading || !tokenInput.trim()}
              className="w-full h-11 bg-[#00A61C] hover:bg-[#008F25] active:scale-[0.99] disabled:opacity-50 text-white font-medium text-xs sm:text-sm tracking-wide rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Searching Order...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Track Order</span>
                </>
              )}
            </button>
          </form>

          {/* Error Message */}
          {errorMsg && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold">Tracking Lookup Failed</p>
                <p className="text-[11px] text-red-600 mt-0.5 font-normal">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tracking Result View */}
        {trackingResult && (
          <div className="bg-white rounded-3xl shadow-xs border border-[#E1E7E1] overflow-hidden space-y-5 p-5 sm:p-6 w-full animate-in fade-in duration-300">
            {/* Shop Badge */}
            <div className="flex items-center justify-center pb-2 border-b border-[#E1E7E1]">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F8EC] border border-[#A7F3D0] text-[#00A61C] text-xs font-medium shadow-2xs">
                <Store className="w-3.5 h-3.5 text-[#00A61C] shrink-0" />
                <span>{trackingResult.shopName}</span>
              </span>
            </div>

            {/* Order Meta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E1E7E1]">
              <div>
                <span className="text-[11px] font-mono font-medium text-[#00A61C] uppercase tracking-wider">
                  Order Code
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="text-lg sm:text-xl font-mono font-semibold text-[#111111]">
                    {trackingResult.orderCode}
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleCopy(trackingResult.orderCode)}
                    className="p-1.5 text-slate-400 hover:text-[#111111] hover:bg-[#F7F8F7] rounded-lg transition-colors cursor-pointer"
                    title="Copy Code"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#00A61C]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    trackingResult.printStatus === 'COMPLETED'
                      ? 'bg-[#E8F8EC] text-[#00A61C] border border-[#A7F3D0]'
                      : trackingResult.printStatus === 'PRINTING'
                      ? 'bg-[#E8F8EC] text-[#00A61C] border border-[#00A61C]'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {trackingResult.printStatus}
                </span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <div className="p-3 bg-[#F7F8F7] rounded-xl border border-[#E1E7E1]">
                <p className="text-[10px] font-medium text-[#646B65] uppercase tracking-wider">Print Shop</p>
                <p className="text-xs sm:text-sm font-semibold text-[#111111] mt-1 truncate">
                  {trackingResult.shopName}
                </p>
              </div>
              <div className="p-3 bg-[#F7F8F7] rounded-xl border border-[#E1E7E1]">
                <p className="text-[10px] font-medium text-[#646B65] uppercase tracking-wider">Pages</p>
                <p className="text-xs sm:text-sm font-semibold text-[#111111] mt-1">
                  {trackingResult.verifiedPageCount} Pages
                </p>
              </div>
              <div className="p-3 bg-[#F7F8F7] rounded-xl border border-[#E1E7E1]">
                <p className="text-[10px] font-medium text-[#646B65] uppercase tracking-wider">Documents</p>
                <p className="text-xs sm:text-sm font-semibold text-[#111111] mt-1">
                  {trackingResult.fileCount} File(s)
                </p>
              </div>
              <div className="p-3 bg-[#F7F8F7] rounded-xl border border-[#E1E7E1]">
                <p className="text-[10px] font-medium text-[#646B65] uppercase tracking-wider">Payment</p>
                <p className="text-xs sm:text-sm font-semibold text-[#00A61C] mt-1">
                  {trackingResult.paymentStatus}
                </p>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="space-y-3 pt-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-[#646B65]">
                Status Timeline
              </h3>
              <div className="space-y-3 relative before:absolute before:top-3 before:bottom-3 before:left-3.5 before:w-0.5 before:bg-[#E1E7E1]">
                {trackingResult.timeline.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 relative">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-xs ${
                        step.completed ? 'bg-[#00A61C] text-white shadow-2xs' : 'bg-[#E1E7E1] text-[#646B65]'
                      }`}
                    >
                      {step.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className={`text-xs font-semibold ${step.completed ? 'text-[#111111]' : 'text-[#646B65]'}`}>
                        {step.label}
                      </p>
                      <p className="text-[10px] text-[#646B65] mt-0.5 font-normal">
                        {new Date(step.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 3. HELP / INFO MODAL (Matching Image 2 Help Modal Experience)              */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {helpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#111111]/40 backdrop-blur-sm"
              onClick={() => setHelpOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden relative flex flex-col z-10 border border-[#E1E7E1]"
            >
              <div className="p-5 sm:p-6 border-b border-[#E1E7E1] flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#111111]">How Order Tracking Works</h2>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className="p-2 hover:bg-[#F7F8F7] rounded-full transition-colors cursor-pointer text-[#646B65]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 bg-[#F7F8F7]/50">
                <p className="text-xs sm:text-sm text-[#646B65]">
                  Easily check real-time progress for your print orders from any connected EasyToPrint counter.
                </p>

                <div className="space-y-3">
                  {[
                    {
                      icon: FileText,
                      title: 'Find Your Tracking Token',
                      desc: 'Your tracking token (e.g. tr_...) was provided on the payment confirmation screen and your receipt.'
                    },
                    {
                      icon: Search,
                      title: 'Enter and Submit',
                      desc: 'Paste or type your tracking token into the search box and press Track Order.'
                    },
                    {
                      icon: PackageCheck,
                      title: 'Monitor Live Progress',
                      desc: 'View real-time printer status, verified page count, and queue timestamps until your prints are ready.'
                    }
                  ].map((step, i) => (
                    <div key={i} className="flex gap-3.5 p-3.5 rounded-2xl bg-white border border-[#E1E7E1] shadow-2xs">
                      <div className="w-10 h-10 rounded-xl bg-[#E8F8EC] flex items-center justify-center shrink-0 border border-[#A7F3D0]">
                        <step.icon className="w-5 h-5 text-[#00B32D]" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-semibold text-[#111111]">{i + 1}. {step.title}</h4>
                        <p className="text-xs text-[#646B65] mt-0.5 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#E1E7E1]">
                  <button
                    type="button"
                    onClick={() => {
                      setHelpOpen(false);
                      navigate(`/s/${uploadPageSlug}`);
                    }}
                    className="w-full h-10 bg-[#00A61C] hover:bg-[#008F25] text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Upload New Documents</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
