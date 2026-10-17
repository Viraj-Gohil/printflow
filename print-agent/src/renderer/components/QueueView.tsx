import React, { useEffect, useMemo, useState } from 'react';
import { DiscoveredPrinter, PrintJobItem } from '../types/agent';
import { formatPrintError } from '../utils/printError';
import { JobStatusBadge } from './StatusBadge';
import { AlertTriangle, FileText, Printer, RefreshCw, Search, Trash2, X, Eye, RotateCcw, Ban, Clock, CheckCircle2 } from 'lucide-react';

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
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [selectedJob, setSelectedJob] = useState<PrintJobItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Keyboard navigation & modal escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedJob) {
        setSelectedJob(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedJob]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      ALL: jobs.length,
      QUEUED: jobs.filter((j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED').length,
      PRINTING: jobs.filter((j) => j.printStatus === 'PRINTING' || j.printStatus === 'DOWNLOADING').length,
      COMPLETED: jobs.filter((j) => j.printStatus === 'COMPLETED').length,
      FAILED: jobs.filter((j) => j.printStatus === 'FAILED' || j.printStatus === 'CANCELLED').length,
      MANUAL_ATTENTION: jobs.filter((j) => j.printStatus === 'MANUAL_ATTENTION').length
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
        if (printerFilter === '__unassigned__' && job.printerName) return false;
        if (printerFilter && printerFilter !== '__unassigned__' && job.printerName !== printerFilter) return false;
        if (filter === 'QUEUED') return job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED';
        if (filter === 'PRINTING') return job.printStatus === 'PRINTING' || job.printStatus === 'DOWNLOADING';
        if (filter === 'COMPLETED') return job.printStatus === 'COMPLETED';
        if (filter === 'FAILED') return job.printStatus === 'FAILED' || job.printStatus === 'CANCELLED';
        if (filter === 'MANUAL_ATTENTION') return job.printStatus === 'MANUAL_ATTENTION';
        return true;
      })
      .sort((left, right) => {
        const leftTime = Date.parse(left.createdAt) || 0;
        const rightTime = Date.parse(right.createdAt) || 0;
        return sortOrder === 'NEWEST' ? rightTime - leftTime : leftTime - rightTime;
      });
  }, [jobs, search, filter, printerFilter, sortOrder]);

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onPollNow();
    } finally {
      setIsRefreshing(false);
    }
  };

  const retry = (job: PrintJobItem) => {
    if (
      job.retrySafe &&
      window.confirm(`Retry job ${job.id}? The agent confirmed the failure occurred safely before physical printing started.`)
    ) {
      onReprintJob(job.id);
    }
  };

  return (
    <section className="space-y-4 animate-fade-in">
      {/* Controls & Filter Card */}
      <div className="pf-card p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
            <input
              type="search"
              aria-label="Search jobs by order ID or document filename"
              placeholder="Search by job ID or filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="settings-input !pl-9 !text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-[var(--text-faint)] hover:text-[var(--text-primary)]"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter jobs by printer"
              value={printerFilter}
              onChange={(e) => setPrinterFilter(e.target.value)}
              className="settings-input pf-form-select !w-auto min-w-36 !text-xs"
            >
              <option value="">All Printers</option>
              {printers.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.displayName}
                </option>
              ))}
              <option value="__unassigned__">Unassigned</option>
            </select>

            <select
              aria-label="Sort jobs by creation time"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'NEWEST' | 'OLDEST')}
              className="settings-input pf-form-select !w-auto !text-xs"
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
            </select>

            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="secondary-button !min-h-[36px] !text-xs"
              title="Poll cloud backend for newly authorized print jobs"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-teal-600 dark:text-teal-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear completed and cancelled jobs from local view? Active jobs and crash recovery data will be preserved.')) {
                  onClearCompleted();
                }
              }}
              className="secondary-button !min-h-[36px] !text-xs text-[var(--text-muted)] hover:text-red-600"
              title="Remove finished and cancelled print jobs from local queue view"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear Done</span>
            </button>
          </div>
        </div>

        {/* Status Segmented Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-default)]" role="group" aria-label="Filter jobs by status">
          {(
            [
              { id: 'ALL', label: 'All Jobs' },
              { id: 'QUEUED', label: 'Queued' },
              { id: 'PRINTING', label: 'Printing' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'FAILED', label: 'Failed' },
              { id: 'MANUAL_ATTENTION', label: 'Needs Review' }
            ] as const
          ).map((tab) => {
            const count = counts[tab.id];
            const isActive = filter === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                aria-pressed={isActive}
                onClick={() => setFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--border-default)] text-[var(--text-secondary)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table / Empty State Container */}
      <div className="pf-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="space-y-3 py-16 text-center bg-[var(--bg-subtle)]">
            <Printer className="mx-auto h-10 w-10 text-[var(--text-faint)]" />
            <h3 className="text-sm font-bold text-[var(--text-secondary)]">
              {jobs.length ? 'No jobs match your filter criteria' : 'Print queue is currently empty'}
            </h3>
            <p className="mx-auto max-w-sm text-xs text-[var(--text-muted)]">
              {jobs.length
                ? 'Try resetting the search terms or changing your status filter tabs above.'
                : 'Click below to poll the PrintFlow cloud backend for newly paid customer orders.'}
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="primary-button mx-auto mt-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Check Cloud Queue</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-[10.5px] uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Job Reference</th>
                  <th className="px-4 py-3 font-bold">Document &amp; Specs</th>
                  <th className="px-4 py-3 font-bold">Printer</th>
                  <th className="px-4 py-3 font-bold">Timestamp</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {filtered.map((job) => {
                  const isQueued = job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED';
                  const isSafeToRetry = job.printStatus === 'FAILED' && job.retrySafe === true;
                  const fileName = job.files[0]?.fileName || 'Document Payload';
                  const progress =
                    job.printStatus === 'DOWNLOADING'
                      ? job.downloadProgress
                      : job.printStatus === 'PRINTING'
                      ? job.printProgress
                      : undefined;

                  return (
                    <tr key={job.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      {/* Job ID */}
                      <td className="px-4 py-3.5 font-mono font-bold text-[var(--text-primary)]">
                        <button
                          type="button"
                          onClick={() => setSelectedJob(job)}
                          className="hover:text-teal-600 dark:hover:text-teal-400 hover:underline cursor-pointer"
                        >
                          {job.id}
                        </button>
                      </td>

                      {/* Filename & Progress */}
                      <td className="max-w-xs px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                          <button
                            type="button"
                            onClick={() => setSelectedJob(job)}
                            className="truncate text-left font-medium text-[var(--text-secondary)] hover:text-teal-600 dark:hover:text-teal-400"
                            title="Inspect full job details"
                          >
                            {fileName}
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-[10.5px] text-[var(--text-muted)] mt-0.5">
                          <span>{job.files[0]?.paperSize || 'A4'}</span>
                          <span>•</span>
                          <span>{job.files[0]?.colorMode === 'COLOR' ? 'Color' : 'B&W'}</span>
                          <span>•</span>
                          <span>{job.files[0]?.copies || 1} {job.files[0]?.copies === 1 ? 'copy' : 'copies'}</span>
                        </div>

                        {progress !== undefined && (
                          <div className="mt-1.5 space-y-1">
                            <div className="flex justify-between text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                              <span>{job.printStatus === 'DOWNLOADING' ? 'Downloading' : 'Spooling'}</span>
                              <span className="font-mono">{progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-[var(--border-default)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-500 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {job.errorMessage && (
                          <p
                            className="mt-1 truncate text-[10.5px] text-red-600 dark:text-red-400 font-medium"
                            title={formatPrintError(job.errorMessage)}
                          >
                            {formatPrintError(job.errorMessage)}
                          </p>
                        )}
                      </td>

                      {/* Assigned Printer */}
                      <td className="px-4 py-3.5 text-[var(--text-secondary)]">
                        {job.printerName ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs font-medium">
                            <Printer className="w-3 h-3 text-[var(--text-faint)]" />
                            <span className="truncate max-w-[140px]">{job.printerName}</span>
                          </span>
                        ) : (
                          <span className="text-[var(--text-faint)] italic">Pending assignment</span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-[var(--text-muted)]">
                        {new Date(job.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5">
                        <JobStatusBadge status={job.printStatus} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedJob(job)}
                            className="secondary-button !min-h-[28px] !px-2.5 !py-1 !text-[11px]"
                            title="Inspect job specification"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
                          </button>

                          {isQueued && (
                            <button
                              type="button"
                              onClick={() => onCancelJob(job.id)}
                              className="danger-button !min-h-[28px] !px-2.5 !py-1 !text-[11px]"
                              title="Cancel queued print job"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          )}

                          {isSafeToRetry && (
                            <button
                              type="button"
                              onClick={() => retry(job)}
                              className="primary-button !min-h-[28px] !px-2.5 !py-1 !text-[11px]"
                              title="Safe to reprint because the job failed before paper spooling started"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Retry</span>
                            </button>
                          )}

                          {job.printStatus === 'MANUAL_ATTENTION' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>Review First</span>
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

      {/* 4. JOB DETAIL MODAL */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedJob(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-detail-title"
            className="w-full max-w-lg space-y-4 p-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-2xl animate-scale-in text-xs"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border-default)]">
              <div>
                <h2 id="job-detail-title" className="text-base font-bold text-[var(--text-primary)]">
                  Print Job Specification
                </h2>
                <p className="font-mono text-xs text-[var(--text-muted)] mt-0.5">{selectedJob.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-lg text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                title="Close modal (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status & Overview */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Current Spool Status</span>
              <JobStatusBadge status={selectedJob.printStatus} />
            </div>

            <div className="space-y-2">
              <Detail label="Created Timestamp" value={new Date(selectedJob.createdAt).toLocaleString()} />
              <Detail label="Target Windows Printer" value={selectedJob.printerName || 'Pending Spooler Assignment'} />
              {selectedJob.customerName && <Detail label="Customer Name" value={selectedJob.customerName} />}
              {selectedJob.customerPhone && <Detail label="Customer Phone" value={selectedJob.customerPhone} />}
              {selectedJob.orderCode && <Detail label="Cloud Order Code" value={selectedJob.orderCode} />}
              <Detail label="Shop Identifier" value={selectedJob.shopId} />
            </div>

            {/* Documents List */}
            <div className="space-y-2 border-t border-[var(--border-default)] pt-3">
              <h3 className="text-xs font-bold text-[var(--text-primary)]">Assigned Document Files ({selectedJob.files.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedJob.files.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] space-y-1"
                  >
                    <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                      <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="truncate">{file.fileName}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--text-muted)] pt-1">
                      <span>Pages: <strong className="text-[var(--text-secondary)]">{file.pageCount}</strong></span>
                      <span>Copies: <strong className="text-[var(--text-secondary)]">{file.copies}</strong></span>
                      <span>Color Mode: <strong className="text-[var(--text-secondary)]">{file.colorMode}</strong></span>
                      <span>Paper Tray: <strong className="text-[var(--text-secondary)]">{file.paperSize}</strong></span>
                      <span>Duplex: <strong className="text-[var(--text-secondary)]">{file.duplex ? 'Yes (Double-sided)' : 'No (Simplex)'}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Message if any */}
            {selectedJob.errorMessage && (
              <div
                role="alert"
                className={`p-3.5 rounded-xl border text-xs ${
                  selectedJob.printStatus === 'MANUAL_ATTENTION'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300'
                }`}
              >
                {selectedJob.printStatus === 'MANUAL_ATTENTION' && (
                  <p className="mb-1 flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Requires Manual Shop Inspection</span>
                  </p>
                )}
                <p className="font-mono text-[11px] leading-relaxed">{formatPrintError(selectedJob.errorMessage)}</p>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-[var(--border-default)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="secondary-button"
              >
                Close
              </button>
              {selectedJob.printStatus === 'FAILED' && selectedJob.retrySafe && (
                <button
                  type="button"
                  onClick={() => {
                    retry(selectedJob);
                    setSelectedJob(null);
                  }}
                  className="primary-button"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Printing</span>
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
};

const Detail: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--border-subtle)] text-xs">
    <span className="text-[var(--text-muted)]">{label}</span>
    <span className="text-right font-medium text-[var(--text-secondary)] truncate max-w-[280px]">{value}</span>
  </div>
);
