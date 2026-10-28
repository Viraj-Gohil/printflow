import React, { useState, useEffect } from 'react';
import { AgentConfig, AgentConnectionStatus, DiscoveredPrinter } from '../types/agent';
import {
  Activity,
  ExternalLink,
  Fingerprint,
  Info,
  ShieldCheck,
  Store,
  Wifi,
  WifiOff,
  Laptop,
  SlidersHorizontal,
  Printer,
  ArrowRight,
  RefreshCw,
  Check,
  AlertTriangle,
  HardDrive,
  Sun,
  Moon,
  LogOut,
  Server
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { AgentStatusBadge } from './StatusBadge';
import {
  FormField,
  ReadOnlyField,
  TextInput,
  SelectInput,
  ToggleSwitch,
  SettingsCard,
  SaveButton
} from './ui/FormControls';
import packageMetadata from '../../../package.json';

export interface DevicePreferencesViewProps {
  config: AgentConfig;
  status: AgentConnectionStatus;
  lastHeartbeat: string | null;
  printers: DiscoveredPrinter[];
  onSave: (values: Partial<AgentConfig>) => Promise<{ success: boolean; error?: string }>;
  onTestConnection: () => Promise<{ success: boolean; error?: string }>;
  onReset: () => Promise<{ success: boolean; error?: string }>;
  onDisconnect?: () => Promise<{ success: boolean; error?: string }>;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
  onNavigatePrinters: () => void;
  onCopyDeviceId: (deviceId: string) => Promise<boolean>;
}

export const DevicePreferencesView: React.FC<DevicePreferencesViewProps> = ({
  config,
  status,
  lastHeartbeat,
  printers,
  onSave,
  onTestConnection,
  onReset,
  onDisconnect,
  onOpenSettings,
  onOpenLogs,
  onNavigatePrinters,
  onCopyDeviceId
}) => {
  // Terminal Device Name State
  const [deviceName, setDeviceName] = useState(config.deviceName || '');
  const [nameSaveStatus, setNameSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [nameError, setNameError] = useState<string | null>(null);

  // Agent Preferences State
  const [pollIntervalMs, setPollIntervalMs] = useState(config.pollIntervalMs || 5000);
  const [autoStartOnBoot, setAutoStartOnBoot] = useState(config.autoStartOnBoot || false);
  const [allowColorFallback, setAllowColorFallback] = useState(config.allowColorFallback ?? true);
  const [prefSaveStatus, setPrefSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [prefError, setPrefError] = useState<string | null>(null);

  // Connection Test & Diagnostics State
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setDeviceName(config.deviceName || '');
    setPollIntervalMs(config.pollIntervalMs || 5000);
    setAutoStartOnBoot(config.autoStartOnBoot || false);
    setAllowColorFallback(config.allowColorFallback ?? true);
  }, [config]);

  const { theme, resolvedTheme, setTheme } = useTheme();

  const handleCopyText = async (text: string, label: string): Promise<boolean> => {
    if (!text) return false;
    let success = false;
    if (window.electronAgentAPI?.copyText) {
      success = await window.electronAgentAPI.copyText(text);
    } else {
      await navigator.clipboard.writeText(text);
      success = true;
    }
    setGlobalMessage({
      type: 'success',
      text: `${label} copied to clipboard!`
    });
    setTimeout(() => {
      setGlobalMessage(null);
    }, 2500);
    return success;
  };

  const handleSaveDeviceName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (nameSaveStatus === 'saving' || !deviceName.trim() || deviceName === config.deviceName) return;

    setNameSaveStatus('saving');
    setNameError(null);
    setGlobalMessage(null);

    try {
      const result = await onSave({ deviceName: deviceName.trim() });
      if (result.success) {
        setNameSaveStatus('saved');
        setGlobalMessage({ type: 'success', text: 'Terminal device name updated.' });
        setTimeout(() => setNameSaveStatus('idle'), 2500);
      } else {
        setNameSaveStatus('error');
        setNameError(result.error || 'Failed to update device name.');
        setTimeout(() => setNameSaveStatus('idle'), 3500);
      }
    } catch (err) {
      setNameSaveStatus('error');
      setNameError(err instanceof Error ? err.message : 'Failed to update device name.');
      setTimeout(() => setNameSaveStatus('idle'), 3500);
    }
  };

  const handleSavePreferences = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (prefSaveStatus === 'saving') return;

    setPrefSaveStatus('saving');
    setPrefError(null);
    setGlobalMessage(null);

    try {
      const result = await onSave({
        pollIntervalMs,
        autoStartOnBoot,
        allowColorFallback,
        themePreference: theme
      });

      if (result.success) {
        setPrefSaveStatus('saved');
        setGlobalMessage({ type: 'success', text: 'Agent preferences saved and applied.' });
        setTimeout(() => setPrefSaveStatus('idle'), 2500);
      } else {
        setPrefSaveStatus('error');
        setPrefError(result.error || 'Could not save agent preferences.');
        setTimeout(() => setPrefSaveStatus('idle'), 3500);
      }
    } catch (err) {
      setPrefSaveStatus('error');
      setPrefError(err instanceof Error ? err.message : 'Could not save agent preferences.');
      setTimeout(() => setPrefSaveStatus('idle'), 3500);
    }
  };

  const handleTestConnection = async () => {
    if (isTestingConnection) return;
    setIsTestingConnection(true);
    setGlobalMessage(null);

    try {
      const result = await onTestConnection();
      if (result.success) {
        setGlobalMessage({
          type: 'success',
          text: 'PrintFlow Cloud handshake successful! Terminal is connected.'
        });
      } else {
        setGlobalMessage({
          type: 'error',
          text: result.error || 'Connection test failed. Verify network access.'
        });
      }
    } catch (err) {
      setGlobalMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network test error.'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (isRefreshingStatus) return;
    setIsRefreshingStatus(true);
    try {
      await onTestConnection();
      setGlobalMessage({ type: 'success', text: 'Status refreshed.' });
      setTimeout(() => setGlobalMessage(null), 2000);
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const handleResetSettings = async () => {
    if (!window.confirm('Reset local agent configuration and erase stored device credentials?')) return;
    setGlobalMessage(null);
    try {
      const result = await onReset();
      if (result.success) {
        setGlobalMessage({
          type: 'success',
          text: 'Settings and credentials were reset.'
        });
      } else {
        setGlobalMessage({
          type: 'error',
          text: result.error || 'Could not reset settings.'
        });
      }
    } catch (err) {
      setGlobalMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not reset settings.'
      });
    }
  };

  const onlinePrintersCount = printers.filter((p) => p.isOnline).length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Global Feedback Banner */}
      {globalMessage && (
        <div
          role={globalMessage.type === 'error' ? 'alert' : 'status'}
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs animate-fade-in ${
            globalMessage.type === 'success'
              ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {globalMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-[#10B981] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
            )}
            <span className="font-semibold">{globalMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalMessage(null)}
            className="text-xs font-bold underline hover:opacity-80 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Row 1: Identity & Security Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section A: Device Identity */}
        <SettingsCard
          title="Station Identity"
          description="Hardware computer identity registered to your PrintFlow shop."
          icon={<Laptop className="w-4 h-4 text-[#2563EB]" />}
        >
          <div className="space-y-4">
            <ReadOnlyField
              label="Agent Device ID"
              value={config.agentId || 'Not Paired'}
              description="Cryptographic terminal identifier bound to this computer."
              icon={<Fingerprint className="w-4 h-4" />}
              copyable={Boolean(config.agentId)}
              onCopy={onCopyDeviceId}
            />

            <ReadOnlyField
              label="Paired Shop ID"
              value={config.shopId || 'Not Paired'}
              description="Authorized shop instance receiving customer print orders."
              icon={<Store className="w-4 h-4" />}
              copyable={Boolean(config.shopId)}
              onCopy={(val) => handleCopyText(val, 'Paired Shop ID')}
            />

            <ReadOnlyField
              label="Detected System Hostname"
              value={config.deviceName || 'Detecting...'}
              description="Windows operating system hostname bound to this agent."
              icon={<HardDrive className="w-4 h-4" />}
              copyable={Boolean(config.deviceName)}
              onCopy={(val) => handleCopyText(val, 'Host Name')}
            />

            <form onSubmit={handleSaveDeviceName} className="pt-2 border-t border-[#E2E8F0] dark:border-slate-800">
              <FormField
                label="Friendly Counter Name"
                htmlFor="terminal-device-name"
                description="Label shown on your web shop dashboard for this station."
                error={nameError || undefined}
                required
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <TextInput
                    id="terminal-device-name"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="e.g. Counter PC 1"
                    maxLength={100}
                    icon={<Laptop className="w-4 h-4" />}
                    disabled={nameSaveStatus === 'saving'}
                  />
                  <SaveButton
                    status={nameSaveStatus}
                    idleText="Save Label"
                    savingText="Saving..."
                    savedText="Saved ✓"
                    errorText="Error"
                    disabled={!deviceName.trim() || deviceName === config.deviceName}
                    className="sm:w-auto shrink-0"
                  />
                </div>
              </FormField>
            </form>
          </div>
        </SettingsCard>

        {/* Section B: Connection & Security */}
        <SettingsCard
          title="Session & Security"
          description="Cloud synchronization telemetry, DPAPI vault, and session management."
          icon={<ShieldCheck className="w-4 h-4 text-[#2563EB]" />}
        >
          <div className="space-y-4">
            {/* Status Item */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider block">
                  Session Status
                </span>
                <span className="text-xs font-bold text-[#0F172A] dark:text-white mt-0.5 block">
                  {status === 'ONLINE' || status === 'CONNECTED'
                    ? 'Active Station'
                    : status === 'CONNECTING'
                    ? 'Connecting to Cloud...'
                    : status === 'REVOKED'
                    ? 'Session Replaced by another PC'
                    : 'Disconnected'}
                </span>
              </div>
              <AgentStatusBadge status={status} />
            </div>

            {/* Heartbeat Status */}
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider block">
                Last Heartbeat
              </span>
              <p className="text-xs font-mono font-bold text-[#0F172A] dark:text-slate-200">
                {lastHeartbeat ? new Date(lastHeartbeat).toLocaleString() : 'No authenticated heartbeat'}
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Background ping proves this station is ready to receive and print documents.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="secondary-button !min-h-[38px] !text-xs font-semibold"
              >
                <Wifi className={`w-3.5 h-3.5 text-[#2563EB] ${isTestingConnection ? 'animate-pulse' : ''}`} />
                <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenLogs}
                className="secondary-button !min-h-[38px] !text-xs font-semibold"
              >
                <Activity className="w-3.5 h-3.5 text-[#64748B]" />
                <span>View Diagnostics</span>
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                className="secondary-button !min-h-[38px] !text-xs font-semibold col-span-full"
              >
                <Store className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Change Shop / Re-pair Token</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDisconnectModal(true)}
                disabled={isDisconnecting}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] shadow-xs transition-colors cursor-pointer col-span-full"
              >
                <LogOut className="w-3.5 h-3.5 text-[#EF4444]" />
                <span>Disconnect Agent from this PC</span>
              </button>
            </div>
          </div>
        </SettingsCard>
      </div>

      {/* Disconnect Confirmation Dialog */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#131D33] border border-[#E2E8F0] dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 max-w-sm w-full text-center">
            <div className="w-11 h-11 rounded-full bg-[#FEF2F2] text-[#EF4444] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                Disconnect Print Agent?
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
                Disconnecting will stop automatic printing on this PC and release the active device assignment for this shop.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                disabled={isDisconnecting}
                className="secondary-button flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsDisconnecting(true);
                  try {
                    if (onDisconnect) await onDisconnect();
                    else if (window.electronAgentAPI?.disconnectDevice) await window.electronAgentAPI.disconnectDevice();
                    setShowDisconnectModal(false);
                  } catch (err: any) {
                    setGlobalMessage({ type: 'error', text: err?.message || 'Failed to disconnect agent.' });
                  } finally {
                    setIsDisconnecting(false);
                  }
                }}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#EF4444] hover:bg-[#DC2626] text-white transition-colors cursor-pointer flex-1"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 2: Agent Preferences */}
      <SettingsCard
        title="Spooler & Agent Preferences"
        description="Configure polling frequency, Windows autostart behavior, and monochrome fallback rules."
        icon={<SlidersHorizontal className="w-4 h-4 text-[#2563EB]" />}
      >
        <form onSubmit={handleSavePreferences} className="space-y-5">
          {prefError && (
            <div role="alert" className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{prefError}</span>
            </div>
          )}

          {/* Polling Frequency Select */}
          <div className="max-w-md">
            <FormField
              label="Queue Polling Frequency"
              htmlFor="queue-poll-frequency"
              description="Interval between automated requests checking for paid customer print jobs."
            >
              <SelectInput
                id="queue-poll-frequency"
                value={pollIntervalMs}
                onChange={(e) => setPollIntervalMs(Number(e.target.value))}
              >
                <option value={3000}>3 Seconds (High Speed Counter - Recommended for busy Xerox shops)</option>
                <option value={5000}>5 Seconds (Standard Frequency - Default)</option>
                <option value={10000}>10 Seconds (Low Network Overhead)</option>
              </SelectInput>
            </FormField>
          </div>

          {/* Toggle Switches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#E2E8F0] dark:border-slate-800">
            <ToggleSwitch
              id="autostart-on-boot"
              checked={autoStartOnBoot}
              onChange={setAutoStartOnBoot}
              label="Launch on Windows Sign-in"
              description="Automatically launch PrintFlow Agent in the background system tray when your Windows PC starts."
            />

            <ToggleSwitch
              id="allow-color-fallback"
              checked={allowColorFallback}
              onChange={setAllowColorFallback}
              label="Monochrome (B&W) Fallback"
              description="Permit black & white printing if the assigned physical printer runs out of color toner."
            />
          </div>

          {/* Action Button */}
          <div className="pt-4 border-t border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between gap-3">
            <SaveButton
              status={prefSaveStatus}
              idleText="Save Preferences"
              savingText="Saving Preferences..."
              savedText="Preferences Saved ✓"
              errorText="Save Failed"
              disabled={prefSaveStatus === 'saving'}
            />

            <button
              type="button"
              onClick={handleResetSettings}
              className="secondary-button !text-xs text-[#64748B] hover:text-[#EF4444]"
              title="Reset configuration and erase saved device credentials"
            >
              <WifiOff className="w-4 h-4" />
              <span>Reset Configuration</span>
            </button>
          </div>
        </form>
      </SettingsCard>
    </div>
  );
};

