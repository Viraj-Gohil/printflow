import React, { useState } from 'react';
import { AgentConfig, AgentConnectionStatus, DiscoveredPrinter, PrintJobItem, QueueMetrics } from '../types/agent';
import { formatPrintError } from '../utils/printError';
import { JobStatusBadge } from './StatusBadge';
import { Printer, Clock, CheckCircle2, Cpu, ShieldCheck, ArrowRight, AlertTriangle, FileText, Sparkles, RefreshCw, Copy, Check } from 'lucide-react';

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
    if (!config.shopDetails?.shopId) return;
    if (window.electronAgentAPI?.copyText) {
      await window.electronAgentAPI.copyText(config.shopDetails.shopId);
    } else {
      await navigator.clipboard.writeText(config.shopDetails.shopId);
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
  const recentJobs = jobs.slice(0, 5);

  const onlinePrintersCount = printers.filter((p) => p.isOnline).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* SHOP & SUBSCRIPTION STATUS BANNER */}
      {config.shopDetails && (
        <div className="pf-card p-4 bg-gradient-to-r from-blue-500/10 via-[var(--bg-surface)] to-[var(--bg-surface)] border-l-4 border-l-blue-600 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-2xs">
              {config.shopDetails.shopName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{config.shopDetails.shopName}</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  {config.shopDetails.planName} Plan
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    config.shopDetails.shopStatus === 'ACTIVE' && (config.shopDetails.planStatus === 'ACTIVE' || config.shopDetails.planStatus === 'TRIAL')
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  }`}
                >
                  {config.shopDetails.planStatus}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono flex items-center gap-1.5 flex-wrap">
                <span>ID: {config.shopDetails.shopId}</span>
                <button
                  type="button"
                  onClick={handleCopyShopId}
                  title="Copy full canonical Shop ID UUID"
                  className="p-1 rounded hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedShopId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[10px] text-emerald-500 font-sans font-semibold">Copied!</span>
                    </>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <span>• Slug: /{config.shopDetails.shopSlug}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="text-right hidden sm:block">
              <span className="text-[var(--text-muted)] text-[11px] block">Plan Printers</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {config.shopDetails.registeredCount} / {config.shopDetails.printerLimit} Registered
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('PRINTERS')}
              className="secondary-button !py-1 !px-2.5 !text-xs font-semibold cursor-pointer"
            >
              Hardware →
            </button>
          </div>
        </div>
      )}

      {/* RESTRICTION WARNING BANNER */}
      {((config.shopDetails && !config.shopDetails.isOperational) || status === 'RESTRICTED' || status === 'UNAUTHORIZED') && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm">Shop Subsystem Restricted</p>
            <p className="leading-relaxed">
              {config.shopDetails?.restrictionReason ||
                'Your shop account or subscription status requires attention in the Web Dashboard before processing new print jobs.'}
            </p>
          </div>
        </div>
      )}

      {/* 1. TOP METRICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Queue Backlog */}
        <div className="pf-card p-4 relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Queue Backlog</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[var(--text-primary)] mt-3 font-mono tracking-tight">
            {metrics.queuedJobs}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[var(--text-muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Awaiting spooler</span>
          </div>
        </div>

        {/* Card 2: Active Spooling */}
        <div className="pf-card p-4 relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Active Spooling</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[var(--text-primary)] mt-3 font-mono tracking-tight">
            {metrics.printingJobs}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[var(--text-muted)]">
            <span className={`w-1.5 h-1.5 rounded-full ${metrics.printingJobs > 0 ? 'bg-teal-500 animate-ping' : 'bg-slate-400'}`} />
            <span>{metrics.printingJobs > 0 ? 'Printing right now' : 'Spooler idle'}</span>
          </div>
        </div>

        {/* Card 3: Completed Jobs */}
        <div className="pf-card p-4 relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Completed Orders</span>
            <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-[var(--text-primary)] mt-3 font-mono tracking-tight">
            {metrics.completedJobs}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[var(--text-muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>Printed successfully</span>
          </div>
        </div>

        {/* Card 4: Discovered Printers */}
        <div className="pf-card p-4 relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Windows Printers</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <p className="text-3xl font-extrabold text-[var(--text-primary)] font-mono tracking-tight">{printers.length}</p>
            <span className="text-xs text-[var(--text-muted)]">({onlinePrintersCount} online)</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5 truncate" title={config.selectedPrinterName || 'System Default'}>
            Target: <span className="font-semibold text-[var(--text-secondary)]">{config.selectedPrinterName ? config.selectedPrinterName : 'OS Default'}</span>
          </p>
        </div>
      </div>

      {/* 2. ACTIVE JOB SPOTLIGHT (WHEN PRINTING/DOWNLOADING) */}
      {activeJob && (
        <div className="pf-card border-l-4 border-l-blue-600 p-5 space-y-4 bg-gradient-to-r from-blue-500/5 via-[var(--bg-surface)] to-[var(--bg-surface)] shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                  <span>Currently Processing Print Job</span>
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </h2>
                <span className="text-xs text-[var(--text-muted)]">Live Windows Spooler Execution</span>
              </div>
            </div>
            <JobStatusBadge status={activeJob.printStatus} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[var(--bg-subtle)] p-3.5 rounded-xl border border-[var(--border-default)]">
            <div>
              <span className="text-[var(--text-muted)] text-[11px] font-medium">Order Reference:</span>
              <p className="font-bold font-mono text-[var(--text-primary)] mt-0.5 truncate">{activeJob.id}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)] text-[11px] font-medium">Assigned Printer:</span>
              <p className="font-bold text-[var(--text-secondary)] mt-0.5 truncate">{activeJob.printerName || 'Auto-assigning...'}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)] text-[11px] font-medium">Document File:</span>
              <p className="font-bold text-cyan-600 dark:text-cyan-400 truncate mt-0.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{activeJob.files[0]?.fileName || 'Document.pdf'}</span>
              </p>
            </div>
          </div>

          {activeProgress !== undefined && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-[var(--text-secondary)] font-medium">
                <span>
                  {activeJob.printStatus === 'DOWNLOADING'
                    ? 'Retrieving encrypted document payload...'
                    : 'Transmitting raster data to Windows Print Spooler...'}
                </span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{activeProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)] border border-[var(--border-default)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, activeProgress))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. RECENT ACTIVITY & HARDWARE INTEGRATION STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Recent Jobs Table */}
        <div className="lg:col-span-2 pf-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--border-default)]">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Print Queue</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Automated spool jobs handled by this station</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('QUEUE')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Queue ({jobs.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentJobs.length === 0 ? (
            <div className="py-12 text-center space-y-3 border border-dashed border-[var(--border-default)] rounded-xl bg-[var(--bg-subtle)]">
              <Printer className="w-9 h-9 text-[var(--text-faint)] mx-auto" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-secondary)]">Queue is currently clear</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">No pending or recent print jobs stored locally.</p>
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
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[var(--text-primary)]">{job.id}</span>
                      {job.printerName && (
                        <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.2 rounded bg-[var(--bg-subtle)] border border-[var(--border-default)] truncate">
                          {job.printerName}
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[var(--text-secondary)] truncate mt-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[var(--text-faint)] shrink-0" />
                      <span className="font-medium truncate">{job.files[0]?.fileName || 'Document'}</span>
                      <span className="text-[var(--text-faint)]">
                        ({job.files[0]?.paperSize || 'A4'}, {job.files[0]?.colorMode || 'BW'}, {job.files[0]?.copies || 1} {job.files[0]?.copies === 1 ? 'copy' : 'copies'})
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)]">
                      <span>{new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                    {job.errorMessage && (
                      <p className="mt-1 truncate text-[10.5px] text-red-600 dark:text-red-400 font-medium" title={formatPrintError(job.errorMessage)}>
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

        {/* Right Column: Hardware Health & Security */}
        <div className="space-y-4">
          {/* Installed Printers Summary Card */}
          <div className="pf-card p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-1 border-b border-[var(--border-default)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Discovered Printers</h3>
                <span className="text-[11px] text-[var(--text-muted)]">{printers.length} installed Windows devices</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('PRINTERS')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Manage →
              </button>
            </div>

            <div className="space-y-2">
              {printers.slice(0, 3).map((p) => (
                <div
                  key={p.name}
                  className="p-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-[var(--text-primary)] truncate">{p.displayName}</p>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {p.capabilities.supportsColor ? 'Color' : 'Monochrome'} • {p.capabilities.supportsDuplex ? 'Duplex' : 'Simplex'}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      p.isOnline
                        ? 'border-green-500/25 bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
              {printers.length === 0 && (
                <p className="rounded-xl border border-dashed border-[var(--border-default)] p-4 text-center text-xs text-[var(--text-muted)]">
                  No Windows printers detected. Rescan in Printers tab.
                </p>
              )}
            </div>
          </div>

          {/* M2M Hardware Security Shield */}
          <div className="pf-card p-4 text-xs space-y-2.5 border-l-4 border-l-teal-600">
            <div className={`flex items-center gap-2 font-bold ${config.hasStoredCredentials ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}`}>
              <ShieldCheck className="w-4 h-4" />
              <span>{config.hasStoredCredentials ? 'Windows Protected Credential' : 'Credentials Unsecured'}</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {lastHeartbeat
                ? `Last authenticated heartbeat: ${new Date(lastHeartbeat).toLocaleTimeString()}. `
                : 'No recent authenticated heartbeat. '}
              Device tokens are securely isolated in Windows safeStorage DPAPI vault.
            </p>
          </div>

          {/* Attention Required Banner */}
          {(metrics.manualAttentionJobs || 0) > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold">Attention Required</p>
                <p className="text-[11px] mt-0.5">
                  {metrics.manualAttentionJobs} {metrics.manualAttentionJobs === 1 ? 'job needs' : 'jobs need'} manual confirmation before re-printing.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
