import React, { useEffect, useState } from 'react';
import { AgentConfig, DiscoveredPrinter } from '../types/agent';
import { X, ShieldCheck, CheckCircle2, AlertCircle, Eye, EyeOff, Server, Key, Printer, Clock } from 'lucide-react';

interface SettingsModalProps {
  config: AgentConfig;
  printers: DiscoveredPrinter[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (newConfig: Partial<AgentConfig>) => Promise<{ success: boolean; error?: string }>;
  onPair: (data: { serverUrl: string; shopId: string; authToken: string; deviceName?: string }) => Promise<{ success: boolean; error?: string }>;
  required?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  printers,
  isOpen,
  onClose,
  onSave,
  onPair,
  required = false
}) => {
  const [serverUrl, setServerUrl] = useState(config.serverUrl || '');
  const [shopId, setShopId] = useState(config.shopId || '');
  const [authToken, setAuthToken] = useState(config.authToken || '');
  const [deviceName, setDeviceName] = useState(config.deviceName || 'Counter PC');
  const [pollIntervalSec, setPollIntervalSec] = useState(Math.round((config.pollIntervalMs || 5000) / 1000));
  const [selectedPrinter, setSelectedPrinter] = useState(config.selectedPrinterName || '');
  const [showToken, setShowToken] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setServerUrl(config.serverUrl || '');
    setShopId(config.shopId || '');
    setAuthToken('');
    setDeviceName(config.deviceName || 'Counter PC');
    setPollIntervalSec(Math.round((config.pollIntervalMs || 5000) / 1000));
    setSelectedPrinter(config.selectedPrinterName || '');
    setShowToken(false);
    setStatusMessage(null);
  }, [isOpen, config]);

  // Handle ESC key for dismiss
  useEffect(() => {
    if (required || !isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, required, onClose]);

  const handlePairAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const normalizedUrl = serverUrl.trim().replace(/\/+$/, '');
      const parsedUrl = new URL(normalizedUrl);
      const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname);
      if (
        (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && isLocalhost)) ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.search ||
        parsedUrl.hash
      ) {
        throw new Error('Please enter a valid HTTPS backend URL (HTTP is only allowed for local testing).');
      }

      const shouldPair =
        required ||
        !config.hasStoredCredentials ||
        Boolean(authToken.trim()) ||
        normalizedUrl !== config.serverUrl ||
        shopId.trim() !== config.shopId;

      if (shouldPair) {
        if (!shopId.trim() || !deviceName.trim() || !authToken.trim()) {
          throw new Error('Please provide the Shop ID, Terminal Name, and Device Token to complete pairing.');
        }
        const pairRes = await onPair({
          serverUrl: normalizedUrl,
          shopId: shopId.trim(),
          authToken: authToken.trim(),
          deviceName: deviceName.trim()
        });
        if (!pairRes.success) {
          setStatusMessage({ type: 'error', text: pairRes.error || 'Authentication with PrintFlow server failed.' });
          return;
        }
      }

      const saveRes = await onSave({
        deviceName: deviceName.trim(),
        pollIntervalMs: pollIntervalSec * 1000,
        selectedPrinterName: selectedPrinter || undefined
      });
      if (!saveRes.success) {
        setStatusMessage({ type: 'error', text: saveRes.error || 'Could not save agent configuration.' });
        return;
      }

      setAuthToken('');
      setStatusMessage({
        type: 'success',
        text: shouldPair
          ? 'Device successfully paired and credentials securely encrypted.'
          : 'Agent settings saved successfully.'
      });

      if (!required) {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not establish connection to the PrintFlow server.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const tokenRequired =
    required ||
    !config.hasStoredCredentials ||
    Boolean(authToken.trim()) ||
    serverUrl.trim().replace(/\/+$/, '') !== config.serverUrl ||
    shopId.trim() !== config.shopId;

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in ${
        required ? 'setup-modal-backdrop-required' : ''
      }`}
      role={required ? undefined : 'presentation'}
      onMouseDown={(e) => {
        if (!required && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-dialog-title"
        className={`w-full max-w-lg p-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-2xl space-y-4 text-xs animate-scale-in ${
          required ? 'setup-dialog-required' : ''
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 id="setup-dialog-title" className="text-sm font-bold text-[var(--text-primary)]">
              {required ? 'Connect Terminal to Shop' : 'Agent Connection & Credentials'}
            </h2>
          </div>
          {!required && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 animate-fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-500/10 border-red-500/25 text-red-800 dark:text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handlePairAndSave} className="space-y-3.5">
          {/* Cloud Host URL */}
          <div>
            <label className="font-semibold text-[var(--text-secondary)] block mb-1">
              PrintFlow Cloud Server URL
            </label>
            <input
              type="url"
              required
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://app.printflow.cloud"
              className="settings-input font-mono !text-xs"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              The backend host endpoint providing print queue synchronization.
            </p>
          </div>

          {/* Shop ID & Terminal Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[var(--text-secondary)] block mb-1">
                Shop ID / Slug
              </label>
              <input
                type="text"
                required
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                placeholder="e.g. quick-print-hub"
                className="settings-input font-mono !text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-[var(--text-secondary)] block mb-1">
                Terminal Name
              </label>
              <input
                type="text"
                required
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Front Counter 1"
                className="settings-input !text-xs"
              />
            </div>
          </div>

          {/* Device Auth Token */}
          <div>
            <label className="font-semibold text-[var(--text-secondary)] block mb-1">
              Agent Device Auth Token
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                required={tokenRequired}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder={
                  config.hasStoredCredentials
                    ? 'Saved token is protected (enter a new token only to re-pair)'
                    : 'agt_tok_...'
                }
                className="settings-input !pr-9 font-mono !text-xs"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-2.5 text-[var(--text-faint)] hover:text-[var(--text-primary)] cursor-pointer"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Generate this device token from your web Shop Dashboard under <strong>Settings → Print Agent</strong>.
            </p>
          </div>

          {/* Spooler Printer & Poll Interval */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[var(--text-secondary)] block mb-1 flex items-center gap-1">
                <Printer className="w-3 h-3 text-[var(--text-faint)]" />
                <span>Target Spooler Printer</span>
              </label>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="settings-input !text-xs"
              >
                <option value="">Default Windows Printer</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name} disabled={!p.isOnline}>
                    {p.displayName} {p.isDefault ? '(Default)' : ''} {!p.isOnline ? '(Offline)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-[var(--text-secondary)] block mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[var(--text-faint)]" />
                <span>Polling Frequency</span>
              </label>
              <select
                value={pollIntervalSec}
                onChange={(e) => setPollIntervalSec(Number(e.target.value))}
                className="settings-input !text-xs"
              >
                <option value={3}>3 Seconds (High Speed)</option>
                <option value={5}>5 Seconds (Recommended)</option>
                <option value={10}>10 Seconds (Standard)</option>
              </select>
            </div>
          </div>

          {/* Security Notice Callout */}
          <div className="p-3 bg-teal-500/10 border border-teal-500/25 rounded-xl text-[11px] text-teal-800 dark:text-teal-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Upon successful pairing, your token is secured via hardware DPAPI encryption (Windows safeStorage) and is never
              re-exposed to the renderer or stored in unencrypted browser storage.
            </p>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-[var(--border-default)] flex items-center justify-end gap-2">
            {!required && (
              <button
                type="button"
                onClick={onClose}
                className="secondary-button"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="primary-button text-xs font-semibold"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Authenticating...' : required ? 'Pair Terminal & Connect' : 'Save & Update'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
