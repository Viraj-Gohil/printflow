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
import { AboutView, ProfileDeviceView, SettingsPage } from './components/DevicePages';
import {
  Activity,
  CircleHelp,
  LayoutDashboard,
  ListOrdered,
  Printer,
  Settings2,
  ShieldCheck,
  Terminal
} from 'lucide-react';

type AgentPage = 'DASHBOARD' | 'QUEUE' | 'PRINTERS' | 'LOGS' | 'PROFILE' | 'SETTINGS' | 'ABOUT';

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
  spoolerTimeoutMs: 30000
};

const PAGE_DETAILS: Record<AgentPage, { title: string; description: string; icon: React.ReactNode }> = {
  DASHBOARD: { title: 'Dashboard', description: 'Live overview of this print terminal.', icon: <LayoutDashboard /> },
  QUEUE: { title: 'Print Queue', description: 'Review local jobs, their progress, and any attention required.', icon: <ListOrdered /> },
  PRINTERS: { title: 'Printers', description: 'Installed Windows printers discovered by this agent.', icon: <Printer /> },
  LOGS: { title: 'Live Logs', description: 'Recent agent, network, authentication, and spooler events.', icon: <Terminal /> },
  PROFILE: { title: 'Profile & Device', description: 'Pairing identity, credential state, and backend connection.', icon: <ShieldCheck /> },
  SETTINGS: { title: 'Settings', description: 'Local polling and startup preferences for this device.', icon: <Settings2 /> },
  ABOUT: { title: 'About', description: 'Application information and support links.', icon: <CircleHelp /> }
};

