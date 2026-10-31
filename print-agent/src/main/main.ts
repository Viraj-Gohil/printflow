import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog, clipboard } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { agentService } from './agent/PrintAgentService.js';
import { localVault } from './storage/LocalDataVault.js';
import { printerManager } from './printer/WindowsPrinterManager.js';
import { logger } from './logger/AgentLogger.js';
import { AgentConfig } from '../renderer/types/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// 1. Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    localVault.reloadConfig();
    createMainWindow();
    createSystemTray();
    app.setLoginItemSettings({ openAtLogin: localVault.getConfig().autoStartOnBoot });

    // Wire up logger broadcast to renderer
    logger.setBroadcastListener((entry) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('event:log-added', entry);
      }
    });

    // Wire up agent service listeners
    agentService.setMainWindow(mainWindow);
    agentService.setOnStatusChangeListener((status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('event:status-changed', status);
      }
      updateTrayMenu();
    });

    agentService.setOnJobUpdateListener((job) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('event:job-updated', job);
      }
    });

    // Start background agent service
    await agentService.start();
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 740,
    minWidth: 860,
    minHeight: 600,
    title: 'PrintFlow Agent - Desktop Spooler Service',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: process.env.NODE_ENV !== 'production'
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Load bundled HTML in production or dist
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')).catch(() => {
      // In local dev without separate renderer build, fall back to index.html
      mainWindow?.loadFile(path.resolve(__dirname, '../../index.html')).catch(() => {});
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createSystemTray() {
  // Simple 16x16 tray icon fallback
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('PrintFlow Agent (Connected)');
  updateTrayMenu();

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const status = agentService.getStatus().status;
  const config = localVault.getConfig();

  const contextMenu = Menu.buildFromTemplate([
    { label: `PrintFlow Agent: ${config.shopSlug || 'Counter'}`, enabled: false },
    { label: `Status: ${status}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    {
      label: 'Check for Jobs Now',
      click: async () => {
        await agentService.pollPendingJobs();
      }
    },
    {
      label: 'Rescan Printers',
      click: async () => {
        await agentService.rescanPrinters();
      }
    },
    { type: 'separator' },
    {
      label: 'Exit Agent',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// ============================================================================
// IPC MAIN HANDLERS
// ============================================================================

ipcMain.handle('system:get-hostname', () => {
  return os.hostname();
});

ipcMain.handle('agent:get-config', () => {
  return localVault.getPublicConfig();
});

ipcMain.handle('agent:save-config', (_event, partial: unknown) => {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial) || 'authToken' in partial) {
    return { success: false, error: 'Invalid settings payload.' };
  }
  const settings = partial as Record<string, unknown>;
  const allowedKeys = new Set([
    'deviceName',
    'pollIntervalMs',
    'autoStartOnBoot',
    'selectedPrinterName',
    'disabledPrinterNames',
    'allowColorFallback',
    'spoolerTimeoutMs'
  ]);
  if (Object.keys(settings).some((key) => !allowedKeys.has(key))) {
    return { success: false, error: 'Unsupported agent setting.' };
  }
  if (
    (settings.deviceName !== undefined && (typeof settings.deviceName !== 'string' || settings.deviceName.length > 100)) ||
    (settings.pollIntervalMs !== undefined &&
      (typeof settings.pollIntervalMs !== 'number' ||
        !Number.isInteger(settings.pollIntervalMs) ||
        settings.pollIntervalMs < 3000 ||
        settings.pollIntervalMs > 10000)) ||
    (settings.autoStartOnBoot !== undefined && typeof settings.autoStartOnBoot !== 'boolean') ||
    (settings.disabledPrinterNames !== undefined &&
      (!Array.isArray(settings.disabledPrinterNames) ||
        settings.disabledPrinterNames.length > 256 ||
        settings.disabledPrinterNames.some((name) => typeof name !== 'string' || name.length > 256))) ||
    (settings.allowColorFallback !== undefined && typeof settings.allowColorFallback !== 'boolean') ||
    (settings.spoolerTimeoutMs !== undefined &&
      (typeof settings.spoolerTimeoutMs !== 'number' ||
        !Number.isInteger(settings.spoolerTimeoutMs) ||
        settings.spoolerTimeoutMs < 5000 ||
        settings.spoolerTimeoutMs > 120000)) ||
    (settings.selectedPrinterName !== undefined &&
      (typeof settings.selectedPrinterName !== 'string' ||
        (settings.selectedPrinterName !== '' &&
          !printerManager.getCachedPrinters().some((printer) => printer.name === settings.selectedPrinterName))))
  ) {
    return { success: false, error: 'Invalid queue or printer settings.' };
  }
  const result = agentService.updateConfig(partial as Partial<AgentConfig>);
  if (result.success && settings.autoStartOnBoot !== undefined) {
    app.setLoginItemSettings({ openAtLogin: settings.autoStartOnBoot as boolean });
  }
  return result;
});

ipcMain.handle('agent:pair-device', async (_event, pairingData: unknown) => {
  if (!pairingData || typeof pairingData !== 'object' || Array.isArray(pairingData)) {
    return { success: false, error: 'Enter the backend URL, shop ID, token, and device name.' };
  }
  const data = pairingData as Record<string, unknown>;
  if (
    typeof data.serverUrl !== 'string' ||
    typeof data.shopId !== 'string' ||
    typeof data.authToken !== 'string' ||
    typeof data.deviceName !== 'string' ||
    !data.serverUrl.trim() ||
    data.serverUrl.length > 2048 ||
    !data.shopId.trim() ||
    data.shopId.length > 200 ||
    !data.authToken ||
    data.authToken.length > 4096 ||
    !data.deviceName.trim() ||
    data.deviceName.length > 100
  ) return { success: false, error: 'Enter the backend URL, shop ID, token, and device name.' };
  return agentService.pairDevice({
    serverUrl: data.serverUrl,
    shopId: data.shopId,
    authToken: data.authToken,
    deviceName: data.deviceName
  });
});

ipcMain.handle('agent:disconnect-device', async () => {
  const result = await agentService.disconnectDevice();
  if (result.success) {
    app.setLoginItemSettings({ openAtLogin: false });
  }
  return result;
});

ipcMain.handle('agent:get-status', () => {
  return agentService.getStatus();
});

ipcMain.handle('agent:get-shop-info', async () => {
  return agentService.getShopInfo();
});

ipcMain.handle('agent:test-connection', async () => agentService.testConnection());

ipcMain.handle('agent:reset-config', () => {
  const result = agentService.resetConfig();
  if (result.success) app.setLoginItemSettings({ openAtLogin: false });
  return result;
});

ipcMain.handle('agent:get-metrics', () => {
  return localVault.getMetrics();
});

ipcMain.handle('printer:get-list', () => {
  return printerManager.getCachedPrinters();
});

ipcMain.handle('printer:is-scanning', () => {
  return agentService.getIsScanningPrinters();
});

ipcMain.handle('printer:rescan', async () => {
  const printers = await agentService.rescanPrinters();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('event:printers-updated', printers);
  }
  return printers;
});

ipcMain.handle('printer:set-registered', async (_event, printerName: unknown, registered: unknown) => {
  if (typeof printerName !== 'string' || !printerName.trim() || typeof registered !== 'boolean') {
    return { success: false, error: 'Select a valid printer registration action.' };
  }
  return agentService.setPrinterRegistered(printerName, registered);
});

ipcMain.handle('printer:set-enabled', async (_event, printerName: unknown, enabled: unknown) => {
  if (typeof printerName !== 'string' || !printerName.trim() || typeof enabled !== 'boolean') {
    return { success: false, error: 'Select a valid printer enablement action.' };
  }
  return agentService.setPrinterEnabled(printerName, enabled);
});

ipcMain.handle('printer:test-print', async (_event, printerName: unknown) => {
  if (typeof printerName !== 'string' || !printerName.trim()) {
    return { success: false, printerName: '', message: 'Select a valid installed printer.' };
  }
  return agentService.testPrint(printerName);
});

ipcMain.handle('printer:get-configs', () => {
  return localVault.getAllPrinterConfigs();
});

ipcMain.handle('printer:save-owner-config', async (_event, printerName: unknown, config: unknown) => {
  if (typeof printerName !== 'string' || !printerName.trim() || typeof config !== 'object' || !config) {
    return { success: false, error: 'Valid printer name and configuration object required.' };
  }
  return agentService.savePrinterOwnerConfig(printerName, config as any);
});

ipcMain.handle('printer:reset-config', async (_event, printerName: unknown) => {
  if (typeof printerName !== 'string' || !printerName.trim()) {
    return { success: false, error: 'Valid printer name required.' };
  }
  return agentService.resetPrinterConfig(printerName);
});

ipcMain.handle('printer:get-detection-details', (_event, printerName: unknown) => {
  if (typeof printerName !== 'string' || !printerName.trim()) {
    return { success: false, error: 'Valid printer name required.' };
  }
  const cfg = localVault.getPrinterConfig(printerName);
  return { success: Boolean(cfg), hardware: cfg?.hardware };
});

ipcMain.handle('jobs:get-list', () => {
  return localVault.getAllJobs();
});

ipcMain.handle('jobs:poll-now', async () => {
  return agentService.pollPendingJobs();
});

ipcMain.handle('jobs:reprint', async (_event, jobId: unknown) => {
  if (typeof jobId !== 'string' || !jobId.trim()) return { success: false, error: 'Invalid job ID.' };
  return agentService.reprintJob(jobId);
});

ipcMain.handle('jobs:cancel', (_event, jobId: unknown) => {
  if (typeof jobId !== 'string' || !jobId.trim()) return { success: false, error: 'Invalid job ID.' };
  return agentService.cancelJob(jobId);
});

ipcMain.handle('jobs:clear-completed', () => {
  localVault.clearCompletedJobs();
  return true;
});

ipcMain.handle('logs:get-list', () => {
  return logger.getRecentLogs();
});

ipcMain.handle('logs:clear', () => {
  logger.clear();
  return true;
});

ipcMain.handle('logs:export', async () => {
  const options = {
    title: 'Export sanitized PrintFlow Agent logs',
    defaultPath: `printflow-agent-logs-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  };
  const result: any = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { success: false };
  fs.writeFileSync(result.filePath, logger.getSanitizedExport(), 'utf8');
  return { success: true, filePath: result.filePath };
});

ipcMain.handle('window:copy-text', (_event, value: unknown) => {
  if (typeof value !== 'string' || value.length > 500) return false;
  clipboard.writeText(value);
  return true;
});
ipcMain.handle('window:open-external', async (_event, url: unknown) => {
  if (typeof url !== 'string') throw new Error('Invalid external URL.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Only HTTP(S) URLs are allowed.');
  await shell.openExternal(parsed.toString());
});

ipcMain.on('window:minimize-to-tray', () => {
  mainWindow?.hide();
});

ipcMain.on('window:quit-app', () => {
  isQuitting = true;
  app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  agentService.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep agent running in background tray unless explicitly quit
  }
});
