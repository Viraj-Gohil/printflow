import React, { useEffect, useState } from 'react';
import { AgentConfig, DiscoveredPrinter } from '../types/agent';
import { X, ShieldCheck, CheckCircle2, AlertCircle, Eye, EyeOff, Server, Key, Store } from 'lucide-react';

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
  isOpen,
  onClose,
  onSave,
  onPair,
  required = false
}) => {
  const [shopId, setShopId] = useState(config.shopId || '');
  const [authToken, setAuthToken] = useState(config.authToken || '');
  const [showToken, setShowToken] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [detectedHostName, setDetectedHostName] = useState(config.deviceName || 'PrintFlow Agent');

  useEffect(() => {
    if (!isOpen) return;
    setShopId(config.shopId || '');
    setAuthToken('');
    setShowToken(false);
    setStatusMessage(null);

    // Auto-detect actual computer Host Name via Electron IPC
    if (window.electronAgentAPI?.getHostname) {
      window.electronAgentAPI.getHostname().then((detected) => {
        if (detected) setDetectedHostName(detected);
      }).catch(() => {});
    }
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
      if (!shopId.trim()) {
        throw new Error('Please enter your canonical Shop ID.');
      }

      const shouldPair =
        required ||
        !config.hasStoredCredentials ||
        Boolean(authToken.trim()) ||
        shopId.trim() !== config.shopId;

      if (shouldPair && !authToken.trim()) {
        throw new Error('Please enter the Agent Authentication Token.');
      }

      const effectiveServerUrl = (config.serverUrl && config.serverUrl.trim())
        ? config.serverUrl.trim()
        : (window.location.origin.startsWith('http') ? window.location.origin : 'https://printflow.cloud');
      const effectiveDeviceName = detectedHostName || config.deviceName || 'PrintFlow Agent';

      if (shouldPair) {
        const pairRes = await onPair({
          serverUrl: effectiveServerUrl,
          shopId: shopId.trim(),
          authToken: authToken.trim(),
          deviceName: effectiveDeviceName
        });
        if (!pairRes.success) {
          setStatusMessage({ type: 'error', text: pairRes.error || 'Authentication with PrintFlow server failed.' });
          return;
        }
      }

      const saveRes = await onSave({
        deviceName: effectiveDeviceName,
        pollIntervalMs: config.pollIntervalMs || 5000,
        selectedPrinterName: config.selectedPrinterName || undefined
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
        className={`w-full max-w-md max-h-[92vh] overflow-y-auto p-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl shadow-2xl space-y-4 text-xs animate-scale-in ${
          required ? 'setup-dialog-required' : ''
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
                ? 'bg-green-500/10 border-green-500/25 text-green-800 dark:text-green-300'
                : 'bg-red-500/10 border-red-500/25 text-red-800 dark:text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span className="font-medium leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handlePairAndSave} className="space-y-4">
          {/* Field 1: Shop ID */}
          <div>
            <label className="font-semibold text-[var(--text-secondary)] block mb-1 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Shop ID</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              placeholder="Canonical Shop UUID (e.g. a001a111-0000-0000-0000-000000000001)"
              className="settings-input font-mono !text-xs"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Find your canonical Shop ID on your web Shop Dashboard header.
            </p>
          </div>

          {/* Field 2: Agent Device Auth Token */}
          <div>
            <label className="font-semibold text-[var(--text-secondary)] block mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Agent Authentication Token</span>
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                required={tokenRequired}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder={
                  config.hasStoredCredentials
                    ? 'Saved token protected via Windows DPAPI (enter new token only to re-pair)'
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
              Obtain your M2M token from your web Shop Dashboard under <strong>Settings → Print Agent</strong>.
            </p>
          </div>

          {/* Security & One-Agent Policy Callout */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/25 rounded-xl text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Upon successful pairing, your token is encrypted locally via Windows safeStorage (DPAPI). PrintFlow enforces a strict <strong>1 Active Agent per Shop</strong> policy.
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