const NAVIGATION: Array<{ id: AgentPage; label: string; icon: React.ReactNode }> = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard /> },
  { id: 'QUEUE', label: 'Print Queue', icon: <ListOrdered /> },
  { id: 'PRINTERS', label: 'Printers', icon: <Printer /> },
  { id: 'LOGS', label: 'Live Logs', icon: <Terminal /> },
  { id: 'PROFILE', label: 'Profile & Device', icon: <ShieldCheck /> },
  { id: 'SETTINGS', label: 'Settings', icon: <Settings2 /> },
  { id: 'ABOUT', label: 'About', icon: <CircleHelp /> }
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
    ]).then(([loadedConfig, loadedStatus, loadedMetrics, loadedPrinters, loadedJobs, loadedLogs]) => {
      if (!active) return;
      setConfig(loadedConfig);
      setStatus(loadedStatus.status);
      setLastHeartbeat(loadedStatus.lastHeartbeat);
      setMetrics(loadedMetrics);
      setPrinters(loadedPrinters);
      setJobs(loadedJobs);
      setLogs(loadedLogs);
    }).catch((error: unknown) => {
      if (!active) return;
      setInitializationError(error instanceof Error ? error.message : 'Could not load agent state.');
      setStatus('ERROR');
    });

    const unsubStatus = api.onStatusChanged((newStatus) => {
      setStatus(newStatus);
      void api.getStatus().then((newDetails) => {
        if (active) setLastHeartbeat(newDetails.lastHeartbeat);
      }).catch(() => undefined);
    });
    const unsubJob = api.onJobUpdated((updatedJob) => {
      setJobs((previous) => {
        const index = previous.findIndex((job) => job.id === updatedJob.id);
        if (index < 0) return [updatedJob, ...previous];
        const next = [...previous];
        next[index] = updatedJob;
        return next;
      });
      void api.getMetrics().then((nextMetrics) => {
        if (active) setMetrics(nextMetrics);
      }).catch(() => undefined);
    });
    const unsubLog = api.onLogAdded((newLog) => setLogs((previous) => [newLog, ...previous.slice(0, 199)]));
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
      if (!api) throw new Error('PrintFlow Agent must run in the Electron desktop app.');
      const result = await api.pollNow();
      if (!result.success) throw new Error(result.error || 'The backend request failed.');
      const [updatedJobs, updatedMetrics] = await Promise.all([api.getJobs(), api.getMetrics()]);
      setJobs(updatedJobs);
      setMetrics(updatedMetrics);
      setInitializationError(null);
    } catch (error) {
      setInitializationError(error instanceof Error ? error.message : 'Could not check the print queue.');
    } finally {
      setIsPolling(false);
    }
  };

  const handleRescanPrinters = async () => {
    setIsScanning(true);
    try {
      const api = window.electronAgentAPI;
      if (!api) throw new Error('PrintFlow Agent must run in the Electron desktop app.');
      setPrinters(await api.rescanPrinters());
      setInitializationError(null);
    } catch (error) {
      setInitializationError(error instanceof Error ? error.message : 'Could not scan installed printers.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleTestPrint = async (printerName: string): Promise<TestPrintResult> => {
    const api = window.electronAgentAPI;
    if (api) return api.testPrint(printerName);
    return { success: false, printerName, message: 'PrintFlow Agent must run in the Electron desktop app.' };
  };

  const handleReprintJob = async (jobId: string) => {
    const api = window.electronAgentAPI;
    if (!api) return;
    const result = await api.reprintJob(jobId);
    if (!result.success) setInitializationError(result.error || 'This job is not safe to retry.');
    else setInitializationError(null);
    setJobs(await api.getJobs());
  };

  const handleCancelJob = async (jobId: string) => {
    const api = window.electronAgentAPI;
    if (!api) return;
    const result = await api.cancelJob(jobId);
    if (!result.success) setInitializationError(result.error || 'Could not cancel the queued job.');
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
    if (!api) return { success: false, error: 'PrintFlow Agent must run in the Electron desktop app.' };
    const result = await api.saveConfig(partial);
    if (result.success) {
      const [savedConfig, savedMetrics] = await Promise.all([api.getConfig(), api.getMetrics()]);
      setConfig(savedConfig);
      setMetrics(savedMetrics);
      setInitializationError(null);
    } else {
      setInitializationError(result.error || 'Could not save agent settings.');
    }
    return result;
  };

  const handlePairDevice = async (data: { serverUrl: string; shopId: string; authToken: string; deviceName?: string }) => {
    const api = window.electronAgentAPI;
    if (!api) return { success: false, error: 'PrintFlow Agent must run in the Electron desktop app.' };
    const result = await api.pairDevice(data);
    const [savedConfig, connection, savedMetrics] = await Promise.all([api.getConfig(), api.getStatus(), api.getMetrics()]);
    setConfig(savedConfig);
    setStatus(connection.status);
    setLastHeartbeat(connection.lastHeartbeat);
    setMetrics(savedMetrics);
    setInitializationError(result.success ? null : result.error || 'Device pairing failed.');
    return result;
  };

  const handleTestConnection = async () => {
    const api = window.electronAgentAPI;
    if (!api) return { success: false, error: 'PrintFlow Agent must run in the Electron desktop app.' };
    const result = await api.testConnection();
    const currentStatus = await api.getStatus();
    setStatus(currentStatus.status);
    setLastHeartbeat(currentStatus.lastHeartbeat);
    return result;
  };

  const handleResetConfig = async () => {
    const api = window.electronAgentAPI;
    if (!api) return { success: false, error: 'PrintFlow Agent must run in the Electron desktop app.' };
    const result = await api.resetConfig();
    if (result.success) {
      setConfig(await api.getConfig());
      setStatus('OFFLINE');
      setLastHeartbeat(null);
      setIsSettingsOpen(false);
    }
    return result;
  };

  const configured = Boolean(config.agentId && config.hasStoredCredentials);
  const currentPage = PAGE_DETAILS[activePage];

  if (!configured) {
    return (
      <div className="setup-screen min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-5 sm:p-8">
        <div className="setup-container w-full max-w-6xl">
          <div className="setup-brand">
            <div className="setup-brand-mark"><Printer /></div>
            <div>
              <div className="setup-brand-name">PrintFlow <span>Agent</span></div>
              <div className="setup-brand-caption">PRINT OPERATIONS DESKTOP</div>
            </div>
          </div>
          <div className="setup-content">
            <section className="setup-welcome">
              <span className="setup-eyebrow"><span className="setup-eyebrow-dot" />WELCOME TO PRINTFLOW</span>
              <h1>Bring your shop’s<br /><span>print queue</span> to life.</h1>
              <p className="setup-description">
                Connect this computer to your PrintFlow shop and let the Agent securely deliver authorized customer jobs to your printers.
              </p>
              <div className="setup-benefits">
                <div><span className="setup-benefit-icon"><ShieldCheck /></span><span><strong>Shop-authorized jobs</strong><small>Only jobs assigned to your paired shop</small></span></div>
                <div><span className="setup-benefit-icon"><Printer /></span><span><strong>Ready for your printers</strong><small>Connect to printers installed on this PC</small></span></div>
                <div><span className="setup-benefit-icon"><Activity /></span><span><strong>Live job visibility</strong><small>Track queue and printing activity here</small></span></div>
              </div>
              <div className="setup-secure-note"><ShieldCheck /><span>Your device token is protected using Windows secure credential storage.</span></div>
            </section>
            <div className="setup-form-wrap">
              <div className="setup-form-heading">
                <span>GET STARTED</span>
                <h2>Connect your device</h2>
                <p>Use the device token from your PrintFlow Shop Dashboard.</p>
              </div>
            {initializationError && <p role="alert" className="mt-3 text-sm text-red-300">{initializationError}</p>}
          <SettingsModal
            config={config}
            printers={printers}
            isOpen
            required
            onClose={() => undefined}
            onSave={handleSaveConfig}
            onPair={handlePairDevice}
          />
            </div>
          </div>
          <p className="setup-footer">PRINTFLOW AGENT <span>·</span> SECURE SHOP CONNECTION</p>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-app min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header
        status={status}
        lastHeartbeat={lastHeartbeat}
        config={config}
        isPolling={isPolling}
        onPollNow={handlePollNow}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onMinimizeToTray={() => window.electronAgentAPI?.minimizeToTray()}
      />

      <div className="agent-layout mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:flex-row">
        <nav aria-label="Primary navigation" className="agent-sidebar h-fit w-full shrink-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-2 lg:sticky lg:top-24 lg:w-56">
          <div className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Workspace</div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
            {NAVIGATION.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-current={activePage === item.id ? 'page' : undefined}
                onClick={() => setActivePage(item.id)}
                className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  activePage === item.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {item.id === 'QUEUE' && metrics.queuedJobs > 0 && (
                  <span className="ml-auto rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">{metrics.queuedJobs}</span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-3 hidden border-t border-slate-800 px-3 pt-3 text-[11px] text-slate-500 lg:block">
            <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />{printers.length} installed printer{printers.length === 1 ? '' : 's'}</span>
          </div>
        </nav>

        <main className="agent-main min-w-0 flex-1 space-y-5">
          <div className="agent-page-heading flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-xl border border-slate-700 bg-slate-800 p-2 text-blue-300 [&>svg]:h-4 [&>svg]:w-4">{currentPage.icon}</span>
              <div>
                <h1 className="text-lg font-bold text-white">{currentPage.title}</h1>
                <p className="mt-1 text-xs text-slate-400">{currentPage.description}</p>
              </div>
            </div>
            {activePage === 'PROFILE' && <span className="text-xs text-slate-500">{config.deviceName || config.agentId}</span>}
          </div>

          {initializationError && (
            <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <span>{initializationError}</span>
              <button type="button" onClick={() => setInitializationError(null)} aria-label="Dismiss error" className="text-red-300 hover:text-white">Dismiss</button>
            </div>
          )}

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
            <QueueView jobs={jobs} printers={printers} onReprintJob={handleReprintJob} onCancelJob={handleCancelJob} onClearCompleted={handleClearCompleted} onPollNow={handlePollNow} />
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
                if (api && await api.clearLogs()) setLogs([]);
              }}
              onExportLogs={async () => {
                const api = window.electronAgentAPI;
                if (!api) return { success: false };
                return api.exportLogs();
              }}
            />
          )}
          {activePage === 'PROFILE' && (
            <ProfileDeviceView
              config={config}
              status={status}
              lastHeartbeat={lastHeartbeat}
              onSave={handleSaveConfig}
              onTestConnection={handleTestConnection}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenLogs={() => setActivePage('LOGS')}
              onCopyDeviceId={(deviceId) => window.electronAgentAPI?.copyText(deviceId) || Promise.resolve(false)}
            />
          )}
          {activePage === 'SETTINGS' && <SettingsPage config={config} onSave={handleSaveConfig} onReset={handleResetConfig} />}
          {activePage === 'ABOUT' && (
            <AboutView onOpenExternal={async (url) => {
              const api = window.electronAgentAPI;
              if (!api) throw new Error('PrintFlow Agent must run in the Electron desktop app.');
              await api.openExternal(url);
            }} />
          )}
        </main>
      </div>

      <SettingsModal
        config={config}
        printers={printers}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveConfig}
        onPair={handlePairDevice}
      />
    </div>
  );
};
