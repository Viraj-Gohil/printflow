import React, { useEffect, useState } from 'react';
import {
  AgentConfig,
  AgentConnectionStatus,
  DiscoveredPrinter,
  PrintJobItem,
  AgentLogEntry,
  QueueMetrics,
  TestPrintResult
} from './types/agent';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { QueueView } from './components/QueueView';
import { PrintersView } from './components/PrintersView';
import { LogsView } from './components/LogsView';
import { SettingsModal } from './components/SettingsModal';
import { AboutView, DevicePreferencesView } from './components/DevicePages';
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

type AgentPage = 'DASHBOARD' | 'QUEUE' | 'PRINTERS' | 'LOGS' | 'DEVICE_PREFERENCES' | 'ABOUT';

const DEFAULT_CONFIG: AgentConfig = {
  serverUrl: '',
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
    icon: <LayoutDashboard className="w-5 h-5 text-[#2563EB]" />
  },
  QUEUE: {
    title: 'Print Job Queue',
    description: 'Monitor incoming customer orders, active spooling progress, and safe retries.',
    icon: <ListOrdered className="w-5 h-5 text-[#2563EB]" />
  },
  PRINTERS: {
    title: 'Printer Management',
    description: 'Installed local & network printers detected via Windows Win32 Print Spooler.',
    icon: <Printer className="w-5 h-5 text-[#2563EB]" />
  },
  LOGS: {
    title: 'Activity Logs',
    description: 'Diagnostic event logs, print spooler handshakes, and network telemetry.',
    icon: <Terminal className="w-5 h-5 text-[#2563EB]" />
  },
  DEVICE_PREFERENCES: {
    title: 'Settings',
    description: 'Device identity, queue polling interval, autostart, and print behavior.',
    icon: <SlidersHorizontal className="w-5 h-5 text-[#2563EB]" />
  },
  ABOUT: {
    title: 'About & System Information',
    description: 'Application build details, environment specifications, and support portal.',
    icon: <CircleHelp className="w-5 h-5 text-[#2563EB]" />
  }
};

