import React, { useState, useMemo } from 'react';
import { useApp } from '../../lib/store';
import {
  Layers,
  Crown,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  CreditCard,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Download,
  Edit2,
  X,
  Save,
  Store,
  RefreshCw,
  FileText,
  ShieldAlert,
  Ban
} from 'lucide-react';
import { Subscription, SaasPlan } from '../../types';

export const AdminShopSubscriptions: React.FC = () => {
  const {
    subscriptions,
    plans,
    shops,
    updateSubscription,
    changeShopSubscription,
    cancelSubscription,
    navigate,
    showToast
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPlan, setSelectedPlan] = useState<string>('ALL');
  const [selectedInterval, setSelectedInterval] = useState<string>('ALL');

  // Modals state
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [newPlanId, setNewPlanId] = useState<string>('');
  const [cancelingSub, setCancelingSub] = useState<Subscription | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Shop owner requested cancellation');
  const [viewingInvoice, setViewingInvoice] = useState<Subscription | null>(null);

  // Compute MRR & KPI Metrics from real data
  const { totalSubs, activeSubs, trialSubs, pastDueSubs, totalMRR, totalARR } = useMemo(() => {
    let active = 0;
    let trial = 0;
    let pastDue = 0;
    let mrr = 0;
    let arr = 0;

    (subscriptions || []).forEach((s) => {
      if (s.status === 'ACTIVE') {
        active++;
        if (s.billingPeriod === 'MONTHLY') {
          mrr += s.amount || 0;
          arr += (s.amount || 0) * 12;
        } else {
          mrr += Math.round((s.amount || 0) / 12);
          arr += s.amount || 0;
        }
      } else if (s.status === 'TRIAL') {
        trial++;
      } else if (s.status === 'PAST_DUE') {
        pastDue++;
      }
    });

    return {
      totalSubs: (subscriptions || []).length,
      activeSubs: active,
      trialSubs: trial,
      pastDueSubs: pastDue,
      totalMRR: mrr,
      totalARR: arr
    };
  }, [subscriptions]);

  // Filter Subscriptions
  const filteredSubs = useMemo(() => {
    return (subscriptions || []).filter((sub) => {
      const shop = shops.find((s) => s.id === sub.shopId);
      const matchesSearch =
        sub.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.planName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (shop?.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (shop?.ownerEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (selectedStatus !== 'ALL' && sub.status !== selectedStatus) return false;
      if (selectedPlan !== 'ALL' && sub.planId !== selectedPlan) return false;
      if (selectedInterval !== 'ALL' && sub.billingPeriod !== selectedInterval) return false;

      return true;
    });
  }, [subscriptions, shops, searchQuery, selectedStatus, selectedPlan, selectedInterval]);

  const handleChangePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub || !newPlanId) return;

    try {
      await changeShopSubscription(editingSub.shopId, newPlanId, 'IMMEDIATE');
      showToast('Subscription Updated', `Switched ${editingSub.shopName} to new plan successfully!`, 'success');
      setEditingSub(null);
    } catch (err) {
      showToast('Update Failed', 'Could not update subscription plan.', 'error');
    }
  };

  const handleCancelSubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelingSub) return;

    cancelSubscription(cancelingSub.id, cancelReason);
    showToast('Subscription Cancelled', `Cancelled subscription for ${cancelingSub.shopName}.`, 'info');
    setCancelingSub(null);
  };

  const handleExtendTrial = (sub: Subscription) => {
    const currentEnd = new Date(sub.currentPeriodEnd);
    const newEnd = new Date(currentEnd.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    updateSubscription(sub.id, {
      currentPeriodEnd: newEnd,
      status: 'TRIAL'
    });
    showToast('Trial Extended', `Added 14 days to ${sub.shopName}'s trial period.`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Platform</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>Billing & Revenue</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-purple-700">Subscriptions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Subscriptions Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor tenant subscription lifecycle, recurring renewals, quotas consumption, and account status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/plans')}
            className="px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5 text-purple-600" />
            <span>Manage SaaS Plans & Pricing</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block mb-1">Active Subscriptions</span>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">{activeSubs}</p>
          <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" />
            {totalSubs} total tenants registered
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block mb-1">Monthly Recurring (MRR)</span>
          <p className="text-2xl font-extrabold text-purple-900 font-mono">
            ₹{totalMRR.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">Normalized monthly billing</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block mb-1">Annual Run Rate (ARR)</span>
          <p className="text-2xl font-extrabold text-slate-900 font-mono">
            ₹{totalARR.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">Projected 12-month value</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 block mb-1">Free & Active Trials</span>
          <p className="text-2xl font-extrabold text-amber-700 font-mono">{trialSubs}</p>
          <span className="text-[10px] text-amber-600 font-medium mt-1 block">14-day evaluation window</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
          <span className="text-[11px] font-semibold text-slate-500 block mb-1">Past Due / At Risk</span>
          <p className="text-2xl font-extrabold text-rose-600 font-mono">{pastDueSubs}</p>
          <span className="text-[10px] text-rose-600 font-medium mt-1 block">Renewal action required</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search by shop name, owner, plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">In Trial</option>
            <option value="PAST_DUE">Past Due</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>

          {/* Plan Filter */}
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
          >
            <option value="ALL">All SaaS Plans</option>
            {(plans || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Billing Interval Filter */}
          <select
            value={selectedInterval}
            onChange={(e) => setSelectedInterval(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
          >
            <option value="ALL">All Intervals</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>

          <span className="text-xs text-slate-500 font-medium ml-auto md:ml-2">
            Showing {filteredSubs.length} of {subscriptions.length}
          </span>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Shop Tenant</th>
                <th className="py-3 px-4">Current SaaS Plan</th>
                <th className="py-3 px-4">Renewal Cycle</th>
                <th className="py-3 px-4">Quota Consumption</th>
                <th className="py-3 px-4">Recurring Fee</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No subscriptions match your search filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub) => {
                  const shop = shops.find((s) => s.id === sub.shopId);
                  const plan = plans.find((p) => p.id === sub.planId);
                  const maxPrints = plan?.isUnlimitedPrintJobs ? 'Unlimited' : plan?.printLimitMonthly || 1000;
                  const printPercent = plan?.isUnlimitedPrintJobs
                    ? 15
                    : Math.min(100, Math.round(((sub.jobsUsedThisMonth || 0) / (plan?.printLimitMonthly || 1000)) * 100));

                  const isExpiredOrPastDue = sub.status === 'PAST_DUE' || sub.status === 'EXPIRED';

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Shop Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-100">
                            <Store className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{sub.shopName}</span>
                            <span className="text-[10px] text-slate-500">
                              {shop?.ownerName || 'Shop Owner'} • {shop?.city || 'Location'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-semibold text-slate-900 block">{sub.planName}</span>
                          <span className="text-[10px] text-purple-700 font-mono font-medium">
                            {sub.billingPeriod} • {sub.autoRenew ? 'Auto-renews' : 'Manual'}
                          </span>
                        </div>
                      </td>

                      {/* Renewal Date */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-mono text-slate-800 text-[11px] block">
                            {new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span
                            className={`text-[10px] font-medium ${
                              isExpiredOrPastDue ? 'text-rose-600 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {isExpiredOrPastDue ? 'Overdue renewal' : 'Active billing cycle'}
                          </span>
                        </div>
                      </td>

                      {/* Quota Usage */}
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                            <span>Jobs: {sub.jobsUsedThisMonth || 0} / {maxPrints}</span>
                            <span>{printPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              style={{ width: `${printPercent}%` }}
                              className={`h-full rounded-full ${
                                printPercent > 90 ? 'bg-rose-500' : 'bg-purple-600'
                              }`}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 mt-1 block">
                            {sub.devicesUsed || 1} connected printers • {sub.storageUsedMb || 0} MB
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        ₹{(sub.amount || 0).toLocaleString('en-IN')}
                        <span className="text-[10px] text-slate-400 font-normal block">
                          /{sub.billingPeriod === 'MONTHLY' ? 'mo' : 'yr'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            sub.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : sub.status === 'TRIAL'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : sub.status === 'PAST_DUE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              sub.status === 'ACTIVE'
                                ? 'bg-emerald-500'
                                : sub.status === 'TRIAL'
                                ? 'bg-amber-500'
                                : sub.status === 'PAST_DUE'
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {sub.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingSub(sub);
                              setNewPlanId(sub.planId);
                            }}
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                            title="Change Plan"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setViewingInvoice(sub)}
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="View Invoice"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {sub.status === 'TRIAL' && (
                            <button
                              onClick={() => handleExtendTrial(sub)}
                              className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Extend 14-day trial"
                            >
                              +14d Trial
                            </button>
                          )}

                          {sub.status !== 'CANCELLED' && (
                            <button
                              onClick={() => setCancelingSub(sub)}
                              className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Cancel Subscription"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Plan Modal */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Crown className="w-4 h-4 text-purple-600" />
                <span>Change Subscription Plan</span>
              </h3>
              <button
                onClick={() => setEditingSub(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePlanSubmit} className="space-y-4">
              <div>
                <span className="text-xs text-slate-500 block mb-1">Tenant Shop</span>
                <p className="font-bold text-slate-900 text-sm">{editingSub.shopName}</p>
                <span className="text-[11px] text-slate-400">Current Plan: {editingSub.planName}</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Select New SaaS Plan Tier
                </label>
                <select
                  value={newPlanId}
                  onChange={(e) => setNewPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {(plans || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{p.priceMonthly}/mo (Printers: {p.printerLimit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-[11px] text-purple-800">
                Plan changes are executed immediately and update hardware allowances and rate ceilings.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSub(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Confirm Plan Switch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {cancelingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-rose-600 text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Cancel Shop Subscription</span>
              </h3>
              <button
                onClick={() => setCancelingSub(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCancelSubSubmit} className="space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to cancel the subscription for <strong>{cancelingSub.shopName}</strong>?
                The shop will be downgraded to the Free Starter tier at the end of the billing period.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Reason for Cancellation
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="e.g. Shop closed, requested downgrade, non-payment..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelingSub(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Keep Subscription
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <span>SaaS Subscription Receipt</span>
              </h3>
              <button
                onClick={() => setViewingInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-start p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[10px] block font-mono">INVOICE #{viewingInvoice.id.toUpperCase()}</span>
                  <strong className="text-slate-900 text-sm">{viewingInvoice.shopName}</strong>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {viewingInvoice.paymentStatus || 'PAID'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 text-[10px] block">Plan Name</span>
                  <span className="font-semibold text-slate-800">{viewingInvoice.planName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Billing Cycle</span>
                  <span className="font-semibold text-slate-800">{viewingInvoice.billingPeriod}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Start Date</span>
                  <span className="font-mono text-slate-800">
                    {new Date(viewingInvoice.currentPeriodStart).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Next Renewal</span>
                  <span className="font-mono text-slate-800">
                    {new Date(viewingInvoice.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-sm font-bold">
                <span className="text-slate-700">Total Billed:</span>
                <span className="text-purple-700 font-mono">₹{(viewingInvoice.amount || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-5">
              <button
                onClick={() => setViewingInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
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