export const AboutView: React.FC<{ onOpenExternal: (url: string) => Promise<void> }> = ({ onOpenExternal }) => (
  <section className="max-w-2xl space-y-6 animate-fade-in">
    <div className="pf-card p-6 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card space-y-5">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/60 border border-[#BFDBFE] dark:border-blue-800 text-[#2563EB] flex items-center justify-center">
          <Printer className="w-6 h-6 stroke-[2]" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#0F172A] dark:text-white">PrintFlow Desktop Agent</h3>
          <p className="text-xs text-[#64748B] dark:text-slate-400 font-mono mt-0.5">
            Version v{packageMetadata.version} · Windows x64 Spooler Service
          </p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-[#475569] dark:text-slate-300">
        Bridges your authorized PrintFlow web shop directly to Windows physical printers. Print orders are securely downloaded over TLS, rasterized locally, and sent to the native Windows Win32 Print Spooler with complete crash-resilient queue safety.
      </p>

      <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 text-xs">
        <div>
          <span className="text-[#64748B] dark:text-slate-400 text-[11px] block font-medium">Application Version</span>
          <span className="font-mono font-bold text-[#0F172A] dark:text-slate-200">v{packageMetadata.version}</span>
        </div>
        <div>
          <span className="text-[#64748B] dark:text-slate-400 text-[11px] block font-medium">Target Subsystem</span>
          <span className="font-semibold text-[#0F172A] dark:text-slate-200">Win32 Print Spooler</span>
        </div>
        <div>
          <span className="text-[#64748B] dark:text-slate-400 text-[11px] block font-medium">Security Vault</span>
          <span className="font-semibold text-[#0F172A] dark:text-slate-200">Windows safeStorage DPAPI</span>
        </div>
        <div>
          <span className="text-[#64748B] dark:text-slate-400 text-[11px] block font-medium">Session Policy</span>
          <span className="font-semibold text-[#10B981]">Single Active PC (Enforced)</span>
        </div>
      </div>

      <div className="pt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void onOpenExternal('https://printflow.cloud')}
          className="secondary-button !text-xs font-semibold"
        >
          <ExternalLink className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>Open Web Dashboard</span>
        </button>
      </div>
    </div>
  </section>
);

export const ProfileDeviceView = DevicePreferencesView;
export const SettingsPage = DevicePreferencesView;
