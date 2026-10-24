import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../lib/store';
import { apiUrl } from '../../lib/apiConfig';
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
  ExternalLink,
  Sparkles,
  Store,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Wifi,
  Shield,
  Layers
} from 'lucide-react';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';

interface ShopLayoutProps {
  children: React.ReactNode;
  activeTab: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
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
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Desktop collapsible sidebar preference
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('printflow_shop_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('printflow_shop_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [profileDropdownOpen]);

  // Real-time Electron Print Agent status tracking
  const [agentAvailability, setAgentAvailability] = useState<{
    isAvailable: boolean;
    agentOnline: boolean;
    printerReady: boolean;
    reason: string;
  }>({
    isAvailable: false,
    agentOnline: false,
    printerReady: false,
    reason: 'Checking agent status...'
  });

  useEffect(() => {
    let isMounted = true;
    const checkAgentStatus = async () => {
      if (!activeShop?.slug) return;
      try {
        const res = await fetch(apiUrl(`/api/public/shops/${encodeURIComponent(activeShop.slug)}/agent-status`));
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.availability && isMounted) {
            setAgentAvailability(data.availability);
          }
        }
      } catch {
        if (isMounted) {
          setAgentAvailability({
            isAvailable: false,
            agentOnline: false,
            printerReady: false,
            reason: 'Agent status unavailable'
          });
        }
      }
    };

    void checkAgentStatus();
    const interval = window.setInterval(() => void checkAgentStatus(), 8000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [activeShop?.slug]);

  const currentPlan = plans.find((p) => p.id === activeShop.planId) || plans[0];

  // Active pending jobs count for live sidebar badge
  const pendingJobsCount = printJobs.filter(
    (j) => j.shopId === activeShop.id && (j.printStatus === 'QUEUED' || j.printStatus === 'PRINTING')
  ).length;

