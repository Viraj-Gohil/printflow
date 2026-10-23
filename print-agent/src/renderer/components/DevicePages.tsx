import React, { useState, useEffect } from 'react';
import { AgentConfig, AgentConnectionStatus, DiscoveredPrinter } from '../types/agent';
import {
  Activity,
  ExternalLink,
  Fingerprint,
  Info,
  KeyRound,
  RotateCw,
  Settings2,
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
  Palette
} from 'lucide-react';
import { useTheme, ThemePreference } from '../context/ThemeContext';
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
  const [globalMessage, setGlobalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Synchronize state when config changes externally
  useEffect(() => {
    setDeviceName(config.deviceName || '');
    setPollIntervalMs(config.pollIntervalMs || 5000);
    setAutoStartOnBoot(config.autoStartOnBoot || false);
    setAllowColorFallback(config.allowColorFallback ?? true);
  }, [config]);

  const { theme, resolvedTheme, setTheme } = useTheme();

  // Handle Terminal Device Name Save
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
        setGlobalMessage({ type: 'success', text: 'Terminal device name updated successfully.' });
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

  // Handle Preferences Save
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

  // Handle Connection Test
  const handleTestConnection = async () => {
    if (isTestingConnection) return;
    setIsTestingConnection(true);
    setGlobalMessage(null);
    try {
      const result = await onTestConnection();
      setGlobalMessage({
        type: result.success ? 'success' : 'error',
        text: result.success
          ? 'Authenticated cloud connection verified successfully.'
          : result.error || 'Cloud connection test failed.'
      });
    } catch (err) {
      setGlobalMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Cloud connection test failed.'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Handle Status Refresh
  const handleRefreshStatus = async () => {
    if (isRefreshingStatus) return;
    setIsRefreshingStatus(true);
    setGlobalMessage(null);
    try {
      const result = await onTestConnection();
      setGlobalMessage({
        type: result.success ? 'success' : 'error',
        text: result.success ? 'Device telemetry refreshed from backend.' : result.error || 'Could not refresh status.'
      });
    } catch (err) {
      setGlobalMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not refresh status.'
      });
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  // Handle Reset Settings & Credentials
  const handleResetSettings = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset all agent preferences and remove the stored device token?\n\n' +
      '• The agent will return to initial setup mode.\n' +
      '• Encrypted credentials will be securely wiped.\n' +
      '• Local print recovery logs and cache will remain preserved.\n\n' +
      'Proceed with reset?'
    );

    if (!confirmed) return;

    setGlobalMessage(null);
    try {
      const result = await onReset();
      if (result.success) {
        setGlobalMessage({
          type: 'success',
          text: 'Settings and credentials were reset successfully.'
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
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Global Feedback Banner */}
      {globalMessage && (
        <div
          role={globalMessage.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 animate-fade-in ${
            globalMessage.type === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {globalMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span>{globalMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalMessage(null)}
            className="text-xs font-semibold hover:opacity-80 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Row 1: Terminal Identity & Connection / Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Section A: Terminal Identity Card */}
        <SettingsCard
          title="Terminal Identity"
          description="Hardware pairing identifiers and counter station identity."
          icon={<Fingerprint className="w-4 h-4" />}
          badge={
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]">
              M2M Verified
            </span>
          }
        >
          <div className="space-y-3.5">
            <ReadOnlyField
              label="Agent Device ID"
              value={config.agentId || 'Not Paired'}
              badge={
                <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                  Read-Only Tag
                </span>
              }
              description="Unique cryptographic device identifier bound to this computer."
              icon={<Fingerprint className="w-4 h-4" />}
              copyable={Boolean(config.agentId)}
              onCopy={onCopyDeviceId}
            />

            <ReadOnlyField
              label="Paired Shop ID"
              value={config.shopId || 'Not Paired'}
              badge={
                <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                  Shop Tenant
                </span>
              }
              description="PrintFlow shop instance authorized to stream print requests to this device."
              icon={<Store className="w-4 h-4" />}
            />



            {/* Editable Terminal Device Name */}
            <form onSubmit={handleSaveDeviceName} className="pt-2 border-t border-[var(--border-default)]">
              <FormField
                label="Terminal Device Name"
                htmlFor="terminal-device-name"
                description="Friendly counter name displayed on your PrintFlow Shop Dashboard."
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
                    idleText="Save Name"
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

        {/* Section B: Connection & Security Card */}
        <SettingsCard
          title="Connection & Security"
          description="Live cloud telemetry, heartbeat status, and hardware vault state."
          icon={<ShieldCheck className="w-4 h-4" />}
          badge={
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]">
              DPAPI Active
            </span>
          }
        >
          <div className="space-y-3.5">
            {/* Status Item: Agent Connection */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)]">
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                  Agent Connection Status
                </span>
                <span className="text-xs font-bold text-[var(--text-primary)] mt-0.5 block">
                  {status === 'ONLINE'
                    ? 'Connected (Synchronized)'
                    : status === 'CONNECTING'
                    ? 'Connecting to Cloud...'
                    : status === 'ERROR'
                    ? 'Sync Error Encountered'
                    : 'Offline / Disconnected'}
                </span>
              </div>
              <AgentStatusBadge status={status} />
            </div>

            {/* Status Item: Heartbeat */}
            <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] space-y-1">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                Last Authenticated Heartbeat
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)] font-mono">
                  {lastHeartbeat
                    ? new Date(lastHeartbeat).toLocaleString()
                    : 'No authenticated heartbeat recorded'}
                </span>
                {lastHeartbeat && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>Active</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Periodic handshake verifies terminal presence and token validity.
              </p>
            </div>

            {/* Status Item: Pairing & Vault */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                  Pairing State
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  {config.agentId && config.shopId ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300">Paired &amp; Verified</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-700 dark:text-amber-300">Setup Required</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] space-y-1">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                  Credential Vault
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  {config.credentialStorageStatus === 'SECURE' ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <span className="text-teal-700 dark:text-teal-300">Windows DPAPI</span>
                    </>
                  ) : config.hasStoredCredentials ? (
                    <>
                      <KeyRound className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-700 dark:text-amber-300">Legacy Encrypted</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500">Unconfigured</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11.5px] leading-relaxed text-[var(--text-muted)] pt-1">
              Your device authentication token is encrypted locally with Windows DPAPI via Electron safeStorage and is strictly isolated from renderer scripts.
            </p>

            {/* Action Buttons Toolbar */}
            <div className="pt-2 border-t border-[var(--border-default)] flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="primary-button !min-h-[38px] !px-3 !text-xs font-semibold"
                title="Verify live authentication against the PrintFlow server"
              >
                <Wifi className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                <span>{isTestingConnection ? 'Testing...' : 'Test Cloud Connection'}</span>
              </button>

              <button
                type="button"
                onClick={handleRefreshStatus}
                disabled={isRefreshingStatus}
                className="secondary-button !min-h-[38px] !px-3 !text-xs font-semibold"
                title="Refresh connection status from the backend"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
                <span>{isRefreshingStatus ? 'Refreshing...' : 'Refresh Status'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                className="secondary-button !min-h-[38px] !px-3 !text-xs font-semibold"
                title="Open device pairing dialog to enter or replace credentials"
              >
                <Settings2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Reconnect / Change Token</span>
              </button>

              <button
                type="button"
                onClick={onOpenLogs}
                className="secondary-button !min-h-[38px] !px-3 !text-xs font-semibold"
                title="Open Live Logs console to view telemetry and error traces"
              >
                <Activity className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>View Diagnostics</span>
              </button>
            </div>
          </div>
        </SettingsCard>
      </div>

      {/* Row 2: Section C: Agent Preferences (Full Width Card) */}
      <SettingsCard
        title="Agent Preferences"
        description="Fine-tune cloud polling intervals, Windows autostart behavior, and monochrome fallback rules."
        icon={<SlidersHorizontal className="w-4 h-4" />}
        badge={
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]">
            Local Configuration
          </span>
        }
      >
        <form onSubmit={handleSavePreferences} className="space-y-5">
          {prefError && (
            <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{prefError}</span>
            </div>
          )}

          {/* Section: Appearance & Theme Mode */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] select-none">
                Appearance &amp; Theme Mode
              </label>
              <p className="text-[11.5px] leading-relaxed text-[var(--text-muted)] select-none">
                Select your preferred Ocean Pulse theme or automatically synchronize with Windows OS settings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Light Mode Card */}
              <button
                type="button"
                onClick={() => {
                  setTheme('light');
                  void onSave({ themePreference: 'light' });
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  theme === 'light'
                    ? 'border-blue-600 bg-blue-500/10 ring-2 ring-blue-500/25 shadow-xs'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                    <Sun className="w-4 h-4" />
                  </div>
                  {theme === 'light' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">Light Theme</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    Clean #F5F7FC canvas with high-contrast surfaces
                  </p>
                </div>
              </button>

              {/* Dark Mode Card */}
              <button
                type="button"
                onClick={() => {
                  setTheme('dark');
                  void onSave({ themePreference: 'dark' });
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  theme === 'dark'
                    ? 'border-blue-600 bg-blue-500/10 ring-2 ring-blue-500/25 shadow-xs'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                    <Moon className="w-4 h-4" />
                  </div>
                  {theme === 'dark' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">Dark Theme</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    Deep #0B1020 canvas for low-glare counter stations
                  </p>
                </div>
              </button>

              {/* System Mode Card */}
              <button
                type="button"
                onClick={() => {
                  setTheme('system');
                  void onSave({ themePreference: 'system' });
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  theme === 'system'
                    ? 'border-blue-600 bg-blue-500/10 ring-2 ring-blue-500/25 shadow-xs'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-500 flex items-center justify-center">
                    <Laptop className="w-4 h-4" />
                  </div>
                  {theme === 'system' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">System (Auto)</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                    Matches Windows OS ({resolvedTheme === 'dark' ? 'Dark active' : 'Light active'})
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Polling Frequency Select */}
          <div className="max-w-md">
            <FormField
              label="Queue Polling Frequency"
              htmlFor="queue-poll-frequency"
              description="Interval between automated requests checking for new customer print jobs."
            >
              <SelectInput
                id="queue-poll-frequency"
                value={pollIntervalMs}
                onChange={(e) => setPollIntervalMs(Number(e.target.value))}
              >
                <option value={3000}>3 Seconds (High Speed Counter - Recommended for busy shops)</option>
                <option value={5000}>5 Seconds (Standard Frequency - Default)</option>
                <option value={10000}>10 Seconds (Low Network Overhead - Recommended for metered connections)</option>
              </SelectInput>
            </FormField>
          </div>

          {/* Checkboxes / Switches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-default)]">
            <ToggleSwitch
              id="autostart-on-boot"
              checked={autoStartOnBoot}
              onChange={setAutoStartOnBoot}
              label="Launch Agent on Windows Sign-in"
              description="Automatically launch PrintFlow Agent in the background system tray whenever the Windows user signs in."
            />

            <ToggleSwitch
              id="allow-color-fallback"
              checked={allowColorFallback}
              onChange={setAllowColorFallback}
              label="Allow Monochrome Fallback"
              description="Permit black & white printing if the assigned physical printer runs out of color ink or only supports monochrome."
            />
          </div>

          {/* Actions Bar */}
          <div className="pt-4 border-t border-[var(--border-default)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SaveButton
                status={prefSaveStatus}
                idleText="Save Preferences"
                savingText="Saving Preferences..."
                savedText="Preferences Saved ✓"
                errorText="Save Failed"
                disabled={prefSaveStatus === 'saving'}
                className="!min-h-[44px]"
              />
            </div>

            <button
              type="button"
              onClick={handleResetSettings}
              className="danger-button !min-h-[44px] !px-4 !text-xs font-semibold"
              title="Reset configuration and erase saved device credentials"
            >
              <WifiOff className="w-4 h-4" />
              <span>Reset Settings &amp; Credentials</span>
            </button>
          </div>
        </form>
      </SettingsCard>

      {/* Row 3: Section D: Printer Summary */}
      <SettingsCard
        title="Printer Summary"
        description="Local and network Windows printers available on this terminal."
        icon={<Printer className="w-4 h-4" />}
        headerAction={
          <button
            type="button"
            onClick={onNavigatePrinters}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <span>Manage Printers &amp; Trays ({printers.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        }
      >
        {printers.length === 0 ? (
          <div className="py-8 text-center space-y-2 border border-dashed border-[var(--border-default)] rounded-xl bg-[var(--bg-subtle)]">
            <Printer className="w-8 h-8 text-[var(--text-faint)] mx-auto" />
            <p className="text-xs font-semibold text-[var(--text-secondary)]">No installed Windows printers detected</p>
            <p className="text-[11px] text-[var(--text-muted)] max-w-sm mx-auto">
              Connect a physical or virtual printer in Windows, then rescan from the Printers view.
            </p>
            <button
              type="button"
              onClick={onNavigatePrinters}
              className="secondary-button !min-h-[32px] !text-xs mt-1"
            >
              <span>Go to Printers</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pb-1 border-b border-[var(--border-subtle)]">
              <span>
                <strong>{printers.length}</strong> Windows printer{printers.length === 1 ? '' : 's'} discovered •{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">{onlinePrintersCount}</strong> online
              </span>
              <span>
                Active Spooler Target:{' '}
                <strong className="text-[var(--text-primary)]">
                  {config.selectedPrinterName || 'System Default'}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {printers.slice(0, 6).map((p) => {
                const isSelected = config.selectedPrinterName
                  ? config.selectedPrinterName === p.name
                  : p.isDefault;

                return (
                  <div
                    key={p.name}
                    className={`p-3 rounded-xl border bg-[var(--bg-subtle)] flex items-start justify-between gap-2 text-xs transition-colors ${
                      isSelected
                        ? 'border-teal-500/50 bg-teal-500/5 ring-1 ring-teal-500/20'
                        : 'border-[var(--border-default)]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[var(--text-primary)] truncate">{p.displayName}</span>
                        {p.isDefault && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-default)] shrink-0">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-[var(--text-muted)] truncate mt-0.5 flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-[var(--text-faint)] shrink-0" />
                        <span>{p.driverName || 'Windows Driver'}</span>
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-[var(--text-faint)] mt-1">
                        <span>{p.capabilities.supportsColor ? 'Color' : 'Monochrome'}</span>
                        <span>•</span>
                        <span>{p.capabilities.supportsDuplex ? 'Duplex' : 'Simplex'}</span>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${
                        p.isOnline
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                );
              })}
            </div>

            {printers.length > 6 && (
              <p className="text-[11px] text-[var(--text-muted)] text-right">
                Showing 6 of {printers.length} printers. Click &quot;Manage Printers &amp; Trays&quot; to inspect all.
              </p>
            )}
          </div>
        )}
      </SettingsCard>
    </div>
  );
};

export const AboutView: React.FC<{ onOpenExternal: (url: string) => Promise<void> }> = ({ onOpenExternal }) => (
  <section className="max-w-2xl space-y-5 animate-fade-in">
    <div className="pf-card p-6 space-y-4">
      <div className="flex items-center gap-3.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
          <Info className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-[var(--text-primary)]">PrintFlow Desktop Agent</h3>
          <p className="text-xs text-[var(--text-muted)] font-mono">
            v{packageMetadata.version} • Windows x64 Spooler Service
          </p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
        Bridges your authorized PrintFlow web shop to locally connected Windows printers. Jobs are verified, downloaded over TLS,
        rasterized, and queued directly to the native Windows print subsystem with complete crash-resilient local recovery.
      </p>

      <div className="pt-2">
        <button
          type="button"
          onClick={() => void onOpenExternal('https://printflow.cloud')}
          className="secondary-button !text-xs font-semibold"
        >
          <ExternalLink className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Open PrintFlow Cloud Portal</span>
        </button>
      </div>

      <div className="grid gap-2.5 pt-4 border-t border-[var(--border-default)] text-xs text-[var(--text-muted)] sm:grid-cols-2">
        <span className="inline-flex items-center gap-2">
          <Store className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Shop-specific M2M token pairing</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>Windows DPAPI safeStorage encryption</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Wifi className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>Heartbeat health diagnostics</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Laptop className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Native Win32 driver integration</span>
        </span>
      </div>
    </div>
  </section>
);

// Backward-compatibility aliases if required by external consumers
export const ProfileDeviceView = DevicePreferencesView;
export const SettingsPage = DevicePreferencesView;
