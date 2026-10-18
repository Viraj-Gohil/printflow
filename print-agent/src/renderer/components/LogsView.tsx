import React, { useEffect, useRef, useState } from 'react';
import { AgentLogEntry } from '../types/agent';
import { Terminal, Search, Trash2, Download, CheckCircle2, Pause, Play, X, AlertCircle } from 'lucide-react';

interface LogsViewProps {
  logs: AgentLogEntry[];
  onClearLogs: () => void;
  onExportLogs: () => Promise<{ success: boolean; filePath?: string }>;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs, onClearLogs, onExportLogs }) => {
  const [levelFilter, setLevelFilter] = useState<'ALL' | AgentLogEntry['level']>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AgentLogEntry['category']>('ALL');
  const [search, setSearch] = useState('');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [displayedLogs, setDisplayedLogs] = useState(logs);
  const [exportError, setExportError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPaused) setDisplayedLogs(logs);
  }, [isPaused, logs]);

  useEffect(() => {
    if (autoScroll && !isPaused && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [autoScroll, isPaused, displayedLogs]);

  const filteredLogs = displayedLogs.filter((l) => {
    if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
    if (categoryFilter !== 'ALL' && l.category !== categoryFilter) return false;
    if (
      search &&
      !l.message.toLowerCase().includes(search.toLowerCase()) &&
      !l.category.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleExport = async () => {
    setExportError(null);
    try {
      const res = await onExportLogs();
      if (res.success && res.filePath) {
        setCopiedNotification(`Sanitized logs exported to: ${res.filePath}`);
        setTimeout(() => setCopiedNotification(null), 4000);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export logs.');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Controls Bar */}
      <div className="pf-card p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative min-w-56 flex-1">
            <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search log messages or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="settings-input !pl-9 !text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-[var(--text-faint)] hover:text-[var(--text-primary)]"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by log category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
              className="settings-input pf-form-select !w-auto !text-xs min-w-36"
            >
              <option value="ALL">All Categories</option>
              {(['AGENT', 'SPOOLER', 'NETWORK', 'AUTH', 'RECOVERY', 'STORAGE'] as const).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsPaused((value) => !value)}
              className="secondary-button !min-h-[36px] !text-xs"
              aria-pressed={isPaused}
              title={isPaused ? 'Resume live log stream' : 'Pause live log stream'}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 text-emerald-500" /> : <Pause className="h-3.5 w-3.5 text-amber-500" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] px-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-blue-600"
              />
              <span>Auto-scroll</span>
            </label>

            <button
              type="button"
              onClick={handleExport}
              className="secondary-button !min-h-[36px] !text-xs"
              title="Save a sanitized JSON/text export of recent log records"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Clear the visible recent-log buffer? Persisted log files and crash recovery records will remain untouched.'
                  )
                ) {
                  onClearLogs();
                  setDisplayedLogs([]);
                }
              }}
              className="secondary-button !min-h-[36px] !text-xs text-[var(--text-muted)] hover:text-red-600"
              title="Clear visible logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-default)]">
          {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map((lvl) => {
            const isActive = levelFilter === lvl;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {lvl}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      {copiedNotification && (
        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-xs flex items-center gap-2 font-mono animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />
          <span className="truncate">{copiedNotification}</span>
        </div>
      )}

      {exportError && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-fade-in"
        >
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Terminal View (Exact Dark Page Background #0B1020 & Border #2A344A) */}
      <div className="bg-[#0B1020] border border-[#2A344A] rounded-2xl p-4 font-mono text-xs overflow-hidden shadow-inner text-slate-300">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1f283c] text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-slate-200">Desktop Spooler &amp; M2M Diagnostics Console</span>
            {isPaused && (
              <span className="px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                STREAM PAUSED
              </span>
            )}
          </div>
          <span className="text-slate-400">Showing {filteredLogs.length} events</span>
        </div>

        <div ref={listRef} className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <p className="text-slate-500 py-12 text-center font-sans text-xs">
              No diagnostic events found matching your active filters.
            </p>
          ) : (
            filteredLogs.map((log) => {
              let levelClass = 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
              let textClass = 'text-slate-200';

              if (log.level === 'WARN') {
                levelClass = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
                textClass = 'text-amber-200';
              } else if (log.level === 'ERROR') {
                levelClass = 'bg-red-500/20 text-red-300 border border-red-500/30';
                textClass = 'text-red-200';
              } else if (log.level === 'DEBUG') {
                levelClass = 'bg-slate-700/50 text-slate-400 border border-slate-600/30';
                textClass = 'text-slate-400';
              }

              return (
                <div
                  key={log.id}
                  className="leading-relaxed hover:bg-slate-900/80 p-1.5 rounded transition-colors flex items-start gap-2 text-[11.5px]"
                >
                  <span className="text-slate-500 text-[10px] shrink-0 select-none mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`font-bold text-[9.5px] px-1.5 py-0.2 rounded shrink-0 uppercase ${levelClass}`}>
                    {log.level}
                  </span>
                  <span className="text-cyan-400 text-[11px] shrink-0 font-semibold">[{log.category}]</span>
                  <span className={`break-words ${textClass} flex-1`}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
