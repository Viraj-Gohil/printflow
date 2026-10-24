import React, { useState, useEffect } from 'react';
import { useApp } from '../../lib/store';
import {
  CreditCard,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Store,
  Clock,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  ExternalLink,
  Info,
  AlertCircle,
  Lock,
  Copy,
  Check,
  Building2,
  Sliders,
  Percent,
  Printer,
  ChevronRight,
  ShieldAlert,
  Loader2,
  X
} from 'lucide-react';
import { apiUrl } from '../../lib/apiConfig';
import {
  validateShopName,
  validateEmail,
  validatePhone,
  validateUpiId
} from '../../lib/validation';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

type SettingsTab = 'general' | 'gateway' | 'profile';

export const ShopSettings: React.FC = () => {
  const { activeShop, updateShopRazorpay, updateShopProfile, printers, showToast, navigate } = useApp();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Server-persisted shop payment integration metadata
  const [shopMeta, setShopMeta] = useState<{
    provider: string;
    keyId: string;
    rawKeyId: string;
    mode: 'test' | 'live';
    isConfigured: boolean;
    isActive: boolean;
    hasSecret: boolean;
    lastUpdatedAt: string | null;
  } | null>(null);

  // Razorpay form state
  const [keyIdInput, setKeyIdInput] = useState(activeShop.razorpaySettings?.keyId || '');
  const [replaceSecret, setReplaceSecret] = useState('');
  const [mode, setMode] = useState<'test' | 'live'>('live');
  const [upiId, setUpiId] = useState(activeShop.razorpaySettings?.upiId || '');
  const [autoCapture, setAutoCapture] = useState(activeShop.razorpaySettings?.autoCapture ?? true);
  const [receiptPrefix, setReceiptPrefix] = useState(activeShop.razorpaySettings?.receiptPrefix || 'SGX-');
  const [isEnabled, setIsEnabled] = useState(activeShop.razorpaySettings?.enabled ?? true);

  const [showSecret, setShowSecret] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingGateway, setIsSavingGateway] = useState(false);
  const [gatewayErrors, setGatewayErrors] = useState<{ keyId?: string; upiId?: string }>({});

  // Mode switch confirmation modal
  const [pendingModeSwitch, setPendingModeSwitch] = useState<'test' | 'live' | null>(null);

  // Shop Profile form state
  const [profileForm, setProfileForm] = useState({
    name: activeShop.name,
    slug: activeShop.slug,
    phone: activeShop.ownerPhone,
    email: activeShop.ownerEmail,
    address: activeShop.address,
    city: activeShop.city,
    businessHours: activeShop.businessHours,
    primaryColor: activeShop.primaryColor
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load shop payment integration from backend
  useEffect(() => {
    if (!activeShop?.id) return;
    fetch(apiUrl(`/api/shop/${encodeURIComponent(activeShop.id)}/payment-settings`), {
      headers: {
        'Authorization': 'Bearer admin_token_active',
        'X-Shop-Id': activeShop.id,
        'X-User-Role': 'SHOP_OWNER'
      }
    })
      .then((r) => {
        if (r.ok && r.headers.get('content-type')?.includes('application/json')) {
          return r.json();
        }
        return null;
      })
      .then((data) => {
        if (data?.success) {
          setShopMeta(data);
          if (data.isConfigured) {
            setKeyIdInput(data.rawKeyId || data.keyId);
            setMode(data.mode);
            setIsEnabled(data.isActive);
          }
        }
      })
      .catch((err) => console.warn('Could not load shop payment integration:', err));
  }, [activeShop?.id]);

  // Keep profile form in sync if activeShop changes
  useEffect(() => {
    setProfileForm({
      name: activeShop.name,
      slug: activeShop.slug,
      phone: activeShop.ownerPhone,
      email: activeShop.ownerEmail,
      address: activeShop.address,
      city: activeShop.city,
      businessHours: activeShop.businessHours,
      primaryColor: activeShop.primaryColor
    });
  }, [activeShop.id, activeShop.name, activeShop.slug, activeShop.ownerPhone, activeShop.ownerEmail]);

  // Copy Storefront URL helper
  const handleCopyStorefrontUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/#/s/${activeShop.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      showToast('Link Copied', 'Storefront URL copied to clipboard', 'info', 2500);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Auto-slugify shop name
  const handleAutoSlug = () => {
    const generated = profileForm.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (generated) {
      setProfileForm((prev) => ({ ...prev, slug: generated }));
      setProfileErrors((prev) => ({ ...prev, slug: '' }));
    }
  };

  // Handle mode selection with interruption confirmation
  const handleSelectMode = (newMode: 'test' | 'live') => {
    if (newMode === mode) return;

    // If currently configured in Live mode and user wants to switch to Test
    if (mode === 'live' && shopMeta?.isConfigured && shopMeta?.mode === 'live') {
      setPendingModeSwitch(newMode);
    } else {
      setMode(newMode);
      setGatewayErrors((prev) => ({ ...prev, keyId: undefined }));
    }
  };

  const confirmModeSwitch = () => {
    if (pendingModeSwitch) {
      setMode(pendingModeSwitch);
      setPendingModeSwitch(null);
      setGatewayErrors((prev) => ({ ...prev, keyId: undefined }));
    }
  };

  // Test Razorpay connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    setGatewayErrors((prev) => ({ ...prev, keyId: undefined }));

    const key = keyIdInput.trim();
    if (!key) {
      setGatewayErrors((prev) => ({ ...prev, keyId: 'Payment Gateway Key ID is required to test connection.' }));
      setTestingConnection(false);
      return;
    }

    if (mode === 'live' && !key.startsWith('rzp_live_')) {
      setGatewayErrors((prev) => ({
        ...prev,
        keyId: 'Live Mode requires a Key ID starting with "rzp_live_".'
      }));
      setTestingConnection(false);
      return;
    }

    if (mode === 'test' && !key.startsWith('rzp_test_')) {
      setGatewayErrors((prev) => ({
        ...prev,
        keyId: 'Test Mode requires a Key ID starting with "rzp_test_".'
      }));
      setTestingConnection(false);
      return;
    }

    try {
      // First attempt the shop-isolated test endpoint
      let res = await fetch(apiUrl(`/api/shop/${encodeURIComponent(activeShop.id)}/payment-settings/test`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token_active',
          'X-Shop-Id': activeShop.id,
          'X-User-Role': 'SHOP_OWNER'
        },
        body: JSON.stringify({
          keyId: key,
          keySecret: replaceSecret.trim() || undefined
        })
      });

      // Fallback to platform test endpoint if shop test route is unavailable
      if (res.status === 404) {
        res = await fetch(apiUrl('/api/payment/platform-config/test'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer admin_token_active',
            'X-User-Role': 'SHOP_OWNER'
          },
          body: JSON.stringify({
            keyId: key,
            keySecret: replaceSecret.trim() || undefined
          })
        });
      }

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.slice(0, 150) || `Server returned HTTP ${res.status}`);
      }

      setTestResult({
        success: Boolean(res.ok && data.success),
        message: data.message || (res.ok ? 'Gateway handshake verified successfully.' : 'Handshake test failed.'),
        latencyMs: data.latencyMs
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Gateway handshake test failed. Please verify credentials.'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Save Razorpay settings
  const handleSaveRazorpay = async (e: React.FormEvent) => {
    e.preventDefault();
    setGatewayErrors({});
    setSaveError(null);
    setSaveSuccess(false);

    const errors: { keyId?: string; upiId?: string } = {};
    const key = keyIdInput.trim();

    if (!key) {
      errors.keyId = 'Key ID is required.';
    } else if (mode === 'live' && !key.startsWith('rzp_live_')) {
      errors.keyId = 'Live mode Key ID must start with "rzp_live_".';
    } else if (mode === 'test' && !key.startsWith('rzp_test_')) {
      errors.keyId = 'Test mode Key ID must start with "rzp_test_".';
    }

    if (upiId && upiId.trim()) {
      const upiCheck = validateUpiId(upiId.trim(), false);
      if (!upiCheck.isValid) {
        errors.upiId = upiCheck.error || 'Invalid UPI ID format (e.g. name@bank).';
      }
    }

    if (Object.keys(errors).length > 0) {
      setGatewayErrors(errors);
      return;
    }

    setIsSavingGateway(true);
    try {
      const res = await fetch(apiUrl(`/api/shop/${encodeURIComponent(activeShop.id)}/payment-settings`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token_active',
          'X-Shop-Id': activeShop.id,
          'X-User-Role': 'SHOP_OWNER'
        },
        body: JSON.stringify({
          keyId: key,
          keySecret: replaceSecret.trim() ? replaceSecret.trim() : undefined,
          mode,
          isActive: isEnabled
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
        setSaveError(data.error || 'Failed to save shop gateway credentials.');
        showToast('Save Error', data.error || 'Credentials rejected by server.', 'error', 5000);
        return;
      }

      setShopMeta(data.config);
      setReplaceSecret('');
      setSaveSuccess(true);
      showToast('Gateway Settings Saved', 'Shop payment gateway credentials encrypted and saved.', 'success', 3500);

      updateShopRazorpay(activeShop.id, {
        enabled: isEnabled,
        isTestMode: mode === 'test',
        keyId: key,
        keySecret: '', // Never store plaintext secret in client state
        upiId: upiId.trim(),
        autoCapture,
        receiptPrefix: receiptPrefix.trim(),
        lastVerifiedAt: data.config?.lastUpdatedAt || new Date().toISOString()
      });

      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Network error while saving shop gateway.');
    } finally {
      setIsSavingGateway(false);
    }
  };

  // Save Shop Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    const nameCheck = validateShopName(profileForm.name);
    if (!nameCheck.isValid) errors.name = nameCheck.error || 'Invalid shop name.';

    const slugClean = profileForm.slug.trim().toLowerCase();
    if (!slugClean || slugClean.length < 3) {
      errors.slug = 'Slug must be at least 3 characters.';
    } else if (!/^[a-z0-9-]+$/.test(slugClean)) {
      errors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens.';
    }

    const emailCheck = validateEmail(profileForm.email);
    if (!emailCheck.isValid) errors.email = emailCheck.error || 'Invalid email address.';

    const phoneCheck = validatePhone(profileForm.phone, false);
    if (!phoneCheck.isValid) errors.phone = phoneCheck.error || 'Invalid 10-digit mobile number.';

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    setProfileErrors({});
    setIsSavingProfile(true);

    try {
      updateShopProfile(activeShop.id, {
        name: profileForm.name.trim(),
        slug: slugClean,
        ownerPhone: profileForm.phone.trim(),
        ownerEmail: profileForm.email.trim(),
        address: profileForm.address.trim(),
        city: profileForm.city.trim(),
        businessHours: profileForm.businessHours.trim(),
        primaryColor: profileForm.primaryColor
      });

      setProfileSaved(true);
      showToast('Profile Saved', 'Shop details updated successfully.', 'success', 3000);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      showToast('Save Failed', err?.message || 'Could not save shop profile.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const isConfirmedLive = Boolean(
    shopMeta?.isConfigured &&
    shopMeta?.mode === 'live' &&
    keyIdInput.trim().startsWith('rzp_live_')
  );

  const shopPrinters = printers.filter((p) => p.shopId === activeShop.id);

  return (
    <div className="max-w-4xl space-y-6">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Shop Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your shop profile and customer payment configuration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeShop.isOpen ? (
            <Chip variant="success" size="sm" dot>
              OPEN FOR ORDERS
            </Chip>
          ) : (
            <Chip variant="warning" size="sm" dot>
              CURRENTLY CLOSED
            </Chip>
          )}

          <Button
            variant="outline"
            size="xs"
            onClick={handleCopyStorefrontUrl}
            className="gap-1.5"
            title="Copy Public Storefront Link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied' : 'Storefront URL'}</span>
          </Button>
        </div>
      </div>

      {/* 2. NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer border-b-2 -mb-px ${
            activeTab === 'general'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>General</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gateway')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer border-b-2 -mb-px ${
            activeTab === 'gateway'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment Gateway</span>
          {isConfirmedLive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Live Production Configured" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 cursor-pointer border-b-2 -mb-px ${
            activeTab === 'profile'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Business Profile</span>
        </button>
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB 1: GENERAL */}
      {activeTab === 'general' && (
        <div className="space-y-5">
          {/* Shop Status Banner */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{activeShop.name}</h2>
                  <p className="text-xs text-slate-500">
                    Public ordering link: <code className="font-mono text-blue-600 font-semibold">/s/{activeShop.slug}</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  variant={activeShop.isOpen ? 'soft' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const nextOpen = !activeShop.isOpen;
                    updateShopProfile(activeShop.id, { isOpen: nextOpen });
                    showToast(
                      nextOpen ? 'Shop Opened' : 'Shop Closed',
                      nextOpen ? 'Customers can now submit online print orders.' : 'Counter ordering portal is currently paused.',
                      nextOpen ? 'success' : 'info'
                    );
                  }}
                  className="gap-1.5"
                >
                  <span className={`w-2 h-2 rounded-full ${activeShop.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <span>{activeShop.isOpen ? 'Accepting Orders' : 'Storefront Paused'}</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.open(`/#/s/${activeShop.slug}`, '_blank');
                    }
                  }}
                  className="gap-1.5"
                >
                  <span>View Storefront</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Configuration Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Gateway Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="font-medium flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  <span>Payment Gateway</span>
                </span>
                {isConfirmedLive ? (
                  <Chip variant="success" size="sm" dot>
                    Live
                  </Chip>
                ) : shopMeta?.isConfigured ? (
                  <Chip variant="warning" size="sm" dot>
                    Test
                  </Chip>
                ) : (
                  <Chip variant="muted" size="sm">
                    Platform Default
                  </Chip>
                )}
              </div>
              <p className="font-bold text-slate-900 text-sm">
                {shopMeta?.isConfigured ? 'Direct Merchant Account' : 'Platform Gateway'}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('gateway')}
                className="text-[11px] text-blue-600 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <span>Configure Gateway</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Hardware Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="font-medium flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Counter Hardware</span>
                </span>
                <span className="font-mono font-bold text-slate-800">{shopPrinters.length} Assigned</span>
              </div>
              <p className="font-bold text-slate-900 text-sm">
                {shopPrinters.filter((p) => p.isEnabled).length} Ready Devices
              </p>
              <button
                type="button"
                onClick={() => navigate('/shop/printers')}
                className="text-[11px] text-blue-600 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
              >
                <span>Manage Hardware</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Platform Fee Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="font-medium flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-blue-600" />
                  <span>Platform Fee</span>
                </span>
                <Chip variant="special" size="sm">
                  0% Take-rate
                </Chip>
              </div>
              <p className="font-bold text-slate-900 text-sm">Direct Settlement</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                100% of counter print revenue deposits directly to your shop.
              </p>
            </div>
          </div>

          {/* Quick Action Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4 text-xs">
            <div className="space-y-0.5">
              <p className="font-bold text-slate-800">Need to update your counter contact or hours?</p>
              <p className="text-slate-500">Keep your physical shop address and phone number current for customer receipts.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('profile')}
              className="shrink-0"
            >
              Edit Profile
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT GATEWAY */}
      {activeTab === 'gateway' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Shop Online Payment Gateway</h2>
                {isConfirmedLive ? (
                  <Chip variant="success" size="sm" dot>
                    LIVE PRODUCTION
                  </Chip>
                ) : shopMeta?.isConfigured && shopMeta?.mode === 'test' ? (
                  <Chip variant="warning" size="sm" dot>
                    TEST / SANDBOX
                  </Chip>
                ) : (
                  <Chip variant="muted" size="sm">
                    UNCONFIGURED
                  </Chip>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure your own Razorpay credentials so customer payments credit directly to your merchant account.
              </p>
            </div>

            {shopMeta?.lastUpdatedAt && (
              <span className="text-[11px] text-slate-400 font-mono">
                Saved: {new Date(shopMeta.lastUpdatedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          <form onSubmit={handleSaveRazorpay} className="p-5 space-y-5">
            {/* Security Guarantee Banner */}
            <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Authenticated AES-256-GCM Vault Protection</span>
                <span className="text-[11px] text-blue-700 block leading-relaxed">
                  Your payment key secret is encrypted at rest using server-side keys. It is never returned in frontend API responses, browser storage, or client bundles.
                </span>
              </div>
            </div>

            {/* Success & Error Banners */}
            {saveSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Shop gateway credentials verified and encrypted in PostgreSQL.</span>
              </div>
            )}

            {saveError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Configuration Error</p>
                  <p className="mt-0.5">{saveError}</p>
                </div>
              </div>
            )}

            {testResult && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {testResult.success ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{testResult.success ? 'Gateway Verified' : 'Handshake Failed'}</p>
                  <p className="mt-0.5">{testResult.message}</p>
                </div>
              </div>
            )}

            {/* Gateway Provider & Integration Mode Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">Gateway Provider</label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 flex items-center justify-between">
                  <span>Razorpay (Direct Merchant Settlement)</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Default</span>
                </div>
                <p className="text-[11px] text-slate-400">Direct settlement to your registered Indian bank account.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">Integration Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectMode('live')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      mode === 'live'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${mode === 'live' ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                    <span>Live Production</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectMode('test')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      mode === 'test'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 ring-1 ring-amber-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${mode === 'test' ? 'bg-amber-600' : 'bg-slate-300'}`} />
                    <span>Sandbox Test</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  {mode === 'live' ? 'Real payments enabled via rzp_live_' : 'Simulated test payments via rzp_test_'}
                </p>
              </div>
            </div>

            {/* Key ID and Dedicated Replace Key Secret */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Razorpay Key ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Razorpay Key ID <span className="text-red-500">*</span></span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {mode === 'live' ? 'rzp_live_...' : 'rzp_test_...'}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder={mode === 'live' ? 'rzp_live_xxxxxxxxxxxxxx' : 'rzp_test_xxxxxxxxxxxxxx'}
                    value={keyIdInput}
                    onChange={(e) => {
                      setGatewayErrors((prev) => ({ ...prev, keyId: undefined }));
                      setKeyIdInput(e.target.value);
                    }}
                    className={`w-full pl-3 pr-9 py-2 bg-white border rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 ${
                      gatewayErrors.keyId ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                </div>
                {gatewayErrors.keyId ? (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{gatewayErrors.keyId}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Found in Razorpay Dashboard &gt; Account &amp; Settings &gt; API Keys
                  </p>
                )}
              </div>

              {/* Dedicated Key Secret Replacement */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Razorpay Key Secret</span>
                  {shopMeta?.hasSecret ? (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Configured in Vault
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-amber-700">Required for Setup</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder={
                      shopMeta?.hasSecret
                        ? '•••••••••••• (Leave blank to keep current secret)'
                        : 'Enter Razorpay Key Secret'
                    }
                    value={replaceSecret}
                    onChange={(e) => setReplaceSecret(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-2 cursor-pointer"
                    aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Leave empty to preserve existing vault-stored secret.</span>
                </p>
              </div>

              {/* Shop UPI ID / VPA */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Shop UPI ID / VPA</span>
                  <span className="text-[10px] text-slate-400">For counter QR code</span>
                </label>
                <input
                  type="text"
                  placeholder="shreeganesh@okaxis"
                  value={upiId}
                  onChange={(e) => {
                    setGatewayErrors((prev) => ({ ...prev, upiId: undefined }));
                    setUpiId(e.target.value);
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                    gatewayErrors.upiId ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-300 focus:ring-blue-500'
                  }`}
                />
                {gatewayErrors.upiId ? (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{gatewayErrors.upiId}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Direct counter UPI handle for customer scans.
                  </p>
                )}
              </div>

              {/* Receipt Number Prefix */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Receipt Number Prefix</span>
                  <span className="text-[10px] text-slate-400">Max 5 characters</span>
                </label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="SGX-"
                  value={receiptPrefix}
                  onChange={(e) => setReceiptPrefix(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400">
                  Formatted on customer receipts (e.g. {receiptPrefix || 'SGX-'}1024)
                </p>
              </div>



              {/* Auto Capture setting */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-800 block">Payment Capture Behavior</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoCapture"
                    checked={autoCapture}
                    onChange={(e) => setAutoCapture(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="autoCapture" className="text-xs text-slate-700 cursor-pointer">
                    <span className="font-semibold block">Auto-capture Payments</span>
                    <span className="text-[11px] text-slate-500 block">Immediately capture authorized customer UPI and card charges.</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={testingConnection || isSavingGateway}
                onClick={handleTestConnection}
                className="w-full sm:w-auto gap-1.5"
              >
                <RotateCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>{testingConnection ? 'Testing Gateway Handshake...' : 'Test Connection'}</span>
              </Button>

              <Button
                variant="solid"
                size="sm"
                disabled={isSavingGateway || testingConnection}
                type="submit"
                className="w-full sm:w-auto gap-1.5"
              >
                {isSavingGateway ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Credentials...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Save Gateway Settings</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: BUSINESS PROFILE */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Shop Profile &amp; Business Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize shop information displayed on customer QR ordering portals and order receipts.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="p-5 space-y-5">
            {profileSaved && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Shop profile details updated successfully.</span>
              </div>
            )}

            {/* Consistent Two-Column Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Shop Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Shop Name <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-400">Display name</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => {
                    setProfileErrors((prev) => ({ ...prev, name: '' }));
                    setProfileForm({ ...profileForm, name: e.target.value });
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                    profileErrors.name ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-300 focus:ring-blue-500'
                  }`}
                />
                {profileErrors.name && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{profileErrors.name}</span>
                  </p>
                )}
              </div>

              {/* Public Slug with Auto-generate */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Public URL Slug <span className="text-red-500">*</span></span>
                  <button
                    type="button"
                    onClick={handleAutoSlug}
                    className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Auto-generate
                  </button>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-mono">
                    /s/
                  </div>
                  <input
                    type="text"
                    required
                    value={profileForm.slug}
                    onChange={(e) => {
                      setProfileErrors((prev) => ({ ...prev, slug: '' }));
                      setProfileForm({ ...profileForm, slug: e.target.value.toLowerCase() });
                    }}
                    className={`w-full pl-8 pr-3 py-2 bg-white border rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 ${
                      profileErrors.slug ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                </div>
                {profileErrors.slug ? (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{profileErrors.slug}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Customer portal: <span className="font-mono text-slate-600">https://printflow.app/s/{profileForm.slug || 'slug'}</span>
                  </p>
                )}
              </div>

              {/* Owner Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Owner Mobile Phone <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-400">10 digits</span>
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={profileForm.phone}
                  onChange={(e) => {
                    setProfileErrors((prev) => ({ ...prev, phone: '' }));
                    setProfileForm({ ...profileForm, phone: e.target.value.replace(/\D/g, '') });
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 ${
                    profileErrors.phone ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-300 focus:ring-blue-500'
                  }`}
                />
                {profileErrors.phone && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{profileErrors.phone}</span>
                  </p>
                )}
              </div>

              {/* Owner Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Owner Email <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-400">Account notifications</span>
                </label>
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) => {
                    setProfileErrors((prev) => ({ ...prev, email: '' }));
                    setProfileForm({ ...profileForm, email: e.target.value });
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                    profileErrors.email ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-300 focus:ring-blue-500'
                  }`}
                />
                {profileErrors.email && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{profileErrors.email}</span>
                  </p>
                )}
              </div>

              {/* Physical Address */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">Physical Counter Address</label>
                <input
                  type="text"
                  placeholder="e.g. Shop #4, University Complex, Central Road"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400">
                  Helps walk-in students and customers identify your counter location.
                </p>
              </div>

              {/* Business Hours */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">Business Hours</label>
                <input
                  type="text"
                  placeholder="9:00 AM - 9:00 PM (Mon-Sat)"
                  value={profileForm.businessHours}
                  onChange={(e) => setProfileForm({ ...profileForm, businessHours: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400">
                  Displayed on the customer tracking page.
                </p>
              </div>

              {/* Platform Fee Information (Replaces Minimum Order Amount per spec) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">Platform Fee Structure</label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-800">PrintFlow Take-rate:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      0% (Direct Settlement)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Zero platform deductions on counter jobs. 100% of order totals are collected directly by your shop.
                  </p>
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button
                variant="solid"
                size="sm"
                type="submit"
                disabled={isSavingProfile}
                className="gap-1.5"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Shop Profile</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 4. MODE SWITCH CONFIRMATION MODAL */}
      {pendingModeSwitch && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">Switch Gateway Mode?</h3>
                  <span className="text-[11px] font-normal text-slate-500">Live Collection Interruption Warning</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingModeSwitch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>
                You are switching your payment gateway from <strong className="text-slate-900">Live Production</strong> to <strong className="text-amber-800">Sandbox Test</strong> mode.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <p className="font-semibold text-amber-950">Customer Impact:</p>
                <p className="text-[11px] text-amber-800">
                  Real customers scanning your counter QR code will not be able to complete live UPI or card payments while in Sandbox Test mode.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingModeSwitch(null)}
              >
                Keep Live Production
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmModeSwitch}
              >
                Confirm Switch to Test
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
