import React, { useEffect, useState } from 'react';
import { AgentConfig, DiscoveredPrinter } from '../types/agent';
import { X, ShieldCheck, CheckCircle2, AlertCircle, Eye, EyeOff, Server, Key } from 'lucide-react';

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
        throw new Error('Use an HTTPS backend URL (HTTP is only allowed for localhost).');
      }

      const shouldPair = required ||
        !config.hasStoredCredentials ||
        Boolean(authToken.trim()) ||
        normalizedUrl !== config.serverUrl ||
        shopId.trim() !== config.shopId;
      if (shouldPair) {
        if (!shopId.trim() || !deviceName.trim() || !authToken.trim()) {
          throw new Error('Enter the shop ID, terminal name, and device token to pair this device.');
        }
        const pairRes = await onPair({
          serverUrl: normalizedUrl,
          shopId: shopId.trim(),
          authToken: authToken.trim(),
          deviceName: deviceName.trim()
        });
        if (!pairRes.success) {
          setStatusMessage({ type: 'error', text: pairRes.error || 'Failed to authenticate with PrintFlow server.' });
          return;
        }
      }

      const saveRes = await onSave({
        deviceName: deviceName.trim(),
        pollIntervalMs: pollIntervalSec * 1000,
        selectedPrinterName: selectedPrinter || undefined
      });
      if (!saveRes.success) {
        setStatusMessage({ type: 'error', text: saveRes.error || 'Could not save agent settings.' });
        return;
      }

      setAuthToken('');
      setStatusMessage({
        type: 'success',
        text: shouldPair ? 'Device successfully paired and credential stored securely.' : 'Agent settings saved.'
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not connect to the PrintFlow server.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const tokenRequired = required ||
    !config.hasStoredCredentials ||
    Boolean(authToken.trim()) ||
    serverUrl.trim().replace(/\/+$/, '') !== config.serverUrl ||
    shopId.trim() !== config.shopId;

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 ${required ? 'setup-modal-backdrop-required' : ''}`}>
      <div role="dialog" aria-modal="true" aria-labelledby="setup-dialog-title" className={`bg-slate-900 border border-slate-700 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-5 text-xs text-slate-200 ${required ? 'setup-dialog-required' : ''}`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-400" />
            <h2 id="setup-dialog-title" className="text-sm font-bold text-white">PrintFlow Agent Setup & Credentials</h2>
          </div>
          {!required && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handlePairAndSave} className="space-y-4">
          <div>
            <label className="font-bold text-slate-300 block mb-1">PrintFlow Cloud Host URL</label>
            <input
              type="url"
              required
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-printflow-host.example"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">Host endpoint where customer print jobs are created.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-300 block mb-1">Shop ID / Slug</label>
              <input
                type="text"
                required
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                placeholder="shop ID from your PrintFlow dashboard"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-slate-300 block mb-1">Terminal Device Name</label>
              <input
                type="text"
                required
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Counter PC 1"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-300 block mb-1">Agent Device Auth Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                required={tokenRequired}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder={config.hasStoredCredentials ? 'Saved token is protected — enter a new token only to re-pair' : 'agt_tok_...'}
                className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Generate and copy this token from your Shop Dashboard under <strong>Settings → Print Agent</strong>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-300 block mb-1">Target Spooler Printer</label>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Default Windows Printer (must be connected)</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name} disabled={!p.isOnline}>
                    {p.displayName} {p.isDefault ? '(Default)' : ''}{!p.isOnline ? ' (Unavailable)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">Queue Poll Interval</label>
              <select
                value={pollIntervalSec}
                onChange={(e) => setPollIntervalSec(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              >
                <option value={3}>3 Seconds (High Speed)</option>
                <option value={5}>5 Seconds (Recommended)</option>
                <option value={10}>10 Seconds (Standard)</option>
              </select>
            </div>
          </div>

          {/* Security notice */}
          <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-[11px] text-blue-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p>
              After pairing, the token is encrypted with Electron safeStorage and is not returned to the renderer. Re-enter a token only when pairing or replacing device credentials.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            {!required && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Authenticating...' : 'Pair & Save'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
