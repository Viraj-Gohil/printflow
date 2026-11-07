import React, { useState } from 'react';
import { AgentConfig, AgentConnectionStatus, DiscoveredPrinter, PrintJobItem, QueueMetrics, PlanEntitlements } from '../types/agent';
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
  XCircle,
  Zap,
  Lock,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import packageMetadata from '../../../package.json';

interface DashboardProps {
  status: AgentConnectionStatus;
  lastHeartbeat: string | null;
  config: AgentConfig;
  metrics: QueueMetrics;
  printers: DiscoveredPrinter[];
  jobs: PrintJobItem[];
  entitlements?: PlanEntitlements | null;
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
  entitlements,
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
  // Exclude virtual / non-physical printers from ready count
  const physicalPrinters = printers.filter((p) => {
    const name = (p.name || p.displayName || '').toLowerCase();
    return !name.includes('pdf') && !name.includes('xps') && !name.includes('onenote') && !name.includes('fax');
  });
  const readyPrintersCount = physicalPrinters.filter((p) => p.isOnline).length;
  const isOnline = status === 'ONLINE' || status === 'CONNECTED';

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* SECTION A: PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E1E7E1] dark:border-slate-800">
        <div>
          <h1 className="text-[24px] font-bold text-[#111111] dark:text-white tracking-tight leading-tight">
            Dashboard
          </h1>
          <p className="text-[14px] text-[#646B65] dark:text-slate-400 mt-1">
            Real-time station status, printer connections, and automated spooling queue.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
            isOnline
              ? 'bg-[#E8F8EC] text-[#008F25] border-[#BCEAC4] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-[#F0F4F1] text-[#646B65] border-[#E1E7E1] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#00B32D]' : 'bg-[#64748B]'}`} />
            {isOnline ? 'Agent Connected' : 'Agent Offline'}
          </span>

          <button
            type="button"
            onClick={onPollNow}
            title="Poll cloud queue immediately"
            className="secondary-button !min-h-[34px] !py-1.5 !px-3 !text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#00B32D]" />
            <span className="hidden sm:inline">Sync Queue</span>
          </button>
        </div>
      </div>

      {/* SECTION B: AGENT OVERVIEW CARD */}
      <div className="pf-card p-5 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] shadow-card rounded-[10px]">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-11 h-11 rounded-lg bg-[#E8F8EC] dark:bg-emerald-950/60 border border-[#BCEAC4] dark:border-emerald-800 text-[#00B32D] dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <Store className="w-5 h-5 stroke-[2]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-[16px] font-bold text-[#111111] dark:text-white tracking-tight">
                  {config.shopDetails?.shopName || config.shopSlug || 'PrintFlow Print Shop'}
                </h2>

                {config.shopDetails?.planName && (
                  <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    {config.shopDetails.planName} Plan
                  </span>
                )}
              </div>

              {/* Metadata row */}
              <div className="flex items-center gap-3.5 text-[12px] text-[#646B65] dark:text-slate-400 mt-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 font-mono">
                  <span>Shop ID: {config.shopDetails?.shopId || config.shopId || 'Unlinked'}</span>
                  <button
                    type="button"
                    onClick={handleCopyShopId}
                    title="Copy Shop ID"
                    className="p-1 rounded hover:bg-[#E8F8EC] text-[#00B32D] transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedShopId ? (
                      <Check className="w-3.5 h-3.5 text-[#00B32D]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <span className="text-[#E1E7E1] dark:text-slate-700">•</span>
                <div className="flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-[#848D86]" />
                  <span>Device: <strong className="font-semibold text-[#111111] dark:text-slate-200">{config.deviceName || 'Local PC'}</strong></span>
                </div>
                <span className="text-[#E1E7E1] dark:text-slate-700">•</span>
                <span>Agent <strong className="font-semibold text-[#111111] dark:text-slate-200">v{packageMetadata.version}</strong></span>
                {lastHeartbeat && (
                  <>
                    <span className="text-[#E1E7E1] dark:text-slate-700">•</span>
                    <span>Last Heartbeat: <strong className="font-semibold text-[#111111] dark:text-slate-200">{new Date(lastHeartbeat).toLocaleTimeString()}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
            <div className="text-right hidden sm:block">
              <span className="text-[12px] text-[#646B65] dark:text-slate-400 block font-medium">Physical Printers</span>
              <span className="text-[13px] font-bold text-[#111111] dark:text-white">
                {readyPrintersCount} Ready / {physicalPrinters.length} Total
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('PRINTERS')}
              className="secondary-button !text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5 text-[#00B32D]" />
              <span>Manage Printers ({printers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* RESTRICTION OR ATTENTION WARNING */}
      {((config.shopDetails && !config.shopDetails.isOperational) || status === 'RESTRICTED' || status === 'UNAUTHORIZED') && (
        <div className="p-4 rounded-[10px] bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#E6A000] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-sm text-[#78350F] dark:text-amber-100">Shop Account Requires Attention</p>
            <p className="leading-relaxed text-[13px]">
              {config.shopDetails?.restrictionReason ||
                'Your shop subscription or printer limits need attention before processing further print jobs.'}
            </p>
          </div>
        </div>
      )}

      {/* SECTION C: 5 OPERATIONAL METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Ready Printers */}
        <div className="pf-card pf-card-hover p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400">
              Ready Printers
            </span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] dark:bg-emerald-950/50 text-[#00B32D] flex items-center justify-center">
              <Printer className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <p className="text-[28px] lg:text-[32px] font-bold text-[#111111] dark:text-white mt-2 font-mono tracking-tight leading-none">
            {readyPrintersCount}
          </p>
          <p className="text-[12px] text-[#646B65] dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${readyPrintersCount > 0 ? 'bg-[#00B32D]' : 'bg-[#DC2626]'}`} />
            <span>{readyPrintersCount > 0 ? `${readyPrintersCount} active device(s)` : 'No printer online'}</span>
          </p>
        </div>

        {/* Metric 2: Active Jobs */}
        <div className="pf-card pf-card-hover p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400">
              Active Jobs
            </span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] dark:bg-emerald-950/50 text-[#00B32D] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <p className="text-[28px] lg:text-[32px] font-bold text-[#111111] dark:text-white mt-2 font-mono tracking-tight leading-none">
            {metrics.printingJobs}
          </p>
          <p className="text-[12px] text-[#646B65] dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${metrics.printingJobs > 0 ? 'bg-[#00B32D] animate-pulse' : 'bg-[#848D86]'}`} />
            <span>{metrics.printingJobs > 0 ? 'Spooling to driver' : 'Spooler idle'}</span>
          </p>
        </div>

        {/* Metric 3: Pending Jobs */}
        <div className="pf-card pf-card-hover p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400">
              Pending Jobs
            </span>
            <div className="w-7 h-7 rounded-md bg-[#FFFBEB] dark:bg-amber-950/50 text-[#E6A000] flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <p className="text-[28px] lg:text-[32px] font-bold text-[#111111] dark:text-white mt-2 font-mono tracking-tight leading-none">
            {metrics.queuedJobs}
          </p>
          <p className="text-[12px] text-[#646B65] dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${metrics.queuedJobs > 0 ? 'bg-[#E6A000]' : 'bg-[#848D86]'}`} />
            <span>Awaiting spooling</span>
          </p>
        </div>

        {/* Metric 4: Completed Today */}
        <div className="pf-card pf-card-hover p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400">
              Completed Today
            </span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] dark:bg-emerald-950/50 text-[#00B32D] flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <p className="text-[28px] lg:text-[32px] font-bold text-[#111111] dark:text-white mt-2 font-mono tracking-tight leading-none">
            {metrics.completedJobs}
          </p>
          <p className="text-[12px] text-[#646B65] dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00B32D]" />
            <span>Printed successfully</span>
          </p>
        </div>

        {/* Metric 5: Failed Jobs */}
        <div className="pf-card pf-card-hover p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400">
              Failed Jobs
            </span>
            <div className="w-7 h-7 rounded-md bg-[#FEF2F2] dark:bg-red-950/50 text-[#DC2626] flex items-center justify-center">
              <XCircle className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <p className="text-[28px] lg:text-[32px] font-bold text-[#111111] dark:text-white mt-2 font-mono tracking-tight leading-none">
            {metrics.failedJobs + (metrics.manualAttentionJobs || 0)}
          </p>
          <p className="text-[12px] text-[#646B65] dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${metrics.failedJobs + (metrics.manualAttentionJobs || 0) > 0 ? 'bg-[#DC2626]' : 'bg-[#848D86]'}`} />
            <span>{metrics.manualAttentionJobs ? `${metrics.manualAttentionJobs} review required` : 'Zero errors'}</span>
          </p>
        </div>
      </div>
      {/* SECTION E: ACTIVE SPOOLING SPOTLIGHT */}
      {activeJob && (
        <div className="pf-card p-5 border-l-4 border-l-[#00B32D] border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center">
                <Printer className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-[#111111] dark:text-white">Currently Processing Print Job</h3>
                <p className="text-[13px] text-[#646B65] dark:text-slate-400">Streaming document payload to Windows Print Spooler</p>
              </div>
            </div>
            <JobStatusBadge status={activeJob.printStatus} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-[#F0F4F1] dark:bg-slate-900 border border-[#E1E7E1] dark:border-slate-800 text-xs">
            <div>
              <span className="text-[#646B65] dark:text-slate-400 text-[11px] block font-medium">Order ID</span>
              <p className="font-mono font-bold text-[#111111] dark:text-slate-200 mt-0.5 truncate">{activeJob.id}</p>
            </div>
            <div>
              <span className="text-[#646B65] dark:text-slate-400 text-[11px] block font-medium">Target Printer</span>
              <p className="font-semibold text-[#111111] dark:text-slate-200 mt-0.5 truncate">{activeJob.printerName || 'Default Windows Printer'}</p>
            </div>
            <div>
              <span className="text-[#646B65] dark:text-slate-400 text-[11px] block font-medium">Document</span>
              <p className="font-semibold text-[#00B32D] dark:text-emerald-400 mt-0.5 truncate flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{activeJob.files[0]?.fileName || 'Document.pdf'}</span>
              </p>
            </div>
          </div>

          {activeProgress !== undefined && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-[#646B65] dark:text-slate-400 font-medium">
                <span>
                  {activeJob.printStatus === 'DOWNLOADING' ? 'Downloading document payload...' : 'Spooling raster pages...'}
                </span>
                <span className="font-mono font-bold text-[#00B32D]">{activeProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#E1E7E1] dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-[#00B32D] transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, activeProgress))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION F: SUBSCRIPTION ENTITLEMENT & QUOTA MONITOR */}
      {(() => {
        const ent = entitlements || config.entitlements || config.shopDetails?.entitlements;
        const planName = ent?.planName || config.shopDetails?.planName || 'Starter';
        const planKey = (ent?.plan || 'starter').toLowerCase();
        const subStatus = (ent?.status || config.shopDetails?.subscriptionStatus || 'active').toLowerCase();
        const isTrial = subStatus === 'trial' || subStatus === 'trialing';

        const jobUsage = ent?.usage?.monthlyPrintJobs ?? metrics.totalJobs ?? 0;
        const jobLimit = ent?.limits?.monthlyPrintJobs ?? (planKey === 'business' ? 5000 : planKey === 'growth' ? 2000 : 500);
        const jobPercent = jobLimit > 0 ? Math.min(100, Math.round((jobUsage / jobLimit) * 100)) : 0;

        const regCount = (config.registeredPrinterNames || []).length;
        const printerLimit = ent?.limits?.printers ?? config.printerLimit ?? (planKey === 'business' ? 10 : planKey === 'growth' ? 5 : 1);

        const canMultipleQueues = ent?.features?.canMultipleQueues ?? (planKey !== 'starter');
        const canSmartRouting = ent?.features?.canSmartPrinterSelection ?? (planKey !== 'starter');
        const canLoadBalancing = ent?.features?.canLoadBalancing ?? (planKey === 'business');
        const canQueueOptimization = ent?.features?.canQueueOptimization ?? (planKey === 'business');

        return (
          <div className="pf-card p-5 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] shadow-card rounded-[10px] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E8F8EC] dark:bg-emerald-950/60 text-[#00B32D] dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-bold text-[#111111] dark:text-white">
                      Subscription Entitlements
                    </span>
                    <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                      {planName} Plan {isTrial ? '(7-Day Trial)' : ''}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#646B65] dark:text-slate-400 mt-0.5">
                    Plan-enforced agent capabilities and monthly print volume quota.
                  </p>
                </div>
              </div>

              {planKey !== 'business' && (
                <button
                  type="button"
                  onClick={() => {
                    const server = (config.serverUrl || 'https://printflow.devpixel.space').replace(/\/+$/, '');
                    const portalUrl = `${server}/shop/subscription`;
                    if (window.electronAgentAPI?.openExternal) {
                      window.electronAgentAPI.openExternal(portalUrl);
                    } else {
                      window.open(portalUrl, '_blank');
                    }
                  }}
                  className="primary-button !min-h-[34px] !text-xs font-semibold shrink-0 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Upgrade Plan</span>
                </button>
              )}
            </div>

            {/* Quota Usage Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Monthly Print Job Meter */}
              <div className="p-3.5 rounded-lg bg-[#F0F4F1] dark:bg-slate-900 border border-[#E1E7E1] dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#111111] dark:text-slate-200">Monthly Print Job Quota</span>
                  <span className="font-mono font-bold text-[#111111] dark:text-white">
                    {jobUsage} / {jobLimit} ({jobPercent}%)
                  </span>
                </div>
                <div className="w-full bg-[#E1E7E1] dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      jobPercent >= 100
                        ? 'bg-[#DC2626]'
                        : jobPercent >= 90
                        ? 'bg-[#E6A000]'
                        : 'bg-[#00B32D]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, jobPercent))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[12px] text-[#646B65] dark:text-slate-400">
                  <span>{Math.max(0, jobLimit - jobUsage)} jobs remaining this cycle</span>
                  {jobPercent >= 90 && (
                    <span className="text-[#E6A000] font-bold">Quota Warning</span>
                  )}
                </div>
              </div>

              {/* Printer Connections Meter */}
              <div className="p-3.5 rounded-lg bg-[#F0F4F1] dark:bg-slate-900 border border-[#E1E7E1] dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#111111] dark:text-slate-200">Registered Printer Connections</span>
                  <span className="font-mono font-bold text-[#111111] dark:text-white">
                    {regCount} / {printerLimit} Allowed
                  </span>
                </div>
                <div className="w-full bg-[#E1E7E1] dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#00B32D] transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round((regCount / (printerLimit || 1)) * 100))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[12px] text-[#646B65] dark:text-slate-400">
                  <span>{printerLimit - regCount} printer slot(s) free</span>
                  {regCount >= printerLimit && (
                    <span className="text-[#00B32D] font-bold">Max Limit Reached</span>
                  )}
                </div>
              </div>
            </div>

            {/* Feature Matrix Badges */}
            <div className="pt-2 border-t border-[#E1E7E1] dark:border-slate-800 flex flex-wrap gap-2 text-[12px]">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00B32D]" />
                Automatic Printing
              </span>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                canMultipleQueues
                  ? 'bg-[#E8F8EC] text-[#008F25] border-[#BCEAC4]'
                  : 'bg-[#F0F4F1] text-[#646B65] border-[#E1E7E1]'
              }`}>
                {canMultipleQueues ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00B32D]" /> : <Lock className="w-3 h-3 text-[#848D86]" />}
                Multi-Printer Queues {canMultipleQueues ? `(up to ${printerLimit})` : '(Growth/Business)'}
              </span>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                canSmartRouting
                  ? 'bg-[#E8F8EC] text-[#008F25] border-[#BCEAC4]'
                  : 'bg-[#F0F4F1] text-[#646B65] border-[#E1E7E1]'
              }`}>
                {canSmartRouting ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00B32D]" /> : <Lock className="w-3 h-3 text-[#848D86]" />}
                Smart Capability Routing {canSmartRouting ? 'Active' : '(Growth/Business)'}
              </span>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium ${
                canLoadBalancing
                  ? 'bg-[#E8F8EC] text-[#008F25] border-[#BCEAC4]'
                  : 'bg-[#F0F4F1] text-[#646B65] border-[#E1E7E1]'
              }`}>
                {canLoadBalancing ? <Zap className="w-3.5 h-3.5 text-[#00B32D]" /> : <Lock className="w-3 h-3 text-[#848D86]" />}
                Dynamic Load Balancing {canLoadBalancing ? 'Active' : '(Business Only)'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* SECTION G & H: TWO-COLUMN LAYOUT FOR RECENT JOBS AND PRINTER OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Print Queue Overview / Recent Activity */}
        <div className="lg:col-span-2 pf-card p-5 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E1E7E1] dark:border-slate-800">
            <div>
              <h3 className="text-[16px] font-bold text-[#111111] dark:text-white">Recent Activity</h3>
              <p className="text-[13px] text-[#646B65] dark:text-slate-400 mt-0.5">Automated print queue processed by this station</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('QUEUE')}
              className="text-xs font-semibold text-[#00B32D] hover:text-[#008F25] flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Queue ({jobs.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentJobs.length === 0 ? (
            <div className="py-12 text-center space-y-3 rounded-lg border border-dashed border-[#E1E7E1] dark:border-slate-800 bg-[#F0F4F1] dark:bg-slate-900">
              <Printer className="w-8 h-8 text-[#848D86] mx-auto" />
              <div>
                <p className="text-sm font-semibold text-[#111111] dark:text-white">Print queue is clear</p>
                <p className="text-xs text-[#646B65] dark:text-slate-400 mt-0.5">No pending or recent print jobs in local buffer.</p>
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
            <div className="divide-y divide-[#E1E7E1] dark:divide-slate-800">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-[#F0F4F1] dark:hover:bg-slate-800/50 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#111111] dark:text-white">{job.id}</span>
                      {job.printerName && (
                        <span className="text-[11px] text-[#646B65] dark:text-slate-400 px-1.5 py-0.2 rounded bg-[#F0F4F1] dark:bg-slate-800 border border-[#E1E7E1] dark:border-slate-700 truncate">
                          {job.printerName}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#646B65] dark:text-slate-300 truncate mt-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#848D86] shrink-0" />
                      <span className="font-medium truncate">{job.files[0]?.fileName || 'Document.pdf'}</span>
                      <span className="text-[#848D86]">
                        · {job.files[0]?.paperSize || 'A4'} · {job.files[0]?.colorMode || 'BW'} · {job.files[0]?.copies || 1} copy
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[12px] text-[#848D86]">
                      <span>{new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                    {job.errorMessage && (
                      <p className="mt-1 text-[12px] text-[#DC2626] dark:text-red-400 font-medium truncate" title={formatPrintError(job.errorMessage)}>
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

        {/* Right 1 Col: Printer Overview & System Security */}
        <div className="space-y-5">
          {/* Printer Overview Card */}
          <div className="pf-card p-5 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#E1E7E1] dark:border-slate-800">
              <div>
                <h3 className="text-[16px] font-bold text-[#111111] dark:text-white">Printer Overview</h3>
                <p className="text-[13px] text-[#646B65] dark:text-slate-400">{readyPrintersCount} physical ready device(s)</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('PRINTERS')}
                className="text-xs font-semibold text-[#00B32D] hover:text-[#008F25] cursor-pointer"
              >
                Manage →
              </button>
            </div>

            <div className="space-y-2">
              {physicalPrinters.slice(0, 4).map((p) => (
                <div
                  key={p.name}
                  className="p-3 rounded-lg border border-[#E1E7E1] dark:border-slate-800 bg-[#F0F4F1] dark:bg-slate-900 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-[#111111] dark:text-white truncate">{p.displayName}</p>
                    <span className="text-[12px] text-[#646B65] dark:text-slate-400">
                      {p.capabilities.supportsColor ? 'Color' : 'Monochrome'} · {p.capabilities.supportsDuplex ? 'Duplex' : 'Simplex'}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                      p.isOnline
                        ? 'bg-[#E8F8EC] text-[#008F25] border-[#BCEAC4] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                    }`}
                  >
                    {p.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))}

              {physicalPrinters.length === 0 && (
                <div className="p-4 rounded-lg border border-dashed border-[#E1E7E1] dark:border-slate-800 text-center text-xs text-[#646B65] dark:text-slate-400">
                  No physical Windows printers detected. Scan in Printers tab.
                </div>
              )}
            </div>
          </div>

          {/* Security & Device Binding Card */}
          <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-[#00B32D] dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 stroke-[2]" />
              <span>Single-Device Protection Active</span>
            </div>
            <p className="text-[13px] text-[#646B65] dark:text-slate-400 leading-relaxed">
              Bound securely to <strong className="text-[#111111] dark:text-slate-200">{config.deviceName || 'this PC'}</strong>. Station credentials are encrypted with Windows DPAPI safeStorage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
