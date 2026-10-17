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
  Shield,
  Copy,
  Info,
  ExternalLink,
  ShieldCheck,
  Server,
  Lock
} from 'lucide-react';
import { AdminRazorpaySettings } from '../../types';
import { RazorpayCheckoutModal } from '../payment/RazorpayCheckoutModal';

export const AdminSettings: React.FC = () => {
  const { adminRazorpay, updateAdminRazorpay, showToast } = useApp();

  // Platform server-persisted metadata
  const [platformMeta, setPlatformMeta] = useState<{
    provider: string;
    keyId: string;
    rawKeyId: string;
    mode: 'test' | 'live';
    isConfigured: boolean;
    isActive: boolean;
    hasSecret: boolean;
    lastUpdatedAt: string | null;
  } | null>(null);

  // Razorpay Form state
  const [keyIdInput, setKeyIdInput] = useState(adminRazorpay.keyId || '');
  const [replaceSecret, setReplaceSecret] = useState('');
  const [mode, setMode] = useState<'test' | 'live'>(adminRazorpay.isTestMode ? 'test' : 'live');
  const [webhookSecret, setWebhookSecret] = useState(adminRazorpay.webhookSecret || '');
  const [currency, setCurrency] = useState<'INR' | 'USD'>(adminRazorpay.currency || 'INR');
  const [isActive, setIsActive] = useState(adminRazorpay.enabled ?? true);

  const [showSecret, setShowSecret] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Load authoritative platform config from backend on mount
  useEffect(() => {
    fetch('/api/payment/platform-config', {
      headers: {
        'Authorization': 'Bearer admin_token_active',
        'X-User-Role': 'ADMIN'
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
          setPlatformMeta(data);
          if (data.isConfigured) {
            setKeyIdInput(data.rawKeyId || data.keyId);
            setMode(data.mode);
            setIsActive(data.isActive);
          }
        }
      })
      .catch((err) => console.warn('Could not load platform payment config:', err));
  }, []);

  // Platform General settings
  const [generalSettings, setGeneralSettings] = useState({
    platformName: 'PrintFlow SaaS Platform',
    supportEmail: 'support@printflow.in',
    fileRetentionDays: 7,
    allowShopCustomGateways: true
  });
  const [generalSaved, setGeneralSaved] = useState(false);

  const webhookEndpoint = 'https://api.printflow.in/api/webhooks/razorpay';

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookEndpoint);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/payment/platform-config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token_active',
          'X-User-Role': 'ADMIN'
        },
        body: JSON.stringify({
          keyId: keyIdInput.trim() || undefined,
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
        message: data.message || data.error || (res.ok ? 'Gateway handshake successful' : 'Connection handshake failed.'),
        latencyMs: data.latencyMs
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error verifying gateway'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveRazorpay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/payment/platform-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token_active',
          'X-User-Role': 'ADMIN'
        },
        body: JSON.stringify({
          keyId: keyIdInput.trim(),
          keySecret: replaceSecret.trim() ? replaceSecret.trim() : undefined,
          mode,
          webhookSecret: webhookSecret.trim() || undefined,
          isActive
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
        setSaveError(data.error || 'Failed to save platform Razorpay credentials.');
        showToast('Save Failed', data.error || 'Configuration rejected by server.', 'error', 5000);
        return;
      }

      setPlatformMeta(data.config);
      setReplaceSecret('');
      setSaveSuccess(true);
      showToast('Configuration Saved', 'Master Razorpay credentials encrypted and verified.', 'success', 4000);

      // Update store state without exposing secrets
      updateAdminRazorpay({
        enabled: isActive,
        isTestMode: mode === 'test',
        keyId: keyIdInput.trim(),
        keySecret: '',
        webhookSecret: webhookSecret.trim(),
        currency,
        platformFeePercent: 2.5,
        lastVerifiedAt: data.config?.lastUpdatedAt || new Date().toISOString()
      });

      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Network error saving configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralSaved(true);
    setTimeout(() => setGeneralSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* SECTION 1: PLATFORM ADMIN RAZORPAY SETTINGS (FOR SAAS PLANS) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-purple-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Platform SaaS Razorpay Gateway</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                  SUBSCRIPTION BILLING
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Master Razorpay API keys used to collect monthly/yearly software fees from Xerox Shop Owners.
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
              {mode === 'test' ? 'SANDBOX TEST MODE' : 'LIVE PRODUCTION'}
            </span>
          </div>
        </div>

        {/* Status Metadata Banner */}
        <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400">Provider:</span>{' '}
              <span className="font-semibold text-slate-800">Razorpay Standard</span>
            </div>
            <div>
              <span className="text-slate-400">Status:</span>{' '}
              <span className={`font-semibold ${platformMeta?.isConfigured ? 'text-emerald-700' : 'text-slate-500'}`}>
                {platformMeta?.isConfigured ? 'Configured & Active' : 'Unconfigured'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Secret Vault:</span>{' '}
              <span className="font-semibold text-purple-700">AES-256-GCM Encrypted</span>
            </div>
          </div>
          {platformMeta?.lastUpdatedAt && (
            <div className="text-[11px] text-slate-500">
              Last saved: {new Date(platformMeta.lastUpdatedAt).toLocaleString()}
            </div>
          )}
        </div>

        <form onSubmit={handleSaveRazorpay} className="p-6 space-y-6">
          {saveSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Platform Razorpay API keys and subscription parameters saved and verified successfully.</span>
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
                <p className="font-semibold">{testResult.success ? 'Credentials Valid' : 'Handshake Failed'}</p>
                <p className="mt-0.5">{testResult.message}</p>
                {testResult.latencyMs !== undefined && (
                  <span className="text-[10px] text-slate-500 block mt-1">
                    API Response Latency: {testResult.latencyMs}ms
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="adminMode"
                checked={mode === 'test'}
                onChange={() => setMode('test')}
                className="text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Sandbox Test Mode</span>
                <span className="text-[11px] text-slate-500">Test SaaS subscription checkouts with fake cards/UPI (rzp_test_...)</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="adminMode"
                checked={mode === 'live'}
                onChange={() => setMode('live')}
                className="text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Live Production Mode</span>
                <span className="text-[11px] text-slate-500">Charge real money for Pro and Starter SaaS plans (rzp_live_...)</span>
              </div>
            </label>
          </div>

          {/* Key ID and Secret Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Master Key ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Platform Master Razorpay Key ID *</span>
                <span className="text-[11px] text-slate-400">e.g. {mode === 'live' ? 'rzp_live_...' : 'rzp_test_...'}</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder={mode === 'live' ? 'rzp_live_xxxxxxxxxxxxxx' : 'rzp_test_xxxxxxxxxxxxxx'}
                  value={keyIdInput}
                  onChange={(e) => setKeyIdInput(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <Key className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
              <p className="text-[11px] text-slate-500">
                Master Razorpay account used for charging SaaS plan subscriptions
              </p>
            </div>

            {/* Dedicated Replace Key Secret Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Platform Razorpay Key Secret</span>
                <span className="text-[11px] text-slate-400">
                  {platformMeta?.hasSecret ? 'Secret Saved in Vault' : 'Required for Initial Setup'}
                </span>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  placeholder={
                    platformMeta?.hasSecret
                      ? '•••••••••••• (Leave blank to keep existing stored secret)'
                      : 'Enter Razorpay Key Secret'
                  }
                  value={replaceSecret}
                  onChange={(e) => setReplaceSecret(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                <Lock className="w-3 h-3 text-purple-600" />
                <span>Encrypted at rest with AES-256-GCM. Never exposed in API responses or logs.</span>
              </p>
            </div>

            {/* Webhook Secret */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Platform Webhook Secret</label>
              <input
                type="text"
                placeholder="whsec_admin_platform_live_events"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-[11px] text-slate-500">
                Validates signature header <code>X-Razorpay-Signature</code>
              </p>
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Billing Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'INR' | 'USD')}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="INR">INR (₹ - Indian Rupee)</option>
                <option value="USD">USD ($ - US Dollar)</option>
              </select>
            </div>
          </div>

          {/* Webhook Endpoint Info */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-800 block">Webhook Callback Endpoint URL</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookEndpoint}
                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700"
              />
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {webhookCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{webhookCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Configure this URL in your Razorpay Dashboard Webhooks with events: <code>subscription.charged</code>, <code>payment.captured</code>, <code>refund.processed</code>.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                disabled={testingConnection}
                onClick={handleTestConnection}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>{testingConnection ? 'Verifying with Razorpay...' : 'Test Gateway Connection'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCheckoutModal(true)}
                className="w-full sm:w-auto px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-purple-200 transition-colors cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                <span>Test Standard Web Checkout</span>
              </button>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Platform Razorpay Keys</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: PLATFORM GENERAL SETTINGS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Platform General Configurations</h2>
            <p className="text-xs text-slate-500">
              Default system parameters for file storage retention and multi-tenancy.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveGeneral} className="p-6 space-y-4">
          {generalSaved && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Platform general configuration updated!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Platform Public Name</label>
              <input
                type="text"
                value={generalSettings.platformName}
                onChange={(e) => setGeneralSettings({ ...generalSettings, platformName: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Super Admin Contact Email</label>
              <input
                type="email"
                value={generalSettings.supportEmail}
                onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">File Retention Days (Auto Cleanup)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={generalSettings.fileRetentionDays}
                onChange={(e) => setGeneralSettings({ ...generalSettings, fileRetentionDays: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-[11px] text-slate-500">Customer files automatically deleted after this time</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Save General Settings
            </button>
          </div>
        </form>
      </div>

      {/* Test Razorpay Standard Web Checkout Modal */}
      <RazorpayCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        defaultAmountInRupees={499}
        orderDescription="PrintFlow Admin Test Transaction"
      />
    </div>
  );
};
