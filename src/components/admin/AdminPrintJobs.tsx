import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import { Printer, Search, Filter, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
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

export const AdminPrintJobs: React.FC = () => {
  const { printJobs, shops } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'QUEUED' | 'PRINTING' | 'COMPLETED' | 'FAILED'>('ALL');

  const filteredJobs = printJobs.filter((job) => {
    const matchesSearch =
      job.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customerName?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedShop !== 'ALL' && job.shopId !== selectedShop) return false;
    if (statusFilter !== 'ALL' && job.printStatus !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Global Print Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Monitor real-time print orders and spooler status across all platform tenants.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
          Total Filtered Orders: <strong className="text-slate-900">{filteredJobs.length}</strong>
        </div>
      </div>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search across all shops by Order ID, shop, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 h-10 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <select
            value={selectedShop}
            onChange={(e) => setSelectedShop(e.target.value)}
            className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-600/20"
          >
            <option value="ALL">All Shops ({shops.length})</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600">
            {(['ALL', 'QUEUED', 'PRINTING', 'COMPLETED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer capitalize ${
                  statusFilter === st
                    ? 'bg-white text-purple-700 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                {st.toLowerCase()}
              </button>
            ))}
          </div>

          {(searchQuery || selectedShop !== 'ALL' || statusFilter !== 'ALL') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedShop('ALL');
                setStatusFilter('ALL');
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* 3. GLOBAL PRINT JOBS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Shop Tenant</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Document / Settings</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Print Status</TableHead>
              <TableHead className="text-right">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">No Print Orders Found</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        No orders match the selected search or filter parameters.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job) => {
                const firstFile = job.files[0];
                return (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono font-semibold text-purple-700">
                      {job.id}
                    </TableCell>

                    <TableCell className="font-semibold text-slate-900">
                      {job.shopName}
                    </TableCell>

                    <TableCell>
                      <span className="font-medium text-slate-900 block">{job.customerName}</span>
                      <span className="text-[11px] text-slate-400">{job.customerPhone || 'Walk-in Guest'}</span>
                    </TableCell>

                    <TableCell>
                      <p className="font-medium text-slate-800 truncate max-w-[180px]" title={firstFile?.fileName}>
                        {firstFile?.fileName || 'Document'}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <span>{firstFile?.paperSize || 'A4'}</span>
                        <span>·</span>
                        <span>{firstFile?.color === 'COLOR' ? 'Color' : 'B&W'}</span>
                        <span>·</span>
                        <span>{firstFile?.copies || 1} {firstFile?.copies === 1 ? 'copy' : 'copies'}</span>
                      </div>
                    </TableCell>

                    <TableCell className="font-mono font-semibold text-slate-900">
                      ₹{job.totalAmount.toFixed(2)}
                    </TableCell>

                    <TableCell>
                      {job.printStatus === 'COMPLETED' ? (
                        <Chip variant="success" size="sm" dot>COMPLETED</Chip>
                      ) : job.printStatus === 'PRINTING' || job.printStatus === 'DOWNLOADING' ? (
                        <Chip variant="special" size="sm" dot className="animate-pulse">{job.printStatus}</Chip>
                      ) : job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED' ? (
                        <Chip variant="warning" size="sm" dot>{job.printStatus}</Chip>
                      ) : (
                        <Chip variant="danger" size="sm" dot>{job.printStatus}</Chip>
                      )}
                    </TableCell>

                    <TableCell className="text-right font-mono text-slate-500 text-[11px]">
                      {new Date(job.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
