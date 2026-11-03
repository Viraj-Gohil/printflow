import React, { useEffect, useMemo, useState } from 'react';
import { DiscoveredPrinter, PrintJobItem, PrinterQueueState } from '../types/agent';
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
  Activity
} from 'lucide-react';

interface QueueViewProps {
  jobs: PrintJobItem[];
  printers: DiscoveredPrinter[];
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

  const counts = useMemo(() => {
    const queued = jobs.filter((j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED').length;
    const printing = jobs.filter((j) => j.printStatus === 'PRINTING' || j.printStatus === 'DOWNLOADING' || j.printStatus === 'SUBMITTED_TO_SPOOLER').length;
    const completed = jobs.filter((j) => j.printStatus === 'COMPLETED').length;
    const failed = jobs.filter((j) => j.printStatus === 'FAILED' || j.printStatus === 'CANCELLED').length;
    const manual = jobs.filter((j) => j.printStatus === 'MANUAL_ATTENTION' || (j as any).printStatus === 'REQUIRES_ATTENTION' || j.printStatus === 'AWAITING_RECONCILIATION').length;
    
    const totalPrinters = printers.length;
    const onlinePrinters = printers.filter(p => p.isOnline).length;
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
  }, [jobs, printers]);

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
    <section className="space-y-5 animate-fade-in">
      {/* Top Agent & Multi-Printer Executive Dashboard Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <div className="pf-card p-4 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Active Printers</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xl font-extrabold text-[#0F172A] dark:text-white font-mono">{counts.totalPrinters}</span>
            <div className="w-8 h-8 rounded-lg bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10.5px] text-[#00B52D] font-bold mt-1 block">
            {counts.onlinePrinters} Online · {counts.offlinePrinters} Offline
          </span>
        </div>

        <div className="pf-card p-4 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Currently Printing</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xl font-extrabold text-[#2563EB] font-mono">{counts.PRINTING}</span>
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <span className="text-[10.5px] text-[#2563EB] font-medium mt-1 block">Active Spooling</span>
        </div>

        <div className="pf-card p-4 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Waiting in Queue</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xl font-extrabold text-[#D97706] font-mono">{counts.QUEUED}</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10.5px] text-[#D97706] font-medium mt-1 block">Sequential FIFO Buffer</span>
        </div>

        <div className="pf-card p-4 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Completed Today</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xl font-extrabold text-[#10B981] font-mono">{counts.COMPLETED}</span>
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10.5px] text-[#10B981] font-medium mt-1 block">Physically Printed</span>
        </div>

        <div className="pf-card p-4 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Failed / Cancelled</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xl font-extrabold text-[#EF4444] font-mono">{counts.FAILED}</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10.5px] text-[#EF4444] font-medium mt-1 block">Pre-spool Errors</span>
        </div>

        <div className="pf-card p-4 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 block">Requires Attention</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xl font-extrabold text-[#EA580C] font-mono">{counts.MANUAL_ATTENTION}</span>
            <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10.5px] text-[#EA580C] font-medium mt-1 block">Verification Required</span>
        </div>
      </div>

      {/* Toolbar & View Switcher */}
      <div className="pf-card p-4 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-[#F8FAFC] dark:bg-slate-900 p-1 rounded-xl border border-[#E2E8F0] dark:border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('MULTI_PRINTER')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'MULTI_PRINTER'
                ? 'bg-[#00B52D] text-white shadow-xs'
                : 'text-[#475569] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Multi-Printer Queues</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
              {printerQueues.length || printers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('ALL_JOBS')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'ALL_JOBS'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#475569] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>All Jobs Log</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {counts.ALL}
            </span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 justify-end">
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="secondary-button !min-h-[38px] !text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Cloud'}</span>
          </button>

          {counts.COMPLETED > 0 && (
            <button
              type="button"
              onClick={onClearCompleted}
              className="secondary-button !min-h-[38px] !text-xs font-semibold text-[#64748B] hover:text-[#EF4444] cursor-pointer"
              title="Remove finished jobs from the local screen buffer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Completed</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: MULTI-PRINTER QUEUE CARDS GRID                                   */}
      {/* ========================================================================= */}
      {viewMode === 'MULTI_PRINTER' && (
        <div className="space-y-6">
          {printerQueues.length === 0 ? (
            <div className="pf-card p-12 text-center border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card space-y-3">
              <Printer className="w-10 h-10 text-[#94A3B8] mx-auto stroke-[1.5]" />
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">No Printers Registered</h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400 max-w-md mx-auto">
                Go to the <strong>Printers Tab</strong> to scan and register physical Windows printers. Each registered printer will automatically receive its own isolated sequential queue.
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
                    className={`pf-card border rounded-2xl overflow-hidden shadow-card transition-all ${
                      isPaused
                        ? 'border-amber-300 dark:border-amber-800/60 bg-amber-50/10 dark:bg-amber-950/10'
                        : activeJob
                          ? 'border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-[#131D33]'
                          : 'border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33]'
                    }`}
                  >
                    {/* Printer Header */}
                    <div className="p-4 bg-[#F8FAFC] dark:bg-slate-900/80 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                            !pq.isOnline
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                              : isPaused
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                : activeJob
                                  ? 'bg-[#EAF8ED] text-[#00B52D]'
                                  : 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                          }`}
                        >
                          <Printer className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white truncate" title={pq.displayName}>
                              {pq.displayName}
                            </h3>
                            {/* Device Lock Hardware Tag */}
                            <span className="text-[10px] font-mono text-[#64748B] dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                              {pq.physicalDeviceId.slice(0, 14)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#64748B] dark:text-slate-400">
                            <span>{pq.capabilities.supportsColor ? 'Colour' : 'B&W Only'}</span>
                            <span>·</span>
                            <span>{pq.capabilities.paperSizes.join(', ')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status & Pause/Resume Control */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                            !pq.isOnline
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              : isPaused
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                                : activeJob
                                  ? 'bg-[#EAF8ED] text-[#008A22] border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              !pq.isOnline
                                ? 'bg-slate-500'
                                : isPaused
                                  ? 'bg-amber-500'
                                  : activeJob
                                    ? 'bg-[#00B52D] animate-ping'
                                    : 'bg-blue-500'
                            }`}
                          />
                          <span>
                            {!pq.isOnline ? 'OFFLINE' : isPaused ? 'PAUSED' : activeJob ? 'PRINTING' : 'READY'}
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() => togglePausePrinter(pq.printerName, isPaused)}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isPaused
                              ? 'bg-[#00B52D] text-white border-[#00B52D] hover:bg-[#008A22]'
                              : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950'
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
                      {/* Active Printing Job Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[#64748B] dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                          <span>Currently Spooling / Printing</span>
                          {activeJob && (
                            <span className="text-[#00B52D] font-mono font-extrabold flex items-center gap-1">
                              <Activity className="w-3 h-3 animate-spin" /> Live Job
                            </span>
                          )}
                        </div>

                        {activeJob ? (
                          <div className="p-3.5 bg-[#EAF8ED]/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-extrabold text-[#0F172A] dark:text-white text-xs truncate block">
                                  {activeJob.files[0]?.fileName || 'Document.pdf'}
                                </span>
                                <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-slate-400 font-mono mt-0.5">
                                  <span>ID: {activeJob.id}</span>
                                  <span>·</span>
                                  <span>Order #{activeJob.orderCode}</span>
                                </div>
                              </div>
                              <JobStatusBadge status={activeJob.printStatus} />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-emerald-200/60 dark:border-emerald-900/60 text-[#475569] dark:text-slate-300">
                              <span>
                                {activeJob.files.reduce((a, f) => a + (f.pageCount || 1) * (f.copies || 1), 0)} total pages (
                                {activeJob.files[0]?.paperSize || 'A4'} · {activeJob.files[0]?.colorMode || 'BW'})
                              </span>
                              {activeJob.spoolerJobId && (
                                <span className="font-mono bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded font-bold">
                                  Spooler ID: #{activeJob.spoolerJobId}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900/40 rounded-xl border border-dashed border-[#CBD5E1] dark:border-slate-800 text-[#94A3B8] text-center text-xs py-4">
                            No job currently printing. Waiting for incoming orders.
                          </div>
                        )}
                      </div>

                      {/* Waiting Queue Table Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[#64748B] dark:text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                          <span>Waiting Queue ({waitingList.length})</span>
                          <span className="text-[10.5px] font-normal text-[#94A3B8]">Ordered FIFO</span>
                        </div>

                        {waitingList.length === 0 ? (
                          <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900/40 rounded-xl text-[#94A3B8] text-center text-xs">
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
                                  className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-[#CBD5E1] transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-bold font-mono text-[11px] flex items-center justify-center shrink-0">
                                      #{item.queuePosition}
                                    </span>
                                    <div className="min-w-0">
                                      <span className="font-bold text-[#0F172A] dark:text-white truncate block max-w-[180px]" title={file?.fileName || 'Document.pdf'}>
                                        {file?.fileName || 'Document.pdf'}
                                      </span>
                                      <span className="text-[10.5px] text-[#64748B] dark:text-slate-400 font-mono block">
                                        ID: {wJob.id} · {pages} pages ({file?.colorMode || 'BW'})
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <JobStatusBadge status={wJob.printStatus} />
                                    <button
                                      type="button"
                                      onClick={() => cancelJobConfirm(wJob.id)}
                                      className="p-1 rounded text-[#94A3B8] hover:text-[#EF4444] cursor-pointer"
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
                      <div className="pt-2 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between text-[11px] text-[#64748B] dark:text-slate-400 font-mono">
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
          <div className="pf-card p-4 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#94A3B8]" />
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
                    className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white"
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
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-[#E2E8F0] dark:border-slate-800">
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
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'text-[#475569] dark:text-slate-400 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-mono ${
                        isActive
                          ? 'bg-white/20 text-white font-bold'
                          : 'bg-[#F1F5F9] dark:bg-slate-800 text-[#64748B] dark:text-slate-400'
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
          <div className="pf-card border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card overflow-hidden">
            {filtered.length === 0 ? (
              <div className="py-16 text-center space-y-3 p-6">
                <Printer className="w-10 h-10 text-[#94A3B8] mx-auto stroke-[1.5]" />
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">No Print Jobs Found</h3>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  {search || filter !== 'ALL'
                    ? 'No print jobs match the selected filter or search keyword.'
                    : 'Your print queue is currently clear.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60 text-[#64748B] dark:text-slate-400">
                      <th className="py-3 px-4 font-semibold">Job ID</th>
                      <th className="py-3 px-4 font-semibold">Document</th>
                      <th className="py-3 px-4 font-semibold">Pages / Specs</th>
                      <th className="py-3 px-4 font-semibold">Target Printer</th>
                      <th className="py-3 px-4 font-semibold">Time</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                    {filtered.map((job) => {
                      const firstFile = job.files[0];
                      const totalPages = job.files.reduce((acc, f) => acc + (f.pageCount || 1) * (f.copies || 1), 0);
                      const isAttention = job.printStatus === 'MANUAL_ATTENTION' || (job as any).printStatus === 'REQUIRES_ATTENTION';

                      return (
                        <tr key={job.id} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#0F172A] dark:text-slate-200">
                            <div className="flex items-center gap-1.5">
                              <span>{job.id}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(job.id)}
                                title="Copy Job ID"
                                className="p-1 rounded text-[#94A3B8] hover:text-[#2563EB] cursor-pointer"
                              >
                                {copiedJobId === job.id ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2 max-w-[220px]">
                              <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
                              <span className="font-semibold text-[#0F172A] dark:text-white truncate" title={firstFile?.fileName || 'Document.pdf'}>
                                {firstFile?.fileName || 'Document.pdf'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-[#475569] dark:text-slate-300">
                            <div className="space-y-0.5">
                              <span className="font-medium">{totalPages} {totalPages === 1 ? 'page' : 'pages'}</span>
                              <span className="text-[11px] text-[#94A3B8] block">
                                {firstFile?.paperSize || 'A4'} · {firstFile?.colorMode || 'BW'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-[#475569] dark:text-slate-300">
                            <span className="font-medium text-[#0F172A] dark:text-white truncate block max-w-[160px]">
                              {job.printerName || 'Default Spooler'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-[#64748B] dark:text-slate-400 whitespace-nowrap">
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
                                className="p-1.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                                title="View Job Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {job.retrySafe && (
                                <button
                                  type="button"
                                  onClick={() => retry(job)}
                                  className="p-1.5 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] text-[#047857] hover:bg-[#D1FAE5] cursor-pointer"
                                  title="Retry Job (Safe - no duplicate physical print)"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {isAttention && (
                                <span
                                  className="p-1.5 rounded-lg bg-[#FFF7ED] text-[#EA580C] border border-[#FFEDD5]"
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

      {/* Security Assurance Footer */}
      <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/40 text-xs text-[#64748B] dark:text-slate-400 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#00B52D] shrink-0" />
        <span>
          <strong>Multi-Printer Queue Isolation:</strong> Each physical printer processes jobs sequentially (concurrency = 1) with hardware locks across device aliases. Different physical printers process queues concurrently.
        </span>
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#131D33] border border-[#E2E8F0] dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">Print Job Specification</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
              <div>
                <span className="text-[#64748B] dark:text-slate-400 text-[11px] block">Job ID</span>
                <span className="font-mono font-bold text-[#0F172A] dark:text-slate-200">{selectedJob.id}</span>
              </div>
              <div>
                <span className="text-[#64748B] dark:text-slate-400 text-[11px] block">Status</span>
                <span className="font-semibold text-[#0F172A] dark:text-slate-200">{selectedJob.printStatus}</span>
              </div>
              <div>
                <span className="text-[#64748B] dark:text-slate-400 text-[11px] block">Assigned Printer</span>
                <span className="font-semibold text-[#0F172A] dark:text-slate-200">{selectedJob.printerName || 'Default'}</span>
              </div>
              <div>
                <span className="text-[#64748B] dark:text-slate-400 text-[11px] block">Created At</span>
                <span className="font-mono text-[#0F172A] dark:text-slate-200">{new Date(selectedJob.createdAt).toLocaleString()}</span>
              </div>
              {selectedJob.spoolerJobId && (
                <div>
                  <span className="text-[#64748B] dark:text-slate-400 text-[11px] block">Windows Spooler ID</span>
                  <span className="font-mono font-bold text-[#00B52D]">#{selectedJob.spoolerJobId}</span>
                </div>
              )}
              {selectedJob.errorMessage && (
                <div className="col-span-2 p-2.5 rounded-lg bg-[#FEF2F2] dark:bg-red-950/40 text-[#DC2626] border border-red-200 dark:border-red-900">
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
