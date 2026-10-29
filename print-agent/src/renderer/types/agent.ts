export type AgentConnectionStatus =
  | 'ONLINE'
  | 'CONNECTED'
  | 'OFFLINE'
  | 'DISCONNECTED'
  | 'REVOKED'
  | 'CONNECTING'
  | 'RECONNECTING'
  | 'UNAUTHORIZED'
  | 'RESTRICTED'
  | 'PRINTER_LIMIT_REACHED'
  | 'ERROR';

export type JobPrintStatus =
  | 'QUEUED'
  | 'ASSIGNED'
  | 'DOWNLOADING'
  | 'PRINTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'MANUAL_ATTENTION'
  | 'REQUIRES_ATTENTION';

export interface ShopDetails {
  shopId: string;
  shopName: string;
  shopSlug: string;
  shopStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  agentId: string;
  deviceName: string;
  planName: string;
  planStatus: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
  subscriptionPeriodStart: string | null;
  subscriptionPeriodEnd: string | null;
  printerLimit: number;
  registeredCount: number;
  agentRegisteredCount: number;
  isOperational: boolean;
  restrictionReason: string | null;
  permissions: string[];
}

export interface AgentConfig {
  serverUrl: string;
  shopId: string;
  shopSlug: string;
  agentId: string;
  authToken: string;
  deviceName: string;
  pollIntervalMs: number;
  autoStartOnBoot: boolean;
  selectedPrinterName?: string;
  disabledPrinterNames?: string[];
  registeredPrinterNames?: string[];
  printerLimit?: number;
  allowColorFallback: boolean;
  spoolerTimeoutMs: number;
  hasStoredCredentials?: boolean;
  credentialStorageStatus?: 'SECURE' | 'LEGACY' | 'NONE';
  themePreference?: 'light' | 'dark' | 'system';
  shopDetails?: ShopDetails;
}

export interface DiscoveredPrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
  status: 'READY' | 'PRINTING' | 'OFFLINE' | 'BUSY' | 'ERROR';
  isOnline: boolean;
  driverName?: string;
  portName?: string;
  capabilities: {
    paperSizes: Array<'A4' | 'A3' | 'A5' | 'Letter' | 'Legal'>;
    supportsColor: boolean | null;
    supportsDuplex: boolean | null;
  };
}

export interface PrintFileItem {
  id: string;
  fileName: string;
  fileUrl?: string;
  downloadUrl?: string;
  pageCount: number;
  copies: number;
  colorMode: 'BW' | 'COLOR';
  paperSize: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';
  duplex: boolean;
  pagesToPrint?: string;
}

export interface PrintJobItem {
  id: string;
  orderCode: string;
  shopId: string;
  customerName: string;
  customerPhone?: string;
  files: PrintFileItem[];
  totalAmount: number;
  paymentStatus: 'SUCCESS';
  printStatus: JobPrintStatus;
  claimedBy?: string;
  claimedAt?: string;
  downloadProgress?: number;
  printProgress?: number;
  retryCount?: number;
  errorMessage?: string;
  retrySafe?: boolean;
  pagesPrinted?: number;
  printerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueueMetrics {
  totalJobs: number;
  queuedJobs: number;
  printingJobs: number;
  completedJobs: number;
  failedJobs: number;
  manualAttentionJobs?: number;
  uptimeSeconds: number;
  lastSyncAt: string | null;
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  category: 'AGENT' | 'SPOOLER' | 'NETWORK' | 'AUTH' | 'RECOVERY' | 'STORAGE';
  message: string;
  details?: Record<string, any>;
}

export interface TestPrintResult {
  success: boolean;
  jobId?: string;
  printerName: string;
  message: string;
}

export interface ElectronAgentAPI {
  // Configuration
  getConfig: () => Promise<AgentConfig>;
  saveConfig: (config: Partial<AgentConfig>) => Promise<{ success: boolean; error?: string }>;
  pairDevice: (pairingData: { serverUrl: string; shopId: string; authToken: string; deviceName?: string }) => Promise<{ success: boolean; error?: string; code?: string; activeDevice?: any }>;
  disconnectDevice: () => Promise<{ success: boolean; error?: string }>;
  testConnection: () => Promise<{ success: boolean; error?: string }>;
  resetConfig: () => Promise<{ success: boolean; error?: string }>;
  
  // Status & Metrics
  getStatus: () => Promise<{ status: AgentConnectionStatus; lastHeartbeat: string | null; error?: string }>;
  getShopInfo: () => Promise<{ success: boolean; shopInfo?: ShopDetails; error?: string }>;
  getMetrics: () => Promise<QueueMetrics>;
  
  // Printers
  getPrinters: () => Promise<DiscoveredPrinter[]>;
  rescanPrinters: () => Promise<DiscoveredPrinter[]>;
  setPrinterRegistered: (printerName: string, registered: boolean) => Promise<{ success: boolean; error?: string }>;
  setPrinterEnabled: (printerName: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  testPrint: (printerName: string) => Promise<TestPrintResult>;
  
  // Jobs Queue
  getJobs: () => Promise<PrintJobItem[]>;
  pollNow: () => Promise<{ success: boolean; newJobsCount: number; error?: string }>;
  reprintJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  cancelJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  clearCompletedJobs: () => Promise<boolean>;
  
  // Logs
  getLogs: () => Promise<AgentLogEntry[]>;
  clearLogs: () => Promise<boolean>;
  exportLogs: () => Promise<{ success: boolean; filePath?: string }>;
  
  // Window & System
  minimizeToTray: () => void;
  quitApp: () => void;
  openExternal: (url: string) => Promise<void>;
  getHostname?: () => Promise<string>;
  
  // Event listeners
  onStatusChanged: (callback: (status: AgentConnectionStatus) => void) => () => void;
  onJobUpdated: (callback: (job: PrintJobItem) => void) => () => void;
  onLogAdded: (callback: (log: AgentLogEntry) => void) => () => void;
  onPrintersUpdated: (callback: (printers: DiscoveredPrinter[]) => void) => () => void;
  copyText: (text: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAgentAPI?: ElectronAgentAPI;
  }
}
