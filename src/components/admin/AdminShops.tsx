import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import {
  Store,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Shield,
  Eye,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { Shop } from '../../types';

export const AdminShops: React.FC = () => {
  const { shops, updateShopStatus, navigate } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShopModal, setSelectedShopModal] = useState<Shop | null>(null);

  const filteredShops = shops.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.ownerEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search shops by name, city, owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="text-xs text-slate-500 font-semibold">
          Showing {filteredShops.length} of {shops.length} Tenants
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Shop Identity</th>
                <th className="py-3 px-4">Owner Contact</th>
                <th className="py-3 px-4">City / Location</th>
                <th className="py-3 px-4">SaaS Plan</th>
                <th className="py-3 px-4">Shop Razorpay Key</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredShops.map((shop) => (
                <tr key={shop.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900 block">{shop.name}</span>
                    <button
                      onClick={() => navigate(`/s/${shop.slug}`)}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-mono cursor-pointer"
                    >
                      /s/{shop.slug}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-900">{shop.ownerName}</p>
                    <p className="text-[11px] text-slate-500">{shop.ownerEmail}</p>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">{shop.city}</td>
                  <td className="py-3.5 px-4 font-bold text-purple-700">{shop.planName}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-mono text-slate-600 text-[11px]">
                      {shop.razorpaySettings?.keyId ? shop.razorpaySettings.keyId.slice(0, 16) + '...' : 'Not Provided'}
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
                    <div className="flex items-center justify-end gap-1.5">
                      {shop.status === 'ACTIVE' ? (
                        <button
                          onClick={() => updateShopStatus(shop.id, 'SUSPENDED')}
                          className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-lg text-[11px] font-semibold cursor-pointer"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => updateShopStatus(shop.id, 'ACTIVE')}
                          className="px-2.5 py-1 text-emerald-600 hover:bg-emerald-50 rounded-lg text-[11px] font-semibold cursor-pointer"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedShopModal(shop)}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-lg text-[11px] cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedShopModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase text-purple-600">Shop Tenant Audit</span>
                <h3 className="text-lg font-bold text-slate-900">{selectedShopModal.name}</h3>
              </div>
              <button
                onClick={() => setSelectedShopModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Shop ID</span>
                  <span className="font-mono font-bold text-slate-900">{selectedShopModal.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Active Plan</span>
                  <span className="font-bold text-purple-700">{selectedShopModal.planName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Public URL</span>
                  <span className="font-mono text-blue-600">/s/{selectedShopModal.slug}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Created At</span>
                  <span className="text-slate-700">{new Date(selectedShopModal.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-800 block">Shop Razorpay Credentials:</span>
                <div className="space-y-1 font-mono text-[11px] text-slate-600">
                  <p>Key ID: {selectedShopModal.razorpaySettings?.keyId || 'Not Set'}</p>
                  <p>Mode: {selectedShopModal.razorpaySettings?.isTestMode ? 'Test' : 'Live'}</p>
                  <p>UPI ID: {selectedShopModal.razorpaySettings?.upiId || 'N/A'}</p>
                  <p>Auto-capture: {selectedShopModal.razorpaySettings?.autoCapture ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedShopModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
