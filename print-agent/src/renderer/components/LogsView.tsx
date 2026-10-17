import React, { useEffect, useRef, useState } from 'react';
import { AgentLogEntry } from '../types/agent';
import { Terminal, Search, Trash2, Download, CheckCircle2, Pause, Play } from 'lucide-react';

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
    if (autoScroll && !isPaused && listRef.current) listRef.current.scrollTop = 0;
  }, [autoScroll, isPaused, displayedLogs]);

  const filteredLogs = displayedLogs.filter((l) => {
    if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
    if (categoryFilter !== 'ALL' && l.category !== categoryFilter) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase()) && !l.category.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleExport = async () => {
    setExportError(null);
    try {
      const res = await onExportLogs();
      if (res.success && res.filePath) {
        setCopiedNotification(`Sanitized logs saved to: ${res.filePath}`);
        setTimeout(() => setCopiedNotification(null), 4000);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export logs.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs font-semibold">
            {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  levelFilter === lvl ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <select aria-label="Filter by log category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)} className="settings-input w-auto">
            <option value="ALL">All categories</option>
            {(['AGENT', 'SPOOLER', 'NETWORK', 'AUTH', 'RECOVERY', 'STORAGE'] as const).map((category) => <option key={category} value={category}>{category}</option>)}
          </select>

          <button type="button" onClick={() => setIsPaused((value) => !value)} className="secondary-button" aria-pressed={isPaused}>
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{isPaused ? 'Resume' : 'Pause'}
          </button>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <input type="checkbox" checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} className="accent-blue-500" />Auto-scroll
          </label>

          <button
            onClick={handleExport}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Save a sanitized export of recent logs"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm('Clear the visible recent-log buffer? Persisted recovery records and log files will not be deleted.')) {
                onClearLogs();
                setDisplayedLogs([]);
              }
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Clear visible log buffer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {copiedNotification && (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="truncate">{copiedNotification}</span>
        </div>
      )}
      {exportError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{exportError}</p>}

      {/* Terminal Output */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs overflow-hidden shadow-inner">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-slate-400">Desktop Spooler & M2M Service Console</span>
          </div>
          <span>Showing {filteredLogs.length} events</span>
        </div>

        <div ref={listRef} className="space-y-1 max-h-[460px] overflow-y-auto pr-1">
          {filteredLogs.length === 0 ? (
            <p className="text-slate-600 py-8 text-center">No log entries recorded for this filter.</p>
          ) : (
            filteredLogs.map((log) => {
              let color = 'text-slate-300';
              if (log.level === 'WARN') color = 'text-amber-400';
              if (log.level === 'ERROR') color = 'text-red-400';
              if (log.level === 'DEBUG') color = 'text-slate-500';

              return (
                <div key={log.id} className="leading-relaxed hover:bg-slate-900/60 p-1 rounded transition-colors">
                  <span className="text-slate-600 mr-2 text-[10px]">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span
                    className={`font-bold mr-2 text-[10px] px-1 py-0.2 rounded ${
                      log.level === 'ERROR'
                        ? 'bg-red-500/20 text-red-400'
                        : log.level === 'WARN'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-800 text-blue-400'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="text-slate-500 mr-2 text-[11px]">[{log.category}]</span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
