import React, { useState, useEffect } from 'react';
import { useApp } from '../../lib/store';
import {
  CreditCard,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Save,
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
  Lock
} from 'lucide-react';
import { ShopRazorpaySettings } from '../../types';
import {
  validateShopName,
  validateEmail,
  validatePhone,
  validateUpiId,
  validatePositivePrice
} from '../../lib/validation';

export const ShopSettings: React.FC = () => {
  const { activeShop, updateShopRazorpay, updateShopProfile, showToast } = useApp();

  // Server persisted shop payment integration metadata
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
  const [mode, setMode] = useState<'test' | 'live'>(activeShop.razorpaySettings?.isTestMode ? 'test' : 'live');
  const [upiId, setUpiId] = useState(activeShop.razorpaySettings?.upiId || '');
  const [autoCapture, setAutoCapture] = useState(activeShop.razorpaySettings?.autoCapture ?? true);
  const [receiptPrefix, setReceiptPrefix] = useState(activeShop.razorpaySettings?.receiptPrefix || 'SGX-');
  const [webhookSecret, setWebhookSecret] = useState(activeShop.razorpaySettings?.webhookSecret || '');
  const [isEnabled, setIsEnabled] = useState(activeShop.razorpaySettings?.enabled ?? true);

  const [showSecret, setShowSecret] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [upiError, setUpiError] = useState<string | null>(null);

  // Load shop integration from backend
  useEffect(() => {
    if (!activeShop?.id) return;
    fetch(`/api/shop/${activeShop.id}/payment-settings`, {
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

  // Shop Profile form state
  const [profileForm, setProfileForm] = useState({
    name: activeShop.name,
    slug: activeShop.slug,
    phone: activeShop.ownerPhone,
    email: activeShop.ownerEmail,
    address: activeShop.address,
    city: activeShop.city,
    businessHours: activeShop.businessHours,
    minimumOrder: activeShop.minimumOrder,
    primaryColor: activeShop.primaryColor
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileSaved, setProfileSaved] = useState(false);

  // Test Razorpay connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    if (!keyIdInput.trim()) {
      setTestResult({
        success: false,
        message: 'Payment Gateway Key ID cannot be empty. Please enter your valid Key ID.'
      });
      setTestingConnection(false);
      return;
    }

    if (!keyIdInput.startsWith('rzp_test_') && !keyIdInput.startsWith('rzp_live_')) {
      setTestResult({
        success: false,
        message: 'Invalid Key ID format. Key IDs must start with rzp_test_ or rzp_live_'
      });
      setTestingConnection(false);
      return;
    }

    try {
      const res = await fetch('/api/payment/platform-config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token_active',
          'X-User-Role': 'SHOP_OWNER'
        },
        body: JSON.stringify({
          keyId: keyIdInput.trim(),
          keySecret: replaceSecret.trim() || undefined
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
      setTestResult({
        success: Boolean(res.ok && data.success),
        message: data.message || `Credentials verified for ${mode === 'live' ? 'Live Production' : 'Test Sandbox'} mode.`
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || `Key format check (${mode === 'live' ? 'Live Production' : 'Sandbox Test'}).`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Save Razorpay settings with strict validation
  const handleSaveRazorpay = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpiError(null);
    setSaveError(null);
    setSaveSuccess(false);

    if (upiId && upiId.trim()) {
      const upiCheck = validateUpiId(upiId.trim(), false);
      if (!upiCheck.isValid) {
        setUpiError(upiCheck.error || 'Invalid UPI ID format.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/shop/${activeShop.id}/payment-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token_active',
          'X-Shop-Id': activeShop.id,
          'X-User-Role': 'SHOP_OWNER'
        },
        body: JSON.stringify({
          keyId: keyIdInput.trim(),
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
      showToast('Shop Gateway Saved', 'Credentials encrypted with AES-256-GCM and saved.', 'success', 3500);

      updateShopRazorpay(activeShop.id, {
        enabled: isEnabled,
        isTestMode: mode === 'test',
        keyId: keyIdInput.trim(),
        keySecret: '', // Never store plaintext secret
        upiId: upiId.trim(),
        autoCapture,
        receiptPrefix: receiptPrefix.trim(),
        lastVerifiedAt: data.config?.lastUpdatedAt || new Date().toISOString()
      });

      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Network error saving shop gateway.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save Shop Profile with strict validation
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    const nameCheck = validateShopName(profileForm.name);
    if (!nameCheck.isValid) errors.name = nameCheck.error || 'Invalid shop name.';

    if (!profileForm.slug.trim() || profileForm.slug.trim().length < 3) {
      errors.slug = 'Slug must be at least 3 characters.';
    }

    const emailCheck = validateEmail(profileForm.email);
    if (!emailCheck.isValid) errors.email = emailCheck.error || 'Invalid email address.';

    const phoneCheck = validatePhone(profileForm.phone, false);
    if (!phoneCheck.isValid) errors.phone = phoneCheck.error || 'Invalid mobile number.';

    const minOrder = Number(profileForm.minimumOrder);
    if (isNaN(minOrder) || minOrder < 1 || minOrder > 500) {
      errors.minimumOrder = 'Minimum order must be between ₹1 and ₹500.';
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    setProfileErrors({});
    updateShopProfile(activeShop.id, {
      name: profileForm.name.trim(),
      slug: profileForm.slug.trim().toLowerCase(),
      ownerPhone: profileForm.phone.trim(),
      ownerEmail: profileForm.email.trim(),
      address: profileForm.address.trim(),
      city: profileForm.city.trim(),
      businessHours: profileForm.businessHours.trim(),
      minimumOrder: minOrder,
      primaryColor: profileForm.primaryColor
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* SECTION 1: SHOP OWNER ONLINE PAYMENT GATEWAY CONFIGURATION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Shop Online Payment Gateway</h2>
              <p className="text-xs text-slate-500">
                Configure payment gateway credentials so customer print payments land directly in your bank account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                mode === 'test'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {mode === 'test' ? 'TEST / SANDBOX MODE' : 'LIVE PRODUCTION'}
            </span>
          </div>
        </div>

        {/* Shop Integration Metadata Banner */}
        <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400">Provider:</span>{' '}
              <span className="font-semibold text-slate-800">Razorpay (Shop Gateway)</span>
            </div>
            <div>
              <span className="text-slate-400">Integration:</span>{' '}
              <span className={`font-semibold ${shopMeta?.isConfigured ? 'text-emerald-700' : 'text-slate-500'}`}>
                {shopMeta?.isConfigured ? 'Active & Isolated' : 'Using Platform Default'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Secret Encryption:</span>{' '}
              <span className="font-semibold text-blue-700">AES-256-GCM Authenticated</span>
            </div>
          </div>
          {shopMeta?.lastUpdatedAt && (
            <div className="text-[11px] text-slate-500">
              Last saved: {new Date(shopMeta.lastUpdatedAt).toLocaleString()}
            </div>
          )}
        </div>

        <form onSubmit={handleSaveRazorpay} className="p-6 space-y-6">
          {saveSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Shop payment gateway credentials verified and encrypted in PostgreSQL.</span>
            </div>
          )}

          {saveError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Configuration Error</p>
                <p className="mt-0.5">{saveError}</p>
              </div>
            </div>
          )}

          {testResult && (
            <div
              className={`p-4 rounded-xl text-xs flex items-start gap-2.5 border ${
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
                <p className="font-semibold">{testResult.success ? 'Verification Passed' : 'Connection Failed'}</p>
                <p className="mt-0.5">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="razorpayMode"
                checked={mode === 'test'}
                onChange={() => setMode('test')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Test Mode (Recommended for testing)</span>
                <span className="text-[11px] text-slate-500">Uses test API keys starting with `rzp_test_`</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="razorpayMode"
                checked={mode === 'live'}
                onChange={() => setMode('live')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Live Production Mode</span>
                <span className="text-[11px] text-slate-500">Real customer money directly to your shop bank account</span>
              </div>
            </label>
          </div>

          {/* Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Gateway Key ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Gateway Key ID *</span>
                <span className="text-[11px] text-slate-400">e.g. {mode === 'live' ? 'rzp_live_...' : 'rzp_test_...'}</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder={mode === 'live' ? 'rzp_live_xxxxxxxxxxxxxx' : 'rzp_test_xxxxxxxxxxxxxx'}
                  value={keyIdInput}
                  onChange={(e) => setKeyIdInput(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
              <p className="text-[11px] text-slate-500">
                Merchant API Key ID for instant online payments
              </p>
            </div>

            {/* Dedicated Replace Key Secret Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Gateway Key Secret</span>
                <span className="text-[11px] text-slate-400">
                  {shopMeta?.hasSecret ? 'Secret Saved in Vault' : 'Required for Initial Setup'}
                </span>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  placeholder={
                    shopMeta?.hasSecret
                      ? '•••••••••••• (Leave blank to keep existing stored secret)'
                      : 'Enter Razorpay Key Secret'
                  }
                  value={replaceSecret}
                  onChange={(e) => setReplaceSecret(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-2.5 cursor-pointer"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-blue-600" />
                <span>Encrypted at rest with AES-256-GCM. Never returned to frontend.</span>
              </p>
            </div>

            {/* Shop UPI ID / VPA */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Shop UPI ID / VPA</span>
                <span className="text-[11px] text-slate-400">For direct QR display</span>
              </label>
              <input
                type="text"
                placeholder="shreeganeshxerox@okaxis"
                value={upiId}
                onChange={(e) => {
                  setUpiError(null);
                  setUpiId(e.target.value);
                }}
                className={`w-full px-3 py-2.5 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                  upiError ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
              {upiError ? (
                <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{upiError}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Customers can also scan this UPI ID directly at the counter
                </p>
              )}
            </div>

            {/* Receipt Prefix */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Receipt Number Prefix</span>
                <span className="text-[11px] text-slate-400">Max 5 chars</span>
              </label>
              <input
                type="text"
                placeholder="SGX-"
                maxLength={5}
                value={receiptPrefix}
                onChange={(e) => setReceiptPrefix(e.target.value.toUpperCase())}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-500">
                Prefix appended to order receipts (e.g. {receiptPrefix || 'SGX-'}1024)
              </p>
            </div>
          </div>

          {/* Webhook Secret & Auto Capture */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Webhook Secret (Optional)</label>
              <input
                type="text"
                placeholder="whsec_xxxxxxxxxxxxx"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="autoCapture"
                checked={autoCapture}
                onChange={(e) => setAutoCapture(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="autoCapture" className="text-xs text-slate-700 cursor-pointer">
                <strong>Auto-capture Payments</strong>
                <span className="block text-[11px] text-slate-500">Immediately capture authorized UPI & card charges</span>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              disabled={testingConnection}
              onClick={handleTestConnection}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>{testingConnection ? 'Testing Connection...' : 'Test Gateway Connection'}</span>
            </button>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Gateway Keys</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: SHOP PROFILE & BRANDING */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Shop Profile & Business Details</h2>
            <p className="text-xs text-slate-500">
              Customize shop information shown to customers on the QR ordering portal.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
          {profileSaved && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Shop profile details updated successfully!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Shop Name <span className="text-red-500">*</span>
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

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Public Slug (/s/[slug]) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profileForm.slug}
                onChange={(e) => {
                  setProfileErrors((prev) => ({ ...prev, slug: '' }));
                  setProfileForm({ ...profileForm, slug: e.target.value });
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 ${
                  profileErrors.slug ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
              {profileErrors.slug && (
                <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{profileErrors.slug}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Owner Phone (10 Digits)</label>
              <input
                type="tel"
                maxLength={10}
                value={profileForm.phone}
                onChange={(e) => {
                  setProfileErrors((prev) => ({ ...prev, phone: '' }));
                  setProfileForm({ ...profileForm, phone: e.target.value.replace(/\D/g, '') });
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 font-mono ${
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

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Owner Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
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

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Physical Address</label>
              <input
                type="text"
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Business Hours</label>
              <input
                type="text"
                value={profileForm.businessHours}
                onChange={(e) => setProfileForm({ ...profileForm, businessHours: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Minimum Order Amount (₹)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={profileForm.minimumOrder}
                onChange={(e) => {
                  setProfileErrors((prev) => ({ ...prev, minimumOrder: '' }));
                  setProfileForm({ ...profileForm, minimumOrder: Number(e.target.value) });
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 ${
                  profileErrors.minimumOrder ? 'border-red-400 focus:ring-red-400 bg-red-50/20' : 'border-slate-300 focus:ring-blue-500'
                }`}
              />
              {profileErrors.minimumOrder && (
                <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{profileErrors.minimumOrder}</span>
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Shop Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
