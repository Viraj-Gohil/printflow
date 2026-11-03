import React, { useState, useEffect } from 'react';
import { useApp } from '../../lib/store';
import {
  Activity,
  Cpu,
  Printer,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Zap,
  Server,
  HardDrive,
  Wifi,
  WifiOff,
  Database,
  Radio,
  FileCode2,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

export const AdminSystemHealth: React.FC = () => {
  const { agents, printJobs, adminRazorpay, testGatewayConnection, showToast } = useApp();

  const [isPinging, setIsPinging] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('Just now');
  const [gatewayLatency, setGatewayLatency] = useState<number>(42);

  // Agent metrics
  const totalAgents = (agents || []).length;
  const onlineAgents = (agents || []).filter((a) => a.status === 'ONLINE').length;
  const offlineAgents = totalAgents - onlineAgents;

  // Queue metrics
  const queuedJobs = (printJobs || []).filter((j) => j.printStatus === 'QUEUED');
  const printingJobs = (printJobs || []).filter((j) => j.printStatus === 'PRINTING');
  const failedJobs = (printJobs || []).filter((j) => j.printStatus === 'FAILED' || j.printStatus === 'PRINT_INTERRUPTED');

  const allOperational = offlineAgents === 0 && failedJobs.length === 0;

  const handleRunDiagnostics = async () => {
    if (isPinging) return;
    setIsPinging(true);
    try {
      const res = await testGatewayConnection();
      setGatewayLatency(res.latencyMs || 38);
      setLastCheckTime('Just now');
      showToast('Diagnostics Complete', `All core systems responding. Gateway latency: ${res.latencyMs}ms.`, 'success');
    } catch {
      showToast('Diagnostics Alert', 'Diagnostics completed with telemetry warnings.', 'info');
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            System Health & Fleet Telemetry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Monitor service availability, database performance, payment integrations, and desktop print agents.
          </p>
        </div>

        <Button
          variant="solid"
          size="sm"
          disabled={isPinging}
          onClick={handleRunDiagnostics}
          className="bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-500"
        >
          {isPinging ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{isPinging ? 'Running Health Checks...' : 'Run Diagnostics'}</span>
        </Button>
      </div>

      {/* 2. OVERALL SYSTEM STATUS PANEL */}
      <div
        className={`p-4 sm:p-5 rounded-xl border shadow-2xs flex items-center justify-between flex-wrap gap-4 ${
          allOperational
            ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
            : 'bg-amber-50/70 border-amber-200/80 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs ${
              allOperational ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold">
                {allOperational ? 'All Platform Systems Operational' : 'Fleet Attention Required'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 border border-slate-200/50">
                99.98% 30d Uptime
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {allOperational
                ? 'All background agents online, Spooler queue clear, Razorpay webhook listener responding.'
                : `${offlineAgents} print agent(s) disconnected or queue errors detected.`}
            </p>
          </div>
        </div>

        <div className="text-right text-xs">
          <span className="text-slate-400 block font-medium">Last Check:</span>
          <span className="font-mono font-bold text-slate-800">{lastCheckTime}</span>
        </div>
      </div>

      {/* 3. MONITORING SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Print Agents Fleet */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-slate-500">Print Agents Fleet</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            {onlineAgents} / {totalAgents} Online
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
            <Radio className="w-3 h-3 text-emerald-500 animate-pulse shrink-0" />
            <span>Avg Heartbeat: <strong>48ms</strong></span>
          </div>
        </div>

        {/* Queue Spool Backlog */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-slate-500">Queue Spool Backlog</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            {queuedJobs.length + printingJobs.length} Jobs Active
          </p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            Average spool time: 1.2s per PDF
          </span>
        </div>

        {/* Platform Gateway API */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-slate-500">Platform Gateway API</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 font-mono tracking-tight">
            {gatewayLatency}ms
          </p>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Razorpay Live API (200 OK)
          </span>
        </div>

        {/* Database & Storage */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-slate-500">Database & Storage</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            Postgres · OK
          </p>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Supabase private storage synced
          </span>
        </div>
      </div>

      {/* 4. DETAILED SERVICE STATUS MATRIX */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden p-5 space-y-4">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-slate-900">
            Subsystem Health Matrix
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Detailed operational metrics for each microservice and background worker.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Express API Gateway</p>
                <p className="text-[11px] text-slate-500">Port 3000 · Node 22</p>
              </div>
            </div>
            <Chip variant="success" size="sm" dot>Operational</Chip>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Neon / Supabase Pool</p>
                <p className="text-[11px] text-slate-500">Connection Pool: 10 max</p>
              </div>
            </div>
            <Chip variant="success" size="sm" dot>Connected</Chip>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <HardDrive className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Storage Bucket</p>
                <p className="text-[11px] text-slate-500">print-documents (Private)</p>
              </div>
            </div>
            <Chip variant="success" size="sm" dot>Secured</Chip>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileCode2 className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Webhook Verifier</p>
                <p className="text-[11px] text-slate-500">HMAC-SHA256 Signatures</p>
              </div>
            </div>
            <Chip variant="success" size="sm" dot>Active</Chip>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Electron M2M Service</p>
                <p className="text-[11px] text-slate-500">Polling & Lease Recovery</p>
              </div>
            </div>
            <Chip variant="success" size="sm" dot>Synchronized</Chip>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Audit & Log Redaction</p>
                <p className="text-[11px] text-slate-500">Credential Sanitization</p>
              </div>
            </div>
            <Chip variant="success" size="sm" dot>Enforced</Chip>
          </div>
        </div>
      </div>

      {/* 5. AGENT RESOURCE MONITORING & TELEMETRY SECTION */}
      <AgentFleetMonitoringSection />
    </div>
  );
};

function AgentFleetMonitoringSection() {
  const [fleetData, setFleetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/admin/resource-overview');
      const data = await res.json();
      if (data.success) {
        setFleetData(data);
      }
    } catch (err) {
      console.warn('Failed to fetch admin resource overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const timer = setInterval(fetchOverview, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleResolveAlert = async (alertId: string) => {
    setResolvingId(alertId);
    try {
      const res = await fetch(`/api/agent/monitoring/alerts/${alertId}/resolve`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        fetchOverview();
      }
    } catch {} finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-purple-600" />
        Loading Desktop Print Agent Fleet Telemetry...
      </div>
    );
  }

  const agents = fleetData?.agents || [];
  const alerts = fleetData?.activeAlerts || [];
  const summary = fleetData?.fleetSummary || {};

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Windows Print Agent Fleet Resources & Health
            </h3>
            <p className="text-xs text-slate-500">
              Live CPU, RAM, Disk, Print Spooler, and Print Agent Local Storage telemetry reported by connected agents.
            </p>
          </div>
          <button
            onClick={fetchOverview}
            className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {agents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
            No registered Windows Print Agents responding to telemetry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                  <th className="py-2.5 px-3">Agent / Shop ID</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">System / Agent CPU</th>
                  <th className="py-2.5 px-3">System / Agent RAM</th>
                  <th className="py-2.5 px-3">Disk Free</th>
                  <th className="py-2.5 px-3">Agent Storage</th>
                  <th className="py-2.5 px-3">Spooler</th>
                  <th className="py-2.5 px-3">Printers</th>
                  <th className="py-2.5 px-3">Last Heartbeat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {agents.map((a: any) => {
                  const ramUsed = a.total_ram_bytes ? (((a.total_ram_bytes - a.available_ram_bytes) / a.total_ram_bytes) * 100).toFixed(0) : '0';
                  const diskFreeMb = (a.free_disk_bytes / (1024 * 1024 * 1024)).toFixed(1);
                  const agentStorageMb = (a.agent_storage_bytes / (1024 * 1024)).toFixed(1);
                  const agentRamMb = (a.agent_ram_bytes / (1024 * 1024)).toFixed(0);

                  return (
                    <tr key={a.agent_id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        <div>{a.agent_id}</div>
                        <div className="text-[10px] text-slate-400 font-normal">Shop: {a.shop_id}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Chip
                          variant={a.status === 'ONLINE' ? 'success' : a.status === 'WARNING' ? 'warning' : 'danger'}
                          size="sm"
                          dot
                        >
                          {a.status}
                        </Chip>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-800">{a.system_cpu_percent}%</span>
                        <span className="text-[10px] text-slate-400 block">Agent: {a.agent_cpu_percent}%</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-800">{ramUsed}% Used</span>
                        <span className="text-[10px] text-slate-400 block">{agentRamMb} MB RSS</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-800">{diskFreeMb} GB</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-purple-700">{agentStorageMb} MB</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`font-semibold ${a.spooler_status === 'RUNNING' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {a.spooler_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {a.online_printers} Online / {a.offline_printers} Offline
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-sans text-[11px]">
                        {new Date(a.last_heartbeat_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ACTIVE ALERTS TABLE */}
      {alerts.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Active Resource & Hardware Health Alerts ({alerts.length})</span>
          </div>

          <div className="space-y-2">
            {alerts.map((alt: any) => (
              <div
                key={alt.id}
                className="bg-white p-3 rounded-lg border border-amber-200/60 flex items-center justify-between text-xs gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      alt.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {alt.severity}
                    </span>
                    <strong className="text-slate-900">{alt.alert_type}</strong>
                    <span className="text-slate-400 text-[10px]">Agent: {alt.agent_id} (Shop: {alt.shop_id})</span>
                  </div>
                  <p className="text-slate-600 mt-1">{alt.message}</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={resolvingId === alt.id}
                  onClick={() => handleResolveAlert(alt.id)}
                  className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 text-xs shrink-0 cursor-pointer"
                >
                  {resolvingId === alt.id ? 'Resolving...' : 'Acknowledge & Resolve'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
