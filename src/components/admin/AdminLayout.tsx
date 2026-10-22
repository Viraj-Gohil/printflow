import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../lib/store';
import {
  Shield,
  LayoutDashboard,
  BarChart3,
  Store,
  Printer,
  Cpu,
  Crown,
  Layers,
  CreditCard,
  LifeBuoy,
  ScrollText,
  Activity,
  Sliders,
  Settings,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  ExternalLink,
  LogOut,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Command,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { AdminCommandPalette } from './AdminCommandPalette';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
}

interface NavSection {
  title: string;
  items: {
    id: string;
    label: string;
    icon: React.ElementType;
    path: string;
    badge?: number | string;
    badgeColor?: string;
  }[];
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activeTab }) => {
  const {
    navigate,
    currentUser,
    logout,
    switchRole,
    adminRazorpay,
    supportTickets,
    printJobs,
    agents
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Persisted Collapsible Sidebar
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('printflow_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem('printflow_admin_sidebar_collapsed', String(next));
    } catch {}
  };

  // Keyboard shortcut for Command Palette (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Real-time Badge Computations
  const openTicketsCount = (supportTickets || []).filter(
    (t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED'
  ).length;

  const queuedJobsCount = (printJobs || []).filter(
    (j) => j.printStatus === 'QUEUED' || j.printStatus === 'PRINTING'
  ).length;

  const offlineAgentsCount = (agents || []).filter((a) => a.status === 'OFFLINE').length;

  // Exact 5 Organized Sections
  const navSections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        {
          id: 'dashboard',
          label: 'Platform Overview',
          icon: LayoutDashboard,
          path: '/admin/dashboard'
        },
        {
          id: 'analytics',
          label: 'Platform Analytics',
          icon: BarChart3,
          path: '/admin/analytics'
        }
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          id: 'shops',
          label: 'Shops Directory',
          icon: Store,
          path: '/admin/shops'
        },
        {
          id: 'print-jobs',
          label: 'Global Print Queue',
          icon: Printer,
          path: '/admin/print-jobs',
          badge: queuedJobsCount > 0 ? queuedJobsCount : undefined,
          badgeColor: 'bg-blue-100 text-blue-700'
        },
        {
          id: 'agents',
          label: 'Print Agents Fleet',
          icon: Cpu,
          path: '/admin/agents',
          badge: offlineAgentsCount > 0 ? `${offlineAgentsCount} off` : undefined,
          badgeColor: 'bg-amber-100 text-amber-800'
        }
      ]
    },
    {
      title: 'BILLING & REVENUE',
      items: [
        {
          id: 'plans',
          label: 'SaaS Plans & Pricing',
          icon: Crown,
          path: '/admin/plans'
        },
        {
          id: 'subscriptions',
          label: 'Subscriptions',
          icon: Layers,
          path: '/admin/subscriptions'
        },
        {
          id: 'payments',
          label: 'Platform Payments',
          icon: CreditCard,
          path: '/admin/payments'
        }
      ]
    },
    {
      title: 'SUPPORT & SECURITY',
      items: [
        {
          id: 'support',
          label: 'Support Tickets',
          icon: LifeBuoy,
          path: '/admin/support',
          badge: openTicketsCount > 0 ? openTicketsCount : undefined,
          badgeColor: 'bg-purple-100 text-purple-700 font-bold'
        },
        {
          id: 'audit-logs',
          label: 'Security & Audit Logs',
          icon: ScrollText,
          path: '/admin/audit-logs'
        },
        {
          id: 'health',
          label: 'System Health',
          icon: Activity,
          path: '/admin/health',
          badge: offlineAgentsCount === 0 ? '99.9%' : 'Alert',
          badgeColor: offlineAgentsCount === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
        }
      ]
    },
    {
      title: 'CONFIGURATION',
      items: [
        {
          id: 'platform-settings',
          label: 'Platform Settings',
          icon: Sliders,
          path: '/admin/platform-settings'
        },
        {
          id: 'settings',
          label: 'Admin Settings',
          icon: Settings,
          path: '/admin/settings'
        }
      ]
    }
  ];

  // Map activeTab to Section & Label for breadcrumbs
  const currentItemInfo = (() => {
    // Normalization: if activeTab is 'saas-plans', map to 'plans'
    const normalizedTab = activeTab === 'saas-plans' ? 'plans' : activeTab;
    for (const sec of navSections) {
      const found = sec.items.find((item) => item.id === normalizedTab);
      if (found) return { section: sec.title, item: found };
    }
    return { section: 'OVERVIEW', item: { id: activeTab, label: 'Platform Console', icon: LayoutDashboard, path: '/admin' } };
  })();

  const isTabActive = (itemId: string) => {
    if (activeTab === itemId) return true;
    if (itemId === 'plans' && (activeTab === 'plans' || activeTab === 'saas-plans')) return true;
    if (itemId === 'health' && (activeTab === 'health' || activeTab === 'system-health')) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col lg:flex-row">
      {/* Mobile Top Bar */}
      <div className="lg:hidden bg-white text-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-xs text-slate-900 block">Super Admin</span>
            <span className="text-[10px] text-purple-700 font-medium">Control Panel</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
            title="Quick Search (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white text-slate-700 flex flex-col justify-between transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen border-r border-slate-200/90 shadow-xl lg:shadow-none overflow-hidden ${
          mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Top Header & Branding */}
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <span className="text-xs font-bold text-slate-900 block truncate">
                  PrintFlow Cloud
                </span>
                <span className="text-[10px] text-purple-700 font-semibold tracking-wide block">
                  Super Admin
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Palette Trigger Button */}
        <div className="p-2.5 shrink-0">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200 hover:border-purple-200 transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center' : 'justify-between'
            }`}
            title="Search & Quick Jump (⌘K)"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600" />
              {!isCollapsed && <span className="text-[11px] text-slate-500 font-medium">Quick Nav...</span>}
            </div>
            {!isCollapsed && (
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-400 shadow-2xs">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        {/* Navigation Scrollable Body */}
        <div className="px-2.5 py-2 space-y-4 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              {/* Section Header */}
              {!isCollapsed ? (
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </div>
              ) : (
                <div className="h-2 flex items-center justify-center">
                  <div className="w-4 border-t border-slate-200" />
                </div>
              )}

              {/* Items */}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isTabActive(item.id);

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigate(item.path);
                      setMobileMenuOpen(false);
                    }}
                    title={`${item.label} (${section.title})`}
                    className={`w-full group relative flex items-center rounded-xl transition-all cursor-pointer text-left ${
                      isCollapsed
                        ? 'justify-center p-2'
                        : 'px-2.5 py-1.5 gap-2.5 text-xs'
                    } ${
                      active
                        ? 'text-purple-900 font-bold bg-purple-50 border border-purple-200/90 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        active ? 'text-purple-600' : 'text-slate-400 group-hover:text-slate-700'
                      }`}
                    />

                    {!isCollapsed && (
                      <span className="truncate flex-1 text-xs">
                        {item.label}
                      </span>
                    )}

                    {/* Badge */}
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-bold rounded-full transition-all ${
                          isCollapsed
                            ? 'absolute top-1 right-1 w-2 h-2 p-0 bg-purple-600'
                            : `px-1.5 py-0.5 ${item.badgeColor || 'bg-purple-100 text-purple-700'}`
                        }`}
                      >
                        {!isCollapsed && item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Profile & Footer Area */}
        <div className="shrink-0 p-3 border-t border-slate-200 bg-slate-50/80 space-y-2">
          {/* Gateway Status Pill */}
          {!isCollapsed ? (
            <div className="flex items-center justify-between text-[11px] px-2 py-1 bg-white rounded-lg border border-slate-200/70">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${adminRazorpay.keyId ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                Gateway
              </span>
              <span className="font-semibold text-purple-700">
                {adminRazorpay.isTestMode ? 'Test Mode' : 'Live'}
              </span>
            </div>
          ) : (
            <div className="flex justify-center" title={`Gateway: ${adminRazorpay.isTestMode ? 'Test' : 'Live'}`}>
              <span className={`w-2 h-2 rounded-full ${adminRazorpay.keyId ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </div>
          )}

          {/* Admin Profile & Actions */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-200">
                AD
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <span className="text-xs font-bold text-slate-900 block truncate">
                    {currentUser?.fullName || 'Master Admin'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block truncate">
                    Platform Super Admin
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Quick switch to Shop Portal */}
              <button
                onClick={() => switchRole('SHOP_OWNER')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-purple-700 hover:bg-white transition-colors cursor-pointer"
                title="Switch to Shop Portal"
              >
                <Store className="w-3.5 h-3.5" />
              </button>

              {/* Logout */}
              <button
                onClick={() => logout()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition-colors cursor-pointer"
                title="Sign out of Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">
        {/* Content Area with Animation */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Global Command Palette */}
      <AdminCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};
