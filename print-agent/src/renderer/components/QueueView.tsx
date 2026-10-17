import React, { useMemo, useState } from 'react';
import { DiscoveredPrinter, PrintJobItem } from '../types/agent';
import { formatPrintError } from '../utils/printError';
import { JobStatusBadge } from './StatusBadge';
import { AlertTriangle, FileText, Printer, RefreshCw, Search, Trash2 } from 'lucide-react';

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

  const filtered = useMemo(() => jobs
    .filter((job) => {
      const query = search.trim().toLowerCase();
      const matchesQuery = !query ||
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
    }), [jobs, search, filter, printerFilter, sortOrder]);

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
    if (job.retrySafe && window.confirm(`Retry ${job.id}? The agent confirmed the previous failure occurred before printing began.`)) {
      onReprintJob(job.id);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="search"
              aria-label="Search jobs by job ID or filename"
              placeholder="Search job ID or filename…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="settings-input pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Filter jobs by printer" value={printerFilter} onChange={(event) => setPrinterFilter(event.target.value)} className="settings-input w-auto min-w-36">
              <option value="">All printers</option>
              {printers.map((printer) => <option key={printer.name} value={printer.name}>{printer.displayName}</option>)}
              <option value="__unassigned__">Unassigned</option>
            </select>
            <select aria-label="Sort jobs by creation time" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'NEWEST' | 'OLDEST')} className="settings-input w-auto">
              <option value="NEWEST">Newest first</option>
              <option value="OLDEST">Oldest first</option>
            </select>
            <button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="secondary-button disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />Refresh jobs
            </button>
            <button type="button" onClick={() => {
              if (window.confirm('Remove completed and cancelled jobs from this local view? Recovery data for active jobs will remain.')) onClearCompleted();
            }} className="secondary-button" title="Remove completed and cancelled local job history">
              <Trash2 className="h-4 w-4" />Clear history
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter jobs by status">
          {(['ALL', 'QUEUED', 'PRINTING', 'COMPLETED', 'FAILED', 'MANUAL_ATTENTION'] as const).map((tab) => (
            <button
              type="button"
              key={tab}
              aria-pressed={filter === tab}
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${filter === tab ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            >
              {tab === 'MANUAL_ATTENTION' ? 'Needs review' : tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/40">
        {filtered.length === 0 ? (
          <div className="space-y-3 py-16 text-center">
            <Printer className="mx-auto h-10 w-10 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-300">{jobs.length ? 'No jobs match these filters' : 'No print jobs recorded'}</h3>
            <p className="mx-auto max-w-sm text-xs text-slate-500">Refresh the queue to check the paired PrintFlow backend for authorized jobs.</p>
            <button type="button" onClick={() => void refresh()} disabled={isRefreshing} className="primary-button mx-auto">
              <RefreshCw className="h-4 w-4" />Check cloud queue
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="border-b border-slate-700/60 bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Job ID</th>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Printer</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filtered.map((job) => {
                  const isQueued = job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED';
                  const isSafeToRetry = job.printStatus === 'FAILED' && job.retrySafe === true;
                  const fileName = job.files[0]?.fileName || 'File name unavailable';
                  const progress = job.printStatus === 'DOWNLOADING'
                    ? job.downloadProgress
                    : job.printStatus === 'PRINTING'
                      ? job.printProgress
                      : undefined;
                  return (
                    <tr key={job.id} className="hover:bg-slate-800/70">
                      <td className="px-4 py-3.5 font-mono font-semibold text-white">{job.id}</td>
                      <td className="max-w-xs px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                          <button type="button" onClick={() => setSelectedJob(job)} className="truncate text-left text-slate-200 hover:text-blue-300" title="Open job details">{fileName}</button>
                        </div>
                        {job.errorMessage && <p className="mt-1 truncate text-[10px] text-red-300" title={job.errorMessage}>{job.errorMessage}</p>}
                        {progress !== undefined && (
                          <p className="mt-1 text-[10px] text-blue-300">
                            {job.printStatus === 'DOWNLOADING' ? `Download ${progress}%` : `Print ${progress}%`}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">{job.printerName || 'Not assigned'}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-400">{new Date(job.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3.5"><JobStatusBadge status={job.printStatus} /></td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => setSelectedJob(job)} className="secondary-button px-2.5 py-1.5">Details</button>
                          {isQueued && <button type="button" onClick={() => onCancelJob(job.id)} className="danger-button px-2.5 py-1.5">Cancel</button>}
                          {isSafeToRetry && <button type="button" onClick={() => retry(job)} className="primary-button px-2.5 py-1.5">Retry</button>}
                          {job.printStatus === 'MANUAL_ATTENTION' && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300"><AlertTriangle className="h-3.5 w-3.5" />Review first</span>}
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

      {selectedJob && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedJob(null);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="job-detail-title" className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="job-detail-title" className="text-base font-bold text-white">Job details</h2><p className="mt-1 break-all font-mono text-xs text-slate-400">{selectedJob.id}</p></div>
              <button type="button" onClick={() => setSelectedJob(null)} className="secondary-button px-2.5 py-1.5">Close</button>
            </div>
            <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-400">Status</span><JobStatusBadge status={selectedJob.printStatus} /></div>
            <Detail label="Created" value={new Date(selectedJob.createdAt).toLocaleString()} />
            <Detail label="Printer" value={selectedJob.printerName || 'Not assigned'} />
            <div className="space-y-2 border-t border-slate-700 pt-3">
              <h3 className="text-xs font-semibold text-slate-300">Documents</h3>
              {selectedJob.files.map((file) => <div key={file.id} className="rounded-lg bg-slate-800 p-3 text-xs text-slate-200">{file.fileName}<span className="mt-1 block text-[11px] text-slate-500">{file.pageCount} pages · {file.copies} copies · {file.paperSize} · {file.colorMode}</span></div>)}
            </div>
            {selectedJob.errorMessage && (
              <div role="alert" className={`break-words whitespace-pre-wrap rounded-xl border p-3 text-xs ${selectedJob.printStatus === 'MANUAL_ATTENTION' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>
                {selectedJob.printStatus === 'MANUAL_ATTENTION' && <p className="mb-1 flex items-center gap-1.5 font-bold"><AlertTriangle className="h-3.5 w-3.5" />Manual attention required</p>}
                {formatPrintError(selectedJob.errorMessage)}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
};

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2 text-xs">
    <span className="text-slate-500">{label}</span><span className="text-right text-slate-200">{value}</span>
  </div>
);
