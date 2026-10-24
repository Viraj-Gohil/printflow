import React, { useState, useEffect } from 'react';
import { useApp } from '../../lib/store';
import {
  Crown,
  CheckCircle2,
  Sparkles,
  CreditCard,
  Printer,
  HardDrive,
  ShieldCheck,
  ChevronRight,
  Info,
  ArrowRight,
  Cpu,
  AlertCircle,
  MoreVertical,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  X
} from 'lucide-react';
import { SaasPlan } from '../../types';
import { RazorpayCheckoutButton } from '../payment/RazorpayCheckoutButton';
import { apiUrl } from '../../lib/apiConfig';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

export const ShopSubscription: React.FC = () => {
  const {
    activeShop,
    plans,
    upgradeShopPlan,
    adminRazorpay,
    printers,
    printJobs,
    navigate,
    showToast,
    currentUser,
    subscriptions,
    shops,
    deletePlan,
    archivePlan,
    togglePlanStatus
  } = useApp();

  const [gatewayMeta, setGatewayMeta] = useState<{
    isConfigured: boolean;
    mode: 'live';
    isActive: boolean;
    rawKeyId: string;
  }>({
    isConfigured: Boolean(adminRazorpay.keyId),
    mode: 'live',
    isActive: true,
    rawKeyId: adminRazorpay.keyId || ''
  });

  useEffect(() => {
    fetch(apiUrl('/api/payment/public-config'))
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setGatewayMeta({
            isConfigured: Boolean(data.isConfigured),
            mode: 'live',
            isActive: true,
            rawKeyId: data.rawKeyId || ''
          });
        }
      })
      .catch((err) => console.warn('Could not fetch public payment config:', err));
  }, []);

  const currentPlan = plans.find((p) => p.id === activeShop.planId) || plans[0];
  const shopPrinters = printers.filter((p) => p.shopId === activeShop.id);
  const shopJobs = printJobs.filter((j) => j.shopId === activeShop.id);

  const printerLimit = currentPlan.printerLimit ?? 1;
  const printLimit = currentPlan.printLimitMonthly ?? 150;
  const printerUsagePercent = Math.min(100, Math.round((shopPrinters.length / printerLimit) * 100));
  const jobsUsagePercent = Math.min(100, Math.round((shopJobs.length / Math.max(1, printLimit)) * 100));
  const approxStorageMb = Math.round(shopJobs.length * 1.5 * 10) / 10;
  const storageLimit = currentPlan.storageLimitMb ?? 500;
  const storageUsagePercent = Math.min(100, Math.round((approxStorageMb / storageLimit) * 100));

  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);

  // Plan management & delete states
  const [activeMenuPlanId, setActiveMenuPlanId] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<SaasPlan | null>(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Close card action menu when clicking outside
  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveMenuPlanId(null);
    };
    if (activeMenuPlanId) {
      document.addEventListener('click', handleDocumentClick);
      return () => document.removeEventListener('click', handleDocumentClick);
    }
  }, [activeMenuPlanId]);

  const isAdmin = currentUser?.role === 'ADMIN';

  const isPlanProtectedDefault = (plan: SaasPlan | null) => {
    if (!plan) return false;
    const lowerId = plan.id.toLowerCase();
    const lowerName = plan.name.toLowerCase();
    return (
      lowerId === 'plan_starter' ||
      lowerId === 'free' ||
      lowerId === 'plan_free' ||
      lowerId === 'starter' ||
      plan.priceMonthly === 0 ||
      lowerName === 'free' ||
      lowerName === 'starter'
    );
  };

  const getPlanAssignedShopsCount = (plan: SaasPlan | null) => {
    if (!plan) return 0;
    const assignedShops = shops.filter((s) => s.planId === plan.id);
    const activeSubs = subscriptions.filter((s) => s.planId === plan.id && s.status === 'ACTIVE');
    const isCurrentActive = activeShop.planId === plan.id;
    return Math.max(assignedShops.length, activeSubs.length, isCurrentActive ? 1 : 0);
  };

  const selectedPlanIsProtected = isPlanProtectedDefault(planToDelete);
  const selectedPlanAssignedCount = getPlanAssignedShopsCount(planToDelete);
  const selectedPlanHasSubscribers = selectedPlanAssignedCount > 0;
  const canDeleteSelectedPlan = isAdmin && !selectedPlanIsProtected && !selectedPlanHasSubscribers;

  const handleConfirmDelete = async () => {
    if (!planToDelete || !canDeleteSelectedPlan) return;
    setIsDeletingPlan(true);
    setDeleteError(null);

    try {
      const res = await fetch(apiUrl(`/api/plans/${encodeURIComponent(planToDelete.id)}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token_active',
          'X-User-Role': currentUser?.role || 'ADMIN'
        }
      });

      const data = await res.json().catch(() => ({ success: false, error: 'Failed to process server response.' }));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server rejected plan deletion request.');
      }

      const storeResult = await deletePlan(planToDelete.id);
      if (!storeResult.success) {
        throw new Error(storeResult.message);
      }

      setPlanToDelete(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete plan.');
    } finally {
      setIsDeletingPlan(false);
    }
  };

  const handleUpgrade = async (plan: SaasPlan) => {
    setIsProcessingUpgrade(true);
    await new Promise((r) => setTimeout(r, 1000));
    await upgradeShopPlan(activeShop.id, plan.id);
    setIsProcessingUpgrade(false);
    setUpgradingPlanId(null);
    setUpgradeSuccess(`Successfully upgraded to "${plan.name}"! Your hardware limit is now ${plan.printerLimit} printer${plan.printerLimit > 1 ? 's' : ''}.`);
    showToast('Plan Upgraded', `Your shop is now subscribed to ${plan.name}.`, 'success', 4000);
    setTimeout(() => setUpgradeSuccess(null), 5000);
  };

  return (
    <div className="max-w-5xl space-y-8">
      {/* 1. CURRENT ACTIVE PLAN CARD */}
      <div className="bg-white p-6 rounded-2xl border-2 border-blue-600 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900">{currentPlan.name}</h2>
                <Chip variant="success" size="sm" dot>
                  ACTIVE SUBSCRIPTION
                </Chip>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{currentPlan.tagline}</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400">Current Billing Rate</span>
            <p className="text-2xl font-extrabold font-mono text-slate-900">
              ₹{currentPlan.priceMonthly}
              <span className="text-xs font-normal text-slate-500"> / month</span>
            </p>
          </div>
        </div>

        {/* Dynamic Hardware & Quota Usage based on real shop records */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200/60">
            <div className="flex justify-between text-slate-600">
              <span className="font-medium">Connected Printers:</span>
              <span className="font-bold text-slate-900">
                {shopPrinters.length} / {printerLimit} Max
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all rounded-full ${
                  shopPrinters.length >= printerLimit ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.max(8, printerUsagePercent)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400">
              <span>{printerLimit - shopPrinters.length} slots left</span>
              <button
                onClick={() => navigate('/shop/printers')}
                className="text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Manage Hardware →
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200/60">
            <div className="flex justify-between text-slate-600">
              <span className="font-medium">Monthly Orders:</span>
              <span className="font-bold text-slate-900">
                {shopJobs.length} / {printLimit > 50000 ? 'Unlimited' : printLimit}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all"
                style={{ width: `${Math.max(5, jobsUsagePercent)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 block">
              {printLimit > 50000 ? 'Unlimited high-volume quota' : `${Math.max(0, printLimit - shopJobs.length)} orders remaining`}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200/60">
            <div className="flex justify-between text-slate-600">
              <span className="font-medium">Temporary Storage:</span>
              <span className="font-bold text-slate-900">
                {approxStorageMb} MB / {storageLimit} MB
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all"
                style={{ width: `${Math.max(5, storageUsagePercent)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 block">Files automatically purged after printing</span>
          </div>
        </div>
      </div>

      {upgradeSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{upgradeSuccess}</span>
        </div>
      )}

      {/* 2. PLANS COMPARISON & SWITCHER */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">SaaS Plan Management</h3>
          <p className="text-xs text-slate-500">
            Switch plans anytime to unlock more counter printers, higher order volume, and advanced spooling tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan.id;
            return (
              <div
                key={plan.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between transition-all relative ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50/20 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {plan.isPopular && (
                  <span className="absolute -top-2.5 right-4 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{plan.name}</h4>
                      {isCurrent && (
                        <Chip variant="special" size="sm" dot>
                          Active
                        </Chip>
                      )}
                    </div>

                    {/* Compact three-dot actions menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuPlanId(activeMenuPlanId === plan.id ? null : plan.id);
                        }}
                        aria-label={`Actions for ${plan.name} plan`}
                        title="Plan actions"
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuPlanId === plan.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 text-xs animate-in fade-in zoom-in-95 duration-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuPlanId(null);
                              setPlanToDelete(plan);
                              setDeleteError(null);
                            }}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 text-rose-600 hover:bg-rose-50 font-medium cursor-pointer transition-colors"
                            aria-label="Delete Plan"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Delete Plan</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-2xl font-extrabold font-mono text-slate-950 mb-1">
                    {plan.priceMonthly === 0 ? 'Free' : `₹${plan.priceMonthly}`}
                    <span className="text-xs text-slate-400 font-normal"> /mo</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mb-4">{plan.tagline}</p>

                  <div className="p-2.5 bg-slate-50 rounded-xl mb-4 text-xs space-y-1 border border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Cpu className="w-3.5 h-3.5 text-blue-600" />
                      <span>{plan.printerLimit} Connected Printer{plan.printerLimit > 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {(plan.printLimitMonthly ?? 0) > 50000 ? 'Unlimited monthly prints' : `Up to ${(plan.printLimitMonthly ?? 150).toLocaleString()} prints/mo`}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    {plan.features.slice(0, 4).map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl cursor-default"
                    >
                      Current Active Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => setUpgradingPlanId(plan.id)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Switch to {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. DELETE PLAN CONFIRMATION MODAL */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">Delete Plan</h3>
                  <span className="text-[11px] font-normal text-slate-500">SaaS Plan Removal</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPlanToDelete(null);
                  setDeleteError(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Plan Details Preview */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Plan Name:</span>
                <span className="font-bold text-slate-900 text-sm">{planToDelete.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Billing Rate:</span>
                <span className="font-mono font-bold text-slate-800">
                  {planToDelete.priceMonthly === 0 ? 'Free' : `₹${planToDelete.priceMonthly}/mo`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Hardware Quota:</span>
                <span className="text-slate-700 font-medium">{planToDelete.printerLimit} Printer{planToDelete.printerLimit > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Validation & Business Rules Warnings */}
            {!isAdmin ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1.5 text-amber-900">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Platform Administrator Privileges Required</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Only authorized platform administrators may delete global SaaS plans. Shop owners are not permitted to remove platform-wide plans from the catalog.
                </p>
              </div>
            ) : selectedPlanIsProtected ? (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5 text-rose-900">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Protected Default Plan</span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  The <strong>{planToDelete.name}</strong> plan is the platform's required default tier. Platform onboarding, fallback accounts, and new shop registrations depend on this plan. It cannot be deleted.
                </p>
                <div className="mt-2 pt-2 border-t border-rose-200/60 text-[11px] text-rose-800">
                  <span className="font-semibold">Safe Alternative:</span> You can edit its hardware limits, features, or description in the Admin Console rather than deleting it.
                </div>
              </div>
            ) : selectedPlanHasSubscribers ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1.5 text-amber-900">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Plan Currently in Use by Active Shops</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  This plan is currently assigned to <strong>{selectedPlanAssignedCount} shop(s)</strong> with active subscriptions{planToDelete.id === activeShop.planId ? ' (including this shop)' : ''}. Deleting an in-use plan would disrupt printing hardware allocations and active customer queues.
                </p>
                <div className="mt-2 pt-2 border-t border-amber-200/60 text-[11px] text-amber-800 space-y-1">
                  <span className="font-semibold">Safe Alternative:</span> Deactivate the plan to prevent any new shops from subscribing, while allowing existing grandfathered shops to keep printing without interruption.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to delete the plan <strong className="text-slate-900 font-bold">"{planToDelete.name}"</strong>?
                </p>
                <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl text-xs text-rose-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Permanent Action</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Deleting a plan permanently removes it from the platform catalog. Historical invoices, payments, and audit logs are securely retained and will not be deleted.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeletingPlan}
                onClick={() => {
                  setPlanToDelete(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>

              {selectedPlanHasSubscribers && isAdmin && !selectedPlanIsProtected ? (
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => {
                    archivePlan(planToDelete.id);
                    setPlanToDelete(null);
                  }}
                >
                  Archive Plan Instead
                </Button>
              ) : null}

              <Button
                variant="danger"
                size="sm"
                disabled={!canDeleteSelectedPlan || isDeletingPlan}
                onClick={handleConfirmDelete}
                className="gap-1.5"
              >
                {isDeletingPlan ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Plan...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Plan</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 4. UPGRADE CONFIRMATION MODAL */}
      {upgradingPlanId && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          {(() => {
            const targetPlan = plans.find((p) => p.id === upgradingPlanId);
            if (!targetPlan) return null;
            return (
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <h3 className="text-base font-bold text-slate-900">SaaS Subscription Upgrade</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    LIVE PRODUCTION (RAZORPAY)
                  </span>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Target Plan:</span>
                    <span className="font-bold text-white text-sm">{targetPlan.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Hardware Limit:</span>
                    <span className="font-bold text-emerald-400">Up to {targetPlan.printerLimit} Printers</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Billing Cycle:</span>
                    <span className="font-mono text-slate-300">Monthly</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-slate-300">Amount:</span>
                    <span className="text-xl font-bold font-mono text-white">
                      {targetPlan.priceMonthly === 0 ? 'Free' : `₹${targetPlan.priceMonthly}.00`}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Instant Activation</span>
                  </p>
                  <p className="text-[11px] text-blue-700">
                    Your printer slots and monthly limits will immediately increase to {targetPlan.printerLimit} printer{targetPlan.printerLimit > 1 ? 's' : ''}.
                  </p>
                </div>

                <div className="pt-3 flex justify-end items-center gap-2">
                  <button
                    disabled={isProcessingUpgrade}
                    onClick={() => setUpgradingPlanId(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>

                  {targetPlan.priceMonthly > 0 ? (
                    <RazorpayCheckoutButton
                      amountInPaise={targetPlan.priceMonthly * 100}
                      currency="INR"
                      name="PrintFlow Cloud Platform"
                      description={`Subscription to ${targetPlan.name} Plan`}
                      buttonText={`Pay ₹${targetPlan.priceMonthly}/mo via Razorpay`}
                      variant="primary"
                      flow="subscription"
                      shopId="platform"
                      notes={{
                        planId: targetPlan.id,
                        shopId: activeShop.id,
                        planName: targetPlan.name,
                        flow: 'subscription'
                      }}
                      onSuccess={(res) => {
                        handleUpgrade(targetPlan);
                      }}
                      onError={(err) => {
                        showToast('Payment Failed', err, 'error');
                      }}
                    />
                  ) : (
                    <button
                      disabled={isProcessingUpgrade}
                      onClick={() => handleUpgrade(targetPlan)}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      {isProcessingUpgrade ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Activating Plan...</span>
                        </>
                      ) : (
                        <span>Activate Free Plan</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
