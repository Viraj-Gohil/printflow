import React from 'react';
import { AgentConnectionStatus, JobPrintStatus } from '../types/agent';
import { CheckCircle2, Clock, Loader2, AlertCircle, Printer, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';

export { cn };

export const AgentStatusBadge: React.FC<{ status: AgentConnectionStatus; className?: string }> = ({ status, className }) => {
  switch (status) {
    case 'ONLINE':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide',
            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25',
            'transition-colors duration-200',
            className
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-semibold text-[11px] uppercase tracking-wider">Online</span>
        </span>
      );
    case 'CONNECTING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25',
            'transition-colors duration-200',
            className
          )}
        >
          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
          <span className="font-semibold text-[11px] uppercase tracking-wider">Connecting...</span>
        </span>
      );
    case 'ERROR':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25',
            'transition-colors duration-200',
            className
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          <span className="font-semibold text-[11px] uppercase tracking-wider">Sync Error</span>
        </span>
      );
    case 'OFFLINE':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/25',
            'transition-colors duration-200',
            className
          )}
        >
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="font-semibold text-[11px] uppercase tracking-wider">Offline</span>
        </span>
      );
  }
};

export const JobStatusBadge: React.FC<{ status: JobPrintStatus; className?: string }> = ({ status, className }) => {
  switch (status) {
    case 'COMPLETED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25',
            className
          )}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>Printed</span>
        </span>
      );
    case 'PRINTING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
            'bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-500/30',
            'shadow-xs shadow-teal-500/10',
            className
          )}
        >
          <Printer className="w-3 h-3 text-teal-500 animate-pulse" />
          <span className="font-medium">Spooling...</span>
        </span>
      );
    case 'DOWNLOADING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
            'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25',
            className
          )}
        >
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
          <span>Downloading</span>
        </span>
      );
    case 'ASSIGNED':
    case 'QUEUED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25',
            className
          )}
        >
          <Clock className="w-3 h-3 text-amber-500" />
          <span>In Queue</span>
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
            'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25',
            className
          )}
        >
          <AlertCircle className="w-3 h-3 text-red-500" />
          <span>Failed</span>
        </span>
      );
    case 'MANUAL_ATTENTION':
    case 'REQUIRES_ATTENTION':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
            'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35',
            className
          )}
        >
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span>Needs Review</span>
        </span>
      );
    case 'CANCELLED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
            'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/25',
            className
          )}
        >
          <XCircle className="w-3 h-3 text-slate-400" />
          <span>Cancelled</span>
        </span>
      );
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
            'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
            className
          )}
        >
          <span>{status}</span>
        </span>
      );
  }
};
