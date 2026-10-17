import React from 'react';
import { AgentConnectionStatus, JobPrintStatus } from '../types/agent';
import { CheckCircle2, Clock, Loader2, AlertCircle, Printer, XCircle } from 'lucide-react';

export const AgentStatusBadge: React.FC<{ status: AgentConnectionStatus }> = ({ status }) => {
  switch (status) {
    case 'ONLINE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>CONNECTED (ONLINE)</span>
        </span>
      );
    case 'CONNECTING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>CONNECTING...</span>
        </span>
      );
    case 'ERROR':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
          <AlertCircle className="w-3 h-3" />
          <span>SYNC ERROR</span>
        </span>
      );
    case 'OFFLINE':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          <span>OFFLINE</span>
        </span>
      );
  }
};

export const JobStatusBadge: React.FC<{ status: JobPrintStatus }> = ({ status }) => {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          <span>PRINTED</span>
        </span>
      );
    case 'PRINTING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
          <Printer className="w-3 h-3 animate-bounce" />
          <span>SPOOLING...</span>
        </span>
      );
    case 'DOWNLOADING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>DOWNLOADING</span>
        </span>
      );
    case 'ASSIGNED':
    case 'QUEUED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Clock className="w-3 h-3" />
          <span>IN QUEUE</span>
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
          <AlertCircle className="w-3 h-3" />
          <span>FAILED</span>
        </span>
      );
    case 'MANUAL_ATTENTION':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">
          <AlertCircle className="h-3 w-3" />
          <span>NEEDS REVIEW</span>
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">
          <XCircle className="w-3 h-3" />
          <span>CANCELLED</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-700 text-slate-300">
          <span>{status}</span>
        </span>
      );
  }
};
