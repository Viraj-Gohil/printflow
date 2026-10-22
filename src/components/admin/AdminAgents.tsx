import React, { useState } from 'react';
import { Cpu, Wifi, WifiOff, Printer, ShieldCheck, Clock, Search } from 'lucide-react';
import { useApp } from '../../lib/store';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../ui/Table';

export const AdminAgents: React.FC = () => {
  const { devices, shops } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');

  const filteredDevices = (devices || []).filter((d) => {
    const matchesSearch =
      d.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.ipAddress || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Electron Print Agent Fleet
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Real-time status and health of desktop print agents deployed across shop workstations.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
          Active Agents: <strong className="text-slate-900">{(devices || []).filter(d => d.status === 'ONLINE').length}</strong> / {(devices || []).length}
        </div>
      </div>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search agents by hostname, shop, IP address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 h-10 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600">
            {(['ALL', 'ONLINE', 'OFFLINE'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer capitalize ${
                  statusFilter === st
                    ? 'bg-white text-purple-700 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                {st.toLowerCase()}
              </button>
            ))}
          </div>

          {(searchQuery || statusFilter !== 'ALL') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* 3. PRINT AGENTS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device Hostname</TableHead>
              <TableHead>Shop Tenant</TableHead>
              <TableHead>Agent Version</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Connected Printers</TableHead>
              <TableHead>Last Sync / Heartbeat</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDevices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">No Print Agents Found</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        No Electron print agents match your search or filter criteria.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredDevices.map((d) => {
                const isOnline = d.status === 'ONLINE';
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono font-semibold text-slate-900 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>{d.deviceName}</span>
                    </TableCell>

                    <TableCell className="font-semibold text-slate-900">
                      {d.shopName}
                    </TableCell>

                    <TableCell className="font-mono text-slate-600 text-xs">
                      {d.agentVersion || d.version || 'v1.4.2'}
                    </TableCell>

                    <TableCell className="font-mono text-slate-500 text-xs">
                      {d.ipAddress || '127.0.0.1'}
                    </TableCell>

                    <TableCell className="text-blue-600 font-semibold">
                      {d.printerCount ?? d.connectedPrintersCount ?? 1} USB/LAN printers
                    </TableCell>

                    <TableCell className="text-slate-500 text-xs font-mono">
                      {d.lastSeen}
                    </TableCell>

                    <TableCell className="text-right">
                      <Chip
                        variant={isOnline ? 'success' : 'danger'}
                        size="sm"
                        dot
                      >
                        {d.status}
                      </Chip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
