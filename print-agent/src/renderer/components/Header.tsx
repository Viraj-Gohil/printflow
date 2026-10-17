import React, { useEffect, useState } from 'react';
import { AgentConfig, AgentConnectionStatus } from '../types/agent';
import { AgentStatusBadge } from './StatusBadge';
import { Printer, RefreshCw, Settings, Minus, Sun, Moon, Store, Laptop } from 'lucide-react';
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
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('printflow_agent_theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('printflow_agent_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('printflow_agent_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return (
    <header className="agent-topbar px-5 py-2.5 flex items-center justify-between border-b border-[var(--border-default)] transition-colors">
      {/* Brand & Terminal Meta */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-700 to-teal-500 text-white flex items-center justify-center shadow-sm shadow-teal-700/20 shrink-0">
          <Printer className="w-5 h-5 stroke-[2.2]" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)]">
              PrintFlow <span className="font-normal text-[var(--text-muted)]">Agent</span>
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]">
              v{packageMetadata.version}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11.5px] text-[var(--text-muted)] mt-0.5 min-w-0">
            <span className="inline-flex items-center gap-1 font-medium text-[var(--text-secondary)] truncate">
              <Store className="w-3 h-3 text-[var(--text-faint)] shrink-0" />
              {config.shopSlug || config.shopId || 'Unlinked Shop'}
            </span>
            <span className="text-[var(--border-strong)]">•</span>
            <span className="inline-flex items-center gap-1 font-mono text-[var(--text-muted)] truncate">
              <Laptop className="w-3 h-3 text-[var(--text-faint)] shrink-0" />
              {config.deviceName || 'Terminal'}
            </span>
            {lastHeartbeat && (
              <>
                <span className="hidden sm:inline text-[var(--border-strong)]">•</span>
                <span
                  className="hidden sm:inline text-[10.5px] text-[var(--text-faint)]"
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
      <div className="flex items-center gap-2 shrink-0">
        <AgentStatusBadge status={status} />

        {/* Manual Poll Button */}
        <button
          type="button"
          onClick={onPollNow}
          disabled={isPolling}
          className="secondary-button !min-h-[32px] !py-1 !px-2.5 text-xs font-semibold"
          title="Force poll cloud queue immediately"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${isPolling ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline font-medium">{isPolling ? 'Checking...' : 'Check Jobs'}</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          title="Agent Setup & Configuration"
          aria-label="Agent Setup & Configuration"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Minimize to Tray */}
        <button
          type="button"
          onClick={onMinimizeToTray}
          className="p-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ml-0.5"
          title="Minimize to Windows System Tray"
          aria-label="Minimize to Windows System Tray"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
