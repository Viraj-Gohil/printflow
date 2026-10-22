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
  Lock,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { apiUrl } from '../../lib/apiConfig';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

export const AdminSettings: React.FC = () => {
  const { adminRazorpay, updateAdminRazorpay, showToast, navigate } = useApp();

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

  const webhookEndpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/razorpay` : 'https://api.printflow.in/api/webhooks/razorpay';

  // Load authoritative platform config from backend on mount
  useEffect(() => {
    fetch(apiUrl('/api/payment/platform-config'), {
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

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookEndpoint);
    setWebhookCopied(true);
    showToast('Webhook Copied', 'Razorpay webhook endpoint copied to clipboard.', 'info');
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    if (testingConnection) return;
    setTestingConnection(true);
    setTestResult(null);

    try {
      const res = await fetch(apiUrl('/api/payment/platform-config/test'), {
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
      showToast('Gateway Handshake', data.message || 'Connection verified successfully', res.ok && data.success ? 'success' : 'error');
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error verifying gateway'
      });
      showToast('Gateway Handshake Failed', err.message, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveRazorpay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(apiUrl('/api/payment/platform-config'), {
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
      showToast('Save Failed', err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Platform</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>Billing</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-purple-700">Master Razorpay Settings</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Platform SaaS Razorpay Gateway
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Master Razorpay API keys used to collect monthly and yearly software subscription fees from xerox shop tenants.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/platform-settings')}
        >
          <span>Global Platform Policies</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </Button>
      </div>

      {/* 2. RAZORPAY CONFIGURATION FORM */}
      <form onSubmit={handleSaveRazorpay} className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-purple-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Razorpay Master Credentials</h2>
                <Chip variant="special" size="sm">
                  SUBSCRIPTION BILLING
                </Chip>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Encrypted at rest using AES-256-GCM via MASTER_ENCRYPTION_KEY.
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
        <div className="bg-slate-50/80 px-5 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-slate-400 font-medium">Provider:</span>{' '}
              <strong className="text-slate-800 uppercase">{platformMeta?.provider || 'Razorpay'}</strong>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Status:</span>{' '}
              <span className={platformMeta?.isConfigured ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                {platformMeta?.isConfigured ? '● Configured & Active' : '○ Not Configured'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Last Updated:</span>{' '}
              <span className="font-mono text-slate-700">
                {platformMeta?.lastUpdatedAt ? new Date(platformMeta.lastUpdatedAt).toLocaleString('en-IN') : 'Never'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              {platformMeta?.hasSecret ? 'Secret Key Secured 🔒' : 'Secret Required'}
            </span>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Platform Razorpay configuration updated and securely saved to database.</span>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Integration Mode */}
            <div className="space-y-1.5">
              <label htmlFor="integration-mode" className="block text-xs font-semibold text-slate-800">
                Integration Mode
              </label>
              <select
                id="integration-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'test' | 'live')}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
              >
                <option value="test">Sandbox Test Mode (rzp_test_...)</option>
                <option value="live">Live Production (rzp_live_...)</option>
              </select>
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <label htmlFor="currency-select" className="block text-xs font-semibold text-slate-800">
                Billing Currency
              </label>
              <select
                id="currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'INR' | 'USD')}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
              >
                <option value="INR">INR (₹ - Indian Rupee)</option>
                <option value="USD">USD ($ - US Dollar)</option>
              </select>
            </div>
          </div>

          {/* Key ID */}
          <div className="space-y-1.5">
            <label htmlFor="razorpay-key-id" className="block text-xs font-semibold text-slate-800">
              Razorpay Key ID <span className="text-red-500">*</span>
            </label>
            <input
              id="razorpay-key-id"
              type="text"
              placeholder="rzp_live_..."
              value={keyIdInput}
              onChange={(e) => setKeyIdInput(e.target.value)}
              className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
            />
            <p className="text-[11px] text-slate-500">Public identifier safe for client-side checkout embedding.</p>
          </div>

          {/* Key Secret */}
          <div className="space-y-1.5">
            <label htmlFor="razorpay-key-secret" className="block text-xs font-semibold text-slate-800">
              Razorpay Key Secret (Replacement)
            </label>
            <div className="relative">
              <input
                id="razorpay-key-secret"
                type={showSecret ? 'text' : 'password'}
                placeholder={platformMeta?.hasSecret ? '•••••••••••••••• (Stored Securely)' : 'Enter new secret key'}
                value={replaceSecret}
                onChange={(e) => setReplaceSecret(e.target.value)}
                className="w-full h-10 pl-3.5 pr-10 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Leave empty to keep the existing stored master secret unchanged.</p>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-1.5">
            <label htmlFor="webhook-secret" className="block text-xs font-semibold text-slate-800">
              Webhook Signing Secret
            </label>
            <input
              id="webhook-secret"
              type="text"
              placeholder="whsec_..."
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
            />
          </div>

          {/* Gateway Actions */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testingConnection}
                onClick={handleTestConnection}
                className="w-full sm:w-auto"
              >
                {testingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                <span>{testingConnection ? 'Testing Connection...' : 'Test Gateway Connection'}</span>
              </Button>
            </div>

            <Button
              type="submit"
              variant="solid"
              size="sm"
              disabled={isSaving}
              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-500"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaving ? 'Encrypting & Saving...' : 'Save Gateway Configuration'}</span>
            </Button>
          </div>

          {/* Test Result Banner */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
              <div>
                <p className="font-semibold">{testResult.success ? 'Gateway Connection Verified' : 'Gateway Handshake Failed'}</p>
                <p className="text-[11px] mt-0.5 opacity-90">{testResult.message} {testResult.latencyMs ? `(${testResult.latencyMs}ms)` : ''}</p>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* 3. PLATFORM WEBHOOK ENDPOINT CARD */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Razorpay Webhook Endpoint</h3>
            <p className="text-xs text-slate-500 mt-0.5">Register this URL in your Razorpay dashboard for automated subscription invoices.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copyWebhookUrl}
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>{webhookCopied ? 'Copied' : 'Copy URL'}</span>
          </Button>
        </div>
        <input
          type="text"
          readOnly
          value={webhookEndpoint}
          className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all"
        />
      </div>
    </div>
  );
};
