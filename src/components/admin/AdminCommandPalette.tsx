import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../lib/store';
import {
  Search,
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
  X,
  ArrowRight,
  ExternalLink,
  Shield,
  Zap
} from 'lucide-react';

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminCommandPalette: React.FC<AdminCommandPaletteProps> = ({ isOpen, onClose }) => {
  const { navigate, shops, printJobs, supportTickets, agents, switchRole } = useApp();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const openTicketsCount = (supportTickets || []).filter(
    (t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED'
  ).length;

  const queuedJobsCount = (printJobs || []).filter(
    (j) => j.printStatus === 'QUEUED' || j.printStatus === 'PRINTING'
  ).length;

  const offlineAgentsCount = (agents || []).filter((a) => a.status === 'OFFLINE').length;

  const commands = useMemo(() => {
    return [
      // Navigation Pages
      {
        id: 'nav-overview',
        title: 'Platform Overview',
        category: 'Navigation',
        section: 'Overview',
        icon: LayoutDashboard,
        path: '/admin/dashboard',
        keywords: ['overview', 'dashboard', 'home', 'kpi', 'summary', 'admin']
      },
      {
        id: 'nav-analytics',
        title: 'Platform Analytics',
        category: 'Navigation',
        section: 'Overview',
        icon: BarChart3,
        path: '/admin/analytics',
        keywords: ['analytics', 'metrics', 'revenue', 'charts', 'trends', 'volume']
      },
      {
        id: 'nav-shops',
        title: 'Shops Directory',
        category: 'Navigation',
        section: 'Operations',
        icon: Store,
        path: '/admin/shops',
        keywords: ['shops', 'tenants', 'stores', 'xerox', 'directory', 'merchants', 'owners']
      },
      {
        id: 'nav-print-jobs',
        title: 'Global Print Queue',
        category: 'Navigation',
        section: 'Operations',
        icon: Printer,
        path: '/admin/print-jobs',
        badge: queuedJobsCount > 0 ? `${queuedJobsCount} active` : undefined,
        keywords: ['queue', 'jobs', 'orders', 'print', 'spool', 'files']
      },
      {
        id: 'nav-agents',
        title: 'Print Agents Fleet',
        category: 'Navigation',
        section: 'Operations',
        icon: Cpu,
        path: '/admin/agents',
        badge: offlineAgentsCount > 0 ? `${offlineAgentsCount} offline` : undefined,
        keywords: ['agents', 'fleet', 'desktop', 'electron', 'printers', 'hardware']
      },
      {
        id: 'nav-plans',
        title: 'SaaS Plans & Pricing',
        category: 'Navigation',
        section: 'Billing & Revenue',
        icon: Crown,
        path: '/admin/plans',
        keywords: ['plans', 'pricing', 'tier', 'saas', 'quotas', 'entitlements']
      },
      {
        id: 'nav-subscriptions',
        title: 'Subscriptions Management',
        category: 'Navigation',
        section: 'Billing & Revenue',
        icon: Layers,
        path: '/admin/subscriptions',
        keywords: ['subscriptions', 'mrr', 'arr', 'tenants', 'renewals', 'billing']
      },
      {
        id: 'nav-payments',
        title: 'Platform Payments',
        category: 'Navigation',
        section: 'Billing & Revenue',
        icon: CreditCard,
        path: '/admin/payments',
        keywords: ['payments', 'transactions', 'gateway', 'revenue', 'fees', 'razorpay']
      },
      {
        id: 'nav-support',
        title: 'Support Tickets',
        category: 'Navigation',
        section: 'Support & Security',
        icon: LifeBuoy,
        path: '/admin/support',
        badge: openTicketsCount > 0 ? `${openTicketsCount} open` : undefined,
        keywords: ['support', 'tickets', 'issues', 'help', 'sla', 'shops']
      },
      {
        id: 'nav-audit',
        title: 'Security & Audit Logs',
        category: 'Navigation',
        section: 'Support & Security',
        icon: ScrollText,
        path: '/admin/audit-logs',
        keywords: ['audit', 'logs', 'security', 'trail', 'compliance', 'actions']
      },
      {
        id: 'nav-health',
        title: 'System Health & Latency',
        category: 'Navigation',
        section: 'Support & Security',
        icon: Activity,
        path: '/admin/health',
        badge: 'Operational',
        keywords: ['health', 'system', 'latency', 'uptime', 'monitoring', 'status']
      },
      {
        id: 'nav-platform-settings',
        title: 'Platform Settings',
        category: 'Navigation',
        section: 'Configuration',
        icon: Sliders,
        path: '/admin/platform-settings',
        keywords: ['settings', 'platform', 'branding', 'policies', 'maintenance', 'gateways']
      },
      {
        id: 'nav-admin-settings',
        title: 'Admin Settings & Gateway API',
        category: 'Navigation',
        section: 'Configuration',
        icon: Settings,
        path: '/admin/settings',
        keywords: ['razorpay', 'credentials', 'keys', 'webhook', 'security', 'admin']
      },

      // Quick Actions
      {
        id: 'act-create-plan',
        title: 'Create New SaaS Subscription Plan',
        category: 'Quick Action',
        section: 'Actions',
        icon: Zap,
        path: '/admin/plans',
        action: () => navigate('/admin/plans'),
        keywords: ['create', 'new plan', 'add plan', 'pricing']
      },
      {
        id: 'act-view-open-tickets',
        title: 'Triage Unresolved Support Tickets',
        category: 'Quick Action',
        section: 'Actions',
        icon: LifeBuoy,
        path: '/admin/support',
        action: () => navigate('/admin/support'),
        keywords: ['open tickets', 'unresolved', 'support', 'sla']
      },
      {
        id: 'act-switch-shop',
        title: 'Switch to Shop Owner Portal',
        category: 'Quick Action',
        section: 'Actions',
        icon: Store,
        action: () => switchRole('SHOP_OWNER'),
        keywords: ['switch', 'shop', 'owner', 'preview', 'kiosk']
      }
    ];
  }, [queuedJobsCount, offlineAgentsCount, openTicketsCount, navigate, switchRole]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [commands, query]);

  const handleSelect = (item: (typeof commands)[0]) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < filteredCommands.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredCommands.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleSelect(filteredCommands[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Palette Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[80vh]">
        {/* Header Search Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-purple-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or jump to page... (e.g. Analytics, Tickets, Plans)"
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-slate-100 flex-1">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching pages or admin actions found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-purple-50 text-purple-900 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-900 block truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.section} • {item.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isSelected
                            ? 'text-purple-600 translate-x-0.5'
                            : 'text-slate-300'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] ml-1">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">↵</kbd> to select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">esc</kbd> to close
            </span>
          </div>
          <span className="text-purple-700 font-semibold">PrintFlow Super Admin</span>
        </div>
      </div>
    </div>
  );
};
