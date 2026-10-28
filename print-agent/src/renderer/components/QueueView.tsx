import React, { useEffect, useMemo, useState } from 'react';
import { DiscoveredPrinter, PrintJobItem } from '../types/agent';
import { formatPrintError } from '../utils/printError';
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
  Check
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

export const QueueView: React.FC<QueueViewProps> = ({
  jobs,
  printers,
  onReprintJob,
  onCancelJob,
  onClearCompleted,
  onPollNow
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [printerFilter, setPrinterFilter] = useState('');
  const [selectedJob, setSelectedJob] = useState<PrintJobItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);

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
    return {
      ALL: jobs.length,
      QUEUED: jobs.filter((j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED').length,
      PRINTING: jobs.filter((j) => j.printStatus === 'PRINTING' || j.printStatus === 'DOWNLOADING').length,
      COMPLETED: jobs.filter((j) => j.printStatus === 'COMPLETED').length,
      FAILED: jobs.filter((j) => j.printStatus === 'FAILED' || j.printStatus === 'CANCELLED').length,
      MANUAL_ATTENTION: jobs.filter((j) => j.printStatus === 'MANUAL_ATTENTION' || (j as any).printStatus === 'REQUIRES_ATTENTION').length
    };
  }, [jobs]);

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
        if (filter === 'PRINTING') return job.printStatus === 'PRINTING' || job.printStatus === 'DOWNLOADING';
        if (filter === 'COMPLETED') return job.printStatus === 'COMPLETED';
        if (filter === 'FAILED') return job.printStatus === 'FAILED' || job.printStatus === 'CANCELLED';
        if (filter === 'MANUAL_ATTENTION') return job.printStatus === 'MANUAL_ATTENTION' || (job as any).printStatus === 'REQUIRES_ATTENTION';
        return true;
      })
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  }, [jobs, search, filter, printerFilter]);

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onPollNow();
    } finally {
      setIsRefreshing(false);
    }
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

  return (
    <section className="space-y-5 animate-fade-in">
      {/* Top Search & Filter Bar */}
      <div className="pf-card p-6 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
          {/* Search Box */}
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
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter by Printer & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
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

            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              className="secondary-button !min-h-[38px] !text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Cloud'}</span>
            </button>

            {counts.COMPLETED > 0 && (
              <button
                type="button"
                onClick={onClearCompleted}
                className="secondary-button !min-h-[38px] !text-xs font-semibold text-[#64748B] hover:text-[#EF4444]"
                title="Remove finished jobs from the local screen buffer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Completed</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
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

      {/* Main Jobs Table / Card List */}
      <div className="pf-card border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center space-y-3 p-6">
            <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 text-[#94A3B8] flex items-center justify-center mx-auto border border-[#E2E8F0] dark:border-slate-800">
              <Printer className="w-6 h-6 stroke-[1.75]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">No Print Jobs Found</h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                {search || filter !== 'ALL'
                  ? 'No print jobs match the selected filter or search keyword.'
                  : 'Your print queue is currently clear. Customer print orders will appear automatically.'}
              </p>
            </div>
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
                    <tr
                      key={job.id}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Job ID */}
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

                      {/* Document Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 max-w-[220px]">
                          <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
                          <span className="font-semibold text-[#0F172A] dark:text-white truncate" title={firstFile?.fileName || 'Document.pdf'}>
                            {firstFile?.fileName || 'Document.pdf'}
                          </span>
                        </div>
                      </td>

                      {/* Pages / Specs */}
                      <td className="py-3.5 px-4 text-[#475569] dark:text-slate-300">
                        <div className="space-y-0.5">
                          <span className="font-medium">
                            {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                          </span>
                          <span className="text-[11px] text-[#94A3B8] block">
                            {firstFile?.paperSize || 'A4'} · {firstFile?.colorMode || 'BW'}
                          </span>
                        </div>
                      </td>

                      {/* Assigned Printer */}
                      <td className="py-3.5 px-4 text-[#475569] dark:text-slate-300">
                        <span className="font-medium text-[#0F172A] dark:text-white truncate block max-w-[160px]">
                          {job.printerName || 'Default Spooler'}
                        </span>
                      </td>

                      {/* Submission Time */}
                      <td className="py-3.5 px-4 text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                        {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <JobStatusBadge status={job.printStatus} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedJob(job)}
                            className="p-1.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
                            title="View Job Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {job.retrySafe && (
                            <button
                              type="button"
                              onClick={() => retry(job)}
                              className="p-1.5 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] text-[#047857] hover:bg-[#D1FAE5]"
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

      {/* Duplicate Prevention & Reliability Assurance Footer */}
      <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/40 text-xs text-[#64748B] dark:text-slate-400 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0" />
        <span>
          <strong>Duplicate Spooling Protection:</strong> Each print job contains a deterministic UUID and is atomically locked by the backend to prevent duplicate physical paper prints.
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
                className="p-1 rounded text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white"
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
                <span className="text-[#64748B] dark:text-slate-400 text-[11px] block">Submitted At</span>
                <span className="text-[#0F172A] dark:text-slate-200">{new Date(selectedJob.createdAt).toLocaleString()}</span>
              </div>
              {selectedJob.errorMessage && (
                <div className="col-span-2 pt-2 border-t border-[#E2E8F0] dark:border-slate-800">
                  <span className="text-[#EF4444] text-[11px] block font-semibold">Error / Note:</span>
                  <span className="text-[#991B1B] dark:text-red-300 leading-relaxed font-mono text-[11.5px]">
                    {formatPrintError(selectedJob.errorMessage)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="secondary-button !min-h-[36px]"
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
