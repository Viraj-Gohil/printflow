import React from 'react';
import { useApp } from '../../lib/store';
import {
  Store,
  Printer,
  CreditCard,
  Cpu,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Shield,
  Layers,
  ArrowUpRight
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { shops, printJobs, agents, transactions, navigate } = useApp();

  const totalShops = (shops || []).length;
  const activeShops = (shops || []).filter((s) => s?.status === 'ACTIVE').length;
  const totalJobs = (printJobs || []).length;
  const totalRevenue = (transactions || []).reduce((acc, t) => acc + (t?.status === 'SUCCESS' ? t.amount : 0), 0);
  const onlineAgents = (agents || []).filter((a) => a?.status === 'ONLINE').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/admin/shops')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold group-hover:text-purple-700 transition-colors">Total Shops</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">{totalShops}</p>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" />
            {activeShops} active SaaS tenants
          </span>
        </div>

        <div
          onClick={() => navigate('/admin/print-jobs')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold group-hover:text-purple-700 transition-colors">Platform Print Jobs</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">{totalJobs}</p>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Across all xerox counters
          </span>
        </div>

        <div
          onClick={() => navigate('/admin/payments')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold group-hover:text-purple-700 transition-colors">Gross Processed (₹)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">₹{totalRevenue.toFixed(2)}</p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            SaaS subscriptions + print volume
          </span>
        </div>

        <div
          onClick={() => navigate('/admin/agents')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold group-hover:text-purple-700 transition-colors">Active Print Agents</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">
            {onlineAgents} / {agents.length}
          </p>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Electron background workers
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Registered Xerox Shops</h2>
            <p className="text-xs text-slate-500">Tenants currently operating on the PrintFlow network</p>
          </div>
          <button
            onClick={() => navigate('/admin/shops')}
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
          >
            <span>View All Shops</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Shop Name</th>
                <th className="py-3 px-4">Owner Contact</th>
                <th className="py-3 px-4">SaaS Plan</th>
                <th className="py-3 px-4">Shop Razorpay</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shops.map((shop) => (
                <tr key={shop.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900 block">{shop.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">/s/{shop.slug}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="text-slate-800 font-medium">{shop.ownerName}</p>
                    <p className="text-[11px] text-slate-500">{shop.ownerEmail}</p>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-purple-700">
                    {shop.planName}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-slate-600 text-[11px]">
                      {shop.razorpaySettings?.keyId ? shop.razorpaySettings.keyId.slice(0, 14) + '...' : 'Not Set'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        shop.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {shop.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => navigate(`/s/${shop.slug}`)}
                      className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 rounded-lg text-[11px] font-semibold cursor-pointer"
                    >
                      View Shop
                    </button>
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
