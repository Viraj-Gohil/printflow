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
  X,
  Filter,
  Info,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  Printer,
  Cpu
} from 'lucide-react';
import { Shop } from '../../types';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Drawer } from '../ui/Drawer';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../ui/Table';

export const AdminShops: React.FC = () => {
  const { shops, printJobs, printers, subscriptions, updateShopStatus, navigate } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  const filteredShops = shops.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.ownerEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    return true;
  });

  // Computed metrics for selected shop detail drawer
  const shopJobs = selectedShop ? printJobs.filter((j) => j.shopId === selectedShop.id) : [];
  const completedShopJobs = shopJobs.filter((j) => j.printStatus === 'COMPLETED').length;
  const pendingShopJobs = shopJobs.filter((j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED' || j.printStatus === 'PRINTING').length;
  const shopPrinters = selectedShop ? printers.filter((p) => p.shopId === selectedShop.id) : [];
  const shopSubscription = selectedShop ? subscriptions.find((sub) => sub.shopId === selectedShop.id) : null;

  const customerOrderingUrl = selectedShop && typeof window !== 'undefined'
    ? `${window.location.origin}/#/s/${selectedShop.slug}`
    : selectedShop ? `/s/${selectedShop.slug}` : '';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Shops Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Manage tenant accounts, shop status, and subscription assignments across the platform.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
          Showing <strong className="text-slate-900">{filteredShops.length}</strong> of {shops.length} Tenants
        </div>
      </div>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search shops by name, owner, city, slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 h-10 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600">
            {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((st) => (
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
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* 3. SHOPS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop Identity</TableHead>
              <TableHead>Owner Contact</TableHead>
              <TableHead>City / Location</TableHead>
              <TableHead>SaaS Plan</TableHead>
              <TableHead>Gateway Config</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShops.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">No Shops Found</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        No tenant accounts match your current search or filter criteria.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredShops.map((shop) => (
                <TableRow key={shop.id}>
                  <TableCell>
                    <span className="font-semibold text-slate-900 block">{shop.name}</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/s/${shop.slug}`)}
                      className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 font-mono cursor-pointer mt-0.5"
                    >
                      <span>/s/{shop.slug}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </TableCell>

                  <TableCell>
                    <span className="font-medium text-slate-900 block">{shop.ownerName}</span>
                    <span className="text-[11px] text-slate-400">{shop.ownerEmail || 'No email provided'}</span>
                  </TableCell>

                  <TableCell className="text-slate-700 font-medium">
                    {shop.city}
                  </TableCell>

                  <TableCell>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
                      {shop.planName}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {shop.razorpaySettings?.keyId ? `${shop.razorpaySettings.keyId.slice(0, 14)}...` : 'Not Configured'}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Chip
                      variant={shop.status === 'ACTIVE' ? 'success' : 'danger'}
                      size="sm"
                      dot
                    >
                      {shop.status}
                    </Chip>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setSelectedShop(shop)}
                      >
                        <Info className="w-3.5 h-3.5 text-slate-500" />
                        <span>View Details</span>
                      </Button>

                      {shop.status === 'ACTIVE' ? (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => updateShopStatus(shop.id, 'SUSPENDED')}
                          className="text-red-600 hover:bg-red-50 border-red-200"
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          variant="solid"
                          size="xs"
                          onClick={() => updateShopStatus(shop.id, 'ACTIVE')}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 4. SHOP BASIC DETAILS DRAWER */}
      <Drawer
        isOpen={!!selectedShop}
        onClose={() => setSelectedShop(null)}
        title={selectedShop?.name || 'Shop Details'}
        description={`Tenant account overview and operational summary`}
        width="max-w-lg"
      >
        {selectedShop && (
          <div className="space-y-6 text-xs text-slate-700">
            {/* Section 1: Shop Information */}
            <div className="space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100 block">
                1. Shop Information
              </span>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Shop Name:</span>
                  <span className="font-semibold text-slate-900">{selectedShop.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Shop ID:</span>
                  <span className="font-mono text-slate-800">{selectedShop.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Public Slug:</span>
                  <span className="font-mono text-blue-600">/s/{selectedShop.slug}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Customer Ordering URL:</span>
                  <a
                    href={customerOrderingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>Open View</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Registration Date:</span>
                  <span className="font-medium text-slate-800">
                    {new Date(selectedShop.createdAt || Date.now()).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Shop Status:</span>
                  <Chip variant={selectedShop.status === 'ACTIVE' ? 'success' : 'danger'} size="sm" dot>
                    {selectedShop.status}
                  </Chip>
                </div>
              </div>
            </div>

            {/* Section 2: Owner Information */}
            <div className="space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100 block">
                2. Owner Information
              </span>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Owner Name:</span>
                  <span className="font-semibold text-slate-900">{selectedShop.ownerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Owner Email:</span>
                  <span className="font-medium text-slate-800">{selectedShop.ownerEmail || 'Not provided'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Owner Phone:</span>
                  <span className="font-mono text-slate-800">{selectedShop.ownerPhone || 'Not provided'}</span>
                </div>
              </div>
            </div>

            {/* Section 3: Business Information */}
            <div className="space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100 block">
                3. Business Information
              </span>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">City / Location:</span>
                  <span className="font-semibold text-slate-900">{selectedShop.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Physical Address:</span>
                  <span className="text-slate-800 text-right max-w-[200px]">{selectedShop.address || 'Standard Kiosk Location'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Business Hours:</span>
                  <span className="text-slate-800">09:00 AM - 09:00 PM (Mon-Sat)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Minimum Order Amount:</span>
                  <span className="font-mono text-slate-900">₹10.00</span>
                </div>
              </div>
            </div>

            {/* Section 4: Subscription Information */}
            <div className="space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100 block">
                4. Subscription Information
              </span>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Current SaaS Plan:</span>
                  <span className="font-bold text-purple-700">{selectedShop.planName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Subscription Status:</span>
                  <Chip variant="success" size="sm" dot>
                    {shopSubscription?.status || 'ACTIVE'}
                  </Chip>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Billing Period:</span>
                  <span className="font-medium text-slate-800">{shopSubscription?.billingPeriod || 'MONTHLY'}</span>
                </div>
              </div>
            </div>

            {/* Section 5: Operational Summary */}
            <div className="space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100 block">
                5. Operational Summary
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 text-[11px] block">Total Print Jobs</span>
                  <span className="text-base font-bold text-slate-900 font-mono">{shopJobs.length}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 text-[11px] block">Completed Orders</span>
                  <span className="text-base font-bold text-emerald-700 font-mono">{completedShopJobs}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 text-[11px] block">Pending / In Queue</span>
                  <span className="text-base font-bold text-amber-600 font-mono">{pendingShopJobs}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 text-[11px] block">Connected Printers</span>
                  <span className="text-base font-bold text-blue-600 font-mono">{shopPrinters.length}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setSelectedShop(null)}
                className="w-full"
              >
                Close Details
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
