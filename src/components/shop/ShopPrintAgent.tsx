import React, { useEffect, useState } from 'react';
import { useApp } from '../../lib/store';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Key,
  Copy,
  Download,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Server
} from 'lucide-react';

export const ShopPrintAgent: React.FC = () => {
  const { activeShop, agents, regenerateAgentToken } = useApp();

  const foundAgent = agents.find((a) => a.shopId === activeShop?.id);
  const shopAgent = foundAgent || {
    id: `agent_${activeShop?.id || 'counter_1'}`,
    shopId: activeShop?.id || 'shop_shree_ganesh',
    shopName: activeShop?.name || 'Counter PC',
    deviceName: `${(activeShop?.slug || 'COUNTER').toUpperCase().slice(0, 10)}-PC01`,
    status: 'OFFLINE' as const,
    lastSeen: 'Not connected',
    connectedPrintersCount: 0,
    printerCount: 0,
    authToken: '',
    apiToken: ''
  };

  const [tokenCopied, setTokenCopied] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [issuedToken, setIssuedToken] = useState<{ shopId: string; token: string } | null>(null);
  const [liveStatus, setLiveStatus] = useState({
    status: 'OFFLINE' as 'ONLINE' | 'OFFLINE',
    lastSeen: 'Not connected',
    connectedPrintersCount: 0
  });
  const [activeTab, setActiveTab] = useState<'STATUS' | 'INSTALL' | 'API'>('STATUS');
  const visibleToken = issuedToken?.shopId === shopAgent.shopId ? issuedToken.token : '';

  useEffect(() => {
    let isCurrent = true;
    const refreshStatus = async () => {
      try {
        const response = await fetch(
          `/api/agent/${encodeURIComponent(shopAgent.id)}/status?shopId=${encodeURIComponent(shopAgent.shopId)}`
        );
        const data = (await response.json()) as {
          success?: boolean;
          status?: 'ONLINE' | 'OFFLINE';
          lastSeen?: string;
          connectedPrintersCount?: number;
        };
        if (!isCurrent) return;
        if (!response.ok || !data.success) {
          setLiveStatus({ status: 'OFFLINE', lastSeen: 'Status unavailable', connectedPrintersCount: 0 });
          return;
        }
        setLiveStatus({
          status: data.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
          lastSeen: data.lastSeen || 'Not connected',
          connectedPrintersCount: data.connectedPrintersCount || 0
        });
      } catch {
        if (isCurrent) {
          setLiveStatus({ status: 'OFFLINE', lastSeen: 'Backend unavailable', connectedPrintersCount: 0 });
        }
      }
    };

    void refreshStatus();
    const timer = window.setInterval(refreshStatus, 15000);
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
    try {
      const result = await regenerateAgentToken(shopAgent.id);
      if (result.success && result.token) {
        setIssuedToken({ shopId: shopAgent.shopId, token: result.token });
        await navigator.clipboard.writeText(result.token);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2000);
      }
    } finally {
      setIsGeneratingToken(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Electron Print Agent (Desktop Service)</h2>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                liveStatus.status === 'ONLINE'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              ● {liveStatus.status === 'ONLINE' ? 'AGENT CONNECTED' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            The separate PrintFlow Desktop Agent runs in the background on your shop PC to receive queued jobs and send them to physical printers.
          </p>
        </div>

        <button
          onClick={handleRegenerateToken}
          disabled={isGeneratingToken}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isGeneratingToken ? 'animate-spin' : ''}`} />
          <span>{isGeneratingToken ? 'Generating…' : 'Generate / Regenerate Token'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Device Host</span>
          <p className="text-sm font-bold text-slate-900 mt-1 truncate">{shopAgent.deviceName}</p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Shop: {activeShop.id}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Agent Version</span>
          <p className="text-sm font-bold font-mono text-slate-900 mt-1">{shopAgent.version || 'v1.4.2'}</p>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">Up to date (LTS)</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Connected Printers</span>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">{liveStatus.connectedPrintersCount}</p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Auto-discovered</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Heartbeat Sync</span>
          <p className={`text-sm font-bold mt-1 ${liveStatus.status === 'ONLINE' ? 'text-emerald-600' : 'text-slate-500'}`}>
            {liveStatus.lastSeen}
          </p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Interval: 5s polling</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-100 bg-slate-50/60 p-1">
          <button
            onClick={() => setActiveTab('STATUS')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
              activeTab === 'STATUS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Agent Credentials & Token
          </button>
          <button
            onClick={() => setActiveTab('INSTALL')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
              activeTab === 'INSTALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Installation Guide (Windows / Linux / macOS)
          </button>
          <button
            onClick={() => setActiveTab('API')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
              activeTab === 'API' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            REST API Contract (for Electron)
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'STATUS' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Device Authentication Bearer Token
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={visibleToken}
                    placeholder="Generate an agent token to pair a device"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                  <button
                    onClick={copyToken}
                    disabled={!visibleToken}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {tokenCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{tokenCopied ? 'Copied' : 'Copy Token'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Paste the token generated here into PrintFlow Agent setup. You do not need to generate a second token in the desktop app.
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1.5">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Hardware-Backed Desktop Isolation & M2M Security
                </span>
                <p className="text-blue-800 leading-relaxed">
                  The desktop agent runs with strict Electron process separation (<code className="px-1 py-0.5 bg-blue-100 rounded text-blue-900 font-mono text-[11px]">contextIsolation: true</code>). Device tokens are encrypted in the operating system's credential vault (Windows Credential Manager / macOS Keychain via safeStorage) and are never exposed to renderer JavaScript or web storage.
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-800 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>OS-backed hardware storage enabled • Machine-to-machine mutual challenge • Instant remote revocation</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'INSTALL' && (
            <div className="space-y-4 text-xs text-slate-700">
              <h3 className="font-bold text-sm text-slate-900">How to install PrintFlow Agent on your Xerox PC:</h3>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Download the latest <code>PrintFlow-Agent-Setup.exe</code> installer for Windows 10/11.</li>
                <li>Run the installer with Administrator privileges so it can discover local and network printer queues.</li>
                <li>Launch the agent from your system tray.</li>
                <li>Enter your <strong>Shop ID ({activeShop.id})</strong> and the already-generated <strong>Agent Auth Token</strong> from the previous tab. Do not generate another token in the desktop app.</li>
                <li>The agent will automatically ping back and begin polling for paid customer print jobs!</li>
              </ol>

              <div className="pt-2">
                <div className="inline-flex px-4 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Download PrintFlow-Agent-Setup-v1.4.2.exe</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'API' && (
            <div className="space-y-3 font-mono text-xs">
              <span className="font-bold text-slate-900">Ready REST API Endpoints:</span>
              <div className="p-3 bg-slate-900 text-slate-200 rounded-xl space-y-2 text-[11px]">
                <p><span className="text-emerald-400">GET</span> /api/agent/jobs?shopId={activeShop.id}</p>
                <p><span className="text-blue-400">POST</span> /api/agent/jobs/:id/claim</p>
                <p><span className="text-amber-400">POST</span> /api/agent/jobs/:id/status (DOWNLOADING | PRINTING | COMPLETED)</p>
                <p><span className="text-purple-400">POST</span> /api/agent/devices/heartbeat</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
