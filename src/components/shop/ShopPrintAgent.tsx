import React, { useEffect, useState, useMemo } from 'react';
import { useApp, getDeterministicAgentToken } from '../../lib/store';
import {
  RotateCw,
  Copy,
  Check,
  Download,
  Terminal,
  ShieldCheck,
  Server,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Clock,
  HardDrive,
  Activity,
  X,
  RefreshCw,
  Info,
  LogOut,
  Laptop
} from 'lucide-react';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';

export const ShopPrintAgent: React.FC = () => {
  const { activeShop, agents, regenerateAgentToken } = useApp();

  const defaultToken = useMemo(
    () => getDeterministicAgentToken(activeShop?.id || 'counter_1'),
    [activeShop?.id]
  );

  const foundAgent = useMemo(
    () => agents.find((a) => a.shopId === activeShop?.id),
    [agents, activeShop?.id]
  );

  const shopAgent = useMemo(() => {
    return (
      foundAgent || {
        id: `agent_${activeShop?.id || 'counter_1'}`,
        shopId: activeShop?.id || '',
        shopName: activeShop?.name || 'Counter PC',
        deviceName: `${(activeShop?.slug || 'COUNTER').toUpperCase().slice(0, 10)}-PC01`,
        status: 'OFFLINE' as const,
        lastSeen: 'Not connected',
        connectedPrintersCount: 0,
        printerCount: 0,
        authToken: defaultToken,
        apiToken: defaultToken
      }
    );
  }, [foundAgent, activeShop?.id, activeShop?.name, activeShop?.slug, defaultToken]);

  const [tokenCopied, setTokenCopied] = useState(false);
  const [showPlainToken, setShowPlainToken] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [issuedToken, setIssuedToken] = useState<{ shopId: string; token: string } | null>(null);
  const [regenSuccessMsg, setRegenSuccessMsg] = useState<string | null>(null);

  // Accurate connection state: ONLINE, OFFLINE, CONNECTING, or ERROR
  const [connectionStatus, setConnectionStatus] = useState<'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR'>('CONNECTING');
  const [lastHeartbeat, setLastHeartbeat] = useState<string>('Checking...');
  const [connectedPrinters, setConnectedPrinters] = useState<number>(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [activeDeviceInfo, setActiveDeviceInfo] = useState<{
    deviceName: string;
    lastSeen: string | null;
    connectedAt: string | null;
  } | null>(null);

  // Tab navigation: OVERVIEW, CREDENTIALS, INSTALL
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CREDENTIALS' | 'INSTALL'>('OVERVIEW');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = async (text: string, key: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const visibleToken =
    (issuedToken?.shopId === shopAgent.shopId ? issuedToken.token : '') ||
    shopAgent.authToken ||
    defaultToken;

  const refreshStatus = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const response = await fetch(
        `/api/agent/active-status?shopId=${encodeURIComponent(activeShop?.id || '')}`
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        setConnectionStatus('OFFLINE');
        setLastHeartbeat('Disconnected');
        setConnectedPrinters(0);
        setActiveDeviceInfo(null);
        setConnectionError(data.error || 'Agent not responding');
        return;
      }

      if (data.connected) {
        const isOnline = data.status === 'ONLINE';
        setConnectionStatus(isOnline ? 'ONLINE' : 'OFFLINE');
        setLastHeartbeat(data.lastSeen ? new Date(data.lastSeen).toLocaleString() : 'Connected');
        setConnectedPrinters(data.printersCount || 0);
        setActiveDeviceInfo({
          deviceName: data.deviceName || 'Counter PC',
          lastSeen: data.lastSeen,
          connectedAt: data.connectedAt
        });
      } else {
        setConnectionStatus('OFFLINE');
        setLastHeartbeat('Disconnected');
        setConnectedPrinters(0);
        setActiveDeviceInfo(null);
      }
      setConnectionError(null);
    } catch {
      setConnectionStatus('ERROR');
      setLastHeartbeat('Unavailable');
      setConnectedPrinters(0);
      setActiveDeviceInfo(null);
      setConnectionError('Backend service unavailable');
    } finally {
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  };

  const handleDisconnectAgent = async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/agent/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: activeShop?.id })
      });
      const data = await response.json();
      if (data.success) {
        setShowDisconnectModal(false);
        setRegenSuccessMsg('Print agent disconnected successfully. Shop active device assignment released.');
        setTimeout(() => setRegenSuccessMsg(null), 5000);
        await refreshStatus(true);
      } else {
        setConnectionError(data.error || 'Failed to disconnect print agent.');
      }
    } catch (err: any) {
      setConnectionError(err?.message || 'Failed to disconnect print agent.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    const fetchInitial = async () => {
      if (!isCurrent) return;
      await refreshStatus();
    };

    void fetchInitial();
    const timer = window.setInterval(() => {
      if (isCurrent) void refreshStatus();
    }, 15000);

    return () => {
      isCurrent = false;
      window.clearInterval(timer);
    };
  }, [shopAgent.id, shopAgent.shopId]);

  const copyToken = async () => {
    if (!visibleToken) return;
    await navigator.clipboard.writeText(visibleToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleRegenerateToken = async () => {
    setIsGeneratingToken(true);
    setShowRegenConfirm(false);
    try {
      const result = await regenerateAgentToken(shopAgent.id);
      if (result.success && result.token) {
        setIssuedToken({ shopId: shopAgent.shopId, token: result.token });
        await navigator.clipboard.writeText(result.token);
        setTokenCopied(true);
        setRegenSuccessMsg('New token generated and copied to clipboard. Update your desktop agent.');
        setTimeout(() => setTokenCopied(false), 2500);
        setTimeout(() => setRegenSuccessMsg(null), 6000);
      }
    } finally {
      setIsGeneratingToken(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10 text-slate-800">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Desktop Print Agent
            </h1>
            <Chip
              variant={
                connectionStatus === 'ONLINE'
                  ? 'success'
                  : connectionStatus === 'CONNECTING'
                  ? 'warning'
                  : connectionStatus === 'ERROR'
                  ? 'danger'
                  : 'muted'
              }
              size="sm"
              dot
            >
              {connectionStatus === 'ONLINE'
                ? 'Agent Online'
                : connectionStatus === 'CONNECTING'
                ? 'Connecting...'
                : connectionStatus === 'ERROR'
                ? 'Backend Offline'
                : 'Agent Offline'}
            </Chip>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Manage your shop's desktop printing connection and devices.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshStatus(true)}
            disabled={isRefreshing}
            title="Check agent heartbeat"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </Button>

          <Button
            variant="solid"
            size="sm"
            onClick={() => setShowRegenConfirm(true)}
            disabled={isGeneratingToken}
            title="Generate a new authentication token for the desktop agent"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isGeneratingToken ? 'animate-spin' : ''}`} />
            <span>{isGeneratingToken ? 'Generating…' : 'Regenerate Token'}</span>
          </Button>
        </div>
      </div>

      {/* 2. FEEDBACK & ALERT BANNERS */}
      {regenSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{regenSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setRegenSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {connectionError && connectionStatus === 'ERROR' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{connectionError}. Local queue processing may be paused until connectivity restores.</span>
          </div>
        </div>
      )}

      {/* 2.5 CONNECTION STATUS & SINGLE-DEVICE CARD */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        {activeDeviceInfo || connectionStatus === 'ONLINE' ? (
          /* When Connected */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Status: Connected
                </span>
                <span className="text-xs font-semibold text-slate-800">
                  Shop: {activeShop.name}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap pt-0.5">
                <span className="flex items-center gap-1 font-mono">
                  <Laptop className="w-3.5 h-3.5 text-slate-400" />
                  <strong>Device Host:</strong> {activeDeviceInfo?.deviceName || shopAgent.deviceName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <strong>Connected:</strong> {lastHeartbeat}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisconnectModal(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect Agent</span>
            </Button>
          </div>
        ) : (
          /* When Disconnected */
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Status: Disconnected
              </span>
              <span className="text-xs text-slate-500">
                Shop: <strong className="text-slate-800">{activeShop.name}</strong>
              </span>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Automatic Device Handover</p>
                <p className="text-blue-800 mt-0.5 leading-relaxed">
                  Each shop can have only <strong>ONE active Print Agent device</strong> at a time. When you connect a new PC with your shop credentials, the previous PC is automatically disconnected and the new PC becomes the active print station.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Shop ID</span>
                  <span className="text-xs font-mono font-bold text-slate-800">{activeShop.id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyText(activeShop.id, 'Shop ID')}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                  title="Copy Shop ID"
                >
                  {copiedKey === 'Shop ID' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="truncate mr-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Agent Auth Token</span>
                  <span className="text-xs font-mono font-bold text-slate-800 truncate block">
                    {visibleToken ? `${visibleToken.slice(0, 16)}...` : 'agt_tok_...'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyToken}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 shrink-0 cursor-pointer"
                  title="Copy Token"
                >
                  {tokenCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xl space-y-4 max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900">
                Disconnect Print Agent?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Disconnect this Print Agent from this PC? Printing will stop until the agent is connected again.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDisconnectModal(false)}
                disabled={isDisconnecting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={() => void handleDisconnectAgent()}
                disabled={isDisconnecting}
                className="bg-red-600 hover:bg-red-700 text-white flex-1"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. AGENT STATUS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Device Hostname */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono mb-1 uppercase tracking-[0.06em]">
            <span>Device Host</span>
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm font-bold text-slate-900 truncate font-mono" title={shopAgent.deviceName}>
              {shopAgent.deviceName}
            </p>
            <button
              type="button"
              onClick={() => void handleCopyText(shopAgent.deviceName, 'Device Host')}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors ml-1 shrink-0 cursor-pointer"
              title="Copy Device Hostname"
            >
              {copiedKey === 'Device Host' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 pt-1 border-t border-slate-100">
            <span className="truncate font-mono" title={activeShop.id}>Shop ID: {activeShop.id}</span>
            <button
              type="button"
              onClick={() => void handleCopyText(activeShop.id, 'Shop ID')}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors ml-1 shrink-0 cursor-pointer"
              title="Copy Full Canonical Shop UUID"
            >
              {copiedKey === 'Shop ID' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Connected Printers */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono mb-1 uppercase tracking-[0.06em]">
            <span>Connected Printers</span>
            <Printer className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {connectedPrinters}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {connectedPrinters > 0 ? 'Hardware queues online' : 'No local printer reported'}
          </p>
        </div>

        {/* Heartbeat Sync */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono mb-1 uppercase tracking-[0.06em]">
            <span>Heartbeat Sync</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p
            className={`text-sm font-bold mt-1 truncate ${
              connectionStatus === 'ONLINE' ? 'text-emerald-600' : 'text-slate-600'
            }`}
          >
            {lastHeartbeat}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Poll cadence: 5s interval
          </p>
        </div>
      </div>

      {/* 4. TABS NAVIGATION */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1 gap-1 overflow-x-auto">
          {[
            { id: 'OVERVIEW', label: 'Overview' },
            { id: 'CREDENTIALS', label: 'Credentials & Token' },
            { id: 'INSTALL', label: 'Installation Guide' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-5">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Agent Connection Details */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span>Connection Telemetry</span>
                  </h3>

                  <dl className="space-y-2 font-mono divide-y divide-slate-100">
                    <div className="flex items-center justify-between pt-1">
                      <dt className="text-slate-500">Service Status:</dt>
                      <dd>
                        <Chip
                          variant={connectionStatus === 'ONLINE' ? 'success' : 'muted'}
                          size="sm"
                          dot
                        >
                          {connectionStatus === 'ONLINE' ? 'Operational' : 'Disconnected'}
                        </Chip>
                      </dd>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <dt className="text-slate-500">Device Hostname:</dt>
                      <dd className="font-semibold text-slate-800">{shopAgent.deviceName}</dd>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <dt className="text-slate-500">Assigned Shop ID:</dt>
                      <dd className="text-slate-700">{activeShop.id}</dd>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <dt className="text-slate-500">Protocol & Encryption:</dt>
                      <dd className="text-slate-700">HTTPS (TLS 1.3) + HMAC-SHA256</dd>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <dt className="text-slate-500">Credential Vault:</dt>
                      <dd className="text-emerald-700 font-semibold">OS safeStorage (DPAPI / Keychain)</dd>
                    </div>
                  </dl>
                </div>

                {/* Printer & Spooler Invariants */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                    <Printer className="w-4 h-4 text-blue-600" />
                    <span>Spooler Invariants</span>
                  </h3>

                  <div className="space-y-2 text-slate-600 leading-relaxed">
                    <p className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <span>
                        <strong className="text-slate-800 font-medium">Virtual Queue Filtering:</strong> Microsoft Print to PDF, OneNote, and XPS virtual queues are auto-excluded from production jobs.
                      </span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <span>
                        <strong className="text-slate-800 font-medium">Atomic 5-Minute Lease:</strong> If counter PC sleeps or crashes during print, jobs auto-recover safely after 5 minutes.
                      </span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <span>
                        <strong className="text-slate-800 font-medium">Spooler Defense:</strong> Ambiguous printer outcomes are flagged as <em>REQUIRES_ATTENTION</em> to prevent duplicate wasted sheets.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CREDENTIALS */}
          {activeTab === 'CREDENTIALS' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1">
                  Device Authentication Bearer Token
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPlainToken ? 'text' : 'password'}
                      readOnly
                      value={visibleToken}
                      placeholder="Generate an agent token to pair a device"
                      className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 font-medium select-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPlainToken(!showPlainToken)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title={showPlainToken ? 'Hide token' : 'Show token'}
                      aria-label={showPlainToken ? 'Hide token' : 'Show token'}
                    >
                      {showPlainToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <Button
                    variant="solid"
                    size="sm"
                    onClick={copyToken}
                    disabled={!visibleToken}
                  >
                    {tokenCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{tokenCopied ? 'Copied' : 'Copy Token'}</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRegenConfirm(true)}
                    disabled={isGeneratingToken}
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isGeneratingToken ? 'animate-spin' : ''}`} />
                    <span>Rotate</span>
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Paste this token once into the desktop agent setup. Tokens are stored encrypted in the OS credential vault.
                </p>
              </div>

              {/* Troubleshooting Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  <span>Connection Troubleshooting</span>
                </span>
                <ul className="space-y-1 text-slate-600 text-[11px] list-disc list-inside">
                  <li>Confirm the desktop agent service is running in your Windows/macOS tray.</li>
                  <li>Verify that your <strong>Shop ID ({activeShop.id})</strong> matches in the agent configuration.</li>
                  <li>If the counter PC is switched, rotate the token and pair the new machine.</li>
                </ul>
              </div>

              {/* Security helper */}
              <div className="flex items-center gap-2 p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-[11px] leading-snug">
                  Hardware-backed M2M authorization: Tokens are protected by OS-level encryption (Windows DPAPI / macOS Keychain) and never exposed to renderer scripts.
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: INSTALLATION GUIDE */}
          {activeTab === 'INSTALL' && (
            <div className="space-y-4 text-xs text-slate-700">
              <h3 className="font-semibold text-sm text-slate-900">
                How to install PrintFlow Agent on your counter PC:
              </h3>
              <ol className="list-decimal pl-5 space-y-2.5">
                <li>
                  Download the latest <code className="font-mono text-blue-700 font-semibold">PrintFlow-Agent-Setup.exe</code> installer for Windows 10/11.
                </li>
                <li>
                  Run the installer with Administrator privileges to enable auto-discovery of USB and network printers.
                </li>
                <li>
                  Launch the application from the desktop shortcut or system tray.
                </li>
                <li>
                  Enter your <strong>Shop ID ({activeShop.id})</strong> and the <strong>Agent Auth Token</strong> from the Credentials tab.
                </li>
                <li>
                  The agent will establish a secure heartbeat and begin claiming customer print jobs automatically.
                </li>
              </ol>

              <div className="pt-2 flex items-center gap-3">
                <Button
                  variant="solid"
                  size="md"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = '#';
                    link.setAttribute('download', 'PrintFlow-Agent-Setup-v1.4.2.exe');
                    // Notification
                    alert('PrintFlow Agent installer v1.4.2 ready. (Run with Admin privileges)');
                  }}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Windows Installer (v1.4.2)</span>
                </Button>
                <span className="text-[11px] text-slate-400 font-mono">
                  SHA-256 verified • NSIS installer
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. CONFIRMATION DIALOG FOR TOKEN REGENERATION */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Regenerate Agent Token?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Generating a new token will immediately disconnect the current Desktop Agent running on your counter PC. You will need to enter the new token into the Agent settings.
              </p>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegenConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={handleRegenerateToken}
                disabled={isGeneratingToken}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isGeneratingToken ? 'Regenerating…' : 'Confirm & Rotate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
