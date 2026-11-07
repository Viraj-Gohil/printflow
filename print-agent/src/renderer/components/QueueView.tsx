import React, { useEffect, useMemo, useState } from 'react';
import { DiscoveredPrinter, PrintJobItem, PrinterQueueState, PlanEntitlements, AgentConfig } from '../types/agent';
import { JobStatusBadge } from './StatusBadge';
import {
  AlertTriangle,
  FileText,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
  Eye,
  RotateCcw,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
  Pause,
  Play,
  Layers,
  LayoutGrid,
  ListFilter,
  Ban,
  Activity,
  Lock,
  Zap,
  ArrowUpRight
} from 'lucide-react';

interface QueueViewProps {
  jobs: PrintJobItem[];
  printers: DiscoveredPrinter[];
  entitlements?: PlanEntitlements | null;
  config?: AgentConfig;
  onReprintJob: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
  onClearCompleted: () => void;
  onPollNow: () => void;
}

type QueueFilter = 'ALL' | 'QUEUED' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'MANUAL_ATTENTION';
type ViewMode = 'MULTI_PRINTER' | 'ALL_JOBS';

export const QueueView: React.FC<QueueViewProps> = ({
  jobs,
  printers,
  entitlements,
  config,
  onReprintJob,
  onCancelJob,
  onClearCompleted,
  onPollNow
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('MULTI_PRINTER');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [printerFilter, setPrinterFilter] = useState('');
  const [selectedJob, setSelectedJob] = useState<PrintJobItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);

  // Multi-Printer Queue States from Electron Main Process
  const [printerQueues, setPrinterQueues] = useState<PrinterQueueState[]>([]);

  const fetchPrinterQueues = async () => {
    if (window.electronAgentAPI?.getPrinterQueues) {
      try {
        const queues = await window.electronAgentAPI.getPrinterQueues();
        setPrinterQueues(queues || []);
      } catch (err) {
        console.error('Failed fetching printer queues:', err);
      }
    }
  };

  useEffect(() => {
    void fetchPrinterQueues();

    if (window.electronAgentAPI?.onQueueStateChanged) {
      const unsubscribe = window.electronAgentAPI.onQueueStateChanged((queues) => {
        setPrinterQueues(queues || []);
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedJob) {
        setSelectedJob(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedJob]);

  // Exclude virtual printers (PDF, XPS, Fax, OneNote) from physical customer queues
  const physicalPrinters = useMemo(() => {
    return printers.filter((p) => {
      const name = (p.name || p.displayName || '').toLowerCase();
      return !name.includes('pdf') && !name.includes('xps') && !name.includes('onenote') && !name.includes('fax');
    });
  }, [printers]);

  const counts = useMemo(() => {
    const queued = jobs.filter((j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED').length;
    const printing = jobs.filter((j) => j.printStatus === 'PRINTING' || j.printStatus === 'DOWNLOADING' || j.printStatus === 'SUBMITTED_TO_SPOOLER').length;
    const completed = jobs.filter((j) => j.printStatus === 'COMPLETED').length;
    const failed = jobs.filter((j) => j.printStatus === 'FAILED' || j.printStatus === 'CANCELLED').length;
    const manual = jobs.filter((j) => j.printStatus === 'MANUAL_ATTENTION' || (j as any).printStatus === 'REQUIRES_ATTENTION' || j.printStatus === 'AWAITING_RECONCILIATION').length;
    
    const totalPrinters = physicalPrinters.length;
    const onlinePrinters = physicalPrinters.filter(p => p.isOnline).length;
    const offlinePrinters = totalPrinters - onlinePrinters;

    return {
      ALL: jobs.length,
      QUEUED: queued,
      PRINTING: printing,
      COMPLETED: completed,
      FAILED: failed,
      MANUAL_ATTENTION: manual,
      totalPrinters,
      onlinePrinters,
      offlinePrinters
    };
  }, [jobs, physicalPrinters]);

  const filtered = useMemo(() => {
    return jobs
      .filter((job) => {
        const query = search.trim().toLowerCase();
        const matchesQuery =
          !query ||
          job.id.toLowerCase().includes(query) ||
          job.files.some((file) => file.fileName.toLowerCase().includes(query));
        if (!matchesQuery) return false;
        if (printerFilter && job.printerName !== printerFilter) return false;
        if (filter === 'QUEUED') return job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED';
        if (filter === 'PRINTING') return job.printStatus === 'PRINTING' || job.printStatus === 'DOWNLOADING' || job.printStatus === 'SUBMITTED_TO_SPOOLER';
        if (filter === 'COMPLETED') return job.printStatus === 'COMPLETED';
        if (filter === 'FAILED') return job.printStatus === 'FAILED' || job.printStatus === 'CANCELLED';
        if (filter === 'MANUAL_ATTENTION') return job.printStatus === 'MANUAL_ATTENTION' || (job as any).printStatus === 'REQUIRES_ATTENTION' || job.printStatus === 'AWAITING_RECONCILIATION';
        return true;
      })
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  }, [jobs, search, filter, printerFilter]);

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onPollNow();
      await fetchPrinterQueues();
    } finally {
      setIsRefreshing(false);
    }
  };

  const togglePausePrinter = async (printerName: string, isCurrentlyPaused: boolean) => {
    if (!window.electronAgentAPI) return;
    if (isCurrentlyPaused) {
      await window.electronAgentAPI.resumePrinterQueue(printerName);
    } else {
      await window.electronAgentAPI.pausePrinterQueue(printerName);
    }
    await fetchPrinterQueues();
  };

  const handleCopy = async (id: string) => {
    if (window.electronAgentAPI?.copyText) {
      await window.electronAgentAPI.copyText(id);
    } else {
      await navigator.clipboard.writeText(id);
    }
    setCopiedJobId(id);
    setTimeout(() => setCopiedJobId(null), 2000);
  };

  const retry = (job: PrintJobItem) => {
    if (
      job.retrySafe &&
      window.confirm(`Retry job ${job.id}? The agent confirmed no physical pages were printed.`)
    ) {
      onReprintJob(job.id);
    }
  };

  const cancelJobConfirm = (jobId: string) => {
    if (window.confirm(`Cancel waiting job ${jobId}? It will be removed from the printer queue.`)) {
      onCancelJob(jobId);
      void fetchPrinterQueues();
    }
  };

  return (
    <section className="space-y-6 animate-fade-in font-sans">
      {/* 2. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E1E7E1] dark:border-slate-800">
        <div>
          <h1 className="text-[24px] font-bold text-[#111111] dark:text-white tracking-tight leading-tight">
            Print Queue
          </h1>
          <p className="text-[14px] text-[#646B65] dark:text-slate-400 mt-1">
            Monitor and manage incoming customer print jobs across connected printers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-[#E8F8EC] text-[#008F25] border-[#BCEAC4] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-[#00B32D] animate-pulse" />
            <span>Live Queue Active</span>
          </span>

          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="secondary-button !min-h-[34px] !py-1.5 !px-3 !text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#00B32D] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Cloud'}</span>
          </button>
        </div>
      </div>

      {/* 3. QUEUE SUMMARY (6 Compact Operational Metric Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Metric 1: Active Printers */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Active Printers</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">{counts.totalPrinters}</span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] dark:bg-emerald-950/50 text-[#00B32D] flex items-center justify-center">
              <Printer className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#008F25] font-semibold mt-2 block truncate">
            {counts.onlinePrinters} Online · {counts.offlinePrinters} Offline
          </span>
        </div>

        {/* Metric 2: Currently Printing */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Currently Printing</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">{counts.PRINTING}</span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] dark:bg-emerald-950/50 text-[#00B32D] flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 animate-pulse stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#008F25] font-semibold mt-2 block truncate">Active Spooling</span>
        </div>

        {/* Metric 3: Waiting Jobs */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Waiting Jobs</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">{counts.QUEUED}</span>
            <div className="w-7 h-7 rounded-md bg-[#FFFBEB] dark:bg-amber-950/50 text-[#E6A000] flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#E6A000] font-semibold mt-2 block truncate">Sequential FIFO</span>
        </div>

        {/* Metric 4: Completed Today */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Completed Today</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">{counts.COMPLETED}</span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] dark:bg-emerald-950/50 text-[#00B32D] flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#008F25] font-semibold mt-2 block truncate">Physically Printed</span>
        </div>

        {/* Metric 5: Failed Jobs */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Failed / Cancelled</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">{counts.FAILED}</span>
            <div className="w-7 h-7 rounded-md bg-[#FEF2F2] dark:bg-red-950/50 text-[#DC2626] flex items-center justify-center">
              <Ban className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#DC2626] font-semibold mt-2 block truncate">Pre-spool Errors</span>
        </div>

        {/* Metric 6: Requires Attention */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Requires Attention</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">{counts.MANUAL_ATTENTION}</span>
            <div className="w-7 h-7 rounded-md bg-[#FFFBEB] dark:bg-amber-950/50 text-[#E6A000] flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#E6A000] font-semibold mt-2 block truncate">Needs Review</span>
        </div>
      </div>

      {/* Plan Entitlement Banner */}
      {(() => {
        const ent = entitlements || config?.entitlements || config?.shopDetails?.entitlements;
        const plan = (ent?.plan || 'starter').toLowerCase();

        return (
          <div className="p-3.5 rounded-[10px] border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs bg-[#F0F4F1] dark:bg-slate-900 border-[#E1E7E1] dark:border-slate-800">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full font-bold text-[12px] bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4]">
                {ent?.planName || (plan === 'business' ? 'Business' : plan === 'growth' ? 'Growth' : 'Starter')} Plan
              </span>

              <span className="text-[#111111] dark:text-slate-200 font-medium">
                {plan === 'business' ? (
                  <>Concurrent Multi-Printer Queues (up to 10) &middot; Dynamic Load Balancing &amp; Queue Optimization Active</>
                ) : plan === 'growth' ? (
                  <>Concurrent Multi-Printer Queues Active (up to 5) &middot; Smart Capability Routing Active</>
                ) : (
                  <>Sequential Single Printer Queue &middot; Manual Printer Selection</>
                )}
              </span>
            </div>

            {plan !== 'business' && (
              <button
                type="button"
                onClick={() => {
                  const server = (config?.serverUrl || 'https://printflow.devpixel.space').replace(/\/+$/, '');
                  const url = `${server}/shop/subscription`;
                  if (window.electronAgentAPI?.openExternal) {
                    window.electronAgentAPI.openExternal(url);
                  } else {
                    window.open(url, '_blank');
                  }
                }}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#00B32D] dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
              >
                <span>{plan === 'starter' ? 'Unlock Multi-Printer Queues' : 'Unlock Load Balancing'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })()}

      {/* Toolbar & View Switcher */}
      <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-[#F0F4F1] dark:bg-slate-900 p-1 rounded-lg border border-[#E1E7E1] dark:border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('MULTI_PRINTER')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'MULTI_PRINTER'
                ? 'bg-[#00B32D] text-white shadow-xs'
                : 'text-[#646B65] dark:text-slate-400 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Printer Queues</span>
            <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-white/20 text-white font-mono font-bold">
              {printerQueues.length || physicalPrinters.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('ALL_JOBS')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'ALL_JOBS'
                ? 'bg-[#00B32D] text-white shadow-xs'
                : 'text-[#646B65] dark:text-slate-400 hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>All Jobs Log</span>
            <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-[#E1E7E1] dark:bg-slate-800 text-[#111111] dark:text-slate-300 font-mono font-bold">
              {counts.ALL}
            </span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 justify-end">
          {counts.COMPLETED > 0 && (
            <button
              type="button"
              onClick={onClearCompleted}
              className="secondary-button !min-h-[36px] !text-xs font-semibold text-[#646B65] hover:text-[#DC2626] cursor-pointer"
              title="Remove completed jobs from local queue screen"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Completed</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: PRINTER QUEUE PANELS GRID                                        */}
      {/* ========================================================================= */}
      {viewMode === 'MULTI_PRINTER' && (
        <div className="space-y-6">
          {printerQueues.length === 0 ? (
            <div className="pf-card p-12 text-center border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card space-y-3">
              <Printer className="w-10 h-10 text-[#848D86] mx-auto stroke-[1.5]" />
              <h3 className="text-sm font-bold text-[#111111] dark:text-white">No Printers Registered</h3>
              <p className="text-xs text-[#646B65] dark:text-slate-400 max-w-md mx-auto">
                Go to the <strong>Printers Tab</strong> to scan and register physical Windows printers. Each registered printer automatically receives its own isolated print queue.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {printerQueues.map((pq) => {
                const isPaused = pq.isQueuePaused;
                const activeJob = pq.currentJob;
                const waitingList = pq.waitingQueue || [];

                return (
                  <div
                    key={pq.printerName}
                    className={`pf-card border rounded-[10px] overflow-hidden shadow-card transition-all ${
                      isPaused
                        ? 'border-[#FDE68A] dark:border-amber-800/60 bg-[#FFFBEB]/30'
                        : activeJob
                          ? 'border-[#BCEAC4] dark:border-emerald-800/80 bg-white dark:bg-[#131D33]'
                          : 'border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33]'
                    }`}
                  >
                    {/* 5. PRINTER QUEUE PANEL HEADER */}
                    <div className="p-4 bg-[#F0F4F1] dark:bg-slate-900/80 border-b border-[#E1E7E1] dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                            !pq.isOnline
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                              : isPaused
                                ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                                : activeJob
                                  ? 'bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4]'
                                  : 'bg-[#E8F8EC] text-[#008F25]'
                          }`}
                        >
                          <Printer className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[#111111] dark:text-white truncate" title={pq.displayName}>
                              {pq.displayName}
                            </h3>
                            <span className="text-[11px] font-mono text-[#646B65] dark:text-slate-400 bg-[#E1E7E1]/50 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                              {pq.physicalDeviceId.slice(0, 14)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#646B65] dark:text-slate-400">
                            <span>{pq.capabilities.supportsColor ? 'Color' : 'Monochrome'}</span>
                            <span>·</span>
                            <span>{pq.capabilities.paperSizes.join(', ')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge & Pause/Resume Toggle Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                            !pq.isOnline
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              : isPaused
                                ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                                : activeJob
                                  ? 'bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4]'
                                  : 'bg-[#E8F8EC] text-[#008F25]'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              !pq.isOnline
                                ? 'bg-slate-500'
                                : isPaused
                                  ? 'bg-[#E6A000]'
                                  : activeJob
                                    ? 'bg-[#00B32D] animate-pulse'
                                    : 'bg-[#00B32D]'
                            }`}
                          />
                          <span>
                            {!pq.isOnline ? 'OFFLINE' : isPaused ? 'PAUSED' : activeJob ? 'PRINTING' : 'READY'}
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() => togglePausePrinter(pq.printerName, isPaused)}
                          className={`px-2.5 py-1.5 rounded-md border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isPaused
                              ? 'bg-[#00B32D] text-white border-[#00B32D] hover:bg-[#008F25]'
                              : 'bg-white dark:bg-slate-800 text-[#B45309] border-[#FDE68A] hover:bg-[#FFFBEB]'
                          }`}
                          title={isPaused ? 'Resume printing queue' : 'Pause queue temporarily'}
                        >
                          {isPaused ? (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Resume</span>
                            </>
                          ) : (
                            <>
                              <Pause className="w-3.5 h-3.5 fill-current" />
                              <span>Pause</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-4 text-xs">
                      {/* Current Printing Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[#646B65] dark:text-slate-400 font-semibold text-[12px]">
                          <span>Currently Printing</span>
                          {activeJob && (
                            <span className="text-[#00B32D] font-mono font-bold flex items-center gap-1">
                              <Activity className="w-3 h-3 animate-spin" /> Live Job
                            </span>
                          )}
                        </div>

                        {activeJob ? (
                          <div className="p-3.5 bg-[#E8F8EC]/50 dark:bg-emerald-950/20 rounded-lg border border-[#BCEAC4] dark:border-emerald-800/60 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-bold text-[#111111] dark:text-white text-xs truncate block">
                                  {activeJob.files[0]?.fileName || 'Document.pdf'}
                                </span>
                                <div className="flex items-center gap-2 text-[11px] text-[#646B65] dark:text-slate-400 font-mono mt-0.5">
                                  <span>ID: {activeJob.id}</span>
                                  <span>·</span>
                                  <span>Order #{activeJob.orderCode}</span>
                                </div>
                              </div>
                              <JobStatusBadge status={activeJob.printStatus} />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-[#BCEAC4]/60 text-[#646B65] dark:text-slate-300">
                              <span>
                                {activeJob.files.reduce((a, f) => a + (f.pageCount || 1) * (f.copies || 1), 0)} total pages (
                                {activeJob.files[0]?.paperSize || 'A4'} · {activeJob.files[0]?.colorMode || 'BW'})
                              </span>
                              {activeJob.spoolerJobId && (
                                <span className="font-mono bg-[#E8F8EC] text-[#008F25] px-1.5 py-0.5 rounded font-bold">
                                  Spooler ID: #{activeJob.spoolerJobId}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-[#F0F4F1] dark:bg-slate-900/40 rounded-lg border border-dashed border-[#E1E7E1] dark:border-slate-800 text-[#848D86] text-center text-xs py-4">
                            No active job currently printing.
                          </div>
                        )}
                      </div>

                      {/* Waiting Queue Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[#646B65] dark:text-slate-400 font-semibold text-[12px]">
                          <span>Waiting Queue ({waitingList.length})</span>
                          <span className="text-[11px] text-[#848D86]">Ordered FIFO</span>
                        </div>

                        {waitingList.length === 0 ? (
                          <div className="p-3 bg-[#F0F4F1] dark:bg-slate-900/40 rounded-lg text-[#848D86] text-center text-xs">
                            Queue is empty.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            {waitingList.map((item) => {
                              const wJob = item.job;
                              const file = wJob.files[0];
                              const pages = wJob.files.reduce((a, f) => a + (f.pageCount || 1) * (f.copies || 1), 0);

                              return (
                                <div
                                  key={wJob.id}
                                  className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-[#E1E7E1] dark:border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-[#C8D1C8] transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-6 h-6 rounded-md bg-[#FFFBEB] text-[#B45309] font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
                                      #{item.queuePosition}
                                    </span>
                                    <div className="min-w-0">
                                      <span className="font-bold text-[#111111] dark:text-white truncate block max-w-[180px]" title={file?.fileName || 'Document.pdf'}>
                                        {file?.fileName || 'Document.pdf'}
                                      </span>
                                      <span className="text-[11px] text-[#646B65] dark:text-slate-400 font-mono block">
                                        ID: {wJob.id} · {pages} pages ({file?.colorMode || 'BW'})
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <JobStatusBadge status={wJob.printStatus} />
                                    <button
                                      type="button"
                                      onClick={() => cancelJobConfirm(wJob.id)}
                                      className="p-1 rounded text-[#848D86] hover:text-[#DC2626] cursor-pointer"
                                      title="Cancel waiting job"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Summary */}
                      <div className="pt-2 border-t border-[#E1E7E1] dark:border-slate-800 flex items-center justify-between text-[11px] text-[#646B65] dark:text-slate-400 font-mono">
                        <span>Completed: {pq.completedCount}</span>
                        <span>Failed: {pq.failedCount}</span>
                        <span>Status: {pq.status}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: ALL JOBS TABULAR LOG VIEW                                         */}
      {/* ========================================================================= */}
      {viewMode === 'ALL_JOBS' && (
        <div className="space-y-4">
          {/* Search & Filter Controls */}
          <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#848D86]" />
                <input
                  type="search"
                  aria-label="Search jobs"
                  placeholder="Search by job ID, document name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="settings-input !pl-10 !text-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-3 text-[#848D86] hover:text-[#111111] dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                aria-label="Filter by printer"
                value={printerFilter}
                onChange={(e) => setPrinterFilter(e.target.value)}
                className="settings-input pf-form-select !w-auto min-w-[150px] !text-xs"
              >
                <option value="">All Printers</option>
                {physicalPrinters.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-[#E1E7E1] dark:border-slate-800">
              {(
                [
                  { key: 'ALL', label: 'All Jobs', count: counts.ALL },
                  { key: 'QUEUED', label: 'Pending', count: counts.QUEUED },
                  { key: 'PRINTING', label: 'Printing', count: counts.PRINTING },
                  { key: 'COMPLETED', label: 'Completed', count: counts.COMPLETED },
                  { key: 'FAILED', label: 'Failed', count: counts.FAILED },
                  { key: 'MANUAL_ATTENTION', label: 'Requires Attention', count: counts.MANUAL_ATTENTION }
                ] as const
              ).map((tab) => {
                const isActive = filter === tab.key;
                return (
                  <button
                    type="button"
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#00B32D] text-white shadow-xs'
                        : 'text-[#646B65] dark:text-slate-400 hover:bg-[#E8F8EC] dark:hover:bg-slate-800 hover:text-[#111111] dark:hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-mono ${
                        isActive
                          ? 'bg-white/20 text-white font-bold'
                          : 'bg-[#F0F4F1] dark:bg-slate-800 text-[#646B65] dark:text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table of Jobs */}
          <div className="pf-card border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-16 text-center space-y-3 p-6">
                <Printer className="w-10 h-10 text-[#848D86] mx-auto stroke-[1.5]" />
                <h3 className="text-sm font-bold text-[#111111] dark:text-white">No Print Jobs Found</h3>
                <p className="text-xs text-[#646B65] dark:text-slate-400">
                  {search || filter !== 'ALL'
                    ? 'No print jobs match the selected filter or search keyword.'
                    : 'Your print queue is currently clear.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E1E7E1] dark:border-slate-800 bg-[#F0F4F1] dark:bg-slate-900/60 text-[#646B65] dark:text-slate-400">
                      <th className="py-3 px-4 font-bold">Job ID</th>
                      <th className="py-3 px-4 font-bold">Document</th>
                      <th className="py-3 px-4 font-bold">Pages / Specs</th>
                      <th className="py-3 px-4 font-bold">Target Printer</th>
                      <th className="py-3 px-4 font-bold">Time</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E7E1] dark:divide-slate-800">
                    {filtered.map((job) => {
                      const firstFile = job.files[0];
                      const totalPages = job.files.reduce((acc, f) => acc + (f.pageCount || 1) * (f.copies || 1), 0);
                      const isAttention = job.printStatus === 'MANUAL_ATTENTION' || (job as any).printStatus === 'REQUIRES_ATTENTION';

                      return (
                        <tr key={job.id} className="hover:bg-[#F0F4F1] dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#111111] dark:text-slate-200">
                            <div className="flex items-center gap-1.5">
                              <span>{job.id}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(job.id)}
                                title="Copy Job ID"
                                className="p-1 rounded text-[#848D86] hover:text-[#00B32D] cursor-pointer"
                              >
                                {copiedJobId === job.id ? <Check className="w-3 h-3 text-[#00B32D]" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 max-w-[220px]">
                              <FileText className="w-4 h-4 text-[#00B32D] shrink-0" />
                              <span className="font-semibold text-[#111111] dark:text-white truncate" title={firstFile?.fileName || 'Document.pdf'}>
                                {firstFile?.fileName || 'Document.pdf'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-[#646B65] dark:text-slate-300">
                            <div className="space-y-0.5">
                              <span className="font-medium text-[#111111] dark:text-slate-200">{totalPages} {totalPages === 1 ? 'page' : 'pages'}</span>
                              <span className="text-[11px] text-[#848D86] block">
                                {firstFile?.paperSize || 'A4'} · {firstFile?.colorMode || 'BW'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-[#646B65] dark:text-slate-300">
                            <span className="font-medium text-[#111111] dark:text-white truncate block max-w-[160px]">
                              {job.printerName || 'Default Spooler'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-[#646B65] dark:text-slate-400 whitespace-nowrap">
                            {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <JobStatusBadge status={job.printStatus} />
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedJob(job)}
                                className="p-1.5 rounded-md border border-[#E1E7E1] dark:border-slate-800 text-[#646B65] hover:text-[#111111] dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                                title="View Job Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {job.retrySafe && (
                                <button
                                  type="button"
                                  onClick={() => retry(job)}
                                  className="p-1.5 rounded-md border border-[#BCEAC4] bg-[#E8F8EC] text-[#008F25] hover:bg-[#D6F2DD] cursor-pointer"
                                  title="Retry Job (Safe - no duplicate physical print)"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {isAttention && (
                                <span
                                  className="p-1.5 rounded-md bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]"
                                  title="Verify printer tray output before re-spooling"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security & Concurrency Footer */}
      <div className="p-4 rounded-[10px] border border-[#E1E7E1] dark:border-slate-800 bg-[#F0F4F1] dark:bg-slate-900/40 text-xs text-[#646B65] dark:text-slate-400 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#00B32D] shrink-0" />
        <span>
          <strong>Multi-Printer Queue Isolation:</strong> Each physical printer processes jobs sequentially (concurrency = 1) with hardware locks across device aliases. Different physical printers process queues concurrently.
        </span>
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#131D33] border border-[#E1E7E1] dark:border-slate-800 p-6 rounded-[10px] shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E1E7E1] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00B32D]" />
                <h3 className="text-sm font-bold text-[#111111] dark:text-white">Print Job Specification</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded text-[#848D86] hover:text-[#111111] dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-[#F0F4F1] dark:bg-slate-900 border border-[#E1E7E1] dark:border-slate-800">
              <div>
                <span className="text-[#646B65] dark:text-slate-400 text-[11px] block font-medium">Job ID</span>
                <span className="font-mono font-bold text-[#111111] dark:text-slate-200">{selectedJob.id}</span>
              </div>
              <div>
                <span className="text-[#646B65] dark:text-slate-400 text-[11px] block font-medium">Status</span>
                <span className="font-semibold text-[#111111] dark:text-slate-200">{selectedJob.printStatus}</span>
              </div>
              <div>
                <span className="text-[#646B65] dark:text-slate-400 text-[11px] block font-medium">Assigned Printer</span>
                <span className="font-semibold text-[#111111] dark:text-slate-200">{selectedJob.printerName || 'Default'}</span>
              </div>
              <div>
                <span className="text-[#646B65] dark:text-slate-400 text-[11px] block font-medium">Created At</span>
                <span className="font-mono text-[#111111] dark:text-slate-200">{new Date(selectedJob.createdAt).toLocaleString()}</span>
              </div>
              {selectedJob.spoolerJobId && (
                <div>
                  <span className="text-[#646B65] dark:text-slate-400 text-[11px] block font-medium">Windows Spooler ID</span>
                  <span className="font-mono font-bold text-[#00B32D]">#{selectedJob.spoolerJobId}</span>
                </div>
              )}
              {selectedJob.errorMessage && (
                <div className="col-span-2 p-2.5 rounded-lg bg-[#FEF2F2] dark:bg-red-950/40 text-[#DC2626] border border-[#FECACA] dark:border-red-900">
                  <span className="font-bold block text-[11px]">Error Message:</span>
                  <span>{selectedJob.errorMessage}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="secondary-button !text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
