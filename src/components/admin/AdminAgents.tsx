import React from 'react';
import { Cpu, Wifi, WifiOff, Printer, ShieldCheck, Clock } from 'lucide-react';
import { useApp } from '../../lib/store/appStore';

export const AdminAgents: React.FC = () => {
  const { devices, shops } = useApp();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Electron Print Agent Fleet</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Real-time status of desktop print agents deployed across shop workstations.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Device Hostname</th>
                <th className="py-3 px-4">Shop Tenant</th>
                <th className="py-3 px-4">Agent Version</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Connected Printers</th>
                <th className="py-3 px-4">Last Sync / Heartbeat</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!devices || devices.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No print agents registered yet.
                  </td>
                </tr>
              ) : (
                devices.map((d) => {
                  const isOnline = d.status === 'ONLINE';
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-slate-400" />
                        <span>{d.deviceName}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {d.shopName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {d.agentVersion || d.version || 'v1.4.2'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {d.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-3.5 px-4 text-blue-600 font-semibold">
                        {d.printerCount ?? d.connectedPrintersCount ?? 1} USB/LAN printers
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {d.lastSeen}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 ${
                          isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          <span>{d.status}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
