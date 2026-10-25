import React, { useState, useMemo } from 'react';
import { useApp } from '../../lib/store';
import {
  Crown,
  CheckCircle2,
  Edit2,
  Save,
  X,
  Info,
  Shield,
  Store,
  Printer,
  CreditCard,
  Plus,
  Copy,
  Archive,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  AlertTriangle,
  Download,
  RefreshCw,
  Clock,
  Sparkles,
  Calendar,
  TrendingUp,
  HardDrive,
  Users,
  Layers,
  Settings2,
  FileText,
  Check,
  ChevronDown,
  Zap,
  Building2,
  HelpCircle,
  Activity,
  SlidersHorizontal,
  Lock,
  Eye,
  EyeOff,
  Radio,
  ArrowRight,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import {
  SaasPlan,
  Subscription,
  PlatformPolicies,
  PlanStatus,
  PlanChangePolicy,
  PlanFeatureEntitlements
} from '../../types';
import { apiUrl } from '../../lib/apiConfig';

export const AdminSubscriptions: React.FC = () => {
  const {
    currentUser,
    plans,
    createPlan,
    updatePlan,
    duplicatePlan,
    archivePlan,
    deletePlan,
    togglePlanStatus,
    subscriptions,
    updateSubscription,
    changeShopSubscription,
    cancelSubscription,
    platformPolicies,
    updatePlatformPolicies,
    adminRazorpay,
    updateAdminRazorpay,
    testGatewayConnection,
    shops,
    printJobs,
    printers,
    auditLogs,
    showToast,
    navigate
  } = useApp();

  // Navigation tabs inside the Admin SaaS Module
  type AdminTab = 'catalog' | 'subscribers' | 'usage' | 'policies' | 'gateway' | 'audit';
  const [activeTab, setActiveTab] = useState<AdminTab>('catalog');

  // Plan catalog state & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PlanStatus>('ALL');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'FREE' | 'PAID'>('ALL');
  const [sortBy, setSortBy] = useState<'order' | 'priceAsc' | 'priceDesc' | 'subscribers' | 'name'>('order');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals state
  const [editingPlan, setEditingPlan] = useState<SaasPlan | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedPlanForSubscribers, setSelectedPlanForSubscribers] = useState<string | null>(null);
  const [planToArchive, setPlanToArchive] = useState<SaasPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<SaasPlan | null>(null);

  const handleConfirmDelete = async () => {
    if (!planToDelete) return;
    try {
      const result = await deletePlan(planToDelete.id);
      if (result.success) {
        setPlanToDelete(null);
        if (editingPlan?.id === planToDelete.id) {
          setEditingPlan(null);
        }
      } else {
        showToast('Delete Prevented', result.message, 'error', 5000);
      }
    } catch (err: any) {
      showToast('Delete Failed', err?.message || 'Could not delete plan.', 'error', 5000);
    }
  };

  // Subscriber management state
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberStatusFilter, setSubscriberStatusFilter] = useState<string>('ALL');
  const [subscriberPlanFilter, setSubscriberPlanFilter] = useState<string>('ALL');
  const [subToChangePlan, setSubToChangePlan] = useState<Subscription | null>(null);
  const [targetNewPlanId, setTargetNewPlanId] = useState<string>('');
  const [subToCancel, setSubToCancel] = useState<Subscription | null>(null);
  const [cancelReason, setCancelReason] = useState('Shop request');

  // Safe Plan Updates policy selector
  const [updatePolicy, setUpdatePolicy] = useState<PlanChangePolicy>('NEW_ONLY');
  const [showGrandfatherWarning, setShowGrandfatherWarning] = useState(false);

  // Gateway test state
  const [isTestingGateway, setIsTestingGateway] = useState(false);
  const [gatewayTestResult, setGatewayTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [replaceSecretKey, setReplaceSecretKey] = useState('');
  const [isSavingGateway, setIsSavingGateway] = useState(false);
  const [gatewaySaveError, setGatewaySaveError] = useState<string | null>(null);
  const [gatewaySaveSuccess, setGatewaySaveSuccess] = useState(false);

  // Policies form state
  const [policiesForm, setPoliciesForm] = useState<PlatformPolicies>({ ...platformPolicies });
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);

  // Temporary plan form state for Create / Edit
  const [planForm, setPlanForm] = useState<{
    id?: string;
    name: string;
    slug: string;
    tagline: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    isFree: boolean;
    billingInterval: 'MONTHLY' | 'YEARLY' | 'BOTH';
    trialDays: number;
    taxInclusive: boolean;
    status: PlanStatus;
    isActive: boolean;
    displayOrder: number;
    isPopular: boolean;
    adminNotes: string;
    printLimitMonthly: number;
    isUnlimitedPrintJobs: boolean;
    printerLimit: number;
    isUnlimitedPrinters: boolean;
    storageLimitMb: number;
    isUnlimitedStorage: boolean;
    staffLimit: number;
    maxUploadSizeMb: number;
    fileRetentionHours: number;
    features: string[];
    featureEntitlements: PlanFeatureEntitlements;
  }>({
    name: '',
    slug: '',
    tagline: '',
    description: '',
    priceMonthly: 499,
    priceYearly: 4990,
    isFree: false,
    billingInterval: 'BOTH',
    trialDays: 14,
    taxInclusive: true,
    status: 'ACTIVE',
    isActive: true,
    displayOrder: 1,
    isPopular: false,
    adminNotes: '',
    printLimitMonthly: 1500,
    isUnlimitedPrintJobs: false,
    printerLimit: 2,
    isUnlimitedPrinters: false,
    storageLimitMb: 5000,
    isUnlimitedStorage: false,
    staffLimit: 2,
    maxUploadSizeMb: 35,
    fileRetentionHours: 48,
    features: [
      '2 Connected Counter Printers',
      'Up to 1,500 print orders/mo',
      'Direct Shop Razorpay & UPI Gateway',
      'Daily Revenue & Order Analytics'
    ],
    featureEntitlements: {
      qrPrinting: true,
      multiFileUpload: true,
      automatedQueue: true,
      multiplePrinters: true,
      smartPrinterSelection: false,
      analytics: true,
      customBranding: false,
      staffManagement: false,
      apiAccess: false,
      prioritySupport: false
    }
  });

  // Calculate live MRR strictly from valid paid active subscriptions
  const kpiData = useMemo(() => {
    const totalPlansCount = plans.length;
    const activePlansCount = plans.filter((p) => p.isActive && p.status !== 'ARCHIVED').length;
    const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE');
    const trialSubs = subscriptions.filter((s) => s.status === 'TRIAL');
    const pastDueOrExpiringSubs = subscriptions.filter(
      (s) => s.status === 'PAST_DUE' || s.status === 'EXPIRED'
    );

    // MRR calculation: only include paid active subscriptions
    let mrr = 0;
    activeSubs.forEach((sub) => {
      const plan = plans.find((p) => p.id === sub.planId);
      // Free starter plans are ₹0
      if (plan?.isFree || sub.amount === 0) return;

      if (sub.billingPeriod === 'YEARLY') {
        mrr += Math.round((sub.amount || plan?.priceYearly || 0) / 12);
      } else {
        mrr += sub.amount || plan?.priceMonthly || 0;
      }
    });

    return {
      totalPlans: totalPlansCount,
      activePlans: activePlansCount,
      activeSubscriptions: activeSubs.length,
      mrr,
      trialSubscriptions: trialSubs.length,
      pastDueSubscriptions: pastDueOrExpiringSubs.length
    };
  }, [plans, subscriptions]);

  // Subscriber count helper per plan
  const planSubscribersMap = useMemo(() => {
    const map: Record<string, number> = {};
    subscriptions.forEach((sub) => {
      if (sub.status === 'ACTIVE' || sub.status === 'TRIAL') {
        map[sub.planId] = (map[sub.planId] || 0) + 1;
      }
    });
    return map;
  }, [subscriptions]);

  // Filtered & sorted plans
  const filteredPlans = useMemo(() => {
    let result = plans.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.slug || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? p.status === 'ACTIVE' || (p.isActive && p.status !== 'ARCHIVED')
          : p.status === statusFilter;

      const matchesTier =
        tierFilter === 'ALL'
          ? true
          : tierFilter === 'FREE'
          ? p.isFree || p.priceMonthly === 0
          : !p.isFree && p.priceMonthly > 0;

      return matchesSearch && matchesStatus && matchesTier;
    });

    result.sort((a, b) => {
      if (sortBy === 'order') return (a.displayOrder || 99) - (b.displayOrder || 99);
      if (sortBy === 'priceAsc') return a.priceMonthly - b.priceMonthly;
      if (sortBy === 'priceDesc') return b.priceMonthly - a.priceMonthly;
      if (sortBy === 'subscribers') {
        return (planSubscribersMap[b.id] || 0) - (planSubscribersMap[a.id] || 0);
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [plans, searchQuery, statusFilter, tierFilter, sortBy, planSubscribersMap]);

  // Filtered subscribers list
  const filteredSubscribers = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchesSearch =
        sub.shopName.toLowerCase().includes(subscriberSearch.toLowerCase()) ||
        sub.shopId.toLowerCase().includes(subscriberSearch.toLowerCase()) ||
        sub.planName.toLowerCase().includes(subscriberSearch.toLowerCase());

      const matchesStatus =
        subscriberStatusFilter === 'ALL' || sub.status === subscriberStatusFilter;

      const matchesPlan =
        subscriberPlanFilter === 'ALL' || sub.planId === subscriberPlanFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [subscriptions, subscriberSearch, subscriberStatusFilter, subscriberPlanFilter]);

  // Helper to open Edit Plan
  const handleOpenEditPlan = (plan: SaasPlan) => {
    setEditingPlan(plan);
    setIsCreatingNew(false);
    setUpdatePolicy('NEW_ONLY');
    setShowGrandfatherWarning(false);
    setPlanForm({
      id: plan.id,
      name: plan.name,
      slug: plan.slug || plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      tagline: plan.tagline || '',
      description: plan.description || plan.tagline || '',
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly || plan.priceMonthly * 10,
      isFree: plan.isFree ?? plan.priceMonthly === 0,
      billingInterval: plan.billingInterval || 'BOTH',
      trialDays: plan.trialDays ?? (plan.priceMonthly === 0 ? 0 : 14),
      taxInclusive: plan.taxInclusive ?? true,
      status: plan.status || (plan.isActive ? 'ACTIVE' : 'DRAFT'),
      isActive: plan.isActive,
      displayOrder: plan.displayOrder || 1,
      isPopular: plan.isPopular ?? false,
      adminNotes: plan.adminNotes || '',
      printLimitMonthly: plan.printLimitMonthly || 1500,
      isUnlimitedPrintJobs: plan.isUnlimitedPrintJobs ?? (plan.printLimitMonthly ? plan.printLimitMonthly > 50000 : false),
      printerLimit: plan.printerLimit || 1,
      isUnlimitedPrinters: plan.isUnlimitedPrinters ?? false,
      storageLimitMb: plan.storageLimitMb || 5000,
      isUnlimitedStorage: plan.isUnlimitedStorage ?? false,
      staffLimit: plan.staffLimit || 1,
      maxUploadSizeMb: plan.maxUploadSizeMb || 35,
      fileRetentionHours: plan.fileRetentionHours || 48,
      features: [...plan.features],
      featureEntitlements: {
        qrPrinting: plan.featureEntitlements?.qrPrinting ?? true,
        multiFileUpload: plan.featureEntitlements?.multiFileUpload ?? true,
        automatedQueue: plan.featureEntitlements?.automatedQueue ?? true,
        multiplePrinters: plan.featureEntitlements?.multiplePrinters ?? (plan.printerLimit > 1),
        smartPrinterSelection: plan.featureEntitlements?.smartPrinterSelection ?? false,
        analytics: plan.featureEntitlements?.analytics ?? true,
        customBranding: plan.featureEntitlements?.customBranding ?? false,
        staffManagement: plan.featureEntitlements?.staffManagement ?? false,
        apiAccess: plan.featureEntitlements?.apiAccess ?? false,
        prioritySupport: plan.featureEntitlements?.prioritySupport ?? false
      }
    });
  };

  // Helper to open Create Plan
  const handleOpenCreatePlan = () => {
    setIsCreatingNew(true);
    setEditingPlan(null);
    setUpdatePolicy('NEW_ONLY');
    setShowGrandfatherWarning(false);
    setPlanForm({
      name: '',
      slug: '',
      tagline: '',
      description: '',
      priceMonthly: 499,
      priceYearly: 4990,
      isFree: false,
      billingInterval: 'BOTH',
      trialDays: 14,
      taxInclusive: true,
      status: 'ACTIVE',
      isActive: true,
      displayOrder: plans.length + 1,
      isPopular: false,
      adminNotes: '',
      printLimitMonthly: 1500,
      isUnlimitedPrintJobs: false,
      printerLimit: 2,
      isUnlimitedPrinters: false,
      storageLimitMb: 5000,
      isUnlimitedStorage: false,
      staffLimit: 2,
      maxUploadSizeMb: 35,
      fileRetentionHours: 48,
      features: [
        '2 Connected Counter Printers',
        'Up to 1,500 print orders/mo',
        'Direct Shop Razorpay & UPI Gateway',
        'Daily Revenue & Order Analytics'
      ],
      featureEntitlements: {
        qrPrinting: true,
        multiFileUpload: true,
        automatedQueue: true,
        multiplePrinters: true,
        smartPrinterSelection: false,
        analytics: true,
        customBranding: false,
        staffManagement: false,
        apiAccess: false,
        prioritySupport: false
      }
    });
  };

  // Save Plan Submission
  const handleSavePlanForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!planForm.name.trim()) {
      showToast('Validation Error', 'Plan name is required.', 'error');
      return;
    }

    const effectiveSlug =
      planForm.slug.trim() ||
      planForm.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const effectiveMonthlyPrice = planForm.isFree ? 0 : Math.max(0, Number(planForm.priceMonthly));
    const effectiveYearlyPrice = planForm.isFree ? 0 : Math.max(0, Number(planForm.priceYearly));

    // Cap max upload size to platform security ceiling
    const effectiveUploadSize = Math.min(
      Number(planForm.maxUploadSizeMb) || 35,
      platformPolicies.maxAllowedUploadSizeMb
    );

    const payload = {
      name: planForm.name.trim(),
      slug: effectiveSlug,
      tagline: planForm.tagline.trim(),
      description: planForm.description.trim(),
      priceMonthly: effectiveMonthlyPrice,
      priceYearly: effectiveYearlyPrice,
      isFree: planForm.isFree,
      billingInterval: planForm.billingInterval,
      trialDays: planForm.isFree ? 0 : Number(planForm.trialDays),
      taxInclusive: planForm.taxInclusive,
      status: planForm.status,
      isActive: planForm.status === 'ACTIVE',
      displayOrder: Number(planForm.displayOrder) || 1,
      sortOrder: Number(planForm.displayOrder) || 1,
      isPopular: planForm.isPopular,
      currency: 'INR',
      isPublic: true,
      adminNotes: planForm.adminNotes.trim(),
      limits: {
        printLimitMonthly: planForm.isUnlimitedPrintJobs ? 999999 : Number(planForm.printLimitMonthly),
        printerLimit: planForm.isUnlimitedPrinters ? 99 : Math.max(1, Number(planForm.printerLimit)),
        storageLimitMb: planForm.isUnlimitedStorage ? 500000 : Number(planForm.storageLimitMb),
        staffLimit: Number(planForm.staffLimit) || 1,
        maxUploadSizeMb: effectiveUploadSize,
        fileRetentionHours: Number(planForm.fileRetentionHours) || 48,
        isUnlimitedPrintJobs: planForm.isUnlimitedPrintJobs,
        isUnlimitedPrinters: planForm.isUnlimitedPrinters,
        isUnlimitedStorage: planForm.isUnlimitedStorage
      },
      printLimitMonthly: planForm.isUnlimitedPrintJobs ? 999999 : Number(planForm.printLimitMonthly),
      isUnlimitedPrintJobs: planForm.isUnlimitedPrintJobs,
      printerLimit: planForm.isUnlimitedPrinters ? 99 : Math.max(1, Number(planForm.printerLimit)),
      isUnlimitedPrinters: planForm.isUnlimitedPrinters,
      storageLimitMb: planForm.isUnlimitedStorage ? 500000 : Number(planForm.storageLimitMb),
      isUnlimitedStorage: planForm.isUnlimitedStorage,
      staffLimit: Number(planForm.staffLimit) || 1,
      maxUploadSizeMb: effectiveUploadSize,
      fileRetentionHours: Number(planForm.fileRetentionHours) || 48,
      features: planForm.features.filter((f) => f.trim().length > 0),
      featureEntitlements: planForm.featureEntitlements
    };

    if (isCreatingNew) {
      await createPlan(payload);
    } else if (editingPlan) {
      await updatePlan(editingPlan.id, payload, updatePolicy);
    }

    setEditingPlan(null);
    setIsCreatingNew(false);
  };

  // Duplicate plan handler
  const handleDuplicate = async (planId: string) => {
    const cloned = await duplicatePlan(planId);
    if (cloned) {
      handleOpenEditPlan(cloned);
    }
  };

  // Archive plan confirmation
  const handleConfirmArchive = () => {
    if (!planToArchive) return;
    archivePlan(planToArchive.id);
    setPlanToArchive(null);
  };

  // Export subscribers to CSV
  const handleExportSubscribersCSV = () => {
    const headers = [
      'Shop ID',
      'Shop Name',
      'Plan ID',
      'Plan Name',
      'Status',
      'Billing Interval',
      'Amount (INR)',
      'Start Date',
      'Renewal Date',
      'Jobs Used',
      'Printers Used'
    ];

    const rows = filteredSubscribers.map((sub) => [
      `"${sub.shopId}"`,
      `"${sub.shopName.replace(/"/g, '""')}"`,
      `"${sub.planId}"`,
      `"${sub.planName}"`,
      `"${sub.status}"`,
      `"${sub.billingPeriod}"`,
      `"${sub.amount ?? 0}"`,
      `"${sub.currentPeriodStart ? sub.currentPeriodStart.slice(0, 10) : ''}"`,
      `"${sub.currentPeriodEnd ? sub.currentPeriodEnd.slice(0, 10) : ''}"`,
      `"${sub.jobsUsedThisMonth ?? 0}"`,
      `"${sub.devicesUsed ?? 1}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `printflow_subscribers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Complete', 'Subscribers list exported as CSV.', 'success', 3000);
  };

  // Change Subscription Plan
  const handleExecuteChangePlan = async () => {
    if (!subToChangePlan || !targetNewPlanId) return;
    await changeShopSubscription(subToChangePlan.shopId, targetNewPlanId, 'IMMEDIATE');
    setSubToChangePlan(null);
    setTargetNewPlanId('');
  };

  // Cancel Subscription
  const handleExecuteCancelSub = () => {
    if (!subToCancel) return;
    cancelSubscription(subToCancel.id, cancelReason);
    setSubToCancel(null);
  };

  // Save Platform Policies
  const handleSavePolicies = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPolicies(true);
    updatePlatformPolicies(policiesForm);
    setIsSavingPolicies(false);
  };

  // Gateway handshake verification
  const handleTestGateway = async () => {
    setIsTestingGateway(true);
    setGatewayTestResult(null);
    try {
      const res = await testGatewayConnection();
      setGatewayTestResult({ tested: true, ...res });
      if (res.success) {
        showToast('Gateway Operational', res.message, 'success', 4000);
      } else {
        showToast('Verification Failed', res.message, 'error', 4000);
      }
    } catch (err: any) {
      setGatewayTestResult({
        tested: true,
        success: false,
        message: err?.message || 'Gateway connection failed'
      });
    } finally {
      setIsTestingGateway(false);
    }
  };

  // Save Platform Gateway Configuration securely to server
  const handleSaveGateway = async () => {
    setIsSavingGateway(true);
    setGatewaySaveError(null);
    setGatewaySaveSuccess(false);

    try {
      const mode = adminRazorpay.isTestMode ? 'test' : 'live';
      const res = await fetch(apiUrl('/api/payment/platform-config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token_active',
          'X-User-Role': 'ADMIN'
        },
        body: JSON.stringify({
          keyId: adminRazorpay.keyId?.trim(),
          keySecret: replaceSecretKey.trim() || undefined,
          mode,
          webhookSecret: adminRazorpay.webhookSecret?.trim() || undefined,
          isActive: adminRazorpay.enabled ?? true
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.slice(0, 150) || `Server returned HTTP ${res.status}`);
      }

      if (!res.ok || !data.success) {
        setGatewaySaveError(data.error || 'Failed to save gateway configuration');
        showToast('Save Failed', data.error || 'Gateway configuration rejected.', 'error', 5000);
        return;
      }

      setReplaceSecretKey('');
      setGatewaySaveSuccess(true);
      showToast('Gateway Saved', 'Platform Razorpay configuration encrypted and saved.', 'success', 4000);
      updateAdminRazorpay({
        ...adminRazorpay,
        keySecret: '',
        lastVerifiedAt: data.config?.lastUpdatedAt || new Date().toISOString()
      });
      setTimeout(() => setGatewaySaveSuccess(false), 4000);
    } catch (err: any) {
      setGatewaySaveError(err?.message || 'Network error saving gateway configuration');
    } finally {
      setIsSavingGateway(false);
    }
  };

  // Add new feature chip to plan form
  const [newFeatureText, setNewFeatureText] = useState('');
  const handleAddFeatureChip = () => {
    if (!newFeatureText.trim()) return;
    setPlanForm((prev) => ({
      ...prev,
      features: [...prev.features, newFeatureText.trim()]
    }));
    setNewFeatureText('');
  };

  const handleRemoveFeatureChip = (index: number) => {
    setPlanForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  // Role Security Check
  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Platform Admin Privilege Required</h2>
        <p className="text-xs text-slate-500">
          This SaaS subscription and pricing administration console is strictly restricted to platform super administrators.
        </p>
        <div className="pt-2">
          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Sign In As Platform Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. ENTERPRISE PAGE HEADER */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            SaaS Plans & Pricing
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Manage subscription plans, shop entitlements, usage quotas, and billing policies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Active Tenant Subscriptions */}
          <button
            onClick={() => navigate('/admin/subscriptions')}
            className="px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Active Subscriptions</span>
          </button>

          {/* Gateway Status Badge */}
          <div
            onClick={() => setActiveTab('gateway')}
            className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              adminRazorpay.keyId
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
            title="Click to view Gateway diagnostics"
          >
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                adminRazorpay.keyId ? 'bg-emerald-600' : 'bg-amber-600'
              }`}
            />
            <span>
              {adminRazorpay.keyId
                ? `Gateway: ${adminRazorpay.isTestMode ? 'Test Sandbox' : 'Production Live'}`
                : 'Gateway: Unconfigured'}
            </span>
          </div>

          <button
            onClick={() => setActiveTab('gateway')}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Billing Settings</span>
          </button>

          <button
            onClick={handleOpenCreatePlan}
            className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Plan</span>
          </button>
        </div>
      </div>

      {/* 2. OVERVIEW KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Total Plans */}
        <div
          onClick={() => {
            setActiveTab('catalog');
            setStatusFilter('ALL');
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-medium">Total Plans</span>
            <Layers className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 group-hover:text-purple-600 transition-colors">
            {kpiData.totalPlans}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Catalog tiers</span>
        </div>

        {/* Metric 2: Active Plans */}
        <div
          onClick={() => {
            setActiveTab('catalog');
            setStatusFilter('ACTIVE');
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-medium">Active Plans</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 group-hover:text-emerald-600 transition-colors">
            {kpiData.activePlans}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">Live in checkout</span>
        </div>

        {/* Metric 3: Active Subscriptions */}
        <div
          onClick={() => {
            setActiveTab('subscribers');
            setSubscriberStatusFilter('ACTIVE');
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-medium">Active Tenants</span>
            <Store className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 group-hover:text-blue-600 transition-colors">
            {kpiData.activeSubscriptions}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Paying & active</span>
        </div>

        {/* Metric 4: Monthly Recurring Revenue (MRR) */}
        <div
          onClick={() => {
            setActiveTab('subscribers');
            setSubscriberStatusFilter('ACTIVE');
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-medium">Monthly MRR</span>
            <CreditCard className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 group-hover:text-purple-600 transition-colors">
            ₹{kpiData.mrr.toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Valid subscriptions</span>
        </div>

        {/* Metric 5: Trial Subscriptions */}
        <div
          onClick={() => {
            setActiveTab('subscribers');
            setSubscriberStatusFilter('TRIAL');
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-medium">Trials</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 group-hover:text-amber-600 transition-colors">
            {kpiData.trialSubscriptions}
          </p>
          <span className="text-[10px] text-amber-600 font-medium mt-0.5 block">Evaluation tier</span>
        </div>

        {/* Metric 6: Expiring or Past-Due Subscriptions */}
        <div
          onClick={() => {
            setActiveTab('subscribers');
            setSubscriberStatusFilter('PAST_DUE');
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-red-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-medium">Past-Due</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 group-hover:text-red-600 transition-colors">
            {kpiData.pastDueSubscriptions}
          </p>
          <span className="text-[10px] text-red-600 font-medium mt-0.5 block">Payment grace period</span>
        </div>
      </div>

      {/* 3. NAVIGATION VIEW TABS */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'catalog'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Plans Catalog ({plans.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('subscribers')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'subscribers'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Subscribers & Tenants ({subscriptions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('usage')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'usage'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Usage & Quota Telemetry</span>
          </button>

          <button
            onClick={() => setActiveTab('policies')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'policies'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Platform Policies</span>
          </button>

          <button
            onClick={() => setActiveTab('gateway')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gateway'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Razorpay Billing Gateway</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Audit History</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PLANS CATALOG VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search plan by name, slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="DRAFT">Drafts</option>
                <option value="ARCHIVED">Archived</option>
              </select>

              {/* Tier filter */}
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
              >
                <option value="ALL">All Tiers</option>
                <option value="FREE">Free Plans</option>
                <option value="PAID">Paid Commercial</option>
              </select>

              {/* Sorting */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
              >
                <option value="order">Display Order</option>
                <option value="priceAsc">Price: Low to High</option>
                <option value="priceDesc">Price: High to Low</option>
                <option value="subscribers">Most Subscribers</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white shadow-2xs text-purple-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cards Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'table' ? 'bg-white shadow-2xs text-purple-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Table View
              </button>
            </div>
          </div>

          {/* Empty State */}
          {filteredPlans.length === 0 && (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
              <Layers className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">No subscription plans match your search</p>
              <p className="text-xs text-slate-400">Try adjusting your filters or create a new plan.</p>
              <button
                onClick={handleOpenCreatePlan}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Plan</span>
              </button>
            </div>
          )}

          {/* GRID VIEW */}
          {viewMode === 'grid' && filteredPlans.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredPlans.map((p) => {
                const subscriberCount = planSubscribersMap[p.id] || 0;
                const isArchived = p.status === 'ARCHIVED';
                const isDraft = p.status === 'DRAFT';

                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl border flex flex-col justify-between transition-all relative overflow-hidden ${
                      p.isPopular
                        ? 'border-purple-500 shadow-xs'
                        : isArchived
                        ? 'border-slate-200 bg-slate-50/60 opacity-80'
                        : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Top banner / Popular chip */}
                    {p.isPopular && (
                      <div className="bg-purple-600 text-white text-[10px] font-semibold tracking-wider uppercase text-center py-1">
                        Recommended Plan
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Title & Status badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              {p.name}
                            </h3>
                            <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                              /{p.slug || p.id}
                            </span>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isArchived
                                ? 'bg-slate-100 text-slate-600 border border-slate-300'
                                : isDraft
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {p.status || (p.isActive ? 'ACTIVE' : 'DRAFT')}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 min-h-[32px] line-clamp-2 mt-1">
                          {p.tagline}
                        </p>

                        {/* Pricing */}
                        <div className="my-3 pb-3 border-b border-slate-100">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold font-mono text-slate-900">
                              {p.isFree || p.priceMonthly === 0 ? '₹0' : `₹${p.priceMonthly}`}
                            </span>
                            <span className="text-xs text-slate-400">/mo</span>
                          </div>
                          {p.priceMonthly > 0 && (
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                              or ₹{p.priceYearly || p.priceMonthly * 10}/yr{' '}
                              <span className="text-emerald-600 font-medium font-sans">
                                (Save ~17%)
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Hardware & Quotas compact summary */}
                        <div className="space-y-1.5 text-xs text-slate-600 py-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Printer className="w-3 h-3 text-slate-400" />
                              Printers:
                            </span>
                            <span className="font-semibold text-slate-800">
                              {p.isUnlimitedPrinters ? 'Unlimited' : `${p.printerLimit} device(s)`}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 flex items-center gap-1">
                              <FileText className="w-3 h-3 text-slate-400" />
                              Print Orders:
                            </span>
                            <span className="font-semibold text-slate-800">
                              {p.isUnlimitedPrintJobs
                                ? 'Unlimited'
                                : `${(p.printLimitMonthly || 1500).toLocaleString()}/mo`}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 flex items-center gap-1">
                              <HardDrive className="w-3 h-3 text-slate-400" />
                              Cloud Storage:
                            </span>
                            <span className="font-semibold text-slate-800">
                              {p.isUnlimitedStorage
                                ? 'Unlimited'
                                : `${((p.storageLimitMb || 5000) / 1024).toFixed(1)} GB`}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              Staff Operators:
                            </span>
                            <span className="font-semibold text-slate-800">
                              {p.staffLimit || 1} staff accounts
                            </span>
                          </div>
                        </div>

                        {/* Feature Entitlements Chips */}
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1">
                          {p.features.slice(0, 3).map((feat, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md truncate max-w-full"
                            >
                              <Check className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                              <span className="truncate">{feat}</span>
                            </span>
                          ))}
                          {p.features.length > 3 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{p.features.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Subscribers counter badge */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <button
                          onClick={() => {
                            setActiveTab('subscribers');
                            setSubscriberPlanFilter(p.id);
                          }}
                          className="text-purple-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Store className="w-3 h-3" />
                          <span>{subscriberCount} Subscribed Shop{subscriberCount !== 1 ? 's' : ''}</span>
                        </button>
                        <span className="text-[10px] text-slate-400">
                          v{p.version || 1}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 text-xs">
                      <button
                        onClick={() => handleOpenEditPlan(p)}
                        className="flex-1 py-1.5 px-2 bg-white hover:bg-purple-50 hover:text-purple-700 text-slate-700 font-semibold rounded-lg border border-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit Plan</span>
                      </button>

                      <button
                        onClick={() => handleDuplicate(p.id)}
                        title="Duplicate Plan"
                        className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 font-medium rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {!isArchived ? (
                        <button
                          onClick={() => setPlanToArchive(p)}
                          title="Archive Plan (Hide from new subscribers)"
                          className="p-1.5 bg-white hover:bg-amber-50 hover:text-amber-700 text-slate-600 font-medium rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => togglePlanStatus(p.id, 'ACTIVE')}
                          title="Unarchive & Activate Plan"
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg border border-emerald-200 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => setPlanToDelete(p)}
                        title="Delete Plan from Database"
                        className="p-1.5 bg-white hover:bg-red-50 hover:text-red-700 text-slate-400 hover:border-red-200 font-medium rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE VIEW */}
          {viewMode === 'table' && filteredPlans.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Plan Name & Slug</th>
                      <th className="py-3 px-4">Monthly / Yearly Rate</th>
                      <th className="py-3 px-4">Print Volume</th>
                      <th className="py-3 px-4">Printers</th>
                      <th className="py-3 px-4">Storage</th>
                      <th className="py-3 px-4">Subscribers</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPlans.map((p) => {
                      const subscriberCount = planSubscribersMap[p.id] || 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{p.name}</span>
                            <span className="text-[10px] font-mono text-purple-700">/{p.slug || p.id}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            <span className="font-bold text-slate-900">
                              {p.isFree || p.priceMonthly === 0 ? '₹0' : `₹${p.priceMonthly}/mo`}
                            </span>
                            <span className="text-slate-400 text-[11px] block">
                              ₹{p.priceYearly || p.priceMonthly * 10}/yr
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700">
                            {p.isUnlimitedPrintJobs
                              ? 'Unlimited'
                              : `${(p.printLimitMonthly || 1500).toLocaleString()} jobs`}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {p.isUnlimitedPrinters ? 'Unlimited' : `${p.printerLimit} device(s)`}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {p.isUnlimitedStorage
                              ? 'Unlimited'
                              : `${((p.storageLimitMb || 5000) / 1024).toFixed(1)} GB`}
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => {
                                setActiveTab('subscribers');
                                setSubscriberPlanFilter(p.id);
                              }}
                              className="font-bold text-purple-700 hover:underline cursor-pointer"
                            >
                              {subscriberCount} shops
                            </button>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === 'ACTIVE' || (p.isActive && p.status !== 'ARCHIVED')
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : p.status === 'DRAFT'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-300'
                              }`}
                            >
                              {p.status || (p.isActive ? 'ACTIVE' : 'DRAFT')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditPlan(p)}
                                className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDuplicate(p.id)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                                title="Duplicate"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {p.status !== 'ARCHIVED' && (
                                <button
                                  onClick={() => setPlanToArchive(p)}
                                  className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                                  title="Archive"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setPlanToDelete(p)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                title="Delete Plan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUBSCRIBERS & TENANTS MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'subscribers' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search shop, ID, owner..."
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>

              <select
                value={subscriberStatusFilter}
                onChange={(e) => setSubscriberStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="TRIAL">In Trial</option>
                <option value="PAST_DUE">Past Due</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>

              <select
                value={subscriberPlanFilter}
                onChange={(e) => setSubscriberPlanFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
              >
                <option value="ALL">All Plans</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-slate-400 text-xs">
                {filteredSubscribers.length} tenant{filteredSubscribers.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleExportSubscribersCSV}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Shop Identity</th>
                    <th className="py-3 px-4">Subscribed Plan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Billing Rate</th>
                    <th className="py-3 px-4">Period / Renewal</th>
                    <th className="py-3 px-4">Quota Utilization</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubscribers.map((sub) => {
                    const matchedPlan = plans.find((p) => p.id === sub.planId);
                    const matchedShop = shops.find((s) => s.id === sub.shopId);
                    const jobLimit = matchedPlan?.printLimitMonthly || 1500;
                    const jobsUsed = sub.jobsUsedThisMonth || 0;
                    const jobsPercent = Math.min(100, Math.round((jobsUsed / Math.max(1, jobLimit)) * 100));

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{sub.shopName}</span>
                          <span className="text-[10px] font-mono text-slate-400">ID: {sub.shopId}</span>
                          {matchedShop?.city && (
                            <span className="text-[11px] text-slate-500 block">{matchedShop.city}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-purple-700 block">{sub.planName}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                            {sub.billingPeriod}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : sub.status === 'TRIAL'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : sub.status === 'PAST_DUE'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-bold text-slate-900">
                            {sub.amount === 0 ? 'Free (₹0)' : `₹${sub.amount}`}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {sub.paymentStatus || 'PAID'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-slate-700 block">
                            Ends: {sub.currentPeriodEnd ? sub.currentPeriodEnd.slice(0, 10) : 'N/A'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Auto-Renew: {sub.autoRenew ? 'Yes' : 'Disabled'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 min-w-[140px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-500">
                              <span>Jobs: {jobsUsed}</span>
                              <span>{matchedPlan?.isUnlimitedPrintJobs ? 'Unlimited' : `${jobsPercent}%`}</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  jobsPercent >= 90
                                    ? 'bg-red-500'
                                    : jobsPercent >= 75
                                    ? 'bg-amber-500'
                                    : 'bg-purple-600'
                                }`}
                                style={{ width: `${Math.max(4, Math.min(100, jobsPercent))}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSubToChangePlan(sub);
                                setTargetNewPlanId(sub.planId);
                              }}
                              className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg cursor-pointer"
                            >
                              Change Plan
                            </button>
                            {sub.status !== 'CANCELLED' && (
                              <button
                                onClick={() => setSubToCancel(sub)}
                                className="px-2 py-1 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 font-medium rounded-lg cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: USAGE & QUOTA TELEMETRY */}
      {/* ========================================================================= */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold">Print Orders Handled</span>
                <Printer className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900">
                {subscriptions.reduce((acc, s) => acc + (s.jobsUsedThisMonth || 0), 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-500 block">Total monthly spooled volume</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold">Registered Printers</span>
                <HardwareDeviceIcon />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900">
                {printers.length} devices
              </p>
              <span className="text-[11px] text-emerald-600 font-medium block">
                Across all active tenant queues
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-semibold">Quota Warning Alerts</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold font-mono text-slate-900">
                {
                  subscriptions.filter((s) => {
                    const plan = plans.find((p) => p.id === s.planId);
                    if (!plan || plan.isUnlimitedPrintJobs) return false;
                    const limit = plan.printLimitMonthly || 1500;
                    return (s.jobsUsedThisMonth || 0) / limit >= 0.8;
                  }).length
                }
              </p>
              <span className="text-[11px] text-amber-600 font-medium block">
                Tenants exceeding {platformPolicies.warningThresholdPercent}% quota threshold
              </span>
            </div>
          </div>

          {/* Detailed shop quota status table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tenant Hardware & Volume Telemetry</h3>
                <p className="text-xs text-slate-500">Live monitoring of tenant quotas against subscribed tier limits.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tenant</th>
                    <th className="py-3 px-4">Plan Quota Tier</th>
                    <th className="py-3 px-4">Monthly Jobs Allocation</th>
                    <th className="py-3 px-4">Connected Hardware</th>
                    <th className="py-3 px-4">Cloud Storage</th>
                    <th className="py-3 px-4">Quota Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.map((sub) => {
                    const plan = plans.find((p) => p.id === sub.planId);
                    const jobLimit = plan?.printLimitMonthly || 1500;
                    const jobsUsed = sub.jobsUsedThisMonth || 0;
                    const jobRatio = jobsUsed / Math.max(1, jobLimit);
                    const printerLimit = plan?.printerLimit || 1;
                    const shopPrinters = printers.filter((pr) => pr.shopId === sub.shopId);

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{sub.shopName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{sub.shopId}</span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-purple-700">
                          {sub.planName}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className="text-slate-800 font-medium">
                              {jobsUsed.toLocaleString()} / {plan?.isUnlimitedPrintJobs ? 'Unlimited' : jobLimit.toLocaleString()}
                            </span>
                            <div className="w-32 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  jobRatio >= 0.95 ? 'bg-red-500' : jobRatio >= 0.8 ? 'bg-amber-500' : 'bg-purple-600'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, Math.round(jobRatio * 100)))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {shopPrinters.length} / {plan?.isUnlimitedPrinters ? 'Unlimited' : `${printerLimit} max`}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {((sub.storageUsedMb || 0) / 1024).toFixed(1)} GB /{' '}
                          {plan?.isUnlimitedStorage ? 'Unlimited' : `${((plan?.storageLimitMb || 5000) / 1024).toFixed(1)} GB`}
                        </td>
                        <td className="py-3.5 px-4">
                          {jobRatio >= 1.0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              Quota Exceeded
                            </span>
                          ) : jobRatio >= 0.8 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Warning (&gt;80%)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Optimal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PLATFORM POLICIES */}
      {/* ========================================================================= */}
      {activeTab === 'policies' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Global Quota & Subscription Policies</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Universal platform restrictions that enforce system boundaries across all tenant tiers.
                </p>
              </div>
              <div className="text-[11px] text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-100 font-medium">
                Last updated: {platformPolicies.updatedAt?.slice(0, 10) || 'Recent'}
              </div>
            </div>

            <form onSubmit={handleSavePolicies} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Default File Retention (Hours)</label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={policiesForm.defaultFileRetentionHours}
                    onChange={(e) =>
                      setPoliciesForm({ ...policiesForm, defaultFileRetentionHours: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400">
                    Duration after completed print before uploaded PDFs/images are purged.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Platform Max Upload Ceiling (MB)</label>
                  <input
                    type="number"
                    min={5}
                    max={500}
                    value={policiesForm.maxAllowedUploadSizeMb}
                    onChange={(e) =>
                      setPoliciesForm({ ...policiesForm, maxAllowedUploadSizeMb: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400">
                    Hard security ceiling. No plan can grant uploads higher than this threshold.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Global Rate Limit (Requests / Min)</label>
                  <input
                    type="number"
                    min={30}
                    max={1000}
                    value={policiesForm.globalRateLimitPerMin}
                    onChange={(e) =>
                      setPoliciesForm({ ...policiesForm, globalRateLimitPerMin: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400">DDoS and counter flood protection.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Default Trial Duration (Days)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={policiesForm.trialDurationDays}
                    onChange={(e) =>
                      setPoliciesForm({ ...policiesForm, trialDurationDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400">Standard evaluation period for new shop signups.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Failed Payment Grace Period (Days)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={policiesForm.failedPaymentGracePeriodDays}
                    onChange={(e) =>
                      setPoliciesForm({ ...policiesForm, failedPaymentGracePeriodDays: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400">Time allowed before past-due accounts are locked.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Usage Warning Threshold (%)</label>
                  <input
                    type="number"
                    min={50}
                    max={95}
                    value={policiesForm.warningThresholdPercent}
                    onChange={(e) =>
                      setPoliciesForm({ ...policiesForm, warningThresholdPercent: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400">Sends alert to shop dashboard when reached.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Quota Overage Policy</label>
                  <select
                    value={policiesForm.overagePolicy}
                    onChange={(e) => setPoliciesForm({ ...policiesForm, overagePolicy: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  >
                    <option value="BLOCK_PRINTS">Block Orders (Prompt Shop To Upgrade)</option>
                    <option value="SOFT_WARNING">Soft Warning (Allow Prints with Notification)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800">Cancellation Policy</label>
                  <select
                    value={policiesForm.cancellationPolicy}
                    onChange={(e) =>
                      setPoliciesForm({ ...policiesForm, cancellationPolicy: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  >
                    <option value="END_OF_CYCLE">Active until end of current billing cycle</option>
                    <option value="IMMEDIATE">Immediate cancellation (Revert to Free tier)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={isSavingPolicies}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingPolicies ? 'Saving...' : 'Save Platform Policies'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RAZORPAY BILLING GATEWAY SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'gateway' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Platform Razorpay Gateway Configuration</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Collect recurring SaaS subscriptions from shop owners. Secret credentials remain strictly protected on the backend.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestGateway}
                disabled={isTestingGateway}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-xl border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingGateway ? 'animate-spin' : ''}`} />
                <span>{isTestingGateway ? 'Verifying...' : 'Verify Gateway Handshake'}</span>
              </button>
            </div>

            {/* Test result banner */}
            {gatewayTestResult && (
              <div
                className={`p-4 rounded-xl text-xs flex items-start gap-2.5 ${
                  gatewayTestResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {gatewayTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{gatewayTestResult.success ? 'Handshake Successful' : 'Handshake Failed'}</p>
                  <p className="mt-0.5">{gatewayTestResult.message}</p>
                  {gatewayTestResult.latencyMs && (
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Server API Response Latency: {gatewayTestResult.latencyMs}ms
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2 text-xs text-blue-900">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Configured via Server-Side Environment Variables</span>
              </div>
              <p className="text-blue-800 leading-relaxed">
                Platform SaaS Razorpay Gateway API credentials (<code className="font-mono bg-blue-100 px-1 py-0.5 rounded">RAZORPAY_KEY_ID</code> / <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">RAZORPAY_KEY_SECRET</code>) are configured exclusively via server-side environment variables. Admin dashboard configuration, editing, saving, and overrides have been permanently disabled for security.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2">
              <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                <span>Security Architecture Notes</span>
              </h4>
              <ul className="text-slate-500 space-y-1 text-[11px] list-disc list-inside">
                <li>All subscriptions and orders are created server-side via authenticated endpoints.</li>
                <li>Webhook event IDs are idempotently stored to prevent duplicate charges or double execution.</li>
                <li>HMAC SHA-256 payload verification is enforced on all captured events.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: SECURITY & AUDIT HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Subscription & Plan Change Audit Log</h3>
              <p className="text-xs text-slate-500">Immutable record of plan pricing updates, archiving, and grandfathering actions.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs
                  .filter((l) => l.entityType === 'SUBSCRIPTION' || l.entityType === 'SETTINGS')
                  .slice(0, 15)
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 text-slate-500">{log.createdAt.replace('T', ' ').slice(0, 19)}</td>
                      <td className="py-2.5 px-4 font-bold text-purple-700">{log.action}</td>
                      <td className="py-2.5 px-4 text-slate-600">{log.entityId}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-800">{log.actorName}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-600">{log.details}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE OR EDIT PLAN */}
      {/* ========================================================================= */}
      {(editingPlan || isCreatingNew) && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isCreatingNew ? 'Create New SaaS Subscription Plan' : `Edit Plan: ${planForm.name}`}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure billing parameters, hardware limits, feature entitlements, and quota boundaries.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPlan(null);
                  setIsCreatingNew(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlanForm} className="space-y-6 text-xs">
              {/* SECTION A: BASIC INFORMATION */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-purple-700">
                  1. Basic Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-semibold text-slate-800">Plan Display Name *</label>
                    <input
                      type="text"
                      required
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      placeholder="e.g. Pro Xerox Hub"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-800">URL Slug</label>
                    <input
                      type="text"
                      value={planForm.slug}
                      onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                      placeholder="e.g. pro-xerox-hub"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-3">
                    <label className="font-semibold text-slate-800">Tagline / Headline</label>
                    <input
                      type="text"
                      value={planForm.tagline}
                      onChange={(e) => setPlanForm({ ...planForm, tagline: e.target.value })}
                      placeholder="e.g. Best for busy print centers near colleges & courts"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-semibold text-slate-800">Full Description</label>
                    <input
                      type="text"
                      value={planForm.description}
                      onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                      placeholder="Detailed overview for the subscription catalog..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-800">Status</label>
                    <select
                      value={planForm.status}
                      onChange={(e) => setPlanForm({ ...planForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    >
                      <option value="ACTIVE">Active (Checkout Available)</option>
                      <option value="DRAFT">Draft (Internal Only)</option>
                      <option value="ARCHIVED">Archived (Grandfathered Only)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION B: PRICING */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-purple-700">
                    2. Pricing & Commercials (INR ₹)
                  </h4>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={planForm.isFree}
                      onChange={(e) => setPlanForm({ ...planForm, isFree: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span>Free Plan (₹0 / month)</span>
                  </label>
                </div>

                {!planForm.isFree && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-800">Monthly Price (₹) *</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={planForm.priceMonthly}
                        onChange={(e) => setPlanForm({ ...planForm, priceMonthly: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-800">Yearly Price (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={planForm.priceYearly}
                        onChange={(e) => setPlanForm({ ...planForm, priceYearly: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-800">Trial Days</label>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={planForm.trialDays}
                        onChange={(e) => setPlanForm({ ...planForm, trialDays: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-800">Billing Interval</label>
                      <select
                        value={planForm.billingInterval}
                        onChange={(e) => setPlanForm({ ...planForm, billingInterval: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                      >
                        <option value="BOTH">Monthly & Yearly</option>
                        <option value="MONTHLY">Monthly Only</option>
                        <option value="YEARLY">Yearly Only</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION C: HARDWARE & QUOTAS */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-purple-700">
                  3. Hardware & Volume Quotas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-800">Monthly Print Orders</label>
                      <label className="text-[10px] text-purple-700 cursor-pointer flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={planForm.isUnlimitedPrintJobs}
                          onChange={(e) => setPlanForm({ ...planForm, isUnlimitedPrintJobs: e.target.checked })}
                          className="rounded text-purple-600"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      disabled={planForm.isUnlimitedPrintJobs}
                      value={planForm.printLimitMonthly}
                      onChange={(e) => setPlanForm({ ...planForm, printLimitMonthly: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-800">Max Allowed Printers</label>
                      <label className="text-[10px] text-purple-700 cursor-pointer flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={planForm.isUnlimitedPrinters}
                          onChange={(e) => setPlanForm({ ...planForm, isUnlimitedPrinters: e.target.checked })}
                          className="rounded text-purple-600"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min={1}
                      disabled={planForm.isUnlimitedPrinters}
                      value={planForm.printerLimit}
                      onChange={(e) => setPlanForm({ ...planForm, printerLimit: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-800">Storage Limit (MB)</label>
                      <label className="text-[10px] text-purple-700 cursor-pointer flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={planForm.isUnlimitedStorage}
                          onChange={(e) => setPlanForm({ ...planForm, isUnlimitedStorage: e.target.checked })}
                          className="rounded text-purple-600"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      min={100}
                      disabled={planForm.isUnlimitedStorage}
                      value={planForm.storageLimitMb}
                      onChange={(e) => setPlanForm({ ...planForm, storageLimitMb: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-800">Staff Accounts Limit</label>
                    <input
                      type="number"
                      min={1}
                      value={planForm.staffLimit}
                      onChange={(e) => setPlanForm({ ...planForm, staffLimit: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-800">Max Upload Size (MB)</label>
                    <input
                      type="number"
                      min={5}
                      max={platformPolicies.maxAllowedUploadSizeMb}
                      value={planForm.maxUploadSizeMb}
                      onChange={(e) => setPlanForm({ ...planForm, maxUploadSizeMb: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                    />
                    <span className="text-[10px] text-slate-400">
                      Capped at platform limit: {platformPolicies.maxAllowedUploadSizeMb}MB
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION D: FEATURE ENTITLEMENTS */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-purple-700">
                  4. Feature Entitlements
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries({
                    qrPrinting: 'QR Code Stand',
                    multiFileUpload: 'Multi-File Upload',
                    automatedQueue: 'Auto Print Queue',
                    multiplePrinters: 'Multiple Printers',
                    smartPrinterSelection: 'Smart Auto-Routing',
                    analytics: 'Revenue Analytics',
                    customBranding: 'Custom Shop Logo',
                    staffManagement: 'Staff Roles & Logins',
                    apiAccess: 'Print Agent API',
                    prioritySupport: 'Priority Support SLA'
                  }).map(([key, label]) => {
                    const isChecked = (planForm.featureEntitlements as any)[key] ?? false;
                    return (
                      <label
                        key={key}
                        className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-purple-50/70 border-purple-200 text-purple-900 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setPlanForm({
                              ...planForm,
                              featureEntitlements: {
                                ...planForm.featureEntitlements,
                                [key]: e.target.checked
                              }
                            })
                          }
                          className="rounded text-purple-600"
                        />
                        <span className="truncate">{label}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Custom Features List */}
                <div className="pt-2">
                  <label className="font-semibold text-slate-800 block mb-1">
                    Display Feature Bullets
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {planForm.features.map((feat, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[11px] px-2.5 py-1 rounded-lg border border-slate-200"
                      >
                        <span>{feat}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeatureChip(idx)}
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add another highlight bullet..."
                      value={newFeatureText}
                      onChange={(e) => setNewFeatureText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeatureChip();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleAddFeatureChip}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                    >
                      Add Bullet
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION E: SAFE PLAN UPDATE POLICY (When editing existing plan) */}
              {!isCreatingNew && (
                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
                  <h4 className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-700" />
                    <span>Safe Plan Update Policy</span>
                  </h4>
                  <p className="text-[11px] text-amber-800">
                    Choose how price or quota revisions are applied to existing active subscribers:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <label
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-start gap-2 ${
                        updatePolicy === 'NEW_ONLY'
                          ? 'bg-white border-amber-500 font-semibold shadow-2xs'
                          : 'bg-amber-50/40 border-amber-200 text-amber-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="updatePolicy"
                        checked={updatePolicy === 'NEW_ONLY'}
                        onChange={() => setUpdatePolicy('NEW_ONLY')}
                        className="mt-0.5 text-amber-600"
                      />
                      <div>
                        <span>New Subscribers Only</span>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                          Grandfathers existing active shops at original pricing and limits.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-start gap-2 ${
                        updatePolicy === 'AT_RENEWAL'
                          ? 'bg-white border-amber-500 font-semibold shadow-2xs'
                          : 'bg-amber-50/40 border-amber-200 text-amber-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="updatePolicy"
                        checked={updatePolicy === 'AT_RENEWAL'}
                        onChange={() => setUpdatePolicy('AT_RENEWAL')}
                        className="mt-0.5 text-amber-600"
                      />
                      <div>
                        <span>At Next Renewal</span>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                          Applies new rate when customer's current billing cycle renews.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-start gap-2 ${
                        updatePolicy === 'IMMEDIATE'
                          ? 'bg-white border-red-500 font-semibold shadow-2xs'
                          : 'bg-amber-50/40 border-amber-200 text-amber-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="updatePolicy"
                        checked={updatePolicy === 'IMMEDIATE'}
                        onChange={() => setUpdatePolicy('IMMEDIATE')}
                        className="mt-0.5 text-red-600"
                      />
                      <div>
                        <span>Apply Immediately</span>
                        <p className="text-[10px] text-red-600 font-normal mt-0.5">
                          Updates active subscriptions immediately. Requires audit confirmation.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2.5">
                {!isCreatingNew && editingPlan ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPlanToDelete(editingPlan);
                    }}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Plan</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPlan(null);
                      setIsCreatingNew(false);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    {isCreatingNew ? 'Create & Publish Plan' : 'Save Plan Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ARCHIVE CONFIRMATION */}
      {/* ========================================================================= */}
      {planToArchive && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Archive Plan</h3>
                <p className="text-xs text-slate-500">"{planToArchive.name}"</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Archiving this plan removes it from checkout and customer plan selection.
              <strong> Existing subscribers will remain active on grandfathered terms</strong> without breaking historical billing records or print queues.
            </p>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPlanToArchive(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl cursor-pointer text-xs shadow-xs"
              >
                Confirm & Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2.1: DELETE PLAN CONFIRMATION */}
      {/* ========================================================================= */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Plan</h3>
                <p className="text-xs text-slate-500">"{planToDelete.name}"</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this SaaS subscription plan? This action cannot be undone and will remove the plan from the catalog.
            </p>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPlanToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl cursor-pointer text-xs shadow-xs"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CHANGE SUBSCRIBER PLAN */}
      {/* ========================================================================= */}
      {subToChangePlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Change Shop Subscription Plan</h3>
              <p className="text-xs text-slate-500">
                Updating subscription for <strong>{subToChangePlan.shopName}</strong>
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-800">Select Target Plan</label>
              <select
                value={targetNewPlanId}
                onChange={(e) => setTargetNewPlanId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{p.priceMonthly}/mo ({p.printerLimit} printers max)
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-purple-50 rounded-xl text-[11px] text-purple-900 border border-purple-100">
              <p className="font-semibold">Consequence Summary:</p>
              <p className="mt-0.5">
                The shop's hardware allocation and print limits will immediately sync with the selected tier. A subscription billing record will be stamped in platform financials.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSubToChangePlan(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteChangePlan}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl cursor-pointer shadow-xs"
              >
                Confirm Plan Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CANCEL SUBSCRIBER CONFIRMATION */}
      {/* ========================================================================= */}
      {subToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Cancel Tenant Subscription</h3>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to cancel the subscription for <strong>{subToCancel.shopName}</strong>?
              The shop will be downgraded to the Free Starter tier upon cancellation.
            </p>

            <div className="space-y-1 text-xs">
              <label className="font-semibold text-slate-800">Reason for Cancellation</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSubToCancel(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl cursor-pointer"
              >
                Abort
              </button>
              <button
                type="button"
                onClick={handleExecuteCancelSub}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl cursor-pointer shadow-xs"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper micro-icon component
function HardwareDeviceIcon() {
  return <Printer className="w-4 h-4 text-emerald-600" />;
}
