import React, { useState } from 'react';
import { useApp } from '../../lib/store';
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
  ToggleRight
} from 'lucide-react';

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

  // Webhook
  const [webhookCopied, setWebhookCopied] = useState(false);
  const webhookUrl = 'https://api.printflow.in/api/webhooks/platform-master';

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSavePolicies = (e: React.FormEvent) => {
    e.preventDefault();
    updatePlatformPolicies({
      defaultFileRetentionHours: Number(defaultRetentionHours),
      maxAllowedUploadSizeMb: Number(maxUploadSizeMb)
    });
    setSavedSuccess(true);
    showToast('Platform Settings Saved', 'Global platform parameters have been updated successfully.', 'success');
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Platform</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>Configuration</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="font-semibold text-purple-700">Platform Settings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Platform Settings & Global Policies
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage white-label branding, tenant lifecycle policies, notification gateways, and maintenance status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/settings')}
            className="px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-purple-600" />
            <span>Master Razorpay Settings</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSavePolicies} className="space-y-6">
        {/* Section 1: Branding & Identity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Platform Identity & Branding</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Platform Brand Name</label>
              <input
                type="text"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">System Tagline</label>
              <input
                type="text"
                value={systemTagline}
                onChange={(e) => setSystemTagline(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Official Support Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Support Phone / WhatsApp</label>
              <input
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Global Tenant Policies */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <HardDrive className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Tenant Policies & Storage Ceilings</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Default PDF/Doc Retention (Hours)
              </label>
              <input
                type="number"
                value={defaultRetentionHours}
                onChange={(e) => setDefaultRetentionHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Files are automatically purged from secure storage after this duration.
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Max Allowed Upload Size (MB)
              </label>
              <input
                type="number"
                value={maxUploadSizeMb}
                onChange={(e) => setMaxUploadSizeMb(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Platform-level file upload safety cap.
              </span>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={autoApproveShops}
                onChange={(e) => setAutoApproveShops(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
              <span className="text-slate-800 font-medium">
                Auto-approve newly registered shops into Free Starter plan immediately
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={allowShopCustomGateways}
                onChange={(e) => setAllowShopCustomGateways(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
              <span className="text-slate-800 font-medium">
                Allow shop owners to configure their custom merchant Razorpay API keys
              </span>
            </label>
          </div>
        </div>

        {/* Section 3: Notification Gateways */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Bell className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Notification & Messaging Gateways</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-purple-600" />
                  Email Dispatch
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Transactional order receipts & renewal notices
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEmailGatewayEnabled(!emailGatewayEnabled)}
                className={`p-1 rounded cursor-pointer ${
                  emailGatewayEnabled ? 'text-purple-600' : 'text-slate-400'
                }`}
              >
                {emailGatewayEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  SMS Gateway
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  OTP login & order ready SMS alerts
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSmsGatewayEnabled(!smsGatewayEnabled)}
                className={`p-1 rounded cursor-pointer ${
                  smsGatewayEnabled ? 'text-purple-600' : 'text-slate-400'
                }`}
              >
                {smsGatewayEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-blue-600" />
                  WhatsApp Alerts
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  QR pickup notifications
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappNotifications(!whatsappNotifications)}
                className={`p-1 rounded cursor-pointer ${
                  whatsappNotifications ? 'text-purple-600' : 'text-slate-400'
                }`}
              >
                {whatsappNotifications ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: Maintenance Mode */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900">System Maintenance Mode</h3>
            </div>
            <button
              type="button"
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`p-1 rounded cursor-pointer ${
                maintenanceMode ? 'text-rose-600' : 'text-slate-400'
              }`}
            >
              {maintenanceMode ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>

          <p className="text-xs text-slate-600">
            When enabled, customer print uploads will show a temporary maintenance banner. Platform admins remain authenticated.
          </p>

          {maintenanceMode && (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Broadcast Maintenance Message
              </label>
              <input
                type="text"
                value={maintenanceNotice}
                onChange={(e) => setMaintenanceNotice(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-rose-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}
        </div>

        {/* Section 5: Master Webhook Configuration */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Key className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Platform Master Webhook Endpoint</h3>
          </div>

          <div className="space-y-2 text-xs">
            <span className="text-slate-600 block">
              Configure this webhook URL in your Master Razorpay Dashboard to listen for platform-level subscription events:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800"
              />
              <button
                type="button"
                onClick={copyWebhook}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {webhookCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{webhookCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Platform settings updated successfully!</span>
            </div>
          )}
          <button
            type="submit"
            className="ml-auto px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Platform Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
