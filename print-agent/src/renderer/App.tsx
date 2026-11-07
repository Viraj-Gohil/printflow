import React, { useEffect, useState } from 'react';
import {
  AgentConfig,
  AgentConnectionStatus,
  DiscoveredPrinter,
  PrintJobItem,
  AgentLogEntry,
  QueueMetrics,
  TestPrintResult,
  PlanEntitlements
} from './types/agent';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { QueueView } from './components/QueueView';
import { PrintersView } from './components/PrintersView';
import { LogsView } from './components/LogsView';
import { HealthView } from './components/HealthView';
import { SettingsModal } from './components/SettingsModal';
import { LoginScreen } from './components/LoginScreen';
import { AboutView } from './components/AboutView';
import { DevicePreferencesView } from './components/DevicePages';
import {
  Activity,
  CircleHelp,
  LayoutDashboard,
  ListOrdered,
  Printer,
  SlidersHorizontal,
  Terminal,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
  ShieldCheck
} from 'lucide-react';

type AgentPage = 'DASHBOARD' | 'HEALTH' | 'QUEUE' | 'PRINTERS' | 'LOGS' | 'DEVICE_PREFERENCES' | 'ABOUT';

const DEFAULT_CONFIG: AgentConfig = {
  serverUrl: 'https://printflow.devpixel.space',
  shopId: '',
  shopSlug: '',
  agentId: '',
  authToken: '',
  deviceName: '',
  pollIntervalMs: 5000,
  autoStartOnBoot: false,
  allowColorFallback: true,
  spoolerTimeoutMs: 30000,
  themePreference: 'system'
};

const PAGE_DETAILS: Record<AgentPage, { title: string; description: string; icon: React.ReactNode }> = {
  DASHBOARD: {
    title: 'Dashboard Overview',
    description: 'Real-time telemetry, queue metrics, and printer hardware status for this counter station.',
    icon: <LayoutDashboard className="w-5 h-5 text-[#00B32D]" />
  },
  HEALTH: {
    title: 'System Health & Telemetry',
    description: 'Hardware resource utilization, Windows Print Spooler status, SQLite storage, and network health.',
    icon: <Activity className="w-5 h-5 text-[#00B32D]" />
  },
  QUEUE: {
    title: 'Print Job Queue',
    description: 'Monitor incoming customer orders, active spooling progress, and safe retries.',
    icon: <ListOrdered className="w-5 h-5 text-[#00B32D]" />
  },
  PRINTERS: {
    title: 'Printer Management',
    description: 'Installed local & network printers detected via Windows Win32 Print Spooler.',
    icon: <Printer className="w-5 h-5 text-[#00B32D]" />
  },
  LOGS: {
    title: 'Activity Logs',
    description: 'Diagnostic event logs, print spooler handshakes, and network telemetry.',
    icon: <Terminal className="w-5 h-5 text-[#00B32D]" />
  },
  DEVICE_PREFERENCES: {
    title: 'Settings',
    description: 'Device identity, queue polling interval, autostart, and print behavior.',
    icon: <SlidersHorizontal className="w-5 h-5 text-[#00B32D]" />
  },
  ABOUT: {
    title: 'About & System Information',
    description: 'Application build details, environment specifications, and support portal.',
    icon: <CircleHelp className="w-5 h-5 text-[#00B32D]" />
  }
};

