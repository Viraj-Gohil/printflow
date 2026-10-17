import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../lib/store';
import {
  LayoutDashboard,
  Printer,
  QrCode,
  SlidersHorizontal,
  CreditCard,
  Crown,
  BarChart3,
  Cpu,
  Settings,
  Menu,
  X,
  ChevronRight,
  Zap,
  LogOut,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Plus,
  Store,
  ShieldCheck
} from 'lucide-react';

interface ShopLayoutProps {
  children: React.ReactNode;
  activeTab: string;
}

export const ShopLayout: React.FC<ShopLayoutProps> = ({ children, activeTab }) => {
  const {
    activeShop,
    navigate,
    printJobs,
    currentUser,
    logout,
    plans,
    simulateCustomerPrintJob
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(true);

  const currentPlan = plans.find((p) => p.id === activeShop.planId) || plans[0];

  // Active pending jobs count for live sidebar badge
  const pendingJobsCount = printJobs.filter(
    (j) => j.shopId === activeShop.id && (j.printStatus === 'QUEUED' || j.printStatus === 'PRINTING')
  ).length;

  const navigationSections = [
    {
      title: 'Counter Operations',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          path: '/shop/dashboard'
        },
        {
          id: 'print-jobs',
          label: 'Live Print Queue',
          icon: Printer,
          path: '/shop/print-jobs',
          badge: pendingJobsCount > 0 ? `${pendingJobsCount} live` : undefined,
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-200'
        },
        {
          id: 'printers',
          label: 'Printers & Hardware',
          icon: Cpu,
          path: '/shop/printers'
        },
        {
          id: 'qr-codes',
          label: 'Tabletop QR Stands',
          icon: QrCode,
          path: '/shop/qr-codes'
        }
      ]
    },
    {
      title: 'Rates & Revenue',
      items: [
        {
          id: 'pricing',
          label: 'Pricing Rules',
          icon: SlidersHorizontal,
          path: '/shop/pricing'
        },
        {
          id: 'payments',
          label: 'Payments & Revenue',
          icon: CreditCard,
          path: '/shop/payments'
        }
      ]
    },
    {
      title: 'Settings & Tools',
      items: [
        {
          id: 'print-agent',
          label: 'Desktop Print Agent',
          icon: Zap,
          path: '/shop/print-agent'
        },
        {
          id: 'analytics',
          label: 'Performance Analytics',
          icon: BarChart3,
          path: '/shop/analytics'
        },
        {
          id: 'subscription',
          label: 'SaaS Subscription',
          icon: Crown,
          path: '/shop/subscription',
          badge: currentPlan.name.replace(' Xerox Hub', '').replace(' Starter', '').replace(' Counter', ''),
          badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
        },
        {
          id: 'settings',
          label: 'Shop Settings',
          icon: Settings,
          path: '/shop/settings'
        }
      ]
    }
  ];

  const currentTabMeta = navigationSections
    .flatMap((s) => s.items)
    .find((m) => m.id === activeTab);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col lg:flex-row">
      {/* Mobile Sticky Navigation Header Bar */}
      <div className="lg:hidden bg-white text-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-200 sticky top-16 z-40 shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm text-slate-900 truncate">Shop Console</span>
          <span className="text-slate-300 text-xs">•</span>
          <span className="text-xs text-slate-500 truncate">{currentTabMeta?.label || activeTab}</span>
        </div>

        <div className="flex items-center gap-2">
          {pendingJobsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              {pendingJobsCount} in queue
            </span>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer active:scale-95 transition-all"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* MODERN REDESIGNED SHOP CONSOLE SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white text-slate-700 flex flex-col justify-between transform transition-transform duration-200 ease-out lg:translate-x-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] border-r border-slate-200 shadow-xl lg:shadow-none overflow-hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Navigation Sections */}
        <div className="p-3.5 space-y-4 overflow-y-auto flex-1 min-h-0 pt-4">
          {/* Single Independent Shop Header (1 Shop = 1 Dedicated Account) */}
          <div className="mb-3 pb-3 border-b border-slate-100 px-1">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-bold text-slate-900 truncate" title={activeShop.name}>
                  {activeShop.name}
                </h3>
                <span className="text-[10px] text-slate-500 truncate block">
                  {activeShop.city || 'Counter Station'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Single Independent Shop
              </span>
              <span className="font-mono text-slate-400">/{activeShop.slug}</span>
            </div>
          </div>

          <nav className="space-y-4">
            {navigationSections.map((sec, secIdx) => (
              <div key={secIdx} className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 block mb-1">
                  {sec.title}
                </span>

                <div className="space-y-0.5">
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigate(item.path);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all text-left cursor-pointer group ${
                          isActive
                            ? 'text-blue-700 font-bold bg-blue-50/90 border border-blue-200/90 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono shrink-0 ${
                              isActive
                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                : item.id === 'print-jobs'
                                ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                                : item.badgeColor
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer: User Profile & Quick Sign Out */}
        <div className="shrink-0 p-3.5 border-t border-slate-200/90 bg-slate-50/80">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {(currentUser?.fullName || activeShop.ownerName || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                  {currentUser?.fullName || activeShop.ownerName}
                </p>
                <button
                  onClick={() => {
                    navigate('/shop/subscription');
                    setMobileMenuOpen(false);
                  }}
                  className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-1 truncate mt-0.5"
                >
                  <Crown className="w-2.5 h-2.5" />
                  <span>{currentPlan.name}</span>
                </button>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Sleek Breadcrumb & Action Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-semibold text-slate-600">Console</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="font-bold text-blue-700">
                {currentTabMeta?.label || activeTab}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {currentTabMeta?.label || 'Shop Console'}
              </h1>
              {activeTab === 'qr-codes' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ● QR ACTIVE
                </span>
              )}
              {activeTab === 'pricing' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Dynamic Rates Engine
                </span>
              )}
              {activeTab === 'analytics' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                  Live Business Intelligence
                </span>
              )}
            </div>
            {activeTab === 'qr-codes' && (
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Create and print your shop's QR stand so customers can upload documents and place print orders directly from their phones.
              </p>
            )}
            {activeTab === 'pricing' && (
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Configure per-page rates across standard, architectural, and custom paper sizes. Changes reflect instantly on customer mobile checkout.
              </p>
            )}
            {activeTab === 'analytics' && (
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Understand your shop's printing volume, revenue, customer demand and printer performance.
              </p>
            )}
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {import.meta.env.DEV && (
              <button
                onClick={() => simulateCustomerPrintJob()}
                className="px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Send a sample customer print order to verify live queue"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>+ Test Live Queue</span>
              </button>
            )}
            <button
              onClick={() => navigate(`/s/${activeShop.slug}`)}
              className="px-3 py-2 text-xs font-medium text-slate-700 hover:text-blue-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>Customer View</span>
            </button>
            <button
              onClick={() => navigate('/shop/qr-codes')}
              className="px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-blue-600" />
              <span>Counter Stands</span>
            </button>
          </div>
        </div>

        {/* Animated Tab Content Switcher */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};
