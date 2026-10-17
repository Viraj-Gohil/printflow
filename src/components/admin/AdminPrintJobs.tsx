import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import { Printer, Search, Filter, Eye, CheckCircle2, Clock } from 'lucide-react';

export const AdminPrintJobs: React.FC = () => {
  const { printJobs } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState('ALL');

  const filteredJobs = printJobs.filter((job) => {
    const matchesSearch =
      job.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customerName?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedShop !== 'ALL' && job.shopId !== selectedShop) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search across all shops by ID, shop, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="text-xs text-slate-500 font-semibold">
          Total Global Print Orders: {filteredJobs.length}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Shop Tenant</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Files / Pages</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Print Status</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4 font-mono font-bold text-purple-700">{job.id}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{job.shopName}</td>
                  <td className="py-3.5 px-4 text-slate-700">{job.customerName}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {job.files.length} document(s) · {job.files[0]?.paperSize} ({job.files[0]?.color})
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                    ₹{job.totalAmount.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        job.printStatus === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : job.printStatus === 'PRINTING'
                          ? 'bg-blue-50 text-blue-700 animate-pulse'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {job.printStatus}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                    {new Date(job.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
