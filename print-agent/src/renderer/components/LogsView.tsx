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
    <div className="space-y-5 animate-fade-in">
      {/* Controls Bar */}
      <div className="pf-card p-6 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search log messages or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="settings-input !pl-10 !text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Filter by log category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
              className="settings-input pf-form-select !w-auto !text-xs min-w-[140px]"
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
              className="secondary-button !min-h-[38px] !text-xs font-semibold"
              aria-pressed={isPaused}
              title={isPaused ? 'Resume live log stream' : 'Pause live log stream'}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 text-[#10B981]" /> : <Pause className="h-3.5 w-3.5 text-[#F59E0B]" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <label className="inline-flex items-center gap-2 text-xs text-[#475569] dark:text-slate-300 px-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-[#2563EB]"
              />
              <span>Auto-scroll</span>
            </label>

            <button
              type="button"
              onClick={handleExport}
              className="secondary-button !min-h-[38px] !text-xs font-semibold"
              title="Save a sanitized JSON/text export of recent log records"
            >
              <Download className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear the recent log screen buffer? Persisted crash logs remain safely saved on disk.')) {
                  onClearLogs();
                }
              }}
              className="secondary-button !min-h-[38px] !text-xs font-semibold text-[#64748B] hover:text-[#EF4444]"
              title="Clear visible logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {copiedNotification && (
          <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>{copiedNotification}</span>
          </div>
        )}
        {exportError && (
          <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
            <span>{exportError}</span>
          </div>
        )}
      </div>

      {/* Log Console Window */}
      <div className="pf-card p-5 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] dark:border-slate-800 text-xs text-[#64748B] dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#2563EB]" />
            <span className="font-bold text-[#0F172A] dark:text-white">Diagnostic Stream</span>
            <span>({filteredLogs.length} events)</span>
          </div>
          <span className="text-[11px] font-mono">Tokens &amp; customer documents sanitized</span>
        </div>

        <div
          ref={listRef}
          className="h-[520px] overflow-y-auto space-y-1.5 font-mono text-[11.5px] p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-24 text-center text-[#94A3B8]">
              No log events recorded matching the selected filter.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isError = log.level === 'ERROR';
              const isWarn = log.level === 'WARN';
              return (
                <div
                  key={log.id}
                  className={`p-2 rounded-lg flex items-start gap-2.5 transition-colors leading-relaxed ${
                    isError
                      ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                      : isWarn
                      ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                      : 'hover:bg-white dark:hover:bg-slate-800 text-[#334155] dark:text-slate-300'
                  }`}
                >
                  <span className="text-[#94A3B8] shrink-0 text-[10.5px]">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                      isError
                        ? 'bg-[#EF4444] text-white'
                        : isWarn
                        ? 'bg-[#F59E0B] text-white'
                        : 'bg-[#E2E8F0] dark:bg-slate-800 text-[#475569] dark:text-slate-300'
                    }`}
                  >
                    {log.category}
                  </span>
                  <span className="break-all flex-1">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
