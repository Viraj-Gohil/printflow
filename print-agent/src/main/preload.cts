import { contextBridge, ipcRenderer } from 'electron';
import { AgentConfig, AgentConnectionStatus, DiscoveredPrinter, PrintJobItem, AgentLogEntry, TestPrintResult, QueueMetrics } from '../renderer/types/agent.js';

// Secure Preload Bridge exposing strictly typed IPC methods
contextBridge.exposeInMainWorld('electronAgentAPI', {
  // Configuration
  getConfig: (): Promise<AgentConfig> => ipcRenderer.invoke('agent:get-config'),
  getHostname: (): Promise<string> => ipcRenderer.invoke('system:get-hostname'),
  saveConfig: (config: Partial<AgentConfig>): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('agent:save-config', config),
  pairDevice: (pairingData: { serverUrl: string; shopId: string; authToken: string; deviceName?: string }): Promise<{ success: boolean; error?: string; code?: string; activeDevice?: any }> =>
    ipcRenderer.invoke('agent:pair-device', pairingData),
  disconnectDevice: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('agent:disconnect-device'),
  testConnection: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('agent:test-connection'),
  resetConfig: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('agent:reset-config'),

  // Status & Metrics
  getStatus: (): Promise<{ status: AgentConnectionStatus; lastHeartbeat: string | null; error?: string }> =>
    ipcRenderer.invoke('agent:get-status'),
  getShopInfo: (): Promise<{ success: boolean; shopInfo?: import('../renderer/types/agent.js').ShopDetails; error?: string }> =>
    ipcRenderer.invoke('agent:get-shop-info'),
  getMetrics: (): Promise<QueueMetrics> => ipcRenderer.invoke('agent:get-metrics'),

  // Printers
  getPrinters: (): Promise<DiscoveredPrinter[]> => ipcRenderer.invoke('printer:get-list'),
  rescanPrinters: (): Promise<DiscoveredPrinter[]> => ipcRenderer.invoke('printer:rescan'),
  setPrinterRegistered: (printerName: string, registered: boolean): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('printer:set-registered', printerName, registered),
  setPrinterEnabled: (printerName: string, enabled: boolean): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('printer:set-enabled', printerName, enabled),
  testPrint: (printerName: string): Promise<TestPrintResult> => ipcRenderer.invoke('printer:test-print', printerName),

  // Jobs Queue
  getJobs: (): Promise<PrintJobItem[]> => ipcRenderer.invoke('jobs:get-list'),
  pollNow: (): Promise<{ success: boolean; newJobsCount: number; error?: string }> => ipcRenderer.invoke('jobs:poll-now'),
  reprintJob: (jobId: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('jobs:reprint', jobId),
  cancelJob: (jobId: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('jobs:cancel', jobId),
  clearCompletedJobs: (): Promise<boolean> => ipcRenderer.invoke('jobs:clear-completed'),

  // Logs
  getLogs: (): Promise<AgentLogEntry[]> => ipcRenderer.invoke('logs:get-list'),
  clearLogs: (): Promise<boolean> => ipcRenderer.invoke('logs:clear'),
  exportLogs: (): Promise<{ success: boolean; filePath?: string }> => ipcRenderer.invoke('logs:export'),

  // Window Controls
  minimizeToTray: (): void => ipcRenderer.send('window:minimize-to-tray'),
  quitApp: (): void => ipcRenderer.send('window:quit-app'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('window:open-external', url),
  copyText: (text: string): Promise<boolean> => ipcRenderer.invoke('window:copy-text', text),

  // Event Push Subscriptions
  onStatusChanged: (callback: (status: AgentConnectionStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: AgentConnectionStatus) => callback(status);
    ipcRenderer.on('event:status-changed', handler);
    return () => ipcRenderer.removeListener('event:status-changed', handler);
  },

  onJobUpdated: (callback: (job: PrintJobItem) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, job: PrintJobItem) => callback(job);
    ipcRenderer.on('event:job-updated', handler);
    return () => ipcRenderer.removeListener('event:job-updated', handler);
  },

  onLogAdded: (callback: (log: AgentLogEntry) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, log: AgentLogEntry) => callback(log);
    ipcRenderer.on('event:log-added', handler);
    return () => ipcRenderer.removeListener('event:log-added', handler);
  },

  onPrintersUpdated: (callback: (printers: DiscoveredPrinter[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, printers: DiscoveredPrinter[]) => callback(printers);
    ipcRenderer.on('event:printers-updated', handler);
    return () => ipcRenderer.removeListener('event:printers-updated', handler);
  }
});
