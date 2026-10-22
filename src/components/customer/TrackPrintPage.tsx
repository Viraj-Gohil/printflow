import React, { useState } from 'react';
import { Search, CheckCircle2, Clock, Printer, Package, AlertCircle, Copy, Check, ArrowRight, ShieldCheck, Store, ArrowLeft } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Button */}
        <div>
          <button
            type="button"
            onClick={() => navigate(`/s/${activeShop.slug || 'viraj-xerox'}`)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to File Upload</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold shadow-2xs">
            <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>{trackingResult?.shopName || activeShop?.name || 'PrintFlow Print Centre'}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Track Your Print Order</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Enter your secure tracking token issued at checkout to monitor real-time print dispatch and queue status.
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 max-w-xl mx-auto">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter tracking token (e.g. tr_...)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !tokenInput.trim()}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {isLoading ? 'Searching...' : 'Track'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {errorMsg && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Tracking Lookup Failed</p>
                <p className="text-[11px] text-red-600 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tracking Result */}
        {trackingResult && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-6 p-5 sm:p-8 animate-in fade-in duration-300 max-w-xl mx-auto w-full">
            {/* Shop Badge right under header */}
            <div className="flex items-center justify-center pb-2 border-b border-slate-100">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold shadow-2xs">
                <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{trackingResult.shopName}</span>
              </span>
            </div>

            {/* Order Meta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider">Order Code</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h2 className="text-xl font-mono font-bold text-slate-900">{trackingResult.orderCode}</h2>
                  <button
                    onClick={() => handleCopy(trackingResult.orderCode)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Copy Code"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  trackingResult.printStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  trackingResult.printStatus === 'PRINTING' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {trackingResult.printStatus}
                </span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Print Shop</p>
                <p className="text-sm font-semibold text-slate-900 mt-1 truncate">{trackingResult.shopName}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Verified Pages</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{trackingResult.verifiedPageCount} Pages</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Documents</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{trackingResult.fileCount} File(s)</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payment</p>
                <p className="text-sm font-semibold text-emerald-600 mt-1">{trackingResult.paymentStatus}</p>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="space-y-4 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Status Timeline</h3>
              <div className="space-y-3 relative before:absolute before:top-3 before:bottom-3 before:left-4 before:w-0.5 before:bg-slate-200">
                {trackingResult.timeline.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3.5 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 font-bold text-xs ${
                      step.completed ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {step.completed ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className={`text-sm font-bold ${step.completed ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(step.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
