import React, { useState } from 'react';
import { AgentConfig, AgentConnectionStatus, DiscoveredPrinter, PrintJobItem, QueueMetrics } from '../types/agent';
import { formatPrintError } from '../utils/printError';
import { JobStatusBadge } from './StatusBadge';
import {
  Printer,
  Clock,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  FileText,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Laptop,
  Store,
  Layers,
  XCircle
} from 'lucide-react';
import packageMetadata from '../../../package.json';

interface DashboardProps {
  status: AgentConnectionStatus;
  lastHeartbeat: string | null;
  config: AgentConfig;
  metrics: QueueMetrics;
  printers: DiscoveredPrinter[];
  jobs: PrintJobItem[];
  onNavigateTab: (tab: 'QUEUE' | 'PRINTERS' | 'LOGS') => void;
  onPollNow: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  status,
  lastHeartbeat,
  config,
  metrics,
  printers,
  jobs,
  onNavigateTab,
  onPollNow
}) => {
  const [copiedShopId, setCopiedShopId] = useState(false);

  const handleCopyShopId = async () => {
    const idToCopy = config.shopDetails?.shopId || config.shopId;
    if (!idToCopy) return;
    if (window.electronAgentAPI?.copyText) {
      await window.electronAgentAPI.copyText(idToCopy);
    } else {
      await navigator.clipboard.writeText(idToCopy);
    }
    setCopiedShopId(true);
    setTimeout(() => setCopiedShopId(false), 2000);
  };

  const activeJob = jobs.find((j) => j.printStatus === 'PRINTING' || j.printStatus === 'DOWNLOADING');
  const activeProgress = activeJob
    ? activeJob.printStatus === 'DOWNLOADING'
      ? activeJob.downloadProgress
      : activeJob.printProgress
    : undefined;

  const recentJobs = jobs.slice(0, 6);
  const onlinePrintersCount = printers.filter((p) => p.isOnline).length;
  const isOnline = status === 'ONLINE' || status === 'CONNECTED';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. SHOP IDENTITY & OVERVIEW CARD */}
      <div className="pf-card p-6 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] shadow-card rounded-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Shop & Agent Information */}
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/60 border border-[#BFDBFE] dark:border-blue-800 text-[#2563EB] dark:text-blue-400 flex items-center justify-center font-bold text-xl shrink-0">
              <Store className="w-6 h-6 stroke-[2]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-[#0F172A] dark:text-white tracking-tight">
                  {config.shopDetails?.shopName || config.shopSlug || 'PrintFlow Print Shop'}
                </h2>
                {config.shopDetails?.planName && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                    {config.shopDetails.planName} Plan
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    isOnline
                      ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#10B981]' : 'bg-[#94A3B8]'}`} />
                  {isOnline ? 'Agent Online' : 'Agent Offline'}
                </span>
              </div>

              {/* Metadata row with Shop ID, Hostname, and Heartbeat */}
              <div className="flex items-center gap-4 text-xs text-[#64748B] dark:text-slate-400 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5 font-mono">
                  <span>Shop ID: {config.shopDetails?.shopId || config.shopId || 'Unlinked'}</span>
                  <button
                    type="button"
                    onClick={handleCopyShopId}
                    title="Copy Shop ID"
                    className="p-1 rounded hover:bg-[#F1F5F9] dark:hover:bg-slate-800 text-[#2563EB] dark:text-blue-400 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedShopId ? (
                      <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <span className="text-[#CBD5E1] dark:text-slate-700">•</span>
                <div className="flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span>Device: <strong className="font-semibold text-[#0F172A] dark:text-slate-200">{config.deviceName || 'Local PC'}</strong></span>
                </div>
                <span className="text-[#CBD5E1] dark:text-slate-700">•</span>
                <span>Agent <strong className="font-semibold text-[#0F172A] dark:text-slate-200">v{packageMetadata.version}</strong></span>
                {lastHeartbeat && (
                  <>
                    <span className="text-[#CBD5E1] dark:text-slate-700">•</span>
                    <span>Last heartbeat: <strong className="font-semibold text-[#0F172A] dark:text-slate-200">{new Date(lastHeartbeat).toLocaleTimeString()}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Hardware Summary / Manage Button */}
          <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-[#64748B] dark:text-slate-400 block font-medium">Windows Printers</span>
              <span className="text-xs font-bold text-[#0F172A] dark:text-white">
                {onlinePrintersCount} Online / {printers.length} Total
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('PRINTERS')}
              className="secondary-button !text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Printers ({printers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* RESTRICTION OR ATTENTION WARNING */}
      {((config.shopDetails && !config.shopDetails.isOperational) || status === 'RESTRICTED' || status === 'UNAUTHORIZED') && (
        <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-sm text-[#78350F] dark:text-amber-100">Shop Account Requires Attention</p>
            <p className="leading-relaxed">
              {config.shopDetails?.restrictionReason ||
                'Your shop subscription or printer limits need attention before processing further print jobs.'}
            </p>
          </div>
        </div>
      )}

      {/* 2. FOUR KEY METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Pending (Queued) Jobs */}
        <div className="pf-card pf-card-hover p-5 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
              Pending Jobs
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] dark:bg-amber-950/50 text-[#F59E0B] flex items-center justify-center">
              <Clock className="w-4 h-4 stroke-[2]" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#0F172A] dark:text-white mt-3 font-mono tracking-tight">
            {metrics.queuedJobs}
          </p>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${metrics.queuedJobs > 0 ? 'bg-[#F59E0B]' : 'bg-[#CBD5E1]'}`} />
            <span>Awaiting spooling</span>
          </p>
        </div>

        {/* Metric 2: Currently Printing */}
        <div className="pf-card pf-card-hover p-5 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
              Printing Now
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/50 text-[#2563EB] flex items-center justify-center">
              <Printer className="w-4 h-4 stroke-[2]" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#0F172A] dark:text-white mt-3 font-mono tracking-tight">
            {metrics.printingJobs}
          </p>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${metrics.printingJobs > 0 ? 'bg-[#2563EB] animate-pulse' : 'bg-[#CBD5E1]'}`} />
            <span>{metrics.printingJobs > 0 ? 'Active in spooler' : 'Spooler idle'}</span>
          </p>
        </div>

        {/* Metric 3: Completed Orders */}
        <div className="pf-card pf-card-hover p-5 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] dark:bg-emerald-950/50 text-[#10B981] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 stroke-[2]" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#0F172A] dark:text-white mt-3 font-mono tracking-tight">
            {metrics.completedJobs}
          </p>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span>Successfully printed</span>
          </p>
        </div>

        {/* Metric 4: Failed / Attention */}
        <div className="pf-card pf-card-hover p-5 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
              Failed / Attention
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] dark:bg-red-950/50 text-[#EF4444] flex items-center justify-center">
              <XCircle className="w-4 h-4 stroke-[2]" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[#0F172A] dark:text-white mt-3 font-mono tracking-tight">
            {metrics.failedJobs + (metrics.manualAttentionJobs || 0)}
          </p>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${metrics.failedJobs + (metrics.manualAttentionJobs || 0) > 0 ? 'bg-[#EF4444]' : 'bg-[#CBD5E1]'}`} />
            <span>{metrics.manualAttentionJobs ? `${metrics.manualAttentionJobs} need review` : 'Zero errors'}</span>
          </p>
        </div>
      </div>

      {/* 3. ACTIVE SPOOLING SPOTLIGHT (IF IN PROGRESS) */}
      {activeJob && (
        <div className="pf-card p-5 border-l-4 border-l-[#2563EB] border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
                <Printer className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">Currently Processing Print Job</h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">Streaming document payload to Windows Print Spooler</p>
              </div>
            </div>
            <JobStatusBadge status={activeJob.printStatus} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 text-xs">
            <div>
              <span className="text-[#64748B] dark:text-slate-400 text-[11px] block font-medium">Order ID</span>
              <p className="font-mono font-bold text-[#0F172A] dark:text-slate-200 mt-0.5 truncate">{activeJob.id}</p>
            </div>
            <div>
              <span className="text-[#64748B] dark:text-slate-400 text-[11px] block font-medium">Target Printer</span>
              <p className="font-semibold text-[#0F172A] dark:text-slate-200 mt-0.5 truncate">{activeJob.printerName || 'Default Windows Printer'}</p>
            </div>
            <div>
              <span className="text-[#64748B] dark:text-slate-400 text-[11px] block font-medium">Document</span>
              <p className="font-semibold text-[#2563EB] dark:text-blue-400 mt-0.5 truncate flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{activeJob.files[0]?.fileName || 'Document.pdf'}</span>
              </p>
            </div>
          </div>

          {activeProgress !== undefined && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-[#64748B] dark:text-slate-400 font-medium">
                <span>
                  {activeJob.printStatus === 'DOWNLOADING' ? 'Downloading document payload...' : 'Spooling raster pages...'}
                </span>
                <span className="font-mono font-bold text-[#2563EB]">{activeProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-[#2563EB] transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, activeProgress))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. TWO-COLUMN LAYOUT: RECENT JOBS & HARDWARE STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Recent Activity / Queue */}
        <div className="lg:col-span-2 pf-card p-6 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">Recent Activity</h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">Automated print queue processed by this station</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('QUEUE')}
              className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] dark:text-blue-400 flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Queue ({jobs.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentJobs.length === 0 ? (
            <div className="py-12 text-center space-y-3 rounded-xl border border-dashed border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900">
              <Printer className="w-8 h-8 text-[#94A3B8] mx-auto" />
              <div>
                <p className="text-sm font-semibold text-[#0F172A] dark:text-white">Print queue is clear</p>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">No pending or recent print jobs in local buffer.</p>
              </div>
              <button
                type="button"
                onClick={onPollNow}
                className="primary-button text-xs font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Cloud for Orders</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-[#F8FAFC] dark:hover:bg-slate-800/50 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#0F172A] dark:text-white">{job.id}</span>
                      {job.printerName && (
                        <span className="text-[10.5px] text-[#64748B] dark:text-slate-400 px-1.5 py-0.2 rounded bg-[#F1F5F9] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 truncate">
                          {job.printerName}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#475569] dark:text-slate-300 truncate mt-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                      <span className="font-medium truncate">{job.files[0]?.fileName || 'Document.pdf'}</span>
                      <span className="text-[#94A3B8]">
                        · {job.files[0]?.paperSize || 'A4'} · {job.files[0]?.colorMode || 'BW'} · {job.files[0]?.copies || 1} copy
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#94A3B8]">
                      <span>{new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                    {job.errorMessage && (
                      <p className="mt-1 text-[11px] text-[#DC2626] dark:text-red-400 font-medium truncate" title={formatPrintError(job.errorMessage)}>
                        {formatPrintError(job.errorMessage)}
                      </p>
                    )}
                  </div>
                  <JobStatusBadge status={job.printStatus} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right (1 col): Hardware & Station Security */}
        <div className="space-y-5">
          {/* Windows Printers Card */}
          <div className="pf-card p-5 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">Connected Printers</h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">{onlinePrintersCount} ready Windows devices</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('PRINTERS')}
                className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] dark:text-blue-400 cursor-pointer"
              >
                Manage →
              </button>
            </div>

            <div className="space-y-2">
              {printers.slice(0, 4).map((p) => (
                <div
                  key={p.name}
                  className="p-3 rounded-xl border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-[#0F172A] dark:text-white truncate">{p.displayName}</p>
                    <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                      {p.capabilities.supportsColor ? 'Color' : 'Monochrome'} · {p.capabilities.supportsDuplex ? 'Duplex' : 'Simplex'}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      p.isOnline
                        ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}

              {printers.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-[#E2E8F0] dark:border-slate-800 text-center text-xs text-[#64748B] dark:text-slate-400">
                  No Windows printers detected. Rescan in Printers tab.
                </div>
              )}
            </div>
          </div>

          {/* Single Active Device Policy Card */}
          <div className="pf-card p-5 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-xs text-[#2563EB] dark:text-blue-400">
              <ShieldCheck className="w-4 h-4 stroke-[2]" />
              <span>Single-Device Protection Active</span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
              This shop is bound to <strong className="text-[#0F172A] dark:text-slate-200">{config.deviceName || 'this PC'}</strong>. Only one active print station is permitted per shop. Credentials are safeStorage encrypted.
            </p>
          </div>

          {/* Attention Required Banner */}
          {(metrics.manualAttentionJobs || 0) > 0 && (
            <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#78350F] dark:text-amber-100">Manual Review Required</p>
                <p className="text-[11.5px] mt-0.5 leading-relaxed">
                  {metrics.manualAttentionJobs} {metrics.manualAttentionJobs === 1 ? 'job was interrupted' : 'jobs were interrupted'} during session handover. Verify physical print tray before resuming.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
