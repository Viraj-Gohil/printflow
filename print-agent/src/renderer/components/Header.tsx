import React from 'react';
import { AgentConfig, AgentConnectionStatus } from '../types/agent';
import { AgentStatusBadge } from './StatusBadge';
import { Printer, RefreshCw, Settings, Minus, Sun, Moon, Store, Laptop } from 'lucide-react';
import { useTheme, ThemePreference } from '../context/ThemeContext';
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
    <header className="agent-topbar px-5 py-2.5 flex items-center justify-between border-b border-[var(--border-default)] transition-colors">
      {/* Brand & Terminal Meta */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-cyan-500 text-white flex items-center justify-center shadow-sm shadow-blue-600/30 shrink-0">
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

        {/* Manual Poll Button (Cyan Highlight) */}
        <button
          type="button"
          onClick={onPollNow}
          disabled={isPolling}
          className="secondary-button !min-h-[32px] !py-1 !px-2.5 text-xs font-semibold"
          title="Force poll cloud queue immediately"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 ${isPolling ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline font-medium">{isPolling ? 'Checking...' : 'Check Jobs'}</span>
        </button>

        {/* 3-Mode Theme Selector (Light, Dark, System) */}
        <div
          role="group"
          aria-label="Appearance Mode"
          className="flex items-center p-0.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]"
        >
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-1 rounded-md transition-colors ${
              theme === 'light'
                ? 'bg-[var(--bg-surface)] text-amber-500 shadow-xs'
                : 'text-[var(--text-faint)] hover:text-[var(--text-primary)]'
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
                ? 'bg-[var(--bg-surface)] text-blue-400 shadow-xs'
                : 'text-[var(--text-faint)] hover:text-[var(--text-primary)]'
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
                ? 'bg-[var(--bg-surface)] text-cyan-500 shadow-xs'
                : 'text-[var(--text-faint)] hover:text-[var(--text-primary)]'
            }`}
            title={`System Theme (${resolvedTheme === 'dark' ? 'Dark OS' : 'Light OS'})`}
            aria-pressed={theme === 'system'}
            aria-label="System Theme (Follow OS)"
          >
            <Laptop className="w-3.5 h-3.5" />
          </button>
        </div>

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
