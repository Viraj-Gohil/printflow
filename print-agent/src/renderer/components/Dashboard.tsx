import React from 'react';
import { AgentConfig, AgentConnectionStatus, DiscoveredPrinter, PrintJobItem, QueueMetrics } from '../types/agent';
import { formatPrintError } from '../utils/printError';
import { JobStatusBadge } from './StatusBadge';
import { Printer, Clock, CheckCircle2, Cpu, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';

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
  const activeJob = jobs.find((j) => j.printStatus === 'PRINTING' || j.printStatus === 'DOWNLOADING');
  const activeProgress = activeJob
    ? activeJob.printStatus === 'DOWNLOADING' ? activeJob.downloadProgress : activeJob.printProgress
    : undefined;
  const recentJobs = jobs.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 1. TOP METRICS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Queue Backlog */}
        <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Queue Backlog</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2 font-mono">{metrics.queuedJobs}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Awaiting print spooler</span>
        </div>

        {/* Card 2: Active Spooling */}
        <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Spooling</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2 font-mono">{metrics.printingJobs}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Printing right now</span>
        </div>

        {/* Card 3: Completed Jobs */}
        <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completed Orders</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2 font-mono">{metrics.completedJobs}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Successfully printed</span>
        </div>

        {/* Card 4: Discovered Printers */}
        <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Windows Printers</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-2 font-mono">{printers.length}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {config.selectedPrinterName ? 'Selected: ' + config.selectedPrinterName.slice(0, 14) + '...' : 'System default'}
          </span>
        </div>
      </div>

      {/* 2. ACTIVE JOB SPOTLIGHT (IF PRINTING) */}
      {activeJob && (
        <div className="bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-blue-500/40 p-5 rounded-2xl space-y-3 relative overflow-hidden shadow-lg shadow-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Currently Processing Print Job</h2>
            </div>
            <JobStatusBadge status={activeJob.printStatus} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-blue-500/20">
            <div>
              <span className="text-slate-400 text-[11px]">Order Code:</span>
              <p className="font-bold font-mono text-white mt-0.5">{activeJob.id}</p>
            </div>
            <div>
            <span className="text-slate-400 text-[11px]">Printer:</span>
            <p className="font-bold text-slate-200 mt-0.5">{activeJob.printerName || 'Target pending'}</p>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Target File:</span>
              <p className="font-bold text-blue-400 truncate mt-0.5">{activeJob.files[0]?.fileName || 'Document.pdf'}</p>
            </div>
          </div>

          {activeProgress !== undefined && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>{activeJob.printStatus === 'DOWNLOADING' ? 'Downloading document' : 'Sending job to the Windows Print Spooler'}</span>
                <span className="font-mono font-bold text-blue-400">
                  {activeProgress}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full border border-slate-700/80 bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, activeProgress))}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. RECENT ACTIVITY & HARDWARE INTEGRATION STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Recent Jobs Table */}
        <div className="lg:col-span-2 bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Recent Print Jobs</h3>
              <p className="text-xs text-slate-400 mt-0.5">Automated queue handled by this terminal</p>
            </div>
            <button
              onClick={() => onNavigateTab('QUEUE')}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Queue ({jobs.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentJobs.length === 0 ? (
            <div className="py-10 text-center space-y-2 border border-dashed border-slate-700/60 rounded-xl">
              <Printer className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No print jobs in local queue.</p>
              <button
                onClick={onPollNow}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Poll Cloud for Paid Orders
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 p-3 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{job.id}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {job.files[0]?.fileName} ({job.files[0]?.paperSize || 'A4'}, {job.files[0]?.colorMode || 'BW'}, {job.files[0]?.copies || 1} copy)
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">{new Date(job.createdAt).toLocaleString()} {job.printerName ? `· ${job.printerName}` : ''}</p>
                    {job.errorMessage && <p className="mt-1 truncate text-[10px] text-red-300" title={formatPrintError(job.errorMessage)}>{formatPrintError(job.errorMessage)}</p>}
                  </div>
                  <JobStatusBadge status={job.printStatus} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Windows Printer Health & M2M Security */}
        <div className="space-y-4">
          {/* Hardware Summary Card */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Installed Printers</h3>
              <button
                onClick={() => onNavigateTab('PRINTERS')}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
              >
                Manage →
              </button>
            </div>

            <div className="space-y-2">
              {printers.slice(0, 3).map((p) => (
                <div
                  key={p.name}
                  className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/40 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-200 truncate">{p.displayName}</p>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {p.capabilities.supportsColor === null ? 'Color unknown' : p.capabilities.supportsColor ? 'Color capable' : 'Monochrome'} • {p.capabilities.supportsDuplex === null ? 'Duplex unknown' : p.capabilities.supportsDuplex ? 'Duplex capable' : 'Simplex'}
                    </span>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${p.isOnline ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                    {p.status}
                  </span>
                </div>
              ))}
              {printers.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">No Windows printers found. Rescan from Printers.</p>}
            </div>
          </div>

          {/* M2M Hardware Security Shield */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 text-xs space-y-2">
            <div className={`flex items-center gap-2 font-bold ${config.hasStoredCredentials ? 'text-emerald-400' : 'text-amber-300'}`}>
              <ShieldCheck className="w-4 h-4" />
              <span>{config.hasStoredCredentials ? 'Device credential saved' : 'Device credential not saved'}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {lastHeartbeat ? `Last authenticated heartbeat: ${new Date(lastHeartbeat).toLocaleString()}. ` : 'No successful authenticated heartbeat recorded. '}
              The credential is kept out of renderer state and encrypted through Electron safeStorage. Agent connection state: {status.toLowerCase()}.
            </p>
          </div>
          {(metrics.manualAttentionJobs || 0) > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{metrics.manualAttentionJobs} job{metrics.manualAttentionJobs === 1 ? '' : 's'} need manual review before any reprint.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
