import React from 'react';
import { AgentConnectionStatus, JobPrintStatus } from '../types/agent';
import { CheckCircle2, Clock, Loader2, AlertCircle, Printer, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';

export { cn };

export const AgentStatusBadge: React.FC<{ status: AgentConnectionStatus; className?: string }> = ({ status, className }) => {
  switch (status) {
    case 'ONLINE':
    case 'CONNECTED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
            className
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider">Online</span>
        </span>
      );
    case 'CONNECTING':
    case 'RECONNECTING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
            className
          )}
        >
          <Loader2 className="w-3 h-3 animate-spin text-[#F59E0B]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            {status === 'RECONNECTING' ? 'Reconnecting...' : 'Connecting...'}
          </span>
        </span>
      );
    case 'UNAUTHORIZED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
            className
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Unauthorized</span>
        </span>
      );
    case 'RESTRICTED':
    case 'PRINTER_LIMIT_REACHED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
            className
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            {status === 'PRINTER_LIMIT_REACHED' ? 'Limit Reached' : 'Restricted'}
          </span>
        </span>
      );
    case 'ERROR':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
            className
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Error</span>
        </span>
      );
    case 'REVOKED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            'bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3] dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
            className
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 text-[#BE123C]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Session Replaced</span>
        </span>
      );
    case 'DISCONNECTED':
    case 'OFFLINE':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
            className
          )}
        >
          <span className="h-2 w-2 rounded-full bg-[#94A3B8]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Offline</span>
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
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
          <span>Completed</span>
        </span>
      );
    case 'DOWNLOADING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
            className
          )}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
          <span>Downloading</span>
        </span>
      );
    case 'PRINTING':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
            className
          )}
        >
          <Printer className="w-3.5 h-3.5 text-[#2563EB] animate-pulse" />
          <span>Printing</span>
        </span>
      );
    case 'ASSIGNED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-[#F0F9FF] text-[#0369A1] border border-[#BAE6FD] dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
            className
          )}
        >
          <Clock className="w-3.5 h-3.5 text-[#0284C7]" />
          <span>Assigned</span>
        </span>
      );
    case 'QUEUED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
            className
          )}
        >
          <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Queued</span>
        </span>
      );
    case 'MANUAL_ATTENTION':
    case 'REQUIRES_ATTENTION':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-[#FFF7ED] text-[#C2410C] border border-[#FFEDD5] dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
            className
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-[#EA580C]" />
          <span>Requires Attention</span>
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
            className
          )}
        >
          <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
          <span>Failed</span>
        </span>
      );
    case 'CANCELLED':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
            className
          )}
        >
          <XCircle className="w-3.5 h-3.5 text-[#64748B]" />
          <span>Cancelled</span>
        </span>
      );
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
            'bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]',
            className
          )}
        >
          <span>{status}</span>
        </span>
      );
  }
};
