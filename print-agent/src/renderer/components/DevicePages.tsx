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
  WifiOff
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

  const saveDeviceName = () => runAction(
    () => onSave({ deviceName: deviceName.trim() }),
    'Terminal device name saved.'
  );

  const copyDeviceId = async () => {
    if (!config.agentId) return;
    const copied = await onCopyDeviceId(config.agentId);
    setError(!copied);
    setMessage(copied ? 'Device ID copied.' : 'Could not copy the device ID.');
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Profile &amp; Device</h2>
        <p className="mt-1 text-sm text-slate-400">Pairing identity and the current authenticated connection state.</p>
      </div>
      {message && <p role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>{message}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-700/70 bg-slate-800/50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><Fingerprint className="h-4 w-4 text-blue-400" />Device identity</div>
          <InfoRow label="Agent device ID" value={config.agentId || 'Not paired'} action={config.agentId ? <button type="button" onClick={copyDeviceId} className="secondary-button"><Copy className="h-3.5 w-3.5" />Copy ID</button> : undefined} />
          <InfoRow label="Shop ID" value={config.shopId || 'Not paired'} />
          <InfoRow label="Backend host" value={config.serverUrl || 'Not configured'} />
          <div>
            <label htmlFor="device-name" className="mb-1.5 block text-xs font-semibold text-slate-400">Terminal device name</label>
            <div className="flex gap-2">
              <input id="device-name" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} maxLength={100} className="settings-input min-w-0 flex-1" />
              <button type="button" disabled={isBusy || !deviceName.trim() || deviceName === config.deviceName} onClick={saveDeviceName} className="primary-button disabled:cursor-not-allowed disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-700/70 bg-slate-800/50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><Activity className="h-4 w-4 text-blue-400" />Connection &amp; security</div>
          <InfoRow label="Agent connection" value={<AgentStatusBadge status={status} />} />
          <InfoRow
            label="Last successful heartbeat"
            value={lastHeartbeat ? new Date(lastHeartbeat).toLocaleString() : 'No successful heartbeat recorded'}
          />
          <InfoRow
            label="Pairing state"
            value={config.agentId && config.shopId ? 'Paired with device identity' : 'Setup required'}
          />
          <InfoRow
            label="Credential storage"
            value={<span className="inline-flex items-center gap-1.5">{config.credentialStorageStatus === 'SECURE' ? <><ShieldCheck className="h-4 w-4 text-emerald-400" />Encrypted credential saved</> : config.hasStoredCredentials ? <><KeyRound className="h-4 w-4 text-amber-400" />Legacy credential storage</> : <><KeyRound className="h-4 w-4 text-amber-400" />No saved credential</>}</span>}
          />
          <p className="text-xs leading-relaxed text-slate-500">The saved token is never returned to this screen. Device registration date is not provided by the current pairing response.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={isBusy} onClick={() => runAction(onTestConnection, 'Authenticated connection verified.')} className="primary-button"><Wifi className="h-4 w-4" />Test connection</button>
        <button type="button" disabled={isBusy} onClick={() => runAction(onTestConnection, 'Device status refreshed.')} className="secondary-button"><RotateCw className="h-4 w-4" />Refresh status</button>
        <button type="button" onClick={onOpenSettings} className="secondary-button"><Settings2 className="h-4 w-4" />Reconnect or re-pair</button>
        <button type="button" onClick={onOpenLogs} className="secondary-button"><Activity className="h-4 w-4" />View diagnostics</button>
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
      setMessage(result.success ? 'Settings saved.' : result.error || 'Could not save settings.');
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : 'Could not save settings.');
    } finally {
      setIsBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Reset agent settings and remove the saved device credential? Local print recovery records will be kept.')) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const result = await onReset();
      setError(!result.success);
      setMessage(result.success ? 'Settings and credentials were reset. Local print recovery records were kept.' : result.error || 'Could not reset settings.');
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : 'Could not reset settings.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Settings</h2>
        <p className="mt-1 text-sm text-slate-400">Preferences are saved locally and restored when the desktop agent restarts.</p>
      </div>
      {message && <p role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>{message}</p>}
      <div className="space-y-5 rounded-2xl border border-slate-700/70 bg-slate-800/50 p-5">
        <div>
          <label htmlFor="poll-interval" className="mb-1.5 block text-sm font-semibold text-slate-200">Queue polling interval</label>
          <select id="poll-interval" value={pollIntervalMs} onChange={(event) => setPollIntervalMs(Number(event.target.value))} className="settings-input max-w-xs">
            <option value={3000}>3 seconds</option>
            <option value={5000}>5 seconds</option>
            <option value={10000}>10 seconds</option>
          </select>
          <p className="mt-1.5 text-xs text-slate-500">Changes take effect on the next polling cycle.</p>
        </div>
        <label className="flex items-start gap-3 text-sm text-slate-200">
          <input type="checkbox" checked={autoStartOnBoot} onChange={(event) => setAutoStartOnBoot(event.target.checked)} className="mt-0.5 accent-blue-500" />
          <span><strong className="font-semibold">Start agent when I sign in</strong><span className="mt-1 block text-xs text-slate-500">Launch PrintFlow Agent automatically after Windows sign-in.</span></span>
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-200">
          <input type="checkbox" checked={allowColorFallback} onChange={(event) => setAllowColorFallback(event.target.checked)} className="mt-0.5 accent-blue-500" />
          <span><strong className="font-semibold">Allow monochrome fallback</strong><span className="mt-1 block text-xs text-slate-500">Use black-and-white output if the selected printer cannot satisfy a color request.</span></span>
        </label>
        <div className="flex flex-wrap gap-2 border-t border-slate-700/70 pt-4">
          <button type="button" disabled={isBusy} onClick={save} className="primary-button disabled:opacity-50"><Settings2 className="h-4 w-4" />{isBusy ? 'Saving…' : 'Save settings'}</button>
          <button type="button" disabled={isBusy} onClick={reset} className="danger-button disabled:opacity-50"><WifiOff className="h-4 w-4" />Reset settings</button>
        </div>
      </div>
    </section>
  );
};

