import React from 'react';
import { AgentConfig, AgentConnectionStatus } from '../types/agent';
import { AgentStatusBadge } from './StatusBadge';
import { Printer, RefreshCw, Settings, Minus } from 'lucide-react';
import packageMetadata from '../../../package.json';

interface HeaderProps {
  status: AgentConnectionStatus;
  lastHeartbeat: string | null;
  config: AgentConfig;
  isPolling: boolean;
  onPollNow: () => void;
  onOpenSettings: () => void;
  onMinimizeToTray: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  lastHeartbeat,
  config,
  isPolling,
  onPollNow,
  onOpenSettings,
  onMinimizeToTray
}) => {
  return (
    <header className="agent-topbar bg-slate-900/90 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
      {/* Brand & Connection Details */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <Printer className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white tracking-wide">PrintFlow Desktop Agent</h1>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              v{packageMetadata.version}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            <span className="font-semibold text-slate-300">{config.shopSlug || config.shopId}</span>
            <span>•</span>
            <span className="font-mono text-[11px] text-slate-400">{config.deviceName || 'Terminal'}</span>
            <span aria-label="Last successful heartbeat" title={lastHeartbeat ? new Date(lastHeartbeat).toLocaleString() : 'No successful heartbeat recorded'} className="hidden md:inline text-[10px] text-slate-500">
              • Heartbeat {lastHeartbeat ? new Date(lastHeartbeat).toLocaleTimeString() : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Status Pill & Quick Action Bar */}
      <div className="flex items-center gap-2.5">
        <AgentStatusBadge status={status} />

        <button
          onClick={onPollNow}
          disabled={isPolling}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          title="Force poll cloud queue"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-blue-400' : ''}`} />
          <span className="hidden sm:inline">Check Jobs</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors cursor-pointer"
          title="Setup and credentials"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onMinimizeToTray}
          className="p-2 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 rounded-xl transition-colors cursor-pointer ml-1"
          title="Minimize to System Tray"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
