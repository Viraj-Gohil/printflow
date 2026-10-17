import React, { useState, useMemo } from 'react';
import { useApp } from '../../lib/store';
import {
  LifeBuoy,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  UserCheck,
  Building2,
  Printer,
  CreditCard,
  ArrowUpDown,
  Plus,
  Send,
  Lock,
  RefreshCw,
  Download,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Tag,
  MessageSquare,
  History,
  Sparkles,
  Shield,
  ExternalLink,
  FileText,
  Check,
  AlertCircle,
  Phone,
  Mail,
  Flame,
  X,
  HelpCircle,
  Eye,
  Info
} from 'lucide-react';
import {
  SupportTicket,
  TicketPriority,
  TicketStatus,
  TicketCategory,
  SupportTicketMessage,
  SupportTicketHistoryEntry,
  SupportSettings
} from '../../types';

// Helper: Format date/time readable
const formatDate = (isoString?: string) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
};

// Helper: Relative time (e.g. "10 mins ago")
const getRelativeTime = (isoString?: string) => {
  if (!isoString) return '—';
  try {
    const now = new Date().getTime();
    const past = new Date(isoString).getTime();
    const diffMin = Math.round((now - past) / (1000 * 60));
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  } catch (e) {
    return '—';
  }
};

// Category display labels & color badges
const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string }> = {
  PRINTING_ISSUE: { label: 'Printing Issue', icon: Printer, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  PRINTER_OFFLINE: { label: 'Printer Offline', icon: AlertTriangle, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  JOB_FAILURE: { label: 'Print Job Failure', icon: XCircle, color: 'text-red-700 bg-red-50 border-red-200' },
  PAYMENT_REFUND: { label: 'Payment / Refund', icon: CreditCard, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  SUBSCRIPTION_BILLING: { label: 'Subscription / Billing', icon: FileText, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  QR_CODE: { label: 'QR Code Issue', icon: Tag, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  FILE_UPLOAD: { label: 'File Upload Issue', icon: FileText, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  ACCOUNT_LOGIN: { label: 'Account / Login', icon: User, color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  FEATURE_REQUEST: { label: 'Feature Request', icon: Sparkles, color: 'text-violet-700 bg-violet-50 border-violet-200' },
  OTHER: { label: 'Other', icon: HelpCircle, color: 'text-slate-700 bg-slate-100 border-slate-200' },
  // Backward compatibility
  AGENT: { label: 'Print Agent', icon: Printer, color: 'text-rose-700 bg-rose-50 border-rose-200' },
  BILLING: { label: 'Billing Issue', icon: CreditCard, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  HARDWARE: { label: 'Hardware', icon: Printer, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  GENERAL: { label: 'General Request', icon: HelpCircle, color: 'text-slate-700 bg-slate-100 border-slate-200' }
};

// Priority styles
const PRIORITY_BADGES: Record<string, { label: string; badge: string; dot: string; icon: any }> = {
  CRITICAL: {
    label: 'Critical',
    badge: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
    dot: 'bg-rose-600 animate-pulse',
    icon: Flame
  },
  HIGH: {
    label: 'High',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
    dot: 'bg-amber-500',
    icon: AlertTriangle
  },
  NORMAL: {
    label: 'Normal',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
    dot: 'bg-blue-500',
    icon: Clock
  },
  MEDIUM: {
    label: 'Normal',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
    dot: 'bg-blue-500',
    icon: Clock
  },
  LOW: {
    label: 'Low',
    badge: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
    dot: 'bg-slate-400',
    icon: Clock
  }
};

// Status styles
const STATUS_BADGES: Record<string, { label: string; badge: string; dot: string }> = {
  OPEN: {
    label: 'Open',
    badge: 'bg-purple-50 text-purple-700 border-purple-200 font-semibold',
    dot: 'bg-purple-600'
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
    dot: 'bg-blue-600'
  },
  WAITING_SHOP: {
    label: 'Waiting for Shop',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
    dot: 'bg-amber-500'
  },
  WAITING_INTERNAL: {
    label: 'Waiting Internal',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold',
    dot: 'bg-indigo-600'
  },
  RESOLVED: {
    label: 'Resolved',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
    dot: 'bg-emerald-600'
  },
  CLOSED: {
    label: 'Closed',
    badge: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
    dot: 'bg-slate-400'
  }
};

// Canned response snippets for quick replies
const CANNED_RESPONSES = [
  {
    title: 'Investigating Printer Agent Logs',
    text: 'Hello, we have pulled your shop print agent telemetry logs and are investigating the spooler connection. Could you confirm if the Windows tray app displays a green dot?'
  },
  {
    title: 'Refund Processed via Gateway',
    text: 'Hi there, we verified the duplicate payment on the platform gateway and processed a direct reversal to the customer UPI ID. It will reflect in their account within 2-4 business hours.'
  },
  {
    title: 'Printer Driver Configuration',
    text: 'Please open Windows Devices & Printers -> Right click printer -> Printer Properties -> Advanced tab -> Switch driver from Generic Text to Canon PostScript 3 / HP PCL6. Then restart the PrintFlow Agent service.'
  },
  {
    title: 'Plan Quota & Past Due Notice Cleared',
    text: 'We have updated your billing cycle status and synchronized your payment record. Your dashboard past-due banner has been cleared and full print limits are restored.'
  },
  {
    title: 'Large File Upload Recommendation',
    text: 'We have extended the client HTTP chunk timeout to 120s. For files exceeding 40MB, we also recommend asking customers to connect to the shop Wi-Fi network for faster uplink speeds.'
  }
];

export const AdminSupport: React.FC = () => {
  const {
    currentUser,
    supportTickets,
    supportSettings,
    supportAdmins,
    shops,
    printJobs,
    transactions,
    createSupportTicket,
    updateTicketStatus,
    updateTicketPriority,
    assignTicket,
    addTicketMessage,
    updateSupportSettings,
    showToast,
    navigate
  } = useApp();

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TicketStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TicketPriority>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | TicketCategory>('ALL');
  const [adminFilter, setAdminFilter] = useState<'ALL' | 'UNASSIGNED' | string>('ALL');
  const [shopFilter, setShopFilter] = useState<'ALL' | string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'PRIORITY' | 'UPDATED'>('NEWEST');

  // Quick view tab selection
  type QuickView = 'ALL' | 'MY_ASSIGNED' | 'UNASSIGNED' | 'OPEN' | 'CRITICAL' | 'WAITING_SHOP' | 'RESOLVED' | 'CLOSED';
  const [quickView, setQuickView] = useState<QuickView>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Drawer & Modal state
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'conversation' | 'info' | 'history'>('conversation');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reply Composer state
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Create Ticket Form state
  const [createForm, setCreateForm] = useState<{
    shopId: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    assignedAdminId: string;
    description: string;
    relatedJobId: string;
    relatedPaymentId: string;
  }>({
    shopId: shops[0]?.id || '',
    subject: '',
    category: 'PRINTING_ISSUE',
    priority: 'NORMAL',
    assignedAdminId: supportAdmins[0]?.id || '',
    description: '',
    relatedJobId: '',
    relatedPaymentId: ''
  });

  // Settings Form state
  const [settingsForm, setSettingsForm] = useState<SupportSettings>({ ...supportSettings });

  // Currently viewed ticket (reactive to tickets list)
  const activeTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return supportTickets.find((t) => t.id === selectedTicketId) || null;
  }, [selectedTicketId, supportTickets]);

  // Associated shop for active ticket
  const activeTicketShop = useMemo(() => {
    if (!activeTicket) return null;
    return shops.find((s) => s.id === activeTicket.shopId) || null;
  }, [activeTicket, shops]);

  // Associated print job for active ticket (if any)
  const activeTicketJob = useMemo(() => {
    if (!activeTicket?.relatedJobId) return null;
    return printJobs.find((j) => j.id === activeTicket.relatedJobId) || null;
  }, [activeTicket, printJobs]);

  // Associated payment transaction for active ticket (if any)
  const activeTicketPayment = useMemo(() => {
    if (!activeTicket?.relatedPaymentId) return null;
    return transactions.find((tx) => tx.id === activeTicket.relatedPaymentId || tx.gatewayPaymentId === activeTicket.relatedPaymentId) || null;
  }, [activeTicket, transactions]);

  // Real KPI Metrics Calculation
  const metrics = useMemo(() => {
    const total = supportTickets.length;
    const openCount = supportTickets.filter((t) => t.status === 'OPEN').length;
    const unassignedCount = supportTickets.filter((t) => !t.assignedAdminId && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;
    const criticalHighCount = supportTickets.filter((t) => (t.priority === 'CRITICAL' || t.priority === 'HIGH') && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;
    const awaitingAdminCount = supportTickets.filter((t) => t.status === 'OPEN' || t.status === 'WAITING_INTERNAL').length;
    const resolvedCount = supportTickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;

    // SLA Breaches count
    const nowMs = Date.now();
    let slaBreaches = 0;
    let totalFirstResponseMs = 0;
    let respondedCount = 0;
    let totalResolutionMs = 0;
    let resolvedCountWithTime = 0;

    supportTickets.forEach((t) => {
      // Breached check
      if (t.isSlaBreached) {
        slaBreaches++;
      } else if (t.status !== 'RESOLVED' && t.status !== 'CLOSED') {
        if (t.slaResolutionDeadline && new Date(t.slaResolutionDeadline).getTime() < nowMs) {
          slaBreaches++;
        } else if (!t.firstResponseAt && t.slaFirstResponseDeadline && new Date(t.slaFirstResponseDeadline).getTime() < nowMs) {
          slaBreaches++;
        }
      }

      // First response time calculation (only if recorded)
      if (t.firstResponseAt && t.createdAt) {
        const diff = new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime();
        if (diff > 0) {
          totalFirstResponseMs += diff;
          respondedCount++;
        }
      }

      // Resolution time calculation (only if recorded)
      if (t.resolvedAt && t.createdAt) {
        const diff = new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
        if (diff > 0) {
          totalResolutionMs += diff;
          resolvedCountWithTime++;
        }
      }
    });

    const avgResponseHours = respondedCount > 0 ? (totalFirstResponseMs / respondedCount / (1000 * 3600)).toFixed(1) : null;
    const avgResolutionHours = resolvedCountWithTime > 0 ? (totalResolutionMs / resolvedCountWithTime / (1000 * 3600)).toFixed(1) : null;

    return {
      total,
      openCount,
      unassignedCount,
      criticalHighCount,
      awaitingAdminCount,
      resolvedCount,
      slaBreaches,
      avgResponseHours,
      avgResolutionHours
    };
  }, [supportTickets]);

  // Apply Quick View Filters to table
  const handleQuickViewSelect = (view: QuickView) => {
    setQuickView(view);
    setCurrentPage(1);
    switch (view) {
      case 'ALL':
        setStatusFilter('ALL');
        setPriorityFilter('ALL');
        setAdminFilter('ALL');
        break;
      case 'MY_ASSIGNED':
        setStatusFilter('ALL');
        setPriorityFilter('ALL');
        setAdminFilter(currentUser?.id || 'usr_admin');
        break;
      case 'UNASSIGNED':
        setStatusFilter('ALL');
        setPriorityFilter('ALL');
        setAdminFilter('UNASSIGNED');
        break;
      case 'OPEN':
        setStatusFilter('OPEN');
        setPriorityFilter('ALL');
        setAdminFilter('ALL');
        break;
      case 'CRITICAL':
        setStatusFilter('ALL');
        setPriorityFilter('CRITICAL');
        setAdminFilter('ALL');
        break;
      case 'WAITING_SHOP':
        setStatusFilter('WAITING_SHOP');
        setPriorityFilter('ALL');
        setAdminFilter('ALL');
        break;
      case 'RESOLVED':
        setStatusFilter('RESOLVED');
        setPriorityFilter('ALL');
        setAdminFilter('ALL');
        break;
      case 'CLOSED':
        setStatusFilter('CLOSED');
        setPriorityFilter('ALL');
        setAdminFilter('ALL');
        break;
    }
  };

  // Filtered & Sorted Tickets
  const filteredTickets = useMemo(() => {
    let result = [...supportTickets];

    // Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          (t.ticketNumber && t.ticketNumber.toLowerCase().includes(q)) ||
          t.shopName.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
      );
    }

    // Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Priority Filter
    if (priorityFilter !== 'ALL') {
      if (priorityFilter === 'NORMAL') {
        result = result.filter((t) => t.priority === 'NORMAL' || t.priority === 'MEDIUM');
      } else {
        result = result.filter((t) => t.priority === priorityFilter);
      }
    }

    // Category Filter
    if (categoryFilter !== 'ALL') {
      result = result.filter((t) => t.category === categoryFilter);
    }

    // Admin Filter
    if (adminFilter !== 'ALL') {
      if (adminFilter === 'UNASSIGNED') {
        result = result.filter((t) => !t.assignedAdminId);
      } else {
        result = result.filter((t) => t.assignedAdminId === adminFilter);
      }
    }

    // Shop Filter
    if (shopFilter !== 'ALL') {
      result = result.filter((t) => t.shopId === shopFilter);
    }

    // Date Filter
    if (dateFilter !== 'ALL') {
      const now = new Date().getTime();
      result = result.filter((t) => {
        const ticketTime = new Date(t.createdAt).getTime();
        const diffHours = (now - ticketTime) / (1000 * 3600);
        if (dateFilter === 'TODAY') return diffHours <= 24;
        if (dateFilter === '7DAYS') return diffHours <= 24 * 7;
        if (dateFilter === '30DAYS') return diffHours <= 24 * 30;
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'NEWEST') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'OLDEST') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'UPDATED') {
        return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      }
      if (sortBy === 'PRIORITY') {
        const priorityWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, NORMAL: 2, MEDIUM: 2, LOW: 1 };
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      }
      return 0;
    });

    return result;
  }, [supportTickets, searchQuery, statusFilter, priorityFilter, categoryFilter, adminFilter, shopFilter, dateFilter, sortBy]);

  // Paginated Tickets
  const totalPages = Math.ceil(filteredTickets.length / pageSize) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, currentPage, pageSize]);

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setCategoryFilter('ALL');
    setAdminFilter('ALL');
    setShopFilter('ALL');
    setDateFilter('ALL');
    setSortBy('NEWEST');
    setQuickView('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    adminFilter !== 'ALL' ||
    shopFilter !== 'ALL' ||
    dateFilter !== 'ALL' ||
    quickView !== 'ALL';

  // Export CSV
  const handleExportCSV = () => {
    if (filteredTickets.length === 0) {
      showToast('No Tickets to Export', 'There are no tickets matching current filters', 'error');
      return;
    }

    const headers = [
      'Ticket Number',
      'Ticket ID',
      'Subject',
      'Shop Name',
      'Shop ID',
      'Category',
      'Priority',
      'Status',
      'Assigned Admin',
      'Related Order ID',
      'Related Payment ID',
      'Created At',
      'Last Updated',
      'First Response At',
      'Resolved At'
    ];

    const rows = filteredTickets.map((t) => [
      t.ticketNumber || t.id,
      t.id,
      `"${t.subject.replace(/"/g, '""')}"`,
      `"${t.shopName.replace(/"/g, '""')}"`,
      t.shopId,
      t.category,
      t.priority,
      t.status,
      t.assignedAdminName || 'Unassigned',
      t.relatedJobId || '',
      t.relatedPaymentId || '',
      t.createdAt,
      t.updatedAt || '',
      t.firstResponseAt || '',
      t.resolvedAt || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `printflow_support_tickets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Export Successful', `Exported ${filteredTickets.length} tickets to CSV`, 'success');
  };

  // Handle Refresh simulation
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Support Queue Refreshed', 'Ticket data synchronized with master database', 'info');
    }, 500);
  };

  // Submit Reply or Internal Note
  const handleSendReply = async () => {
    if (!activeTicket || !replyText.trim()) return;
    setIsSendingReply(true);

    try {
      await addTicketMessage(activeTicket.id, replyText.trim(), isInternalNote);
      setReplyText('');
    } catch (e) {
      showToast('Error', 'Failed to submit response', 'error');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Create Ticket Submit
  const handleCreateTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.subject.trim() || !createForm.description.trim()) {
      showToast('Validation Error', 'Subject and description are required', 'error');
      return;
    }

    const targetShop = shops.find((s) => s.id === createForm.shopId);
    const newTicket = createSupportTicket({
      shopId: createForm.shopId,
      shopName: targetShop ? targetShop.name : 'Platform Shop',
      subject: createForm.subject.trim(),
      description: createForm.description.trim(),
      category: createForm.category,
      priority: createForm.priority,
      assignedAdminId: createForm.assignedAdminId || undefined,
      relatedJobId: createForm.relatedJobId.trim() || undefined,
      relatedPaymentId: createForm.relatedPaymentId.trim() || undefined
    });

    setIsCreateOpen(false);
    setCreateForm({
      shopId: shops[0]?.id || '',
      subject: '',
      category: 'PRINTING_ISSUE',
      priority: 'NORMAL',
      assignedAdminId: supportAdmins[0]?.id || '',
      description: '',
      relatedJobId: '',
      relatedPaymentId: ''
    });

    // Auto-select newly created ticket
    setSelectedTicketId(newTicket.id);
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSupportSettings(settingsForm);
    setIsSettingsOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Breadcrumb, Actions, and Prominent Search */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 mb-1">
              <span>Platform</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-800">Support Tickets</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <LifeBuoy className="w-7 h-7 text-purple-600" />
              Support Tickets
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Manage shop-owner requests, investigate print errors, process refund queries, and track enterprise SLA resolution.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export active ticket view to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Tickets</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => {
                setSettingsForm({ ...supportSettings });
                setIsSettingsOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
              <span>Support Settings</span>
            </button>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Ticket</span>
            </button>
          </div>
        </div>

        {/* Prominent Global Search Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search tickets by ID (e.g. TCK-1041), subject, shop name, tag, or description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{filteredTickets.length}</span>
            <span>of {supportTickets.length} tickets matching</span>
          </div>
        </div>
      </div>

      {/* 2. Support Overview KPI Cards (Clickable) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Tickets */}
        <button
          onClick={() => handleQuickViewSelect('ALL')}
          className={`p-4 bg-white rounded-2xl border text-left transition-all cursor-pointer ${
            quickView === 'ALL' && !hasActiveFilters
              ? 'border-purple-500 shadow-sm ring-2 ring-purple-500/10'
              : 'border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total</span>
            <LifeBuoy className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{metrics.total}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Platform wide</div>
        </button>

        {/* Open Tickets */}
        <button
          onClick={() => handleQuickViewSelect('OPEN')}
          className={`p-4 bg-white rounded-2xl border text-left transition-all cursor-pointer ${
            quickView === 'OPEN'
              ? 'border-purple-500 shadow-sm ring-2 ring-purple-500/10'
              : 'border-slate-200 shadow-2xs hover:border-purple-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Open</span>
            <span className="w-2 h-2 rounded-full bg-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700 tracking-tight">{metrics.openCount}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Pending triage</div>
        </button>

        {/* Unassigned Tickets */}
        <button
          onClick={() => handleQuickViewSelect('UNASSIGNED')}
          className={`p-4 bg-white rounded-2xl border text-left transition-all cursor-pointer ${
            quickView === 'UNASSIGNED'
              ? 'border-amber-500 shadow-sm ring-2 ring-amber-500/10'
              : 'border-slate-200 shadow-2xs hover:border-amber-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Unassigned</span>
            <UserCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">{metrics.unassignedCount}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Needs agent</div>
        </button>

        {/* High / Critical Priority */}
        <button
          onClick={() => handleQuickViewSelect('CRITICAL')}
          className={`p-4 bg-white rounded-2xl border text-left transition-all cursor-pointer ${
            quickView === 'CRITICAL'
              ? 'border-rose-500 shadow-sm ring-2 ring-rose-500/10'
              : 'border-slate-200 shadow-2xs hover:border-rose-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">High / Critical</span>
            <Flame className="w-4 h-4 text-rose-600 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">{metrics.criticalHighCount}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Urgent resolution</div>
        </button>

        {/* Awaiting Admin */}
        <button
          onClick={() => {
            setQuickView('ALL');
            setStatusFilter('OPEN');
            setCurrentPage(1);
          }}
          className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-200 hover:shadow-xs text-left transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Awaiting Staff</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 tracking-tight">{metrics.awaitingAdminCount}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Awaiting response</div>
        </button>

        {/* Resolved */}
        <button
          onClick={() => handleQuickViewSelect('RESOLVED')}
          className={`p-4 bg-white rounded-2xl border text-left transition-all cursor-pointer ${
            quickView === 'RESOLVED'
              ? 'border-emerald-500 shadow-sm ring-2 ring-emerald-500/10'
              : 'border-slate-200 shadow-2xs hover:border-emerald-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">{metrics.resolvedCount}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Closed & resolved</div>
        </button>
      </div>

      {/* SLA & Performance Bar (Calculated strictly from real timestamps) */}
      <div className="bg-gradient-to-r from-purple-50 via-slate-50 to-slate-100 p-3.5 sm:p-4 rounded-2xl border border-purple-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-600" />
          <span className="font-bold text-slate-800">Support Operations Telemetry:</span>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-slate-600">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-500" />
            <span>Avg First Response:</span>
            <span className="font-bold text-slate-900">
              {metrics.avgResponseHours ? `${metrics.avgResponseHours} hrs` : 'No logs yet'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Avg Resolution Time:</span>
            <span className="font-bold text-slate-900">
              {metrics.avgResolutionHours ? `${metrics.avgResolutionHours} hrs` : 'No logs yet'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <AlertTriangle className={`w-3.5 h-3.5 ${metrics.slaBreaches > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            <span>SLA Breaches:</span>
            <span
              className={`font-bold px-1.5 py-0.5 rounded-md ${
                metrics.slaBreaches > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-200/60 text-slate-700'
              }`}
            >
              {metrics.slaBreaches}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Quick Views, Filter Controls & Filter Chips */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        {/* Quick View Pills */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { id: 'ALL', label: 'All Tickets', count: supportTickets.length },
              { id: 'MY_ASSIGNED', label: 'My Assigned', count: supportTickets.filter((t) => t.assignedAdminId === currentUser?.id).length },
              { id: 'UNASSIGNED', label: 'Unassigned', count: metrics.unassignedCount },
              { id: 'OPEN', label: 'Open', count: metrics.openCount },
              { id: 'CRITICAL', label: 'Critical', count: supportTickets.filter((t) => t.priority === 'CRITICAL').length },
              { id: 'WAITING_SHOP', label: 'Waiting for Shop', count: supportTickets.filter((t) => t.status === 'WAITING_SHOP').length },
              { id: 'RESOLVED', label: 'Resolved', count: supportTickets.filter((t) => t.status === 'RESOLVED').length },
              { id: 'CLOSED', label: 'Closed', count: supportTickets.filter((t) => t.status === 'CLOSED').length }
            ].map((tab) => {
              const isSelected = quickView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleQuickViewSelect(tab.id as QuickView)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline shrink-0 cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Status Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_SHOP">Waiting for Shop</option>
              <option value="WAITING_INTERNAL">Waiting Internal</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Priority Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="PRINTING_ISSUE">Printing Issue</option>
              <option value="PRINTER_OFFLINE">Printer Offline</option>
              <option value="JOB_FAILURE">Print Job Failure</option>
              <option value="PAYMENT_REFUND">Payment / Refund</option>
              <option value="SUBSCRIPTION_BILLING">Subscription / Billing</option>
              <option value="QR_CODE">QR Code Issue</option>
              <option value="FILE_UPLOAD">File Upload Issue</option>
              <option value="ACCOUNT_LOGIN">Account / Login</option>
              <option value="FEATURE_REQUEST">Feature Request</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Assigned Admin Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assigned Admin</label>
            <select
              value={adminFilter}
              onChange={(e) => {
                setAdminFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">All Admins</option>
              <option value="UNASSIGNED">Unassigned</option>
              {supportAdmins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.name}
                </option>
              ))}
            </select>
          </div>

          {/* Shop Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Shop Tenant</label>
            <select
              value={shopFilter}
              onChange={(e) => {
                setShopFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">All Shops</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="PRIORITY">Priority (Critical to Low)</option>
              <option value="UPDATED">Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 text-[11px] font-semibold mr-1">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-medium">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-purple-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('ALL')} className="hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {priorityFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
                Priority: {priorityFilter}
                <button onClick={() => setPriorityFilter('ALL')} className="hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {categoryFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
                Category: {categoryFilter}
                <button onClick={() => setCategoryFilter('ALL')} className="hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {adminFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
                Admin: {adminFilter === 'UNASSIGNED' ? 'Unassigned' : supportAdmins.find((a) => a.id === adminFilter)?.name || adminFilter}
                <button onClick={() => setAdminFilter('ALL')} className="hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {shopFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
                Shop: {shops.find((s) => s.id === shopFilter)?.name || shopFilter}
                <button onClick={() => setShopFilter('ALL')} className="hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. Ticket Management Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {paginatedTickets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No support tickets found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No tickets matched your current search and filter settings. Try adjusting the filters or create a new ticket.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl cursor-pointer"
              >
                Create New Ticket
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Subject & Issue Details</th>
                  <th className="py-3 px-4">Shop Tenant</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned Admin</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTickets.map((ticket) => {
                  const categoryMeta = CATEGORY_MAP[ticket.category] || CATEGORY_MAP.GENERAL;
                  const CategoryIcon = categoryMeta.icon;
                  const priorityMeta = PRIORITY_BADGES[ticket.priority] || PRIORITY_BADGES.NORMAL;
                  const PriorityIcon = priorityMeta.icon;
                  const statusMeta = STATUS_BADGES[ticket.status] || STATUS_BADGES.OPEN;

                  // SLA countdown/status helper
                  const nowMs = Date.now();
                  const isBreached =
                    ticket.isSlaBreached ||
                    (ticket.status !== 'RESOLVED' &&
                      ticket.status !== 'CLOSED' &&
                      ticket.slaResolutionDeadline &&
                      new Date(ticket.slaResolutionDeadline).getTime() < nowMs);

                  const isSelected = selectedTicketId === ticket.id;

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`hover:bg-purple-50/40 transition-colors cursor-pointer ${
                        isSelected ? 'bg-purple-50/70 border-l-4 border-l-purple-600' : ''
                      }`}
                    >
                      {/* Ticket Number & ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[11px]">
                            {ticket.ticketNumber || ticket.id}
                          </span>
                        </div>
                        {isBreached && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-bold mt-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            SLA Breached
                          </span>
                        )}
                      </td>

                      {/* Subject & Snippet */}
                      <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                        <div className="font-bold text-slate-900 truncate">{ticket.subject}</div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">{ticket.description || 'No additional details.'}</div>
                        {ticket.tags && ticket.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {ticket.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-mono"
                              >
                                #{tag}
                              </span>
                            ))}
                            {ticket.tags.length > 2 && (
                              <span className="text-[9px] text-slate-400">+{ticket.tags.length - 2}</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Shop Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{ticket.shopName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{ticket.shopId}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.8 rounded-lg border text-[10px] font-semibold ${categoryMeta.color}`}
                        >
                          <CategoryIcon className="w-3 h-3" />
                          <span>{categoryMeta.label}</span>
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.8 rounded-lg border text-[11px] ${priorityMeta.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityMeta.dot}`} />
                          <span>{priorityMeta.label}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.8 rounded-lg border text-[11px] ${statusMeta.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                          <span>{statusMeta.label}</span>
                        </span>
                      </td>

                      {/* Assigned Admin */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {ticket.assignedAdminName ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center">
                              {ticket.assignedAdminName.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-800 text-[11px] truncate max-w-[110px]">
                              {ticket.assignedAdminName.split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-medium">
                        <div>{getRelativeTime(ticket.updatedAt || ticket.createdAt)}</div>
                        <div className="text-[10px] text-slate-400">{formatDate(ticket.createdAt).split(',')[0]}</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicketId(ticket.id);
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:text-white bg-purple-50 hover:bg-purple-600 rounded-lg transition-colors cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredTickets.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-slate-400">|</span>
              <span>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filteredTickets.length)} of {filteredTickets.length} tickets
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-slate-600 font-semibold">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. TICKET DETAILS SLIDE-OVER DRAWER */}
      {activeTicket && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedTicketId(null)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="font-mono font-bold text-xs text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-md border border-purple-200">
                    {activeTicket.ticketNumber || activeTicket.id}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] ${
                      STATUS_BADGES[activeTicket.status]?.badge || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_BADGES[activeTicket.status]?.dot || 'bg-slate-400'}`} />
                    <span>{STATUS_BADGES[activeTicket.status]?.label || activeTicket.status}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] ${
                      PRIORITY_BADGES[activeTicket.priority]?.badge || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>{PRIORITY_BADGES[activeTicket.priority]?.label || activeTicket.priority}</span>
                  </span>

                  {activeTicket.category && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                      {CATEGORY_MAP[activeTicket.category]?.label || activeTicket.category}
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-slate-900 leading-snug">{activeTicket.subject}</h2>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span className="font-medium text-slate-700">{activeTicket.shopName}</span>
                  <span>•</span>
                  <span>Created {formatDate(activeTicket.createdAt)}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedTicketId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Bar (Status, Priority, Assignee) */}
            <div className="px-5 py-3 border-b border-slate-200 bg-white grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
                <select
                  value={activeTicket.status}
                  onChange={(e) => updateTicketStatus(activeTicket.id, e.target.value as TicketStatus)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="WAITING_SHOP">Waiting for Shop</option>
                  <option value="WAITING_INTERNAL">Waiting Internal</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Priority</label>
                <select
                  value={activeTicket.priority}
                  onChange={(e) => updateTicketPriority(activeTicket.id, e.target.value as TicketPriority)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assigned To</label>
                <select
                  value={activeTicket.assignedAdminId || ''}
                  onChange={(e) => assignTicket(activeTicket.id, e.target.value || undefined)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {supportAdmins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold px-5">
              <button
                onClick={() => setDrawerTab('conversation')}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  drawerTab === 'conversation'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Conversation ({activeTicket.messages?.length || 0})</span>
              </button>

              <button
                onClick={() => setDrawerTab('info')}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  drawerTab === 'info'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Ticket & Shop Details</span>
              </button>

              <button
                onClick={() => setDrawerTab('history')}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  drawerTab === 'history'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Audit Trail ({activeTicket.history?.length || 0})</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {drawerTab === 'conversation' && (
                <div className="space-y-4">
                  {/* Messages Timeline */}
                  <div className="space-y-3">
                    {activeTicket.messages && activeTicket.messages.length > 0 ? (
                      activeTicket.messages.map((msg) => {
                        const isShop = msg.senderRole === 'SHOP_OWNER';
                        const isInternal = msg.isInternalNote;

                        return (
                          <div
                            key={msg.id}
                            className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                              isInternal
                                ? 'bg-amber-50/70 border-amber-200 text-amber-900 shadow-2xs'
                                : isShop
                                ? 'bg-slate-50 border-slate-200 text-slate-800'
                                : 'bg-purple-50/70 border-purple-200 text-purple-950'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-black/5">
                              <div className="flex items-center gap-2">
                                {isInternal ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 font-bold text-[10px]">
                                    <Lock className="w-3 h-3" />
                                    Internal Note (Admins Only)
                                  </span>
                                ) : (
                                  <span
                                    className={`font-bold text-[11px] ${
                                      isShop ? 'text-slate-900' : 'text-purple-900'
                                    }`}
                                  >
                                    {msg.senderName}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 capitalize">({msg.senderRole.toLowerCase().replace('_', ' ')})</span>
                              </div>
                              <span className="text-[10px] text-slate-400">{formatDate(msg.createdAt)}</span>
                            </div>

                            <p className="whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-slate-400 text-xs">No messages recorded yet.</div>
                    )}
                  </div>

                  {/* Reply Composer */}
                  <div className="pt-4 border-t border-slate-200 space-y-3 bg-white">
                    {/* Toggle: Reply to Shop vs Internal Note */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsInternalNote(false)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                            !isInternalNote
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Reply to Shop Owner
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsInternalNote(true)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                            isInternalNote
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          <Lock className="w-3 h-3" />
                          <span>Internal Note</span>
                        </button>
                      </div>

                      {/* Quick Canned Response Picker */}
                      <div className="relative">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              setReplyText(e.target.value);
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg focus:outline-none cursor-pointer"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Insert Canned Response...
                          </option>
                          {CANNED_RESPONSES.map((cr, idx) => (
                            <option key={idx} value={cr.text}>
                              {cr.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isInternalNote && (
                      <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>This note will only be visible to platform administrators and will never be shared with the shop owner.</span>
                      </div>
                    )}

                    <textarea
                      rows={4}
                      placeholder={
                        isInternalNote
                          ? 'Add internal investigation notes, debug findings, hardware logs...'
                          : 'Write reply to the shop owner...'
                      }
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 resize-none font-medium"
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">{replyText.length} characters</span>

                      <div className="flex items-center gap-2">
                        {activeTicket.status !== 'RESOLVED' && (
                          <button
                            type="button"
                            onClick={() => updateTicketStatus(activeTicket.id, 'RESOLVED')}
                            className="px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl cursor-pointer transition-colors"
                          >
                            Mark Resolved
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleSendReply}
                          disabled={!replyText.trim() || isSendingReply}
                          className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                            isInternalNote ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-600 hover:bg-purple-700'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSendingReply ? 'Sending...' : isInternalNote ? 'Add Note' : 'Send Reply'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === 'info' && (
                <div className="space-y-4">
                  {/* Shop Details Card */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-purple-600" />
                        Shop Information
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-[10px]">
                        {activeTicketShop?.planName || 'Registered Tenant'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-slate-700">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Shop Name</span>
                        <span className="font-semibold text-slate-900">{activeTicket.shopName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Shop ID</span>
                        <span className="font-mono text-slate-700">{activeTicket.shopId}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Owner Contact</span>
                        <span>{activeTicketShop?.ownerName || 'Ramesh Patel'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone / Email</span>
                        <span>{activeTicketShop?.ownerPhone || '9825012345'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Address & City</span>
                        <span>{activeTicketShop?.address || 'Campus Square, Ahmedabad'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Related Resources */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 text-xs">
                    <span className="font-bold text-slate-900 block">Related Platform Resources</span>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                          <Printer className="w-3.5 h-3.5 text-purple-600" />
                          <span className="font-semibold text-[11px]">Related Print Job</span>
                        </div>
                        {activeTicket.relatedJobId ? (
                          <div>
                            <span className="font-mono font-bold text-purple-700">{activeTicket.relatedJobId}</span>
                            {activeTicketJob && (
                              <div className="text-[10px] text-slate-500 mt-1">
                                Status: {activeTicketJob.printStatus} • Amount: ₹{activeTicketJob.totalAmount}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">None linked</span>
                        )}
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-semibold text-[11px]">Related Payment</span>
                        </div>
                        {activeTicket.relatedPaymentId ? (
                          <div>
                            <span className="font-mono font-bold text-emerald-700">{activeTicket.relatedPaymentId}</span>
                            {activeTicketPayment && (
                              <div className="text-[10px] text-slate-500 mt-1">
                                Status: {activeTicketPayment.status} • ₹{activeTicketPayment.amount}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">None linked</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SLA Timestamps */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <span className="font-bold text-slate-900 block">SLA Deadlines & Compliance</span>
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">First Response Target</span>
                        <span>{formatDate(activeTicket.slaFirstResponseDeadline)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">First Response Logged</span>
                        <span className={activeTicket.firstResponseAt ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                          {activeTicket.firstResponseAt ? formatDate(activeTicket.firstResponseAt) : 'Pending Response'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Resolution Target</span>
                        <span>{formatDate(activeTicket.slaResolutionDeadline)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Resolved At</span>
                        <span>{activeTicket.resolvedAt ? formatDate(activeTicket.resolvedAt) : 'Not resolved'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === 'history' && (
                <div className="space-y-3">
                  {activeTicket.history && activeTicket.history.length > 0 ? (
                    activeTicket.history.map((hist) => (
                      <div
                        key={hist.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-mono">
                              {hist.action}
                            </span>
                            <span>by {hist.actorName}</span>
                          </div>
                          {(hist.previousValue || hist.newValue) && (
                            <div className="text-[11px] text-slate-600 mt-1">
                              {hist.previousValue && <span className="line-through mr-1 text-slate-400">{hist.previousValue}</span>}
                              {hist.newValue && <span className="font-semibold text-slate-900">{hist.newValue}</span>}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{formatDate(hist.createdAt)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs">No audit logs for this ticket.</div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs">
              <div className="text-slate-500">
                Ticket status: <span className="font-bold text-slate-800">{activeTicket.status}</span>
              </div>

              <div className="flex items-center gap-2">
                {activeTicket.status === 'RESOLVED' || activeTicket.status === 'CLOSED' ? (
                  <button
                    onClick={() => updateTicketStatus(activeTicket.id, 'OPEN', 'Admin reopened ticket')}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                  >
                    Reopen Ticket
                  </button>
                ) : (
                  <button
                    onClick={() => updateTicketStatus(activeTicket.id, 'CLOSED', 'Ticket officially closed')}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                  >
                    Close Ticket
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. CREATE TICKET MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div onClick={() => setIsCreateOpen(false)} className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" />
          <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                Create Support Ticket
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicketSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Shop Tenant *</label>
                <select
                  value={createForm.shopId}
                  onChange={(e) => setCreateForm({ ...createForm, shopId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                >
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name} ({shop.city || 'India'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Printer Agent lost USB spooler connection"
                  value={createForm.subject}
                  onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value as TicketCategory })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="PRINTING_ISSUE">Printing Issue</option>
                    <option value="PRINTER_OFFLINE">Printer Offline</option>
                    <option value="JOB_FAILURE">Print Job Failure</option>
                    <option value="PAYMENT_REFUND">Payment / Refund</option>
                    <option value="SUBSCRIPTION_BILLING">Subscription / Billing</option>
                    <option value="QR_CODE">QR Code Issue</option>
                    <option value="FILE_UPLOAD">File Upload Issue</option>
                    <option value="ACCOUNT_LOGIN">Account / Login</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TicketPriority })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="CRITICAL">Critical (1h response)</option>
                    <option value="HIGH">High (2h response)</option>
                    <option value="NORMAL">Normal (4h response)</option>
                    <option value="LOW">Low (8h response)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Admin</label>
                <select
                  value={createForm.assignedAdminId}
                  onChange={(e) => setCreateForm({ ...createForm, assignedAdminId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="">Unassigned (Queue)</option>
                  {supportAdmins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name} ({admin.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Initial Message *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe the issue reported by the shop owner..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Related Job ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. PJ-8821"
                    value={createForm.relatedJobId}
                    onChange={(e) => setCreateForm({ ...createForm, relatedJobId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Related Payment ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. pay_rcx_upi_9142"
                    value={createForm.relatedPaymentId}
                    onChange={(e) => setCreateForm({ ...createForm, relatedPaymentId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. SUPPORT SETTINGS & SLA CONFIGURATION MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div onClick={() => setIsSettingsOpen(false)} className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" />
          <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-purple-600" />
                Support Policies & SLA Settings
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="space-y-2">
                <span className="font-bold text-slate-900 block">SLA Deadlines by Priority (Hours)</span>
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-rose-700 uppercase mb-1">Critical Priority</label>
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500">Response:</span>
                        <input
                          type="number"
                          min={1}
                          value={settingsForm.slaPolicies.CRITICAL.responseHours}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              slaPolicies: {
                                ...settingsForm.slaPolicies,
                                CRITICAL: { ...settingsForm.slaPolicies.CRITICAL, responseHours: Number(e.target.value) }
                              }
                            })
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-center font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Resolve:</span>
                        <input
                          type="number"
                          min={1}
                          value={settingsForm.slaPolicies.CRITICAL.resolveHours}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              slaPolicies: {
                                ...settingsForm.slaPolicies,
                                CRITICAL: { ...settingsForm.slaPolicies.CRITICAL, resolveHours: Number(e.target.value) }
                              }
                            })
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-700 uppercase mb-1">High Priority</label>
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500">Response:</span>
                        <input
                          type="number"
                          min={1}
                          value={settingsForm.slaPolicies.HIGH.responseHours}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              slaPolicies: {
                                ...settingsForm.slaPolicies,
                                HIGH: { ...settingsForm.slaPolicies.HIGH, responseHours: Number(e.target.value) }
                              }
                            })
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-center font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Resolve:</span>
                        <input
                          type="number"
                          min={1}
                          value={settingsForm.slaPolicies.HIGH.resolveHours}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              slaPolicies: {
                                ...settingsForm.slaPolicies,
                                HIGH: { ...settingsForm.slaPolicies.HIGH, resolveHours: Number(e.target.value) }
                              }
                            })
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-blue-700 uppercase mb-1">Normal Priority</label>
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500">Response:</span>
                        <input
                          type="number"
                          min={1}
                          value={settingsForm.slaPolicies.NORMAL.responseHours}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              slaPolicies: {
                                ...settingsForm.slaPolicies,
                                NORMAL: { ...settingsForm.slaPolicies.NORMAL, responseHours: Number(e.target.value) }
                              }
                            })
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-center font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Resolve:</span>
                        <input
                          type="number"
                          min={1}
                          value={settingsForm.slaPolicies.NORMAL.resolveHours}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              slaPolicies: {
                                ...settingsForm.slaPolicies,
                                NORMAL: { ...settingsForm.slaPolicies.NORMAL, resolveHours: Number(e.target.value) }
                              }
                            })
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Low Priority</label>
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500">Response:</span>
                        <input
                          type="number"
                          min={1}
                          value={settingsForm.slaPolicies.LOW.responseHours}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              slaPolicies: {
                                ...settingsForm.slaPolicies,
                                LOW: { ...settingsForm.slaPolicies.LOW, responseHours: Number(e.target.value) }
                              }
                            })
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-center font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Resolve:</span>
                        <input
                          type="number"
                          min={1}
                          value={settingsForm.slaPolicies.LOW.resolveHours}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              slaPolicies: {
                                ...settingsForm.slaPolicies,
                                LOW: { ...settingsForm.slaPolicies.LOW, resolveHours: Number(e.target.value) }
                              }
                            })
                          }
                          className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto Assign */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.autoAssignEnabled}
                    onChange={(e) => setSettingsForm({ ...settingsForm, autoAssignEnabled: e.target.checked })}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Auto-assign incoming tickets to default lead</span>
                </label>

                {settingsForm.autoAssignEnabled && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Default Assignee</label>
                    <select
                      value={settingsForm.defaultAssigneeId || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, defaultAssigneeId: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold cursor-pointer"
                    >
                      {supportAdmins.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.name} ({admin.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