export const AboutView: React.FC<{ onOpenExternal: (url: string) => Promise<void> }> = ({ onOpenExternal }) => (
  <section className="max-w-2xl space-y-5">
    <div>
      <h2 className="text-lg font-bold text-white">About PrintFlow Agent</h2>
      <p className="mt-1 text-sm text-slate-400">Desktop print management for your Windows counter device.</p>
    </div>
    <div className="rounded-2xl border border-slate-700/70 bg-slate-800/50 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><Info className="h-5 w-5" /></div>
        <div><h3 className="font-semibold text-white">PrintFlow Desktop Agent</h3><p className="text-xs text-slate-400">Version {packageMetadata.version}</p></div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-slate-400">Connects your shop’s authorized PrintFlow device to locally installed Windows printers. Jobs and device status are managed by the paired backend.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void onOpenExternal('https://printflow.cloud')} className="secondary-button"><ExternalLink className="h-4 w-4" />PrintFlow Cloud</button>
      </div>
      <div className="mt-5 grid gap-2 border-t border-slate-700/70 pt-4 text-xs text-slate-400 sm:grid-cols-2">
        <span className="inline-flex items-center gap-2"><Store className="h-3.5 w-3.5" />Shop-specific device pairing</span>
        <span className="inline-flex items-center gap-2"><Wifi className="h-3.5 w-3.5" />Authenticated backend status</span>
      </div>
    </div>
  </section>
);

const InfoRow: React.FC<{ label: string; value: React.ReactNode; action?: React.ReactNode }> = ({ label, value, action }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-700/50 pb-3 last:border-0 last:pb-0">
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 break-all text-sm text-slate-200">{value}</div>
    </div>
    {action}
  </div>
);