const NAVIGATION: Array<{ id: AgentPage; label: string; icon: React.ReactNode }> = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
  { id: 'HEALTH', label: 'System Health', icon: <Activity className="w-4 h-4 shrink-0" /> },
  { id: 'QUEUE', label: 'Print Queue', icon: <ListOrdered className="w-4 h-4 shrink-0" /> },
  { id: 'PRINTERS', label: 'Printers', icon: <Printer className="w-4 h-4 shrink-0" /> },
  { id: 'LOGS', label: 'Activity Logs', icon: <Terminal className="w-4 h-4 shrink-0" /> },
  { id: 'DEVICE_PREFERENCES', label: 'Settings', icon: <SlidersHorizontal className="w-4 h-4 shrink-0" /> },
  { id: 'ABOUT', label: 'About', icon: <CircleHelp className="w-4 h-4 shrink-0" /> }
];

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<AgentPage>('DASHBOARD');
  const [status, setStatus] = useState<AgentConnectionStatus>('CONNECTING');
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [metrics, setMetrics] = useState<QueueMetrics>({
    totalJobs: 0,
    queuedJobs: 0,
    printingJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    manualAttentionJobs: 0,
    uptimeSeconds: 0,
    lastSyncAt: null
  });
  const [printers, setPrinters] = useState<DiscoveredPrinter[]>([]);
  const [jobs, setJobs] = useState<PrintJobItem[]>([]);
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [entitlements, setEntitlements] = useState<PlanEntitlements | null>(null);

  useEffect(() => {
    const api = window.electronAgentAPI;
    if (!api) return;
    let active = true;

    Promise.all([
      api.getConfig(),
      api.getStatus(),
      api.getMetrics(),
      api.getPrinters(),
      api.getJobs(),
      api.getLogs(),
      api.getIsScanning ? api.getIsScanning() : Promise.resolve(false),
      api.getEntitlements ? api.getEntitlements() : Promise.resolve(null)
    ])
      .then(([loadedConfig, loadedStatus, loadedMetrics, loadedPrinters, loadedJobs, loadedLogs, scanningState, loadedEntitlements]) => {
        if (!active) return;
        setConfig(loadedConfig);
        setStatus(loadedStatus.status);
        setLastHeartbeat(loadedStatus.lastHeartbeat);
        setMetrics(loadedMetrics);
        setPrinters(loadedPrinters);
        setJobs(loadedJobs);
        setLogs(loadedLogs);
        setIsScanning(Boolean(scanningState));
        if (loadedEntitlements) {
          setEntitlements(loadedEntitlements);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setInitializationError(error instanceof Error ? error.message : 'Could not initialize agent environment.');
        setStatus('ERROR');
      });

    const unsubStatus = api.onStatusChanged((newStatus) => {
      setStatus(newStatus);
      void Promise.all([api.getStatus(), api.getConfig(), api.getEntitlements ? api.getEntitlements() : Promise.resolve(null)])
        .then(([newDetails, freshConfig, freshEntitlements]) => {
          if (active) {
            setLastHeartbeat(newDetails.lastHeartbeat);
            setConfig(freshConfig);
            if (freshEntitlements) setEntitlements(freshEntitlements);
          }
        })
        .catch(() => undefined);
    });

    const unsubJob = api.onJobUpdated((updatedJob) => {
      setJobs((previous) => {
        const index = previous.findIndex((job) => job.id === updatedJob.id);
        if (index < 0) return [updatedJob, ...previous];
        const next = [...previous];
        next[index] = updatedJob;
        return next;
      });
      void api
        .getMetrics()
        .then((nextMetrics) => {
          if (active) setMetrics(nextMetrics);
        })
        .catch(() => undefined);
    });

    const unsubLog = api.onLogAdded((newLog) =>
      setLogs((previous) => [newLog, ...previous.slice(0, 199)])
    );

    const unsubPrinters = api.onPrintersUpdated((updatedPrinters) => {
      setPrinters(updatedPrinters);
    });

    const unsubScanning = api.onPrinterScanningChanged
      ? api.onPrinterScanningChanged((scanning) => {
          setIsScanning(scanning);
        })
      : () => {};

    const unsubEntitlements = api.onEntitlementsChanged
      ? api.onEntitlementsChanged((nextEntitlements) => {
          if (active && nextEntitlements) setEntitlements(nextEntitlements);
        })
      : () => {};

    return () => {
      active = false;
      unsubStatus();
      unsubJob();
      unsubLog();
      unsubPrinters();
      unsubScanning();
      unsubEntitlements();
    };
  }, []);

  const handlePollNow = async () => {
    if (isPolling) return;
    setIsPolling(true);
    try {
      const api = window.electronAgentAPI;
      if (!api) throw new Error('PrintFlow Agent must run within the Electron desktop runtime.');
      const result = await api.pollNow();
      if (!result.success) throw new Error(result.error || 'Cloud synchronization failed.');
      const [updatedJobs, updatedMetrics] = await Promise.all([api.getJobs(), api.getMetrics()]);
      setJobs(updatedJobs);
      setMetrics(updatedMetrics);
      setInitializationError(null);
    } catch (error) {
      setInitializationError(error instanceof Error ? error.message : 'Could not synchronize cloud queue.');
    } finally {
      setIsPolling(false);
    }
  };

  const handleRescanPrinters = async () => {
    setIsScanning(true);
    try {
      const api = window.electronAgentAPI;
      if (!api) throw new Error('PrintFlow Agent must run within the Electron desktop runtime.');
      setPrinters(await api.rescanPrinters());
      setInitializationError(null);
    } catch (error) {
      setInitializationError(error instanceof Error ? error.message : 'Could not query installed Windows printers.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleTestPrint = async (printerName: string): Promise<TestPrintResult> => {
    const api = window.electronAgentAPI;
    if (api) return api.testPrint(printerName);
    return { success: false, printerName, message: 'PrintFlow Agent must run within the Electron runtime.' };
  };

  const handleReprintJob = async (jobId: string) => {
    const api = window.electronAgentAPI;
    if (!api) return;
    const result = await api.reprintJob(jobId);
    if (!result.success) setInitializationError(result.error || 'This job cannot be safely re-printed.');
    else setInitializationError(null);
    setJobs(await api.getJobs());
  };

  const handleCancelJob = async (jobId: string) => {
    const api = window.electronAgentAPI;
    if (!api) return;
    const result = await api.cancelJob(jobId);
    if (!result.success) setInitializationError(result.error || 'Could not cancel the print job.');
    else setInitializationError(null);
    setJobs(await api.getJobs());
  };

  const handleClearCompleted = async () => {
    const api = window.electronAgentAPI;
    if (!api) return;
    await api.clearCompletedJobs();
    setJobs(await api.getJobs());
  };

  const handleSaveConfig = async (partial: Partial<AgentConfig>) => {
    const api = window.electronAgentAPI;
    if (!api) return { success: false, error: 'PrintFlow Agent must run within the Electron desktop runtime.' };
    const result = await api.saveConfig(partial);
    if (result.success) {
      const [savedConfig, savedMetrics] = await Promise.all([api.getConfig(), api.getMetrics()]);
      setConfig(savedConfig);
      setMetrics(savedMetrics);
      setInitializationError(null);
    } else {
      setInitializationError(result.error || 'Could not save agent configuration.');
    }
    return result;
  };

  const handlePairDevice = async (data: {
    serverUrl: string;
    shopId: string;
    authToken: string;
    deviceName?: string;
  }) => {
    const api = window.electronAgentAPI;
    if (!api) return { success: false, error: 'PrintFlow Agent must run within the Electron desktop runtime.' };
    const result = await api.pairDevice(data);
    if (result.success) {
      // Delay state update briefly so the LoginScreen can display the successful connection card
      await new Promise((resolve) => setTimeout(resolve, 1400));
    }
    const [savedConfig, connection, savedMetrics] = await Promise.all([
      api.getConfig(),
      api.getStatus(),
      api.getMetrics()
    ]);
    setConfig(savedConfig);
    setStatus(connection.status);
    setLastHeartbeat(connection.lastHeartbeat);
    setMetrics(savedMetrics);
    setInitializationError(result.success ? null : result.error || 'Device pairing failed.');
    return result;
  };

  const handleTestConnection = async () => {
    const api = window.electronAgentAPI;
    if (!api) return { success: false, error: 'PrintFlow Agent must run within the Electron desktop runtime.' };
    const result = await api.testConnection();
    const currentStatus = await api.getStatus();
    setStatus(currentStatus.status);
    setLastHeartbeat(currentStatus.lastHeartbeat);
    return result;
  };

  const handleDisconnectDevice = async () => {
    const api = window.electronAgentAPI;
    if (!api) return { success: false, error: 'PrintFlow Agent must run within the Electron desktop runtime.' };
    const result = await api.disconnectDevice();
    const [savedConfig, connection, savedMetrics] = await Promise.all([
      api.getConfig(),
      api.getStatus(),
      api.getMetrics()
    ]);
    setConfig(savedConfig);
    setStatus(connection.status);
    setLastHeartbeat(connection.lastHeartbeat);
    setMetrics(savedMetrics);
    setIsSettingsOpen(false);
    return result;
  };

  const handleResetConfig = async () => {
    const api = window.electronAgentAPI;
    if (!api) return { success: false, error: 'PrintFlow Agent must run within the Electron desktop runtime.' };
    const result = await api.resetConfig();
    if (result.success) {
      setConfig(await api.getConfig());
      setStatus('OFFLINE');
      setLastHeartbeat(null);
      setIsSettingsOpen(false);
    }
    return result;
  };

  const configured = Boolean(config.agentId && config.hasStoredCredentials && status !== 'DISCONNECTED' && status !== 'REVOKED');
  const currentPage = PAGE_DETAILS[activePage];

  // =========================================================================
  // Unpaired / Setup State Screen (Centered Login Card)
  // =========================================================================
  if (!configured) {
    return (
      <LoginScreen
        onPair={handlePairDevice}
        defaultShopId={config.shopId}
        serverUrl={config.serverUrl}
      />
    );
  }

  // =========================================================================
  // Main Application Shell
  // =========================================================================
  return (
    <div className="agent-app">
      <Header
        status={status}
        lastHeartbeat={lastHeartbeat}
        config={config}
        isPolling={isPolling}
        onPollNow={handlePollNow}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onMinimizeToTray={() => window.electronAgentAPI?.minimizeToTray()}
      />

      <div className="agent-layout">
        {/* Navigation Sidebar */}
        <nav
          aria-label="Primary navigation"
          className={`agent-sidebar transition-all duration-200 ${isSidebarCollapsed ? '!w-16' : '!w-56'}`}
        >
          <div className="flex items-center justify-between px-2.5 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-faint)]">
            {!isSidebarCollapsed && <span>Navigation</span>}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="p-1 rounded-md text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ml-auto"
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {NAVIGATION.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActivePage(item.id)}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#00B32D] text-white shadow-xs font-bold'
                      : 'text-[#646B65] dark:text-slate-300 hover:bg-[#E8F8EC] dark:hover:bg-slate-800 hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  {item.id === 'QUEUE' && metrics.queuedJobs > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                        isActive
                          ? 'bg-white text-[#00B32D]'
                          : 'bg-[#E6A000] text-white'
                      } ${isSidebarCollapsed ? 'ml-0' : 'ml-auto'}`}
                    >
                      {metrics.queuedJobs}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {!isSidebarCollapsed && (
            <div className="mt-4 pt-3 border-t border-[#E1E7E1] dark:border-slate-800 px-2 text-[11px] text-[#646B65] dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <Printer className="h-3.5 w-3.5 text-[#00B32D]" />
                <span>
                  {printers.length} Installed Printer{printers.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          )}
        </nav>

        {/* Main Content Area */}
        <main className="agent-main">
          {/* Page Heading Bar */}
          <div className="agent-page-heading flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#E8F8EC] text-[#00B32D] dark:bg-emerald-950/40 dark:text-emerald-400 border border-[#BCEAC4] dark:border-emerald-800 shrink-0 shadow-xs">
                {currentPage.icon}
              </span>
              <div>
                <h1 className="text-base font-bold text-[#111111] dark:text-white tracking-tight">
                  {currentPage.title}
                </h1>
                <p className="text-xs text-[#646B65] dark:text-slate-400 mt-0.5">{currentPage.description}</p>
              </div>
            </div>

            {activePage === 'DEVICE_PREFERENCES' && (
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-[#F0F4F1] text-[#646B65] dark:bg-slate-800 dark:text-slate-300 border border-[#E1E7E1] dark:border-slate-700 self-start sm:self-auto shadow-xs">
                {config.deviceName || config.agentId || 'Terminal'}
              </span>
            )}
          </div>

          {/* Dismissible Error Alert */}
          {initializationError && (
            <div
              role="alert"
              className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] dark:border-red-800 dark:bg-red-950/40 px-4 py-3 text-xs text-[#991B1B] dark:text-red-300 animate-fade-in shadow-xs"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#DC2626]" />
                <span className="font-medium">{initializationError}</span>
              </div>
              <button
                type="button"
                onClick={() => setInitializationError(null)}
                className="text-[#991B1B] dark:text-red-400 hover:text-[#7F1D1D] dark:hover:text-red-200 cursor-pointer"
                title="Dismiss error banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tab Views */}
          <div key={activePage} className="animate-fade-in">
            {activePage === 'DASHBOARD' && (
              <Dashboard
                status={status}
                lastHeartbeat={lastHeartbeat}
                config={config}
                metrics={metrics}
                printers={printers}
                jobs={jobs}
                entitlements={entitlements}
                onNavigateTab={(page) => setActivePage(page)}
                onPollNow={handlePollNow}
              />
            )}
            {activePage === 'HEALTH' && <HealthView onNavigateQueue={() => setActivePage('QUEUE')} />}
            {activePage === 'QUEUE' && (
              <QueueView
                jobs={jobs}
                printers={printers}
                entitlements={entitlements}
                config={config}
                onReprintJob={handleReprintJob}
                onCancelJob={handleCancelJob}
                onClearCompleted={handleClearCompleted}
                onPollNow={handlePollNow}
              />
            )}
            {activePage === 'PRINTERS' && (
              <PrintersView
                printers={printers}
                config={config}
                isScanning={isScanning}
                entitlements={entitlements}
                onRescan={handleRescanPrinters}
                onTestPrint={handleTestPrint}
                onSelectPrinter={(name) => void handleSaveConfig({ selectedPrinterName: name })}
                onSetPrinterEnabled={(name, enabled) => {
                  const disabledPrinterNames = new Set(config.disabledPrinterNames || []);
                  if (enabled) disabledPrinterNames.delete(name);
                  else disabledPrinterNames.add(name);
                  void handleSaveConfig({ disabledPrinterNames: [...disabledPrinterNames] });
                }}
                onSetPrinterRegistered={async (name, registered) => {
                  const api = window.electronAgentAPI;
                  if (!api) return;
                  const result = await api.setPrinterRegistered(name, registered);
                  if (!result.success) {
                    setInitializationError(result.error || 'Could not update shop printer registration.');
                    return;
                  }
                  setConfig(await api.getConfig());
                  setInitializationError(null);
                }}
              />
            )}
            {activePage === 'LOGS' && (
              <LogsView
                logs={logs}
                onClearLogs={async () => {
                  const api = window.electronAgentAPI;
                  if (api && (await api.clearLogs())) setLogs([]);
                }}
                onExportLogs={async () => {
                  const api = window.electronAgentAPI;
                  if (!api) return { success: false };
                  return api.exportLogs();
                }}
              />
            )}
            {activePage === 'DEVICE_PREFERENCES' && (
              <DevicePreferencesView
                config={config}
                status={status}
                lastHeartbeat={lastHeartbeat}
                printers={printers}
                entitlements={entitlements}
                onSave={handleSaveConfig}
                onTestConnection={handleTestConnection}
                onReset={handleResetConfig}
                onDisconnect={handleDisconnectDevice}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenLogs={() => setActivePage('LOGS')}
                onNavigatePrinters={() => setActivePage('PRINTERS')}
                onCopyDeviceId={(deviceId) => window.electronAgentAPI?.copyText(deviceId) || Promise.resolve(false)}
              />
            )}
            {activePage === 'ABOUT' && (
              <AboutView
                config={config}
                status={status}
                onOpenExternal={async (url) => {
                  try {
                    const api = window.electronAgentAPI;
                    if (api?.openExternal) {
                      await api.openExternal(url);
                    } else if (typeof window !== 'undefined') {
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }
                  } catch {
                    if (typeof window !== 'undefined') {
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }
                  }
                }}
                onNavigate={(page) => {
                  const targetPage = page === 'QUEUES' ? 'QUEUE' : page === 'SETTINGS' ? 'DEVICE_PREFERENCES' : page;
                  setActivePage(targetPage as AgentPage);
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* On-demand Settings Dialog */}
      <SettingsModal
        config={config}
        status={status}
        lastHeartbeat={lastHeartbeat}
        printers={printers}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveConfig}
        onPair={handlePairDevice}
        onDisconnect={handleDisconnectDevice}
      />
    </div>
  );
};
