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
  Check
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
  const [authToken, setAuthToken] = useState(config.authToken || '');
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
  const [isSaving, setIsSaving] = useState(false);
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
    setShowDisconnectConfirm(false);

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
    setIsSaving(true);
    setStatusMessage(null);

    try {
      if (!shopId.trim()) {
        throw new Error('Please enter your Shop ID.');
      }
      if (!authToken.trim()) {
        throw new Error('Please enter the Agent Authentication Token.');
      }

      const effectiveServerUrl = (config.serverUrl && config.serverUrl.trim())
        ? config.serverUrl.trim()
        : (window.location.origin.startsWith('http') ? window.location.origin : 'https://printflow.cloud');
      const effectiveDeviceName = detectedHostName || config.deviceName || 'PrintFlow Desktop';

      const pairRes = await onPair({
        serverUrl: effectiveServerUrl,
        shopId: shopId.trim(),
        authToken: authToken.trim(),
        deviceName: effectiveDeviceName
      });

      if (!pairRes.success) {
        setStatusMessage({
          type: 'error',
          text: pairRes.error || 'Authentication with PrintFlow server failed.',
          activeDevice: pairRes.activeDevice
        });
        return;
      }

      await onSave({
        deviceName: effectiveDeviceName,
        pollIntervalMs: config.pollIntervalMs || 5000,
        selectedPrinterName: config.selectedPrinterName || undefined
      });

      setAuthToken('');
      setStatusMessage({
        type: 'success',
        text: 'Device successfully authenticated and paired to your shop.'
      });

      if (!required) {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        text: error?.message || 'Could not connect to the PrintFlow server.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectConfirm = async () => {
    setIsDisconnecting(true);
    try {
      if (onDisconnect) {
        const res = await onDisconnect();
        if (!res.success) {
          throw new Error(res.error || 'Disconnect failed');
        }
      } else if (window.electronAgentAPI?.disconnectDevice) {
        const res = await window.electronAgentAPI.disconnectDevice();
        if (!res.success) {
          throw new Error(res.error || 'Disconnect failed');
        }
      }

      setShowDisconnectConfirm(false);
      setStatusMessage({
        type: 'success',
        text: 'Agent session disconnected successfully. Shop assignment released.'
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

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-dialog-title"
      className={
        required
          ? "w-full space-y-4 text-xs relative"
          : "w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 bg-white dark:bg-[#131D33] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl shadow-xl space-y-4 text-xs animate-scale-in relative"
      }
    >
      {/* Modal Header */}
      {!required && (
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/50 text-[#2563EB] flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 id="setup-dialog-title" className="text-sm font-bold text-[#0F172A] dark:text-white">
                {isConnected ? 'Agent Connection & Credentials' : 'Connect Print Agent to Shop'}
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                {isConnected ? 'Active print agent session details' : 'Enter shop credentials to activate this station'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl border flex flex-col gap-1.5 animate-fade-in ${
              statusMessage.type === 'success'
                ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
            }`}
          >
            <div className="flex items-start gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-semibold leading-relaxed block">{statusMessage.text}</span>
                {statusMessage.activeDevice && (
                  <div className="text-[11px] font-mono bg-[#FEE2E2] p-2 rounded-lg mt-1 border border-[#FECACA] text-[#991B1B]">
                    <p className="font-bold">Active Device: {statusMessage.activeDevice.deviceName || 'Counter PC'}</p>
                    <p>Last seen: {statusMessage.activeDevice.lastSeenFormatted || 'recently'}</p>
                    <p className="mt-1 font-sans">
                      Connecting from this PC will automatically transfer active status to this device.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CASE 1: CONNECTED STATE                                       */}
        {/* ------------------------------------------------------------- */}
        {isConnected ? (
          <div className="space-y-4 animate-fade-in">
            {/* Status card */}
            <div className="p-4 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] dark:bg-emerald-950/20 dark:border-emerald-800/60 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#A7F3D0]/60 dark:border-emerald-800/40">
                <span className="text-[11px] font-semibold text-[#047857] dark:text-emerald-300 uppercase tracking-wider">
                  Connection Status
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white text-[#047857] border border-[#A7F3D0] shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  Connected &amp; Active
                </span>
              </div>

              {/* Shop Name & Shop ID */}
              <div className="flex items-center justify-between py-1 text-xs">
                <span className="text-[#047857] dark:text-emerald-300 flex items-center gap-1.5 font-medium">
                  <Store className="w-3.5 h-3.5" />
                  <span>Shop Name</span>
                </span>
                <span className="font-bold text-[#0F172A] dark:text-white">
                  {config.shopDetails?.shopName || config.shopSlug || 'PrintFlow Shop'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 text-xs">
                <span className="text-[#047857] dark:text-emerald-300 flex items-center gap-1.5 font-medium">
                  <Key className="w-3.5 h-3.5" />
                  <span>Shop ID</span>
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-semibold text-[#0F172A] dark:text-white">{config.shopId}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyId(config.shopId)}
                    title="Copy Shop ID"
                    className="p-1 rounded hover:bg-white/60 text-[#047857] transition-colors cursor-pointer"
                  >
                    {copiedShopId ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Device Hostname */}
              <div className="flex items-center justify-between py-1 text-xs">
                <span className="text-[#047857] dark:text-emerald-300 flex items-center gap-1.5 font-medium">
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Device Hostname</span>
                </span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-white">
                  {detectedHostName || config.deviceName || 'Local PC'}
                </span>
              </div>

              {/* Agent Version */}
              <div className="flex items-center justify-between py-1 text-xs">
                <span className="text-[#047857] dark:text-emerald-300 flex items-center gap-1.5 font-medium">
                  <Server className="w-3.5 h-3.5" />
                  <span>Agent Version</span>
                </span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-white">
                  v{packageMetadata.version}
                </span>
              </div>

              {/* Connected Printer Count */}
              <div className="flex items-center justify-between py-1 text-xs">
                <span className="text-[#047857] dark:text-emerald-300 flex items-center gap-1.5 font-medium">
                  <Printer className="w-3.5 h-3.5" />
                  <span>Connected Printers</span>
                </span>
                <span className="font-semibold text-[#0F172A] dark:text-white">
                  {printers.length} Installed ({printers.filter(p => p.isOnline).length} Online)
                </span>
              </div>

              {/* Last Successful Heartbeat */}
              <div className="flex items-center justify-between py-1 text-xs">
                <span className="text-[#047857] dark:text-emerald-300 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Last Heartbeat</span>
                </span>
                <span className="font-mono text-[#0F172A] dark:text-white">
                  {lastHeartbeat ? new Date(lastHeartbeat).toLocaleString() : 'Active session'}
                </span>
              </div>

              {/* Single device security guarantee */}
              <div className="pt-2 border-t border-[#A7F3D0]/60 dark:border-emerald-800/40 flex items-center gap-1.5 text-[11px] text-[#047857] dark:text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                <span>Single active device policy enforced. Windows safeStorage DPAPI hardware isolation enabled.</span>
              </div>
            </div>

            {/* Disconnect Agent Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(true)}
                disabled={isDisconnecting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] shadow-xs transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#EF4444]" />
                <span>Disconnect Agent from this PC</span>
              </button>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* CASE 2: DISCONNECTED / PAIRING FORM                           */
          /* ------------------------------------------------------------- */
          <div className="space-y-4 animate-fade-in">
            {/* Status Indicator */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
              <span className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider">
                Connection Status
              </span>
              {status === 'REVOKED' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3]">
                  <span className="w-2 h-2 rounded-full bg-[#E11D48]" />
                  Session Replaced
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                  <span className="w-2 h-2 rounded-full bg-[#94A3B8]" />
                  Disconnected
                </span>
              )}
            </div>

            {/* Clear Handover Notice when Replaced */}
            {status === 'REVOKED' && (
              <div role="alert" className="p-3.5 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-xs text-[#9F1239] flex flex-col gap-1.5 animate-fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#E11D48] shrink-0" />
                  <span className="font-bold">This agent session has been replaced by another device.</span>
                </div>
                <p className="text-[11.5px] leading-relaxed text-[#9F1239]">
                  Another PC signed in using valid credentials for this shop. Printing on this PC was automatically stopped to prevent conflicts.
                </p>
                <p className="text-[11.5px] text-[#9F1239] font-medium">
                  To take over and make this PC the active station again, enter your Shop ID and Agent Token below.
                </p>
              </div>
            )}

            {/* Handover Notice */}
            <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] dark:bg-blue-950/40 dark:border-blue-800 rounded-xl text-xs text-[#1E40AF] dark:text-blue-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <p className="font-semibold text-[#1E40AF] dark:text-blue-200">Single Active Device Rule</p>
                <p className="text-[11.5px]">
                  One shop can have only <strong>ONE active Agent PC</strong> at a time. Connecting this device automatically revokes the previous PC session and makes this PC active.
                </p>
              </div>
            </div>

            {/* Simple Connection Form: Only Shop ID & Auth Token */}
            <form onSubmit={handlePairAndConnect} className="space-y-4 pt-1">
              {/* Field 1: Shop ID */}
              <div>
                <label className="font-semibold text-xs text-[#0F172A] dark:text-white block mb-1.5 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                  <span>Shop ID</span>
                  <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  placeholder="e.g. printflow-counter or full UUID"
                  className="settings-input font-mono !text-xs"
                />
                <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                  Found in your Web Dashboard header or URL.
                </p>
              </div>

              {/* Field 2: Agent Auth Token with Secure Toggle */}
              <div>
                <label className="font-semibold text-xs text-[#0F172A] dark:text-white block mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                  <span>Agent Authentication Token</span>
                  <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    required
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder="agt_tok_..."
                    className="settings-input !pr-10 font-mono !text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-2.5 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                    title={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                  Generate or copy in Web Dashboard under <strong>Settings → Print Agent</strong>.
                </p>
              </div>

              {/* Device Hostname Tag */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 text-[11px] text-[#64748B] dark:text-slate-400">
                <Laptop className="w-3.5 h-3.5 text-[#94A3B8]" />
                <span>This PC will register as: <strong className="text-[#0F172A] dark:text-slate-200">{detectedHostName}</strong></span>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
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
                  <span>{isSaving ? 'Authenticating...' : 'Connect Agent'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CONFIRMATION DIALOG: DISCONNECT CONFIRMATION MODAL            */}
        {/* ------------------------------------------------------------- */}
        {showDisconnectConfirm && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs rounded-2xl flex items-center justify-center p-4 z-50 animate-fade-in">
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
                  onClick={() => setShowDisconnectConfirm(false)}
                  disabled={isDisconnecting}
                  className="secondary-button flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisconnectConfirm()}
                  disabled={isDisconnecting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#EF4444] hover:bg-[#DC2626] text-white transition-colors cursor-pointer flex-1"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

  if (required) {
    return modalContent;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (!showDisconnectConfirm && e.target === e.currentTarget) onClose();
      }}
    >
      {modalContent}
    </div>
  );
};
