import React, { useEffect, useState } from 'react';
import { AgentConfig, DiscoveredPrinter, AgentConnectionStatus } from '../types/agent';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Server,
  Key,
  Store,
  LogOut,
  Laptop,
  Clock,
  AlertTriangle,
  Printer,
  Copy,
  Check,
  Loader2
} from 'lucide-react';
import packageMetadata from '../../../package.json';

interface SettingsModalProps {
  config: AgentConfig;
  status?: AgentConnectionStatus;
  lastHeartbeat?: string | null;
  printers: DiscoveredPrinter[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (newConfig: Partial<AgentConfig>) => Promise<{ success: boolean; error?: string }>;
  onPair: (data: { serverUrl: string; shopId: string; authToken: string; deviceName?: string }) => Promise<{ success: boolean; error?: string; code?: string; activeDevice?: any }>;
  onDisconnect?: () => Promise<{ success: boolean; error?: string }>;
  required?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  status = 'OFFLINE',
  lastHeartbeat = null,
  printers,
  isOpen,
  onClose,
  onSave,
  onPair,
  onDisconnect,
  required = false
}) => {
  const [shopId, setShopId] = useState(config.shopId || '');
  const [authToken, setAuthToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    activeDevice?: {
      deviceName?: string;
      lastSeenFormatted?: string;
      lastSeen?: string;
    };
  } | null>(null);
  const [inlineError, setInlineError] = useState<{ shopId?: string; authToken?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStage, setConnectionStage] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [detectedHostName, setDetectedHostName] = useState(config.deviceName || 'PrintFlow Desktop');
  const [copiedShopId, setCopiedShopId] = useState(false);

  const isConnected = Boolean(
    config.hasStoredCredentials &&
    config.agentId &&
    status !== 'DISCONNECTED' &&
    status !== 'REVOKED' &&
    !required
  );

  useEffect(() => {
    if (!isOpen) return;
    setShopId(config.shopId || '');
    setAuthToken('');
    setShowToken(false);
    setStatusMessage(null);
    setInlineError(null);
    setShowDisconnectConfirm(false);
    setConnectionStage(null);

    if (window.electronAgentAPI?.getHostname) {
      window.electronAgentAPI.getHostname().then((detected) => {
        if (detected) setDetectedHostName(detected);
      }).catch(() => {});
    }
  }, [isOpen, config]);

  useEffect(() => {
    if (required || !isOpen || showDisconnectConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, required, showDisconnectConfirm, onClose]);

  const handleCopyId = async (id: string) => {
    if (window.electronAgentAPI?.copyText) {
      await window.electronAgentAPI.copyText(id);
    } else {
      await navigator.clipboard.writeText(id);
    }
    setCopiedShopId(true);
    setTimeout(() => setCopiedShopId(false), 2000);
  };

  const handlePairAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const trimmedShopId = shopId.trim();
    const trimmedToken = authToken.trim();

    const errors: { shopId?: string; authToken?: string } = {};
    if (!trimmedShopId) {
      errors.shopId = 'Shop ID is required.';
    }
    if (!trimmedToken) {
      errors.authToken = 'Authentication Token is required.';
    }

    if (errors.shopId || errors.authToken) {
      setInlineError(errors);
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setInlineError(null);

    try {
      setConnectionStage('Validating credentials...');
      await new Promise((r) => setTimeout(r, 350));

      setConnectionStage('Authenticating shop...');
      let effectiveServerUrl = (config.serverUrl || 'https://printflow.devpixel.space').trim().replace(/\/+$/, '');
      if (!effectiveServerUrl.startsWith('http://') && !effectiveServerUrl.startsWith('https://')) {
        effectiveServerUrl = `https://${effectiveServerUrl}`;
      }

      setConnectionStage('Registering this device...');
      const effectiveDeviceName = detectedHostName || config.deviceName || 'PrintFlow Desktop';

      const pairRes = await onPair({
        serverUrl: effectiveServerUrl,
        shopId: trimmedShopId,
        authToken: trimmedToken,
        deviceName: effectiveDeviceName
      });

      if (!pairRes.success) {
        setStatusMessage({
          type: 'error',
          text: pairRes.error || 'Authentication failed. Verify your Shop ID and Token.',
          activeDevice: pairRes.activeDevice
        });
        return;
      }

      setConnectionStage('Establishing secure connection...');
      await onSave({
        serverUrl: effectiveServerUrl,
        deviceName: effectiveDeviceName,
        pollIntervalMs: config.pollIntervalMs || 5000,
        selectedPrinterName: config.selectedPrinterName || undefined
      });

      setAuthToken('');
      setStatusMessage({
        type: 'success',
        text: 'Device successfully authenticated and paired.'
      });

      if (!required) {
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        text: error?.message || 'Could not connect to the PrintFlow server. Please try again.'
      });
    } finally {
      setIsSaving(false);
      setConnectionStage(null);
    }
  };

  const handleDisconnectConfirm = async () => {
    setIsDisconnecting(true);
    try {
      if (onDisconnect) {
        const res = await onDisconnect();
        if (!res.success) throw new Error(res.error || 'Disconnect failed');
      } else if (window.electronAgentAPI?.disconnectDevice) {
        const res = await window.electronAgentAPI.disconnectDevice();
        if (!res.success) throw new Error(res.error || 'Disconnect failed');
      }

      setShowDisconnectConfirm(false);
      setStatusMessage({
        type: 'success',
        text: 'Agent session disconnected successfully.'
      });
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        text: error?.message || 'Failed to disconnect agent.'
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (!isOpen) return null;

  // Main Pairing Form Component (Centered Login Card)
  const pairingFormContent = (
    <div className="w-full bg-white dark:bg-[#131D33] border border-[#E1E7E1] dark:border-slate-800 rounded-2xl shadow-xl p-8 space-y-6 animate-scale-in relative font-['Manrope',sans-serif]">
      {/* Top Branding & Logo */}
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-[#E8F8EC] dark:bg-emerald-950/60 border border-[#A7F3D0] dark:border-emerald-800 text-[#00B32D] flex items-center justify-center mx-auto shadow-xs">
          <Printer className="w-7 h-7 stroke-[2]" />
        </div>
        <div>
          <h1 className="text-[24px] font-bold text-[#111111] dark:text-white tracking-tight">
            Connect Your Shop
          </h1>
          <p className="text-[13px] text-[#646B65] dark:text-slate-400 mt-1">
            Connect your Windows PC with PrintFlow.
          </p>
        </div>
      </div>

      {/* Revoked Handover Notice if session replaced */}
      {status === 'REVOKED' && (
        <div role="alert" className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626] space-y-1 animate-fade-in">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#DC2626]" />
            <span>Agent Session Replaced</span>
          </div>
          <p className="text-[11.5px] leading-relaxed">
            Another PC connected for this shop. Printing on this PC was paused. Re-enter your Shop ID and Token to reconnect.
          </p>
        </div>
      )}

      {/* Error Feedback Banner */}
      {statusMessage && (
        <div
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-xl border flex flex-col gap-1.5 text-xs animate-fade-in ${
            statusMessage.type === 'success'
              ? 'bg-[#E8F8EC] border-[#A7F3D0] text-[#008F25] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#00B32D] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <span className="font-semibold leading-relaxed block">{statusMessage.text}</span>
              {statusMessage.activeDevice && (
                <div className="text-[11px] font-mono bg-red-100 p-2 rounded-lg mt-1 border border-red-200 text-red-900">
                  <p className="font-bold">Active Device: {statusMessage.activeDevice.deviceName || 'Counter PC'}</p>
                  <p>Last seen: {statusMessage.activeDevice.lastSeenFormatted || 'recently'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Centered Login Form */}
      <form onSubmit={handlePairAndConnect} className="space-y-5">
        {/* Field 1: Shop ID */}
        <div className="space-y-1.5">
          <label htmlFor="login-shop-id" className="block text-[13px] font-semibold text-[#111111] dark:text-white">
            Shop ID <span className="text-[#DC2626]">*</span>
          </label>
          <input
            id="login-shop-id"
            type="text"
            required
            disabled={isSaving}
            value={shopId}
            onChange={(e) => {
              setShopId(e.target.value);
              if (inlineError?.shopId) setInlineError((prev) => ({ ...prev, shopId: undefined }));
            }}
            placeholder="Enter your Shop ID"
            className="w-full h-11 px-3.5 rounded-xl border border-[#E1E7E1] dark:border-slate-700 bg-[#FFFFFF] dark:bg-slate-900 text-[#111111] dark:text-white font-mono text-xs focus:outline-none focus:border-[#00B32D] focus:ring-2 focus:ring-[#00B32D]/20 transition-all disabled:bg-[#F7F8F7] disabled:text-[#646B65] disabled:cursor-not-allowed"
          />
          {inlineError?.shopId && (
            <p role="alert" className="text-[11.5px] text-[#DC2626] font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{inlineError.shopId}</span>
            </p>
          )}
        </div>

        {/* Field 2: Authentication Token */}
        <div className="space-y-1.5">
          <label htmlFor="login-auth-token" className="block text-[13px] font-semibold text-[#111111] dark:text-white">
            Authentication Token <span className="text-[#DC2626]">*</span>
          </label>
          <div className="relative">
            <input
              id="login-auth-token"
              type={showToken ? 'text' : 'password'}
              required
              disabled={isSaving}
              value={authToken}
              onChange={(e) => {
                setAuthToken(e.target.value);
                if (inlineError?.authToken) setInlineError((prev) => ({ ...prev, authToken: undefined }));
              }}
              placeholder="Enter your authentication token"
              className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-[#E1E7E1] dark:border-slate-700 bg-[#FFFFFF] dark:bg-slate-900 text-[#111111] dark:text-white font-mono text-xs focus:outline-none focus:border-[#00B32D] focus:ring-2 focus:ring-[#00B32D]/20 transition-all disabled:bg-[#F7F8F7] disabled:text-[#646B65] disabled:cursor-not-allowed"
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-3 text-[#646B65] hover:text-[#111111] dark:hover:text-white cursor-pointer transition-colors"
              title={showToken ? 'Hide password' : 'Show password'}
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {inlineError?.authToken && (
            <p role="alert" className="text-[11.5px] text-[#DC2626] font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{inlineError.authToken}</span>
            </p>
          )}
        </div>

        {/* Primary Connect Button */}
        <div className="pt-2 space-y-2">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full h-11 rounded-xl text-sm font-bold bg-[#00B32D] hover:bg-[#008F25] active:bg-[#00701D] text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <span>Connect Agent</span>
            )}
          </button>

          {/* Connection Stage Feedback */}
          {isSaving && connectionStage && (
            <div className="text-center animate-fade-in pt-1">
              <span className="text-xs font-medium text-[#646B65] dark:text-slate-400 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00B32D] animate-pulse" />
                {connectionStage}
              </span>
            </div>
          )}
        </div>
      </form>
    </div>
  );

  // If in Connected state while opening inside app modal
  if (isConnected) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-['Manrope',sans-serif]">
        <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 bg-white dark:bg-[#131D33] border border-[#E1E7E1] dark:border-slate-800 rounded-2xl shadow-xl space-y-4 text-xs relative">
          <div className="flex items-center justify-between pb-3 border-b border-[#E1E7E1] dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111111] dark:text-white">Agent Session &amp; Status</h2>
                <p className="text-[11px] text-[#646B65] dark:text-slate-400">Active station pairing details</p>
              </div>
            </div>
            {!required && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-[#646B65] hover:bg-[#F7F8F7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-4 rounded-xl border border-[#A7F3D0] bg-[#E8F8EC] dark:bg-emerald-950/20 dark:border-emerald-800/60 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#A7F3D0]/60">
              <span className="text-[11px] font-semibold text-[#008F25] uppercase tracking-wider">Status</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white text-[#008F25] border border-[#A7F3D0]">
                <span className="w-2 h-2 rounded-full bg-[#00B32D] animate-pulse" />
                Active &amp; Connected
              </span>
            </div>

            <div className="flex items-center justify-between py-1 text-xs">
              <span className="text-[#646B65] dark:text-slate-400">Shop ID</span>
              <span className="font-mono font-bold text-[#111111] dark:text-white">{config.shopId}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs">
              <span className="text-[#646B65] dark:text-slate-400">Hostname</span>
              <span className="font-mono font-semibold text-[#111111] dark:text-white">{detectedHostName}</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowDisconnectConfirm(true)}
              disabled={isDisconnecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-[#DC2626]" />
              <span>Disconnect Agent from this PC</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If in Standalone Required Mode (Unauthenticated Screen)
  if (required) {
    return pairingFormContent;
  }

  // If in Modal Mode
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (!showDisconnectConfirm && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md">
        {pairingFormContent}
      </div>
    </div>
  );
};
