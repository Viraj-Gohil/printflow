import React from 'react';
import { AgentConfig, AgentConnectionStatus } from '../types/agent';
import { AgentStatusBadge } from './StatusBadge';
import { Printer, RefreshCw, Settings, Minus, Sun, Moon, Store, Laptop } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
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
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <header className="agent-topbar px-6 py-3 flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] transition-colors">
      {/* Brand & Terminal Meta */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-xs shrink-0">
          <Printer className="w-5 h-5 stroke-[2]" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-[#0F172A] dark:text-white tracking-tight">
              PrintFlow <span className="font-medium text-[#64748B] dark:text-slate-400">Agent</span>
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 border border-[#E2E8F0] dark:border-slate-700">
              v{packageMetadata.version}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11.5px] text-[#64748B] dark:text-slate-400 mt-0.5 min-w-0">
            <span className="inline-flex items-center gap-1 font-medium text-[#475569] dark:text-slate-300 truncate">
              <Store className="w-3 h-3 text-[#94A3B8] shrink-0" />
              {config.shopDetails?.shopName || config.shopSlug || config.shopId || 'Unlinked Shop'}
            </span>
            <span className="text-[#CBD5E1] dark:text-slate-700">•</span>
            <span className="inline-flex items-center gap-1 font-mono text-[#64748B] dark:text-slate-400 truncate">
              <Laptop className="w-3 h-3 text-[#94A3B8] shrink-0" />
              {config.deviceName || 'Desktop PC'}
            </span>
            {lastHeartbeat && (
              <>
                <span className="hidden sm:inline text-[#CBD5E1] dark:text-slate-700">•</span>
                <span
                  className="hidden sm:inline text-[11px] text-[#94A3B8] dark:text-slate-500"
                  title={`Last successful heartbeat: ${new Date(lastHeartbeat).toLocaleString()}`}
                >
                  Heartbeat {new Date(lastHeartbeat).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status & Global Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        <AgentStatusBadge status={status} />

        {/* Manual Poll Button */}
        <button
          type="button"
          onClick={onPollNow}
          disabled={isPolling}
          className="secondary-button !min-h-[32px] !py-1 !px-2.5 text-xs font-semibold"
          title="Force poll cloud queue immediately"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400 ${isPolling ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline font-medium text-[#0F172A] dark:text-slate-200">
            {isPolling ? 'Checking...' : 'Check Jobs'}
          </span>
        </button>

        {/* Theme Selector */}
        <div
          role="group"
          aria-label="Appearance Mode"
          className="flex items-center p-0.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900"
        >
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-1 rounded-md transition-colors ${
              theme === 'light'
                ? 'bg-white text-amber-500 shadow-xs'
                : 'text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
            title="Light Theme"
            aria-pressed={theme === 'light'}
            aria-label="Light Theme"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-1 rounded-md transition-colors ${
              theme === 'dark'
                ? 'bg-[#131D33] text-blue-400 shadow-xs'
                : 'text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
            title="Dark Theme"
            aria-pressed={theme === 'dark'}
            aria-label="Dark Theme"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`p-1 rounded-md transition-colors ${
              theme === 'system'
                ? 'bg-white dark:bg-[#131D33] text-[#2563EB] shadow-xs'
                : 'text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
            title={`System Theme (${resolvedTheme === 'dark' ? 'Dark OS' : 'Light OS'})`}
            aria-pressed={theme === 'system'}
            aria-label="System Theme"
          >
            <Laptop className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-slate-800 transition-colors"
          title="Agent Setup & Connection"
          aria-label="Agent Setup & Connection"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Minimize to Tray */}
        <button
          type="button"
          onClick={onMinimizeToTray}
          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-slate-800 transition-colors"
          title="Minimize to System Tray"
          aria-label="Minimize to System Tray"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
