import React, { useEffect, useRef, useState, useMemo } from 'react';
import { AgentLogEntry } from '../types/agent';
import {
  Terminal,
  Search,
  Trash2,
  Download,
  CheckCircle2,
  Pause,
  Play,
  X,
  AlertCircle,
  Clock,
  AlertTriangle,
  Info,
  Copy,
  Check,
  ChevronRight,
  ShieldCheck,
  FileText
} from 'lucide-react';

interface LogsViewProps {
  logs: AgentLogEntry[];
  onClearLogs: () => void;
  onExportLogs: () => Promise<{ success: boolean; filePath?: string }>;
}

type DateFilterMode = 'ALL' | 'TODAY' | 'LAST_24H';

export const LogsView: React.FC<LogsViewProps> = ({ logs, onClearLogs, onExportLogs }) => {
  const [levelFilter, setLevelFilter] = useState<'ALL' | AgentLogEntry['level']>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AgentLogEntry['category']>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('ALL');
  const [search, setSearch] = useState('');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [copiedDetail, setCopiedDetail] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [displayedLogs, setDisplayedLogs] = useState(logs);
  const [selectedLog, setSelectedLog] = useState<AgentLogEntry | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [newEventsWhilePaused, setNewEventsWhilePaused] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const prevLogsLengthRef = useRef(logs.length);

  useEffect(() => {
    if (!isPaused) {
      setDisplayedLogs(logs);
      setNewEventsWhilePaused(0);
    } else {
      const diff = logs.length - prevLogsLengthRef.current;
      if (diff > 0) {
        setNewEventsWhilePaused((prev) => prev + diff);
      }
    }
    prevLogsLengthRef.current = logs.length;
  }, [isPaused, logs]);

  useEffect(() => {
    if (autoScroll && !isPaused && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [autoScroll, isPaused, displayedLogs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedLog) {
        setSelectedLog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLog]);

  // Log summary counts
  const counts = useMemo(() => {
    const info = logs.filter((l) => l.level === 'INFO').length;
    const warn = logs.filter((l) => l.level === 'WARN').length;
    const error = logs.filter((l) => l.level === 'ERROR').length;
    return {
      total: logs.length,
      info,
      warn,
      error
    };
  }, [logs]);

  // Filtered log entries
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const todayStart = new Date().setHours(0, 0, 0, 0);

    return displayedLogs.filter((l) => {
      if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
      if (categoryFilter !== 'ALL' && l.category !== categoryFilter) return false;

      const logTime = new Date(l.timestamp).getTime();
      if (dateFilter === 'TODAY' && logTime < todayStart) return false;
      if (dateFilter === 'LAST_24H' && now - logTime > twentyFourHours) return false;

      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchesMsg = l.message.toLowerCase().includes(query);
        const matchesCat = l.category.toLowerCase().includes(query);
        const matchesLvl = l.level.toLowerCase().includes(query);
        const matchesDetails = l.details ? JSON.stringify(l.details).toLowerCase().includes(query) : false;
        if (!matchesMsg && !matchesCat && !matchesLvl && !matchesDetails) return false;
      }
      return true;
    });
  }, [displayedLogs, levelFilter, categoryFilter, dateFilter, search]);

  const latestTimestamp = logs[0] ? new Date(logs[0].timestamp).toLocaleTimeString() : 'N/A';

  const handleExport = async () => {
    setExportError(null);
    try {
      const res = await onExportLogs();
      if (res.success && res.filePath) {
        setCopiedNotification(`Sanitized log export created: ${res.filePath}`);
        setTimeout(() => setCopiedNotification(null), 4000);
      } else {
        setExportError('Log export completed.');
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export logs.');
    }
  };

  const handleCopyLogDetails = async (log: AgentLogEntry) => {
    const payload = JSON.stringify(log, null, 2);
    if (window.electronAgentAPI?.copyText) {
      await window.electronAgentAPI.copyText(payload);
    } else {
      await navigator.clipboard.writeText(payload);
    }
    setCopiedDetail(true);
    setTimeout(() => setCopiedDetail(false), 2000);
  };

  const handleConfirmClear = () => {
    onClearLogs();
    setShowClearModal(false);
    setSelectedLog(null);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-12">
      {/* 2. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E1E7E1] dark:border-slate-800">
        <div>
          <h1 className="text-[24px] font-bold text-[#111111] dark:text-white tracking-tight leading-tight">
            Activity Logs
          </h1>
          <p className="text-[14px] text-[#646B65] dark:text-slate-400 mt-1">
            Monitor agent events, printer activity, job processing and system diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              isPaused
                ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                : 'bg-[#E8F8EC] text-[#008F25] border-[#BCEAC4]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPaused ? 'bg-[#E6A000]' : 'bg-[#00B32D] animate-pulse'
              }`}
            />
            <span>{isPaused ? 'Stream Paused' : 'Live Stream Active'}</span>
            {isPaused && newEventsWhilePaused > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#E6A000] text-white text-[10.5px] font-mono font-bold">
                +{newEventsWhilePaused}
              </span>
            )}
          </span>

          <button
            type="button"
            onClick={handleExport}
            className="primary-button !min-h-[34px] !py-1.5 !px-3.5 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Logs</span>
          </button>
        </div>
      </div>

      {/* 3. LOG SUMMARY (4 Compact Metric Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Events */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Total Events</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">{counts.total}</span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center">
              <Terminal className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#646B65] dark:text-slate-400 mt-2 block font-mono truncate">
            Latest: {latestTimestamp}
          </span>
        </div>

        {/* Information */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Information</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">{counts.info}</span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center">
              <Info className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#008F25] font-semibold mt-2 block truncate">Operational Events</span>
        </div>

        {/* Warnings */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Warnings</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">{counts.warn}</span>
            <div className="w-7 h-7 rounded-md bg-[#FFFBEB] text-[#E6A000] flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#E6A000] font-semibold mt-2 block truncate">Recoverable Retries</span>
        </div>

        {/* Errors */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Errors &amp; Exceptions</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">{counts.error}</span>
            <div className="w-7 h-7 rounded-md bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center">
              <AlertCircle className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#DC2626] font-semibold mt-2 block truncate">Action Required</span>
        </div>
      </div>

      {/* 4. SEARCH AND FILTER TOOLBAR */}
      <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 text-[#848D86] absolute left-3.5 top-3" />
            <input
              type="search"
              aria-label="Search log entries"
              placeholder="Search by message, category, job ID, printer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="settings-input !pl-10 !text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-[#848D86] hover:text-[#111111] dark:hover:text-white"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Toolbar Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Dropdown */}
            <select
              aria-label="Filter by log category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
              className="settings-input pf-form-select !w-auto !text-xs min-w-[130px]"
            >
              <option value="ALL">All Categories</option>
              {(['AGENT', 'SPOOLER', 'NETWORK', 'AUTH', 'RECOVERY', 'STORAGE', 'QUEUE'] as const).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Severity Dropdown */}
            <select
              aria-label="Filter by log severity level"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
              className="settings-input pf-form-select !w-auto !text-xs min-w-[110px]"
            >
              <option value="ALL">All Levels</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>

            {/* Date Dropdown */}
            <select
              aria-label="Filter by date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilterMode)}
              className="settings-input pf-form-select !w-auto !text-xs min-w-[110px]"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="LAST_24H">Last 24 Hours</option>
            </select>

            {/* Pause / Resume Button */}
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              className="secondary-button !min-h-[36px] !py-1 !px-2.5 text-xs font-semibold cursor-pointer"
              title={isPaused ? 'Resume live log stream' : 'Pause live log stream'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-[#00B32D]" /> : <Pause className="w-3.5 h-3.5 text-[#E6A000]" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            {/* Auto-scroll Checkbox */}
            <label className="inline-flex items-center gap-1.5 text-xs text-[#646B65] dark:text-slate-300 px-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-[#00B32D]"
              />
              <span>Auto-scroll</span>
            </label>

            {/* Clear Button */}
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="secondary-button !min-h-[36px] !py-1 !px-2.5 text-xs font-semibold text-[#646B65] hover:text-[#DC2626] cursor-pointer"
              title="Clear visible logs from screen"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Action Notifications */}
        {copiedNotification && (
          <div className="p-3 rounded-lg bg-[#E8F8EC] border border-[#BCEAC4] text-[#008F25] text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#00B32D] shrink-0" />
            <span>{copiedNotification}</span>
          </div>
        )}
        {exportError && (
          <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
            <span>{exportError}</span>
          </div>
        )}
      </div>

      {/* 5. DIAGNOSTIC LOG VIEWER & 6. LOG DETAILS PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Main Log Table / Stream (2 or 3 cols depending on selection) */}
        <div className={`pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card space-y-3 ${
          selectedLog ? 'lg:col-span-2' : 'lg:col-span-3'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-[#E1E7E1] dark:border-slate-800 text-xs text-[#646B65] dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#00B32D]" />
              <span className="font-bold text-[#111111] dark:text-white">Diagnostic Stream</span>
              <span>({filteredLogs.length} events matching filter)</span>
            </div>
            <span className="text-[11px] font-mono text-[#848D86]">
              Sensitive tokens &amp; document contents auto-sanitized
            </span>
          </div>

          <div
            ref={listRef}
            className="h-[520px] overflow-y-auto space-y-1 font-mono text-[12px] p-2 rounded-lg bg-[#F0F4F1] dark:bg-slate-900 border border-[#E1E7E1] dark:border-slate-800"
          >
            {filteredLogs.length === 0 ? (
              <div className="py-24 text-center text-[#848D86] font-sans">
                <Terminal className="w-8 h-8 text-[#848D86] mx-auto mb-2 opacity-60" />
                <p className="font-semibold text-[#111111] dark:text-white">No Log Events Match Filter</p>
                <p className="text-xs text-[#646B65] dark:text-slate-400 mt-0.5">
                  Try broadening search keywords or resetting severity/category filters.
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isError = log.level === 'ERROR';
                const isWarn = log.level === 'WARN';
                const isSelected = selectedLog?.id === log.id;

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`p-2 rounded-md flex items-start gap-2.5 transition-colors cursor-pointer leading-snug select-text ${
                      isSelected
                        ? 'bg-[#E8F8EC] border border-[#BCEAC4] text-[#111111]'
                        : isError
                        ? 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] hover:bg-[#FEE2E2]'
                        : isWarn
                        ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] hover:bg-[#FEF3C7]'
                        : 'hover:bg-white dark:hover:bg-slate-800 text-[#111111] dark:text-slate-300'
                    }`}
                  >
                    {/* Timestamp */}
                    <span className="text-[#848D86] shrink-0 text-[11px] font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>

                    {/* Level */}
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                        isError
                          ? 'bg-[#DC2626] text-white'
                          : isWarn
                          ? 'bg-[#E6A000] text-white'
                          : 'bg-[#00B32D] text-white'
                      }`}
                    >
                      {log.level}
                    </span>

                    {/* Category */}
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 bg-[#E1E7E1] dark:bg-slate-800 text-[#646B65] dark:text-slate-300">
                      {log.category}
                    </span>

                    {/* Message */}
                    <span className="break-all flex-1 truncate">{log.message}</span>

                    {/* Details indicator */}
                    <ChevronRight className="w-3.5 h-3.5 text-[#848D86] shrink-0 self-center" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 6. LOG DETAILS PANEL (Right Side Drawer) */}
        {selectedLog && (
          <div className="pf-card p-5 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#E1E7E1] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00B32D]" />
                <h3 className="text-[16px] font-bold text-[#111111] dark:text-white">Event Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-[#848D86] hover:text-[#111111] dark:hover:text-white cursor-pointer"
                title="Close details panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Event Metadata */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-[#F0F4F1] dark:bg-slate-900 border border-[#E1E7E1] dark:border-slate-800">
                <div>
                  <span className="text-[11px] text-[#646B65] dark:text-slate-400 block font-medium">Timestamp</span>
                  <span className="font-mono font-bold text-[#111111] dark:text-slate-200">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-[#646B65] dark:text-slate-400 block font-medium">Severity / Category</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase text-white ${
                      selectedLog.level === 'ERROR' ? 'bg-[#DC2626]' : selectedLog.level === 'WARN' ? 'bg-[#E6A000]' : 'bg-[#00B32D]'
                    }`}>
                      {selectedLog.level}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-[#E1E7E1] text-[#646B65]">
                      {selectedLog.category}
                    </span>
                  </div>
                </div>

                <div className="col-span-2 pt-1 border-t border-[#E1E7E1] dark:border-slate-800">
                  <span className="text-[11px] text-[#646B65] dark:text-slate-400 block font-medium">Log Record ID</span>
                  <span className="font-mono text-[11px] text-[#111111] dark:text-slate-300">{selectedLog.id}</span>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1">
                <span className="text-[12px] font-bold text-[#111111] dark:text-white block">Event Message</span>
                <div className="p-3 rounded-lg bg-[#F0F4F1] dark:bg-slate-900 border border-[#E1E7E1] dark:border-slate-800 font-mono text-xs leading-relaxed text-[#111111] dark:text-slate-200 break-all">
                  {selectedLog.message}
                </div>
              </div>

              {/* Diagnostic Details Object if available */}
              {selectedLog.details && (
                <div className="space-y-1">
                  <span className="text-[12px] font-bold text-[#111111] dark:text-white block">Diagnostic Details</span>
                  <pre className="p-3 rounded-lg bg-[#F0F4F1] dark:bg-slate-900 border border-[#E1E7E1] dark:border-slate-800 font-mono text-[11px] text-[#111111] dark:text-slate-300 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {/* Troubleshooting Guidance based on category/level */}
              {selectedLog.level === 'ERROR' && (
                <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
                    <span>Suggested Troubleshooting</span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed">
                    {selectedLog.category === 'SPOOLER'
                      ? 'Verify Windows Print Spooler service status under System Health. Ensure printer paper tray is loaded.'
                      : selectedLog.category === 'NETWORK'
                      ? 'Check local Wi-Fi / LAN connection. Verify cloud backend reachability in System Health.'
                      : selectedLog.category === 'AUTH'
                      ? 'Check Shop Auth Token under Settings. Re-pair device if shop credentials were revoked.'
                      : 'Review diagnostic details above and rescan hardware or retry the job from the Print Queue.'}
                  </p>
                </div>
              )}

              {/* Copy Details Action */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleCopyLogDetails(selectedLog)}
                  className="secondary-button !min-h-[32px] !text-xs font-semibold cursor-pointer"
                >
                  {copiedDetail ? <Check className="w-3.5 h-3.5 text-[#00B32D]" /> : <Copy className="w-3.5 h-3.5 text-[#00B32D]" />}
                  <span>{copiedDetail ? 'Copied Details' : 'Copy Log Details'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 9. CLEAR LOGS CONFIRMATION MODAL */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white dark:bg-[#131D33] border border-[#E1E7E1] dark:border-slate-800 rounded-[10px] p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E7E1] dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-[#111111] dark:text-white text-base">
                <Trash2 className="w-5 h-5 text-[#DC2626]" />
                <span>Confirm Clear Screen Buffer</span>
              </div>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="text-[#848D86] hover:text-[#111111] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#646B65] dark:text-slate-300 leading-relaxed">
              This action will clear the visible diagnostic log entries from your active screen session.
            </p>

            <div className="p-3 rounded-lg bg-[#F0F4F1] border border-[#E1E7E1] text-xs text-[#646B65] font-medium leading-relaxed">
              <strong>Retained Safety Logs:</strong> Critical crash records and persistent diagnostic files safely remain saved on local disk under your user AppData directory.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="secondary-button !text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="danger-button !text-xs font-semibold cursor-pointer"
              >
                Clear Visible Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security & Sanitation Footer Notice */}
      <div className="p-4 rounded-[10px] border border-[#E1E7E1] dark:border-slate-800 bg-[#F0F4F1] dark:bg-slate-900/40 text-xs text-[#646B65] dark:text-slate-400 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#00B32D] shrink-0" />
        <span>
          <strong>Automated Data Sanitation Active:</strong> Authentication tokens, shop secrets, customer document contents, and passwords are automatically stripped before log persistence or export.
        </span>
      </div>
    </div>
  );
};
