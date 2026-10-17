import React, { useState } from 'react';
import { AgentConfig, AgentConnectionStatus } from '../types/agent';
import {
  Activity,
  Copy,
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
  Check,
  Laptop
} from 'lucide-react';
import { AgentStatusBadge } from './StatusBadge';
import packageMetadata from '../../../package.json';

interface ProfileDeviceViewProps {
  config: AgentConfig;
  status: AgentConnectionStatus;
  lastHeartbeat: string | null;
  onSave: (values: Partial<AgentConfig>) => Promise<{ success: boolean; error?: string }>;
  onTestConnection: () => Promise<{ success: boolean; error?: string }>;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
  onCopyDeviceId: (deviceId: string) => Promise<boolean>;
}

export const ProfileDeviceView: React.FC<ProfileDeviceViewProps> = ({
  config,
  status,
  lastHeartbeat,
  onSave,
  onTestConnection,
  onOpenSettings,
  onOpenLogs,
  onCopyDeviceId
}) => {
  const [deviceName, setDeviceName] = useState(config.deviceName);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const runAction = async (action: () => Promise<{ success: boolean; error?: string }>, successText: string) => {
    setIsBusy(true);
    setMessage(null);
    try {
      const result = await action();
      setError(!result.success);
      setMessage(result.success ? successText : result.error || 'The requested operation failed.');
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : 'The requested operation failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const saveDeviceName = () =>
    runAction(() => onSave({ deviceName: deviceName.trim() }), 'Terminal device name updated successfully.');

  const copyDeviceId = async () => {
    if (!config.agentId) return;
    const copied = await onCopyDeviceId(config.agentId);
    setError(!copied);
    setMessage(copied ? 'Agent Device ID copied to clipboard.' : 'Could not copy the device ID.');
    if (copied) {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2500);
    }
  };

  return (
    <section className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-base font-bold text-[var(--text-primary)]">Profile &amp; Terminal Device</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Hardware pairing identity, security credentials, and authenticated backend connectivity.
        </p>
      </div>

      {message && (
        <p
          role={error ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-xs font-medium animate-fade-in ${
            error
              ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Device Identity Card */}
        <div className="pf-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-1 border-b border-[var(--border-default)]">
            <Fingerprint className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Terminal Identity</span>
          </div>

          <InfoRow
            label="Agent Device ID"
            value={<span className="font-mono text-xs">{config.agentId || 'Not Paired'}</span>}
            action={
              config.agentId ? (
                <button
                  type="button"
                  onClick={copyDeviceId}
                  className="secondary-button !min-h-[28px] !px-2.5 !py-1 !text-xs"
                  title="Copy Agent ID to clipboard"
                >
                  {hasCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  <span>{hasCopied ? 'Copied' : 'Copy'}</span>
                </button>
              ) : undefined
            }
          />
          <InfoRow label="Paired Shop ID" value={<span className="font-mono">{config.shopId || 'Not Paired'}</span>} />
          <InfoRow label="Cloud Host Endpoint" value={<span className="font-mono text-xs truncate block max-w-[240px]">{config.serverUrl || 'Not Configured'}</span>} />

          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <label htmlFor="device-name" className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
              Terminal Device Name
            </label>
            <div className="flex gap-2">
              <input
                id="device-name"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                maxLength={100}
                className="settings-input min-w-0 flex-1 !text-xs"
                placeholder="e.g. Counter PC 1"
              />
              <button
                type="button"
                disabled={isBusy || !deviceName.trim() || deviceName === config.deviceName}
                onClick={saveDeviceName}
                className="primary-button !min-h-[36px] !text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Connection & Security Card */}
        <div className="pf-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-1 border-b border-[var(--border-default)]">
            <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Connection &amp; Security</span>
          </div>

          <InfoRow label="Agent Connection" value={<AgentStatusBadge status={status} />} />
          <InfoRow
            label="Last Authenticated Heartbeat"
            value={lastHeartbeat ? new Date(lastHeartbeat).toLocaleString() : 'No successful heartbeat'}
          />
          <InfoRow
            label="Pairing State"
            value={
              config.agentId && config.shopId ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Paired &amp; Verified</span>
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">Setup Required</span>
              )
            }
          />
          <InfoRow
            label="Credential Vault"
            value={
              <span className="inline-flex items-center gap-1.5">
                {config.credentialStorageStatus === 'SECURE' ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Windows DPAPI Encrypted</span>
                  </>
                ) : config.hasStoredCredentials ? (
                  <>
                    <KeyRound className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">Legacy Storage</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400">No Saved Credentials</span>
                  </>
                )}
              </span>
            }
          />
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
            The secret device auth token is strictly isolated inside Electron safeStorage and never exposed in the renderer interface.
          </p>
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => runAction(onTestConnection, 'Authenticated cloud connection verified successfully.')}
          className="primary-button !text-xs font-semibold"
        >
          <Wifi className="h-3.5 w-3.5" />
          <span>Test Cloud Connection</span>
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => runAction(onTestConnection, 'Device status refreshed from backend.')}
          className="secondary-button !text-xs font-semibold"
        >
          <RotateCw className="h-3.5 w-3.5" />
          <span>Refresh Status</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="secondary-button !text-xs font-semibold"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span>Reconnect / Change Token</span>
        </button>

        <button
          type="button"
          onClick={onOpenLogs}
          className="secondary-button !text-xs font-semibold"
        >
          <Activity className="h-3.5 w-3.5" />
          <span>View Diagnostics</span>
        </button>
      </div>
    </section>
  );
};

interface SettingsPageProps {
  config: AgentConfig;
  onSave: (values: Partial<AgentConfig>) => Promise<{ success: boolean; error?: string }>;
  onReset: () => Promise<{ success: boolean; error?: string }>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ config, onSave, onReset }) => {
  const [pollIntervalMs, setPollIntervalMs] = useState(config.pollIntervalMs);
  const [autoStartOnBoot, setAutoStartOnBoot] = useState(config.autoStartOnBoot);
  const [allowColorFallback, setAllowColorFallback] = useState(config.allowColorFallback);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const save = async () => {
    setIsBusy(true);
    setMessage(null);
    try {
      const result = await onSave({ pollIntervalMs, autoStartOnBoot, allowColorFallback });
      setError(!result.success);
      setMessage(result.success ? 'Agent settings saved successfully.' : result.error || 'Could not save settings.');
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : 'Could not save settings.');
    } finally {
      setIsBusy(false);
    }
  };

  const reset = async () => {
    if (
      !window.confirm(
        'Reset agent settings and clear stored credentials? The agent will enter setup mode. Local job recovery data will remain.'
      )
    ) {
      return;
    }
    setIsBusy(true);
    setMessage(null);
    try {
      const result = await onReset();
      setError(!result.success);
      setMessage(
        result.success
          ? 'Settings and credentials were reset. Recovery records were preserved.'
          : result.error || 'Could not reset settings.'
      );
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : 'Could not reset settings.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-5 animate-fade-in">
      <div>
        <h2 className="text-base font-bold text-[var(--text-primary)]">Agent Preferences</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Local configuration is persisted in your user profile and restored automatically on restart.
        </p>
      </div>

      {message && (
        <p
          role={error ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-xs font-medium animate-fade-in ${
            error
              ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {message}
        </p>
      )}

      <div className="pf-card p-5 space-y-5">
        <div>
          <label htmlFor="poll-interval" className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
            Queue Polling Frequency
          </label>
          <select
            id="poll-interval"
            value={pollIntervalMs}
            onChange={(e) => setPollIntervalMs(Number(e.target.value))}
            className="settings-input max-w-xs !text-xs"
          >
            <option value={3000}>3 Seconds (High Speed Counter)</option>
            <option value={5000}>5 Seconds (Recommended Standard)</option>
            <option value={10000}>10 Seconds (Low Network Overhead)</option>
          </select>
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Interval between automated checks to the paired PrintFlow cloud server.
          </p>
        </div>

        <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
          <label className="flex items-start gap-3 text-xs text-[var(--text-primary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoStartOnBoot}
              onChange={(e) => setAutoStartOnBoot(e.target.checked)}
              className="mt-0.5 accent-teal-600"
            />
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Launch Agent on Windows Sign-in</span>
              <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                Automatically run the PrintFlow Agent in background tray upon user desktop login.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 text-xs text-[var(--text-primary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allowColorFallback}
              onChange={(e) => setAllowColorFallback(e.target.checked)}
              className="mt-0.5 accent-teal-600"
            />
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Allow Monochrome Fallback</span>
              <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                Permit black &amp; white printing if the assigned physical printer lacks color ink or cartridges.
              </span>
            </div>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border-default)]">
          <button
            type="button"
            disabled={isBusy}
            onClick={save}
            className="primary-button !text-xs font-semibold disabled:opacity-50"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span>{isBusy ? 'Saving...' : 'Save Preferences'}</span>
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={reset}
            className="danger-button !text-xs font-semibold disabled:opacity-50"
          >
            <WifiOff className="h-3.5 w-3.5" />
            <span>Reset Settings &amp; Credentials</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export const AboutView: React.FC<{ onOpenExternal: (url: string) => Promise<void> }> = ({ onOpenExternal }) => (
  <section className="max-w-2xl space-y-5 animate-fade-in">
    <div>
      <h2 className="text-base font-bold text-[var(--text-primary)]">About PrintFlow Desktop Agent</h2>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">
        Automated desktop spooler and cloud bridge designed for high-volume shop counters.
      </p>
    </div>

    <div className="pf-card p-6 space-y-4">
      <div className="flex items-center gap-3.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/25">
          <Info className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-[var(--text-primary)]">PrintFlow Desktop Agent</h3>
          <p className="text-xs text-[var(--text-muted)] font-mono">v{packageMetadata.version} • Windows x64 Spooler Service</p>
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
          <ExternalLink className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>Open PrintFlow Cloud Portal</span>
        </button>
      </div>

      <div className="grid gap-2.5 pt-4 border-t border-[var(--border-default)] text-xs text-[var(--text-muted)] sm:grid-cols-2">
        <span className="inline-flex items-center gap-2">
          <Store className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>Shop-specific M2M token pairing</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>Windows DPAPI safeStorage encryption</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Wifi className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>Heartbeat health diagnostics</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Laptop className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>Native Win32 driver integration</span>
        </span>
      </div>
    </div>
  </section>
);

const InfoRow: React.FC<{ label: string; value: React.ReactNode; action?: React.ReactNode }> = ({
  label,
  value,
  action
}) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border-subtle)] text-xs last:border-0 last:pb-0">
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-[var(--text-muted)]">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
    {action}
  </div>
);
