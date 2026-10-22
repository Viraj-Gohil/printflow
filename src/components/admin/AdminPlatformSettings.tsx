import React, { useState, useEffect } from 'react';
import { useApp } from '../../lib/store';
import { apiUrl } from '../../lib/apiConfig';
import {
  Sliders,
  Building2,
  Shield,
  Bell,
  HardDrive,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Save,
  Key,
  ExternalLink,
  ChevronRight,
  Settings,
  Mail,
  Smartphone,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Lock,
  RefreshCw
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

export const AdminPlatformSettings: React.FC = () => {
  const { adminRazorpay, platformPolicies, updatePlatformPolicies, navigate, showToast } = useApp();

  // Branding & General
  const [platformName, setPlatformName] = useState('PrintFlow Cloud SaaS');
  const [supportEmail, setSupportEmail] = useState('support@printflow.in');
  const [supportPhone, setSupportPhone] = useState('+91 98250 12345');
  const [systemTagline, setSystemTagline] = useState('Touchless QR Xerox & Print Automation Engine');

  // Tenant Policies
  const [defaultRetentionHours, setDefaultRetentionHours] = useState(platformPolicies.defaultFileRetentionHours || 48);
  const [maxUploadSizeMb, setMaxUploadSizeMb] = useState(platformPolicies.maxAllowedUploadSizeMb || 50);
  const [autoApproveShops, setAutoApproveShops] = useState(true);
  const [allowShopCustomGateways, setAllowShopCustomGateways] = useState(true);

  // Notification Gateways
  const [emailGatewayEnabled, setEmailGatewayEnabled] = useState(true);
  const [smsGatewayEnabled, setSmsGatewayEnabled] = useState(true);
  const [whatsappNotifications, setWhatsappNotifications] = useState(true);

  // Maintenance mode
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceNotice, setMaintenanceNotice] = useState('Scheduled system maintenance in progress. Printing will resume shortly.');
  const [maintenanceScope, setMaintenanceScope] = useState<'entire_application' | 'customer_facing' | 'shop_owner'>('entire_application');
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/admin/maintenance'), {
      headers: {
        'Authorization': 'Bearer admin_token_active',
        'X-User-Role': 'ADMIN'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.maintenance) {
          setMaintenanceMode(Boolean(data.maintenance.enabled));
          if (data.maintenance.message) setMaintenanceNotice(data.maintenance.message);
          if (data.maintenance.scope) setMaintenanceScope(data.maintenance.scope);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveMaintenance = async () => {
    setIsSavingMaintenance(true);
    try {
      const res = await fetch(apiUrl('/api/admin/maintenance'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token_active',
          'X-User-Role': 'ADMIN'
        },
        body: JSON.stringify({
          enabled: maintenanceMode,
          scope: maintenanceScope,
          message: maintenanceNotice
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save maintenance state.');
      }
      showToast('Maintenance Mode Updated', maintenanceMode ? 'System is now in MAINTENANCE MODE.' : 'Maintenance Mode disabled successfully.', maintenanceMode ? 'error' : 'success', 4000);
    } catch (err: any) {
      showToast('Save Failed', err?.message || 'Could not update maintenance mode.', 'error', 5000);
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  // Webhook
  const [webhookCopied, setWebhookCopied] = useState(false);
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/platform-master` : 'https://api.printflow.in/api/webhooks/platform-master';

  const handleSavePolicies = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPolicies(true);
    setTimeout(() => {
      updatePlatformPolicies({
        defaultFileRetentionHours: Number(defaultRetentionHours),
        maxAllowedUploadSizeMb: Number(maxUploadSizeMb)
      });
      setIsSavingPolicies(false);
      showToast('Platform Settings Saved', 'Global platform parameters have been updated successfully.', 'success');
    }, 300);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    showToast('Webhook Copied', 'Platform master webhook URL copied to clipboard.', 'info');
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Platform</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>Configuration</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-purple-700">Platform Settings</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Platform Settings & Global Policies
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Manage white-label branding, tenant lifecycle policies, notification gateways, and maintenance status.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/settings')}
        >
          <Key className="w-3.5 h-3.5 text-purple-600" />
          <span>Master Razorpay Settings</span>
        </Button>
      </div>

      <form onSubmit={handleSavePolicies} className="space-y-6">
        {/* 2. PLATFORM IDENTITY & BRANDING */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Platform Identity & Branding</h2>
              <p className="text-xs text-slate-500">Global brand name, support channels, and customer-facing tags.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="platform-name" className="block text-xs font-semibold text-slate-800">
                Platform Brand Name
              </label>
              <input
                id="platform-name"
                type="text"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="support-email" className="block text-xs font-semibold text-slate-800">
                Official Support Email
              </label>
              <input
                id="support-email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="support-phone" className="block text-xs font-semibold text-slate-800">
                Support Phone / WhatsApp
              </label>
              <input
                id="support-phone"
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="system-tagline" className="block text-xs font-semibold text-slate-800">
                System Tagline
              </label>
              <input
                id="system-tagline"
                type="text"
                value={systemTagline}
                onChange={(e) => setSystemTagline(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all"
              />
            </div>
          </div>
        </div>

        {/* 3. TENANT POLICIES & STORAGE LIMITS */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Tenant Policies & Storage Limits</h2>
              <p className="text-xs text-slate-500">Configure file retention hours, upload ceilings, and shop privileges.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="retention-hours" className="block text-xs font-semibold text-slate-800">
                Default PDF / Document Retention (Hours)
              </label>
              <input
                id="retention-hours"
                type="number"
                min={1}
                max={168}
                value={defaultRetentionHours}
                onChange={(e) => setDefaultRetentionHours(Number(e.target.value))}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Customer files are securely purged by background cleanup jobs after this duration.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="max-upload-mb" className="block text-xs font-semibold text-slate-800">
                Maximum Upload Size (MB)
              </label>
              <input
                id="max-upload-mb"
                type="number"
                min={5}
                max={250}
                value={maxUploadSizeMb}
                onChange={(e) => setMaxUploadSizeMb(Number(e.target.value))}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Hard ceiling for single customer document uploads across all shop portals.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={autoApproveShops}
                onChange={(e) => setAutoApproveShops(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 border-slate-300 focus:ring-purple-500 mt-0.5 cursor-pointer"
              />
              <div>
                <span className="font-semibold text-slate-900 block">Auto-approve newly registered shops</span>
                <span className="text-slate-500 text-[11px]">Allow newly registered xerox shop operators to start accepting orders immediately without manual super admin vetting.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={allowShopCustomGateways}
                onChange={(e) => setAllowShopCustomGateways(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 border-slate-300 focus:ring-purple-500 mt-0.5 cursor-pointer"
              />
              <div>
                <span className="font-semibold text-slate-900 block">Allow shop owners to configure custom Razorpay gateways</span>
                <span className="text-slate-500 text-[11px]">Permit individual tenants to connect their own merchant API keys for direct customer payouts.</span>
              </div>
            </label>
          </div>
        </div>

        {/* 4. NOTIFICATION & MESSAGING GATEWAYS */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Notification & Messaging Gateways</h2>
              <p className="text-xs text-slate-500">Configure email dispatch, SMS alerts, and WhatsApp messaging integrations.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-semibold text-slate-800">Email Dispatch</span>
              </div>
              <button
                type="button"
                onClick={() => setEmailGatewayEnabled(!emailGatewayEnabled)}
                className="cursor-pointer text-purple-600"
              >
                {emailGatewayEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-semibold text-slate-800">SMS Gateway</span>
              </div>
              <button
                type="button"
                onClick={() => setSmsGatewayEnabled(!smsGatewayEnabled)}
                className="cursor-pointer text-purple-600"
              >
                {smsGatewayEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-semibold text-slate-800">WhatsApp Alerts</span>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappNotifications(!whatsappNotifications)}
                className="cursor-pointer text-purple-600"
              >
                {whatsappNotifications ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="solid"
            size="md"
            disabled={isSavingPolicies}
            className="bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-500"
          >
            {isSavingPolicies ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Platform Policies</span>
          </Button>
        </div>
      </form>

      {/* 5. SYSTEM MAINTENANCE MODE */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">System Maintenance Mode</h2>
            <p className="text-xs text-slate-500">Temporarily suspend customer print ordering and display maintenance notices.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <div>
              <span className="text-xs font-semibold text-slate-900 block">Enable Maintenance Mode</span>
              <span className="text-[11px] text-slate-500">When enabled, customer portals display the maintenance notice.</span>
            </div>
            <button
              type="button"
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className="cursor-pointer text-purple-600"
            >
              {maintenanceMode ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-slate-400" />}
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="maintenance-notice" className="block text-xs font-semibold text-slate-800">
              Maintenance Notice Message
            </label>
            <textarea
              id="maintenance-notice"
              rows={2}
              value={maintenanceNotice}
              onChange={(e) => setMaintenanceNotice(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant={maintenanceMode ? 'danger' : 'solid'}
              size="sm"
              disabled={isSavingMaintenance}
              onClick={handleSaveMaintenance}
              className={!maintenanceMode ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              {isSavingMaintenance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{maintenanceMode ? 'Apply Maintenance Mode' : 'Disable Maintenance Mode'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 6. PLATFORM MASTER WEBHOOK INFORMATION */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Platform Master Webhook Endpoint</h2>
            <p className="text-xs text-slate-500">Configured webhook ingestion endpoint for Razorpay platform-wide events.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={webhookUrl}
            className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 select-all"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={copyWebhook}
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>{webhookCopied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