  // Simplified into 4 primary groups as explicitly specified
  const primaryNavigationSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          path: '/shop/dashboard'
        }
      ]
    },
    {
      title: 'Printing',
      items: [
        {
          id: 'print-jobs',
          label: 'Live Print Queue',
          icon: Printer,
          path: '/shop/print-jobs',
          badge: pendingJobsCount > 0 ? `${pendingJobsCount}` : undefined,
          badgeColor: 'bg-amber-50 text-amber-800 border-amber-200'
        },
        {
          id: 'printers',
          label: 'Printers & Hardware',
          icon: Cpu,
          path: '/shop/printers'
        },
        {
          id: 'qr-codes',
          label: 'QR Counter Stands',
          icon: QrCode,
          path: '/shop/qr-codes'
        }
      ]
    },
    {
      title: 'Pricing & Revenue',
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
      title: 'Settings',
      items: [
        {
          id: 'print-agent',
          label: 'Desktop Print Agent',
          icon: Zap,
          path: '/shop/print-agent'
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

  // Secondary tools (preserve routes without cluttering primary nav)
  const secondaryItems: NavItem[] = [
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
    }
  ];

  const currentTabMeta = [...primaryNavigationSections.flatMap((s) => s.items), ...secondaryItems].find(
    (m) => m.id === activeTab
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col antialiased">
      {/* COMPACT UNIFIED SHOP CONSOLE HEADER */}
      <header className="sticky top-0 z-40 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 flex items-center justify-between gap-3 shadow-2xs">
        {/* Left: Brand & Shop Context */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation drawer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar collapse"
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* PrintFlow Brand */}
          <button
            type="button"
            onClick={() => navigate('/shop/dashboard')}
            className="flex items-center gap-2 text-left cursor-pointer group shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-2xs group-hover:bg-blue-700 transition-colors">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-slate-900 hidden sm:inline">
              PrintFlow
            </span>
          </button>

          <span className="hidden sm:inline-block h-4 w-px bg-slate-200" aria-hidden="true" />

          {/* Current Active Shop */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200/90 text-xs text-slate-700 max-w-[140px] sm:max-w-[200px] md:max-w-[260px] truncate">
              <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-900 truncate" title={activeShop.name}>
                {activeShop.name}
              </span>
            </div>
          </div>

          {/* Connection / Agent Status Indicator */}
          <button
            type="button"
            onClick={() => navigate('/shop/print-agent')}
            className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200/90 text-xs font-medium hover:bg-slate-100 transition-colors cursor-pointer"
            title={`Print Agent Status: ${agentAvailability.reason}. Click to open agent configuration.`}
          >
            {agentAvailability.agentOnline ? (
              agentAvailability.printerReady ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 animate-pulse" />
                  <span className="text-emerald-800 font-bold hidden xl:inline text-[11px]">Agent Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-100" />
                  <span className="text-amber-800 font-bold hidden xl:inline text-[11px]">Printer Offline</span>
                </>
              )
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-100 animate-pulse" />
                <span className="text-rose-800 font-bold hidden xl:inline text-[11px]">Agent Disconnected</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Actions, Queue Indicator, and User Profile Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* DEV: Test Order */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => simulateCustomerPrintJob()}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
              title="Send a sample customer print order to verify live queue"
            >
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Test Queue</span>
            </button>
          )}

          {/* Live Queue Pill */}
          {pendingJobsCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/shop/print-jobs')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              <span>{pendingJobsCount} queued</span>
            </button>
          )}

          {/* Customer View Quick Action */}
          <button
            type="button"
            onClick={() => navigate(`/s/${activeShop.slug}`)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-blue-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="View customer upload page for this counter"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Customer View</span>
          </button>

          {/* User Profile Menu */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
              aria-label="User profile menu"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-semibold text-xs flex items-center justify-center shadow-2xs">
                {(currentUser?.fullName || activeShop.ownerName || 'U').slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-slate-800 hidden lg:inline max-w-[120px] truncate">
                {currentUser?.fullName || activeShop.ownerName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Profile Dropdown */}
            <AnimatePresence>
              {profileDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs"
                >
                  <div className="px-3.5 py-2.5 border-b border-slate-100">
                    <p className="font-semibold text-slate-900 truncate">
                      {currentUser?.fullName || activeShop.ownerName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{currentUser?.email}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Chip variant="special" size="sm">
                        {currentPlan.name}
                      </Chip>
                      <span className="text-[10px] text-slate-400 font-mono">/{activeShop.slug}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/shop/settings');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>Shop Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/shop/subscription');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5 text-slate-400" />
                      <span>Subscription & Billing</span>
                    </button>
                    {currentUser?.role === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate('/admin/dashboard');
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full px-3.5 py-2 text-left text-purple-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-purple-600" />
                        <span>Super Admin Panel</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full px-3.5 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Layout Container (Sidebar + Content Viewport) */}
      <div className="flex-1 flex min-h-[calc(100vh-3.5rem)]">
        {/* Mobile Drawer Backdrop Overlay */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* SIDEBAR NAVIGATION */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 bg-white text-slate-700 flex flex-col justify-between transform transition-all duration-200 ease-out lg:translate-x-0 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] border-r border-slate-200 shadow-xl lg:shadow-none overflow-hidden shrink-0 ${
            mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
          } ${isCollapsed ? 'lg:w-[68px]' : 'lg:w-64'}`}
        >
          {/* Mobile Drawer Top Banner */}
          <div className="lg:hidden p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <Printer className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm text-slate-900">PrintFlow Console</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items Scroll Container */}
          <div className="p-2.5 sm:p-3 space-y-4 overflow-y-auto flex-1 min-h-0">
            <nav className="space-y-4">
              {primaryNavigationSections.map((sec, secIdx) => (
                <div key={secIdx} className="space-y-1">
                  {!isCollapsed ? (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 px-2.5 block mb-1 font-mono">
                      {sec.title}
                    </span>
                  ) : (
                    <div className="h-2 w-full border-b border-slate-100 my-1" />
                  )}

                  <div className="space-y-0.5">
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            navigate(item.path);
                            setMobileMenuOpen(false);
                          }}
                          title={isCollapsed ? item.label : undefined}
                          className={`w-full relative flex items-center ${
                            isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-2.5 py-2'
                          } rounded-xl text-xs transition-colors text-left cursor-pointer group ${
                            isActive
                              ? 'text-blue-700 font-semibold bg-blue-50/90 border border-blue-200/90 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'
                              }`}
                            />
                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                          </div>

                          {!isCollapsed && item.badge && (
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border font-mono shrink-0 ${
                                isActive
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : item.id === 'print-jobs'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : item.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}

                          {isCollapsed && item.badge && (
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Secondary Navigation (Analytics & Subscription) */}
              <div className="pt-2 border-t border-slate-100 space-y-1">
                {!isCollapsed && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 px-2.5 block mb-1 font-mono">
                    More
                  </span>
                )}
                <div className="space-y-0.5">
                  {secondaryItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          navigate(item.path);
                          setMobileMenuOpen(false);
                        }}
                        title={isCollapsed ? item.label : undefined}
                        className={`w-full relative flex items-center ${
                          isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-2.5 py-2'
                        } rounded-xl text-xs transition-colors text-left cursor-pointer group ${
                          isActive
                            ? 'text-blue-700 font-semibold bg-blue-50/90 border border-blue-200/90 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'
                            }`}
                          />
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!isCollapsed && item.badge && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold border font-mono bg-blue-50 text-blue-700 border-blue-200 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </nav>
          </div>

          {/* Footer: Shop Profile & Quick Status */}
          <div className="shrink-0 p-2.5 sm:p-3 border-t border-slate-200 bg-slate-50/80">
            {!isCollapsed ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{activeShop.name}</p>
                  <p className="text-[10px] text-slate-500 truncate font-mono">/{activeShop.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </aside>

        {/* Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Breadcrumb Header for pages that do not have their own bespoke header */}
          {activeTab !== 'pricing' && activeTab !== 'dashboard' && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <span className="font-medium text-slate-600">Console</span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="font-semibold text-blue-700">{currentTabMeta?.label || activeTab}</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {currentTabMeta?.label || 'Shop Console'}
                </h1>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/s/${activeShop.slug}`)}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Customer View</span>
                </Button>
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => navigate('/shop/qr-codes')}
                >
                  <QrCode className="w-3.5 h-3.5 text-blue-600" />
                  <span>Counter QR</span>
                </Button>
              </div>
            </div>
          )}

          {/* Animated Tab Content Switcher */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