const NAVIGATION: Array<{ id: AgentPage; label: string; icon: React.ReactNode }> = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
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
      api.getLogs()
    ])
      .then(([loadedConfig, loadedStatus, loadedMetrics, loadedPrinters, loadedJobs, loadedLogs]) => {
        if (!active) return;
        setConfig(loadedConfig);
        setStatus(loadedStatus.status);
        setLastHeartbeat(loadedStatus.lastHeartbeat);
        setMetrics(loadedMetrics);
        setPrinters(loadedPrinters);
        setJobs(loadedJobs);
        setLogs(loadedLogs);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setInitializationError(error instanceof Error ? error.message : 'Could not initialize agent environment.');
        setStatus('ERROR');
      });

    const unsubStatus = api.onStatusChanged((newStatus) => {
      setStatus(newStatus);
      void Promise.all([api.getStatus(), api.getConfig()])
        .then(([newDetails, freshConfig]) => {
          if (active) {
            setLastHeartbeat(newDetails.lastHeartbeat);
            setConfig(freshConfig);
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

    const unsubPrinters = api.onPrintersUpdated(setPrinters);

    return () => {
      active = false;
      unsubStatus();
      unsubJob();
      unsubLog();
      unsubPrinters();
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
  // Unpaired / Setup State Screen
  // =========================================================================
  if (!configured) {
    return (
      <div className="setup-screen animate-fade-in">
        <div className="setup-container">
          <div className="setup-brand">
            <div className="setup-brand-mark">
              <Printer className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="setup-brand-name">
                PrintFlow <span>Agent</span>
              </div>
              <div className="setup-brand-caption">DESKTOP SPOOLER STATION</div>
            </div>
          </div>

          <div className="setup-content">
            <section className="setup-welcome">
              <span className="setup-eyebrow">
                <span className="setup-eyebrow-dot" />
                COUNTER SETUP &amp; PAIRING
              </span>
              <h1>
                Bring your shop’s
                <br />
                <span>print queue</span> to life.
              </h1>
              <p className="setup-description">
                Connect this counter station to your PrintFlow shop. The Agent will securely listen for paid customer
                documents and spool them directly to your Windows printers.
              </p>

              <div className="setup-benefits">
                <div>
                  <span className="setup-benefit-icon">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <span>
                    <strong>Shop-Authorized Job Streaming</strong>
                    <small>Only authorized orders designated for your specific shop</small>
                  </span>
                </div>
                <div>
                  <span className="setup-benefit-icon">
                    <Printer className="w-5 h-5" />
                  </span>
                  <span>
                    <strong>Native Windows Print Spooler</strong>
                    <small>Direct raster integration with Win32 local &amp; network drivers</small>
                  </span>
                </div>
                <div>
                  <span className="setup-benefit-icon">
                    <Activity className="w-5 h-5" />
                  </span>
                  <span>
                    <strong>Telemetry &amp; Crash Recovery</strong>
                    <small>Automatic retry protection and live heartbeat monitoring</small>
                  </span>
                </div>
              </div>

              <div className="setup-secure-note">
                <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>Device tokens are securely isolated with Windows DPAPI hardware encryption.</span>
              </div>
            </section>

            <div className="setup-form-wrap">
              <div className="setup-form-heading">
                <span>GET STARTED</span>
                <h2>Connect this Device</h2>
                <p>Enter the shop identifier and device pairing token from your Web Dashboard.</p>
              </div>

              {status === 'REVOKED' && (
                <div role="alert" className="mb-4 p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800 flex flex-col gap-1.5 animate-fade-in shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
                    <span className="font-bold text-xs">This agent session has been replaced by another device.</span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-[#B45309] dark:text-amber-300">
                    Another PC connected to this shop using valid credentials. Printing on this PC was automatically stopped to prevent conflicts.
                  </p>
                  <p className="text-[11px] text-[#92400E] dark:text-amber-400 font-medium">
                    To make this PC the active print device again, enter your shop token below and click Connect to Shop.
                  </p>
                </div>
              )}
              {initializationError && status !== 'REVOKED' && (
                <div role="alert" className="mb-4 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 flex items-center gap-2.5 animate-fade-in shadow-xs">
                  <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
                  <span className="font-medium">{initializationError}</span>
                </div>
              )}

              <SettingsModal
                config={config}
                status={status}
                lastHeartbeat={lastHeartbeat}
                printers={printers}
                isOpen
                required
                onClose={() => undefined}
                onSave={handleSaveConfig}
                onPair={handlePairDevice}
                onDisconnect={handleDisconnectDevice}
              />
            </div>
          </div>

          <p className="setup-footer">
            PRINTFLOW DESKTOP AGENT <span>·</span> SECURE SPOOLER SUBSYSTEM
          </p>
        </div>
      </div>
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
                  className={`flex min-h-9 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-xs font-bold'
                      : 'text-[#475569] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  {item.id === 'QUEUE' && metrics.queuedJobs > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                        isActive
                          ? 'bg-white text-[#2563EB]'
                          : 'bg-[#F59E0B] text-white'
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
            <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-slate-800 px-2 text-[11px] text-[#64748B] dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <Printer className="h-3.5 w-3.5 text-[#2563EB]" />
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
              <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#EFF6FF] text-[#2563EB] dark:bg-blue-950/40 dark:text-blue-400 border border-[#BFDBFE] dark:border-blue-800 shrink-0 shadow-xs">
                {currentPage.icon}
              </span>
              <div>
                <h1 className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight">
                  {currentPage.title}
                </h1>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">{currentPage.description}</p>
              </div>
            </div>

            {activePage === 'DEVICE_PREFERENCES' && (
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-[#F8FAFC] text-[#475569] dark:bg-slate-800 dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700 self-start sm:self-auto shadow-xs">
                {config.deviceName || config.agentId || 'Terminal'}
              </span>
            )}
          </div>

          {/* Dismissible Error Alert */}
          {initializationError && (
            <div
              role="alert"
              className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] dark:border-red-800 dark:bg-red-950/40 px-4 py-3 text-xs text-[#991B1B] dark:text-red-300 animate-fade-in shadow-xs"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#EF4444]" />
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
                onNavigateTab={(page) => setActivePage(page)}
                onPollNow={handlePollNow}
              />
            )}
            {activePage === 'QUEUE' && (
              <QueueView
                jobs={jobs}
                printers={printers}
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
                onOpenExternal={async (url) => {
                  const api = window.electronAgentAPI;
                  if (!api) throw new Error('PrintFlow Agent must run within the Electron desktop runtime.');
                  await api.openExternal(url);
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
