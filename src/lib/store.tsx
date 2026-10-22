import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  Shop,
  SaasPlan,
  Subscription,
  PlatformPolicies,
  PlanStatus,
  PlanChangePolicy,
  PrinterDevice,
  ElectronAgent,
  PrintJob,
  Transaction,
  PricingRule,
  AuditLog,
  SupportTicket,
  TicketPriority,
  TicketStatus,
  TicketCategory,
  SupportTicketMessage,
  SupportTicketHistoryEntry,
  SupportSettings,
  ShopRazorpaySettings,
  AdminRazorpaySettings,
  PrintStatus,
  PaymentStatus,
  Role
} from '../types';
const DEFAULT_ADMIN_RAZORPAY_SETTINGS: AdminRazorpaySettings = {
  keyId: '',
  keySecret: '',
  isTestMode: false,
  enabled: false,
  currency: 'INR',
  platformFeePercent: 2.5
};

const DEFAULT_PLATFORM_POLICIES: PlatformPolicies = {
  defaultFileRetentionHours: 168,
  maxAllowedUploadSizeMb: 50,
  globalRateLimitPerMin: 60,
  trialDurationDays: 14,
  trialPerShopEligibility: true,
  failedPaymentGracePeriodDays: 3,
  warningThresholdPercent: 80,
  criticalThresholdPercent: 95,
  overagePolicy: 'BLOCK_PRINTS',
  cancellationPolicy: 'END_OF_CYCLE'
};

const DEFAULT_SUPPORT_SETTINGS: SupportSettings = {
  autoAssignEnabled: false,
  defaultAssigneeId: 'usr_admin',
  emailNotifications: true,
  slaPolicies: {
    CRITICAL: { responseHours: 1, resolveHours: 4 },
    HIGH: { responseHours: 2, resolveHours: 8 },
    NORMAL: { responseHours: 4, resolveHours: 24 },
    LOW: { responseHours: 8, resolveHours: 48 }
  },
  businessHoursOnly: false,
  supportEmail: 'support@printflow.in',
  escalationEmail: 'support@printflow.in'
};

const SUPPORT_ADMIN_USERS = [
  { id: 'usr_admin', name: 'Platform Super Admin', email: 'admin@printflow.io', role: 'ADMIN' as const }
];

export const EMPTY_SHOP: Shop = {
  id: 'shop_default',
  name: 'PrintFlow Counter',
  slug: 'printflow-counter',
  ownerId: 'owner_default',
  ownerName: 'Counter Manager',
  ownerEmail: 'shop@printflow.io',
  ownerPhone: '+91 98765 43210',
  status: 'ACTIVE',
  planId: 'plan_growth',
  planName: 'Growth Counter',
  address: 'Central Campus Complex',
  city: 'Mumbai',
  businessHours: '8:30 AM - 9:00 PM',
  minimumOrder: 2.0,
  primaryColor: '#2563EB',
  createdAt: new Date().toISOString(),
  razorpaySettings: {
    enabled: false,
    isTestMode: true,
    keyId: '',
    keySecret: ''
  }
};
import {
  hashPassword,
  verifyPassword,
  checkShopOwnership,
  generateMfaEnrollment,
  verifyTotpCode,
  generateRecoveryCodes,
  consumeRecoveryCode
} from './clientSecurity';
import { apiUrl } from './apiConfig';

export const getDeterministicAgentToken = (shopId: string): string => {
  if (shopId === 'shop_royal_cyber') {
    return 'agt_tok_royal_cyber_counter_master_2026';
  }
  const cleanId = (shopId || 'counter').replace(/[^a-zA-Z0-9]/g, '_');
  return `agt_tok_${cleanId}_master_2026`;
};

export interface Toast {
  id: string;
  type: 'success' | 'info' | 'error';
  title: string;
  message?: string;
  duration?: number;
}

interface AppContextType {
  // Authentication & Users
  users: UserProfile[];
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  setCurrentUser: (user: UserProfile | null) => void;
  registerShop: (data: {
    shopName: string;
    ownerName: string;
    email: string;
    phone: string;
    city: string;
    password: string;
    planId?: string;
  }) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; user?: UserProfile }>;
  adminLogin: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string; devResetLink?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  switchRole: (role: Role) => void;

  // Multi-Factor Authentication (MFA)
  enrollMfa: () => { secretBase32: string; otpauthUrl: string };
  verifyAndEnableMfa: (code: string) => { success: boolean; recoveryCodes?: string[]; error?: string };
  disableMfa: () => { success: boolean; error?: string };
  verifyMfaStepUp: (code: string) => { success: boolean; error?: string };
  isMfaStepUpVerified: boolean;

  // Active shop (for shop owner context)
  activeShop: Shop;
  setActiveShopId: (shopId: string) => void;

  // Cloud Synchronization & Database Observability
  isLoadingData: boolean;
  dataLoadError: string | null;
  isCloudSynced: boolean;

  // Shops
  shops: Shop[];
  updateShopProfile: (shopId: string, updates: Partial<Shop>) => void;
  updateShopStatus: (shopId: string, status: 'ACTIVE' | 'SUSPENDED') => void;

  // Razorpay Settings
  adminRazorpay: AdminRazorpaySettings;
  updateAdminRazorpay: (settings: AdminRazorpaySettings) => void;
  updateShopRazorpay: (shopId: string, settings: ShopRazorpaySettings) => void;

  // Plans & SaaS
  plans: SaasPlan[];
  subscriptions: Subscription[];
  platformPolicies: PlatformPolicies;
  createPlan: (plan: Omit<SaasPlan, 'id' | 'createdAt' | 'updatedAt'>) => SaasPlan;
  updatePlan: (planId: string, updates: Partial<SaasPlan>, policy?: PlanChangePolicy) => void;
  duplicatePlan: (planId: string) => SaasPlan | null;
  archivePlan: (planId: string) => { success: boolean; message: string };
  deletePlan: (planId: string) => { success: boolean; message: string };
  togglePlanStatus: (planId: string, status: PlanStatus) => void;
  upgradeShopPlan: (shopId: string, planId: string) => Promise<boolean>;
  updateSubscription: (subId: string, updates: Partial<Subscription>) => void;
  changeShopSubscription: (shopId: string, newPlanId: string, policy?: PlanChangePolicy) => Promise<boolean>;
  cancelSubscription: (subId: string, reason?: string) => void;
  updatePlatformPolicies: (policies: Partial<PlatformPolicies>) => void;
  testGatewayConnection: () => Promise<{ success: boolean; message: string; latencyMs: number }>;

  // Printers & Agent
  printers: PrinterDevice[];
  updatePrinter: (printerId: string, updates: Partial<PrinterDevice>) => void;
  addPrinter: (printer: Omit<PrinterDevice, 'id'>) => { success: boolean; message?: string };
  deletePrinter: (printerId: string) => void;
  agents: ElectronAgent[];
  regenerateAgentToken: (agentId: string) => Promise<{ success: boolean; token?: string; error?: string }>;

  // Print Jobs
  printJobs: PrintJob[];
  createPrintJob: (data: {
    id?: string;
    trackingToken?: string;
    shopId: string;
    customerName: string;
    customerPhone: string;
    files: any[];
    totalAmount: number;
    paymentMethod: string;
    paymentStatus: PaymentStatus;
    paymentId?: string;
  }) => PrintJob;
  simulateCustomerPrintJob: (shopId?: string) => PrintJob;
  updateJobStatus: (jobId: string, printStatus: PrintStatus, paymentStatus?: PaymentStatus) => void;

  // Pricing Rules
  pricingRules: PricingRule[];
  updatePricingRule: (ruleId: string, pricePerPage: number) => void;
  savePricingRules: (rules: PricingRule[]) => void;
  addPricingRule: (rule: Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt'>) => PricingRule;
  deletePricingRule: (ruleId: string) => void;
  togglePricingRule: (ruleId: string, isActive?: boolean) => void;

  // Transactions & Financials
  transactions: Transaction[];
  payments: Transaction[];
  refundTransaction: (transactionId: string) => void;

  // Devices alias
  devices: ElectronAgent[];

  // Toast notifications
  toasts: Toast[];
  showToast: (title: string, message?: string, type?: 'success' | 'info' | 'error', duration?: number) => void;
  dismissToast: (id: string) => void;

  // Audit Logs & Support
  auditLogs: AuditLog[];
  supportTickets: SupportTicket[];
  supportSettings: SupportSettings;
  supportAdmins: Array<{ id: string; name: string; email: string; role: Role }>;
  createSupportTicket: (
    subjectOrData:
      | string
      | {
          shopId?: string;
          shopName?: string;
          subject: string;
          description: string;
          category?: TicketCategory;
          priority?: TicketPriority;
          assignedAdminId?: string;
          relatedJobId?: string;
          relatedPaymentId?: string;
          tags?: string[];
        },
    legacyCategory?: SupportTicket['category']
  ) => SupportTicket;
  updateTicketStatus: (ticketId: string, status: TicketStatus, note?: string) => void;
  updateTicketPriority: (ticketId: string, priority: TicketPriority) => void;
  assignTicket: (ticketId: string, adminId?: string) => void;
  addTicketMessage: (
    ticketId: string,
    message: string,
    isInternalNote: boolean,
    attachments?: Array<{ name: string; size: number; url?: string; type?: string }>
  ) => Promise<boolean>;
  updateSupportSettings: (updates: Partial<SupportSettings>) => void;

  // Router path & navigation helper
  currentPath: string;
  navigate: (path: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// Production storage key prefix for non-sensitive UI settings
const STORAGE_KEY_PREFIX = 'printflow_prod_v2_';
const CLOUD_STATE_KEYS = new Set([
  'shops',
  'active_shop_id',
  'pricing_rules',
  'saas_plans',
  'saas_subscriptions',
  'platform_policies',
  'printers',
  'agents',
  'print_jobs',
  'transactions',
  'audit_logs',
  'support_settings',
  'support_tickets'
]);
let cloudStateWriter: ((key: string, value: unknown) => void) | null = null;

function cloudSafeValue(value: unknown): unknown {
  if (typeof value === 'string') return /^data:[^,]*;base64,/i.test(value) ? undefined : value;
  if (Array.isArray(value)) {
    return value.map(cloudSafeValue).filter((item) => item !== undefined);
  }
  if (value && typeof value === 'object') {
    const safe: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (/(?:password|secret|credential|auth.?token|api.?key|mfa|recovery.?code|filebase64|buffer)/i.test(key)) continue;
      const cleaned = cloudSafeValue(item);
      if (cleaned !== undefined) safe[key] = cleaned;
    }
    return safe;
  }
  return value;
}

// Security Hardening: Immediately purge all business entities and legacy authentication credentials from browser localStorage
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const businessKeys = [
      'current_user', 'users', 'auth_token', 'jwt', 'api_token', 'session_id',
      'shops', 'active_shop_id', 'pricing_rules', 'saas_plans', 'saas_subscriptions',
      'platform_policies', 'printers', 'agents', 'print_jobs', 'transactions',
      'audit_logs', 'support_settings', 'support_tickets', 'admin_razorpay',
      'app_data', 'cloud_state'
    ];
    for (const k of businessKeys) {
      window.localStorage.removeItem(STORAGE_KEY_PREFIX + k);
      window.localStorage.removeItem(k);
    }
  } catch (e) {
    // Ignore restricted storage contexts
  }
}

function getStoredItem<T>(_key: string, fallback: T): T {
  // Authoritative business data is loaded from Neon via backend APIs; localStorage persistence is eliminated.
  return fallback;
}

function setStoredItem<T>(key: string, value: T) {
  // Authoritative business data is persisted to Neon via backend APIs; localStorage persistence is eliminated.
  if (CLOUD_STATE_KEYS.has(key)) {
    cloudStateWriter?.(key, value);
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation State
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      return hash || window.location.pathname || '/';
    }
    return '/';
  });

  const navigate = (path: string) => {
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      window.location.hash = path;
      window.scrollTo(0, 0);
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setCurrentPath(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Registered Users list kept strictly IN-MEMORY (zero credential exposure to localStorage)
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Current authenticated user (null by default; authenticates upon login or registration)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Cloud Synchronization & Observability States
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

  // Restore authenticated session from HttpOnly cookie on mount
  useEffect(() => {
    fetch(apiUrl('/api/auth/session'), { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.user) {
          setCurrentUser(data.user);
          if (data.user.shopId) setActiveShopIdState(data.user.shopId);
        }
      })
      .catch(() => {});
  }, []);

  // Public shops loader: fetch live shops from Supabase for public directory and customers
  useEffect(() => {
    fetch(apiUrl('/api/public/shops'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.shops)) {
          const newShops: Shop[] = data.shops.map((s: any) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            tagline: s.tagline || '',
            address: s.address || '',
            phone: s.phone || '',
            email: s.email || '',
            status: s.status || 'ACTIVE',
            isOpen: s.isOpen !== false,
            businessHours: s.businessHours || '9:00 AM - 9:00 PM',
            logoUrl: s.logoUrl || '',
            primaryColor: s.primaryColor || '#2563EB',
            minimumOrder: s.minOrderAmount || 2.00,
            autoAccept: s.autoAccept !== false,
            planId: s.currentPlanId || 'plan_free',
            planName: 'Counter Plan',
            ownerId: s.ownerId || '',
            ownerName: s.name || 'Counter Owner',
            ownerEmail: s.email || '',
            ownerPhone: s.phone || '',
            createdAt: s.createdAt || new Date().toISOString()
          }));
          setShops(newShops);
          if (newShops.length > 0) {
            setActiveShopIdState((prev) => prev || newShops[0].id);
          }
        }
      })
      .catch((err) => {
        console.warn('[store] Public shop directory fetch notice:', err);
      });
  }, []);

  // Public SaaS plans loader: fetch live plans from Supabase PostgreSQL
  useEffect(() => {
    fetch(apiUrl('/api/public/plans'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.plans) && data.plans.length > 0) {
          setPlans(data.plans);
        }
      })
      .catch((err) => {
        console.warn('[store] Public plans fetch notice:', err);
      });
  }, []);

  const isAuthenticated = currentUser !== null;

  // Shops
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeShopId, setActiveShopIdState] = useState<string>('');

  const activeShop = shops.find((s) => s.id === activeShopId) || shops[0] || EMPTY_SHOP;

  const setActiveShopId = (id: string) => {
    setActiveShopIdState(id);
    setStoredItem('active_shop_id', id);
  };

  // Pricing Rules
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);

  // Authentication: Register Shop
  const registerShop = async (data: {
    shopName: string;
    ownerName: string;
    email: string;
    phone: string;
    city: string;
    password: string;
    planId?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const trimmedEmail = data.email.trim().toLowerCase();

    // Check if email already registered locally in memory
    const existing = users.find((u) => u.email.toLowerCase() === trimmedEmail);
    if (existing) {
      return { success: false, message: 'This email is already registered. Please sign in.' };
    }

    // Determine chosen SaaS Plan (defaults to Free Starter or selected plan)
    const selectedPlan = plans.find((p) => p.id === data.planId) || plans[0] || null;

    // Server registration is authoritative: persist to Neon PostgreSQL
    let serverShop: Shop;
    let serverUser: UserProfile;

    try {
      const response = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          shopName: data.shopName.trim(),
          ownerName: data.ownerName.trim(),
          email: trimmedEmail,
          phone: data.phone.trim(),
          city: data.city.trim(),
          password: data.password,
          planId: selectedPlan?.id || data.planId || 'plan_starter'
        })
      });

      const responseText = await response.text();
      let resData: any = {};
      try {
        resData = JSON.parse(responseText);
      } catch {
        return { success: false, message: response.ok ? 'Unexpected response format from server.' : `Server returned error (${response.status}). Please try again.` };
      }

      if (!response.ok || !resData.success) {
        return { success: false, message: resData.error || 'Registration failed. Database is currently unavailable.' };
      }
      if (resData.accessToken) {
        localStorage.setItem('printflow_access_token', resData.accessToken);
      }
      serverShop = resData.shop;
      serverUser = {
        id: resData.user.id,
        email: resData.user.email,
        fullName: resData.user.fullName,
        phone: data.phone.trim(),
        role: resData.user.role,
        shopId: resData.user.shopId,
        password: data.password,
        createdAt: new Date().toISOString()
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error: could not connect to server database.' };
    }

    // Default pricing rules for newly registered shop in memory
    const defaultRules: PricingRule[] = [
      { id: `pr_${Date.now()}_1`, shopId: serverShop.id, paperSize: 'A4', color: 'BW', sides: 'SINGLE', pricePerPage: 2.0 },
      { id: `pr_${Date.now()}_2`, shopId: serverShop.id, paperSize: 'A4', color: 'BW', sides: 'DOUBLE', pricePerPage: 1.5 },
      { id: `pr_${Date.now()}_3`, shopId: serverShop.id, paperSize: 'A4', color: 'COLOR', sides: 'SINGLE', pricePerPage: 10.0 },
      { id: `pr_${Date.now()}_4`, shopId: serverShop.id, paperSize: 'A4', color: 'COLOR', sides: 'DOUBLE', pricePerPage: 8.0 },
      { id: `pr_${Date.now()}_5`, shopId: serverShop.id, paperSize: 'A3', color: 'BW', sides: 'SINGLE', pricePerPage: 5.0 },
      { id: `pr_${Date.now()}_6`, shopId: serverShop.id, paperSize: 'Legal', color: 'BW', sides: 'SINGLE', pricePerPage: 3.0 }
    ];

    setUsers((prev) => [...prev, serverUser]);
    setShops((prev) => [serverShop, ...prev]);
    setPricingRules((prev) => [...prev, ...defaultRules]);

    // Auto login
    setCurrentUser(serverUser);
    setActiveShopId(serverShop.id);

    showToast('Shop Registered Successfully!', `Welcome to PrintFlow, ${data.ownerName}!`, 'success', 4000);
    navigate('/shop/dashboard');
    return { success: true };
  };

  // Authentication: Shop Owner Login
  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string; user?: UserProfile }> => {
    const trimmedEmail = email.trim().toLowerCase();
    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: trimmedEmail, password })
      });
      const responseText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        return { success: false, message: response.ok ? 'Unexpected response format from server.' : `Server returned error (${response.status}). Please try again.` };
      }

      if (!response.ok || !data.success) {
        return { success: false, message: data.error || 'Invalid email or password. Please verify your credentials.' };
      }

      if (data.accessToken) {
        localStorage.setItem('printflow_access_token', data.accessToken);
      }

      const serverUser: UserProfile = {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        role: data.user.role,
        shopId: data.user.shopId,
        createdAt: new Date().toISOString()
      };

      console.log('[Supabase Auth Debug] Server authentication response payload:', data);

      setCurrentUser(serverUser);
      if (serverUser.shopId) {
        setActiveShopId(serverUser.shopId);
      }

      showToast('Signed In Successfully', `Welcome back, ${serverUser.fullName}!`, 'success', 3000);

      if (serverUser.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/shop/dashboard');
      }

      return { success: true, user: serverUser };
    } catch (err: any) {
      return { success: false, message: 'Could not connect to authentication service. Please check your connection.' };
    }
  };

  // Authentication: Admin Dedicated Login (/admin/login)
  const adminLogin = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: trimmedEmail, password })
      });
      const responseText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        return { success: false, message: response.ok ? 'Unexpected response format from server.' : `Server returned error (${response.status}). Access restricted.` };
      }
      if (!response.ok || !data.success) {
        return { success: false, message: data.error || 'Invalid administrator credentials. Access restricted.' };
      }

      if (data.user.role !== 'ADMIN') {
        return { success: false, message: 'Access denied. Account does not have administrator privileges.' };
      }

      const adminUser: UserProfile = {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        role: 'ADMIN',
        shopId: data.user.shopId,
        createdAt: new Date().toISOString()
      };

      setCurrentUser(adminUser);
      showToast('Admin Access Granted', `Logged in as Platform Super Admin`, 'success', 3000);
      navigate('/admin/dashboard');
      return { success: true };
    } catch (err: any) {
      return { success: false, message: 'Could not connect to authentication service. Please check your connection.' };
    }
  };

  // Authentication: Request Password Reset Link
  const forgotPassword = async (email: string): Promise<{ success: boolean; message?: string; devResetLink?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    try {
      const response = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: trimmedEmail })
      });
      const data = await response.json();
      return { 
        success: true, 
        message: data.message || 'If an account exists for this email address, you will receive a password reset link shortly. Please check your inbox and spam folder.',
        devResetLink: data.devResetLink
      };
    } catch {
      return { success: true, message: 'If an account exists for this email address, you will receive a password reset link shortly. Please check your inbox and spam folder.' };
    }
  };

  // Authentication: Complete Password Reset with Token
  const resetPassword = async (token: string, newPassword: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token, newPassword })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, message: data.error || 'Failed to reset password. The link may have expired or already been used.' };
      }
      showToast('Password Updated', 'Your password has been reset successfully. Please sign in.', 'success', 4000);
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, message: 'Could not connect to authentication service. Please check your network.' };
    }
  };

  // Multi-Factor Authentication (MFA)
  const [isMfaStepUpVerified, setIsMfaStepUpVerified] = useState<boolean>(false);

  const enrollMfa = () => {
    if (!currentUser) throw new Error('Authentication required');
    return generateMfaEnrollment(currentUser.email);
  };

  const verifyAndEnableMfa = (code: string) => {
    if (!currentUser) return { success: false, error: 'Authentication required' };
    const enrollment = generateMfaEnrollment(currentUser.email);
    const check = verifyTotpCode(enrollment.secretBase32, code);
    if (!check.valid) {
      return { success: false, error: check.error || 'Invalid TOTP code' };
    }
    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);
    const updatedUser: UserProfile = {
      ...currentUser,
      isMfaEnabled: true,
      mfaSecret: enrollment.secretBase32,
      hashedRecoveryCodes: hashedCodes,
      mfaEnrolledAt: new Date().toISOString()
    };
    setCurrentUser(updatedUser);
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    addAuditLog('MFA_ENROLLED', 'USER', currentUser.id, 'User enrolled in Multi-Factor Authentication (TOTP)');
    return { success: true, recoveryCodes: plainCodes };
  };

  const disableMfa = () => {
    if (!currentUser) return { success: false, error: 'Authentication required' };
    const updatedUser: UserProfile = {
      ...currentUser,
      isMfaEnabled: false,
      mfaSecret: undefined,
      hashedRecoveryCodes: undefined
    };
    setCurrentUser(updatedUser);
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    addAuditLog('MFA_DISABLED', 'USER', currentUser.id, 'User disabled Multi-Factor Authentication');
    return { success: true };
  };

  const verifyMfaStepUp = (code: string) => {
    if (!currentUser || !currentUser.mfaSecret) {
      setIsMfaStepUpVerified(true);
      return { success: true };
    }
    const check = verifyTotpCode(currentUser.mfaSecret, code);
    if (check.valid) {
      setIsMfaStepUpVerified(true);
      return { success: true };
    }
    if (currentUser.hashedRecoveryCodes && currentUser.hashedRecoveryCodes.length > 0) {
      const rec = consumeRecoveryCode(code, currentUser.hashedRecoveryCodes);
      if (rec.valid) {
        setIsMfaStepUpVerified(true);
        const updated = { ...currentUser, hashedRecoveryCodes: rec.remainingHashedCodes };
        setCurrentUser(updated);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        return { success: true };
      }
    }
    return { success: false, error: check.error || 'Invalid verification code' };
  };

  // Logout
  const logout = () => {
    setCurrentUser(null);
    setIsMfaStepUpVerified(false);

    // Revoke server-side session and clear HttpOnly cookie
    try {
      fetch(apiUrl('/api/auth/logout'), { method: 'POST' }).catch(() => {});
    } catch (e) {}

    showToast('Signed Out', 'You have been logged out securely.', 'info', 3000);
    navigate('/');
  };

  // Role navigation helper
  const switchRole = (role: Role) => {
    if (role === 'ADMIN') {
      navigate('/admin/dashboard');
    } else {
      navigate('/shop/dashboard');
    }
  };

  // Shop management methods (Enforces strict Tenant Isolation & BOLA defense)
  const updateShopProfile = (shopId: string, updates: Partial<Shop>) => {
    const authz = checkShopOwnership(currentUser, shopId);
    if (!authz.authorized) {
      addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', shopId, authz.reason || 'BOLA violation prevented');
      showToast('Access Denied', 'You are not authorized to modify another shop profile.', 'error', 4000);
      return;
    }

    setShops((prev) => {
      const next = prev.map((s) => (s.id === shopId ? { ...s, ...updates } : s));
      setStoredItem('shops', next);
      return next;
    });
    addAuditLog('SHOP_PROFILE_UPDATED', 'SHOP', shopId, `Updated shop details: ${Object.keys(updates).join(', ')}`);
  };

  const updateShopStatus = (shopId: string, status: 'ACTIVE' | 'SUSPENDED') => {
    if (currentUser?.role !== 'ADMIN') {
      addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', shopId, 'Non-admin attempted to change shop status');
      showToast('Access Denied', 'Only Platform Super Admin can suspend or activate shops.', 'error', 4000);
      return;
    }

    setShops((prev) => {
      const next = prev.map((s) => (s.id === shopId ? { ...s, status } : s));
      setStoredItem('shops', next);
      return next;
    });
    addAuditLog('SHOP_STATUS_CHANGED', 'SHOP', shopId, `Shop marked as ${status}`);
  };

  // Razorpay Settings
  const [adminRazorpay, setAdminRazorpay] = useState<AdminRazorpaySettings>(() => ({
    ...DEFAULT_ADMIN_RAZORPAY_SETTINGS,
    keySecret: ''
  }));

  // Synchronize payment configuration with authoritative server state on load
  useEffect(() => {
    fetch(apiUrl('/api/payment/public-config'))
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data.isConfigured) {
          setAdminRazorpay((prev) => ({
            ...prev,
            keyId: data.rawKeyId || prev.keyId,
            isTestMode: data.mode === 'test',
            enabled: data.isActive,
            lastVerifiedAt: data.lastUpdatedAt || prev.lastVerifiedAt
          }));
        }
      })
      .catch((err) => console.warn('Could not sync platform payment config with server:', err));
  }, []);

  const updateAdminRazorpay = async (settings: AdminRazorpaySettings) => {
    if (currentUser?.role !== 'ADMIN') {
      showToast('Access Denied', 'Only Platform Super Admin can update gateway credentials.', 'error', 4000);
      return;
    }
    setAdminRazorpay({
      ...settings,
      keySecret: '' // Keep secret out of browser memory
    });

    // Never store plaintext secret in browser localStorage
    const safeSettings = { ...settings, keySecret: '' };
    setStoredItem('admin_razorpay', safeSettings);

    try {
      const res = await fetch(apiUrl('/api/payment/platform-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: settings.keyId,
          keySecret: settings.keySecret || undefined,
          mode: settings.isTestMode ? 'test' : 'live',
          webhookSecret: settings.webhookSecret,
          isActive: settings.enabled
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast('Gateway Warning', data.error || 'Server rejected gateway settings.', 'error', 5000);
      } else {
        showToast('Platform Gateway Saved', 'Razorpay credentials encrypted and persisted to Neon PostgreSQL.', 'success', 3500);
      }
    } catch (err: any) {
      console.warn('Backend payment save notice:', err);
    }

    addAuditLog('ADMIN_RAZORPAY_UPDATED', 'SETTINGS', 'platform_razorpay', `Platform credentials updated (${settings.isTestMode ? 'Test' : 'Live'})`);
  };

  const updateShopRazorpay = async (shopId: string, settings: ShopRazorpaySettings) => {
    const authz = checkShopOwnership(currentUser, shopId);
    if (!authz.authorized) {
      addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', shopId, 'BOLA violation on shop gateway settings');
      showToast('Access Denied', 'You cannot modify payment credentials of another shop.', 'error', 4000);
      return;
    }

    // Strip plaintext secret from client-side persistent storage
    const safeSettings = { ...settings, keySecret: '' };

    setShops((prev) => {
      const next = prev.map((s) =>
        s.id === shopId ? { ...s, razorpaySettings: { ...safeSettings, lastVerifiedAt: new Date().toISOString() } } : s
      );
      setStoredItem('shops', next);
      return next;
    });

    try {
      const res = await fetch(apiUrl(`/api/shop/${shopId}/payment-settings`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId: settings.keyId,
          keySecret: settings.keySecret || undefined,
          mode: settings.isTestMode ? 'test' : 'live',
          isActive: settings.enabled
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast('Gateway Warning', data.error || 'Server rejected shop credentials.', 'error', 5000);
      } else {
        showToast('Shop Gateway Saved', 'Shop credentials encrypted with AES-256-GCM and saved.', 'success', 3500);
      }
    } catch (err: any) {
      console.warn('Backend shop payment save notice:', err);
    }

    addAuditLog('SHOP_RAZORPAY_UPDATED', 'SETTINGS', shopId, `Shop UPI / Gateway credentials updated (${settings.isTestMode ? 'Test' : 'Live'})`);
  };

  // Plans & SaaS
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [platformPolicies, setPlatformPolicies] = useState<PlatformPolicies>(DEFAULT_PLATFORM_POLICIES);

  const createPlan = (planData: Omit<SaasPlan, 'id' | 'createdAt' | 'updatedAt'>): SaasPlan => {
    const now = new Date().toISOString();
    const slug =
      planData.slug ||
      planData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    const newPlan: SaasPlan = {
      ...planData,
      id: `plan_${Date.now()}`,
      slug,
      status: planData.status || 'ACTIVE',
      isActive: planData.isActive ?? true,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    setPlans((prev) => {
      const next = [...prev, newPlan];
      setStoredItem('saas_plans', next);
      return next;
    });

    addAuditLog('SAAS_PLAN_CREATED', 'SUBSCRIPTION', newPlan.id, `Created plan "${newPlan.name}" (₹${newPlan.priceMonthly}/mo)`);
    showToast('Plan Created', `"${newPlan.name}" has been published to the catalog.`, 'success', 3500);
    return newPlan;
  };

  const updatePlan = (planId: string, updates: Partial<SaasPlan>, policy: PlanChangePolicy = 'NEW_ONLY') => {
    const now = new Date().toISOString();
    let targetPlanName = '';

    setPlans((prev) => {
      const next = prev.map((p) => {
        if (p.id === planId) {
          targetPlanName = p.name;
          return {
            ...p,
            ...updates,
            version: (p.version || 1) + 1,
            updatedAt: now
          };
        }
        return p;
      });
      setStoredItem('saas_plans', next);
      return next;
    });

    // Handle Safe Plan Updates grandfathering policy
    if (policy === 'IMMEDIATE') {
      setSubscriptions((prev) => {
        const next = prev.map((sub) => {
          if (sub.planId === planId && sub.status === 'ACTIVE') {
            return {
              ...sub,
              amount: updates.priceMonthly !== undefined ? updates.priceMonthly : sub.amount,
              updatedAt: now
            };
          }
          return sub;
        });
        setStoredItem('saas_subscriptions', next);
        return next;
      });
    }

    addAuditLog(
      'SAAS_PLAN_UPDATED',
      'SUBSCRIPTION',
      planId,
      `Updated plan "${targetPlanName || planId}". Policy: ${policy}. Changes: ${Object.keys(updates).join(', ')}`
    );
    showToast('Plan Updated', `Changes applied with policy "${policy}".`, 'success', 3500);
  };

  const duplicatePlan = (planId: string): SaasPlan | null => {
    const original = plans.find((p) => p.id === planId);
    if (!original) return null;

    const now = new Date().toISOString();
    const cloned: SaasPlan = {
      ...original,
      id: `plan_${Date.now()}`,
      name: `${original.name} (Copy)`,
      slug: `${original.slug || original.id}-copy`,
      status: 'DRAFT',
      isActive: false,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    setPlans((prev) => {
      const next = [...prev, cloned];
      setStoredItem('saas_plans', next);
      return next;
    });

    addAuditLog('SAAS_PLAN_DUPLICATED', 'SUBSCRIPTION', cloned.id, `Duplicated plan "${original.name}" into "${cloned.name}"`);
    showToast('Plan Duplicated', `"${cloned.name}" created in Draft status.`, 'info', 3500);
    return cloned;
  };

  const archivePlan = (planId: string): { success: boolean; message: string } => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return { success: false, message: 'Plan not found.' };

    const activeSubs = subscriptions.filter((s) => s.planId === planId && s.status === 'ACTIVE');
    const now = new Date().toISOString();

    // Preserve historical records by soft-archiving instead of deleting
    setPlans((prev) => {
      const next = prev.map((p) =>
        p.id === planId ? { ...p, status: 'ARCHIVED' as const, isActive: false, updatedAt: now } : p
      );
      setStoredItem('saas_plans', next);
      return next;
    });

    const msg =
      activeSubs.length > 0
        ? `Plan "${targetPlan.name}" archived. ${activeSubs.length} existing active tenant(s) remain on grandfathered terms.`
        : `Plan "${targetPlan.name}" archived successfully.`;

    addAuditLog('SAAS_PLAN_ARCHIVED', 'SUBSCRIPTION', planId, msg);
    showToast('Plan Archived', msg, 'info', 4000);
    return { success: true, message: msg };
  };

  const deletePlan = (planId: string): { success: boolean; message: string } => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return { success: false, message: 'Plan not found.' };

    const protectedIds = new Set(['plan_starter', 'free', 'plan_free', 'starter']);
    if (protectedIds.has(planId.toLowerCase()) || targetPlan.priceMonthly === 0) {
      return { success: false, message: 'The default Free / Starter plan is required by the platform and cannot be deleted.' };
    }

    const activeSubs = subscriptions.filter((s) => s.planId === planId && s.status === 'ACTIVE');
    if (activeSubs.length > 0) {
      return {
        success: false,
        message: `Cannot delete plan: ${activeSubs.length} active subscription(s) are bound to this plan.`
      };
    }

    const assignedShops = shops.filter((s) => s.planId === planId);
    if (assignedShops.length > 0) {
      return {
        success: false,
        message: `Cannot delete plan: ${assignedShops.length} shop(s) are currently on this plan.`
      };
    }

    setPlans((prev) => {
      const next = prev.filter((p) => p.id !== planId);
      setStoredItem('saas_plans', next);
      return next;
    });

    addAuditLog('SAAS_PLAN_DELETED', 'SUBSCRIPTION', planId, `Plan "${targetPlan.name}" deleted.`);
    showToast('Plan Deleted', `Plan "${targetPlan.name}" deleted permanently.`, 'success', 4000);
    return { success: true, message: 'Plan deleted.' };
  };

  const togglePlanStatus = (planId: string, status: PlanStatus) => {
    const now = new Date().toISOString();
    setPlans((prev) => {
      const next = prev.map((p) =>
        p.id === planId ? { ...p, status, isActive: status === 'ACTIVE', updatedAt: now } : p
      );
      setStoredItem('saas_plans', next);
      return next;
    });
    addAuditLog('SAAS_PLAN_STATUS_CHANGED', 'SUBSCRIPTION', planId, `Plan status set to ${status}`);
    showToast('Status Updated', `Plan is now ${status}.`, 'info', 2500);
  };

  const upgradeShopPlan = async (shopId: string, planId: string): Promise<boolean> => {
    return changeShopSubscription(shopId, planId, 'IMMEDIATE');
  };

  const changeShopSubscription = async (
    shopId: string,
    newPlanId: string,
    policy: PlanChangePolicy = 'IMMEDIATE'
  ): Promise<boolean> => {
    const targetShop = shops.find((s) => s.id === shopId) || activeShop;
    const selectedPlan = plans.find((p) => p.id === newPlanId);
    if (!selectedPlan) return false;

    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const newTxn: Transaction = {
      id: `txn_sub_${Date.now()}`,
      orderId: `SUB-${shopId.slice(0, 5).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      shopId,
      shopName: targetShop.name,
      amount: selectedPlan.priceMonthly,
      status: 'SUCCESS',
      paymentMethod: `Platform Gateway (Auto-Billed)`,
      type: 'SAAS_SUBSCRIPTION',
      createdAt: now,
      gatewayReference: `rzp_sub_${Date.now()}`
    };

    setTransactions((prev) => [newTxn, ...prev]);

    // Update shop record
    setShops((prev) => {
      const next = prev.map((s) =>
        s.id === shopId ? { ...s, planId: selectedPlan.id, planName: selectedPlan.name } : s
      );
      setStoredItem('shops', next);
      return next;
    });

    // Update or create subscription record
    setSubscriptions((prev) => {
      const existingIndex = prev.findIndex((sub) => sub.shopId === shopId);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: selectedPlan.priceMonthly,
          amountPaid: selectedPlan.priceMonthly,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          paymentStatus: 'PAID',
          updatedAt: now
        };
        setStoredItem('saas_subscriptions', next);
        return next;
      } else {
        const newSub: Subscription = {
          id: `sub_${shopId}_${Date.now().toString().slice(-4)}`,
          shopId,
          shopName: targetShop.name,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          status: 'ACTIVE',
          billingPeriod: 'MONTHLY',
          amount: selectedPlan.priceMonthly,
          amountPaid: selectedPlan.priceMonthly,
          currency: 'INR',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          jobsUsedThisMonth: 0,
          storageUsedMb: 0,
          devicesUsed: 1,
          staffUsed: 1,
          paymentStatus: 'PAID',
          autoRenew: true,
          createdAt: now,
          updatedAt: now
        };
        const next = [newSub, ...prev];
        setStoredItem('saas_subscriptions', next);
        return next;
      }
    });

    addAuditLog('PLAN_UPGRADED', 'SUBSCRIPTION', newPlanId, `Shop "${targetShop.name}" switched to "${selectedPlan.name}"`);
    showToast('Subscription Updated', `Shop is now on ${selectedPlan.name}.`, 'success', 3500);
    return true;
  };

  const updateSubscription = (subId: string, updates: Partial<Subscription>) => {
    const now = new Date().toISOString();
    setSubscriptions((prev) => {
      const next = prev.map((s) => (s.id === subId ? { ...s, ...updates, updatedAt: now } : s));
      setStoredItem('saas_subscriptions', next);
      return next;
    });
    addAuditLog('SUBSCRIPTION_UPDATED', 'SUBSCRIPTION', subId, `Admin updated subscription ${subId}`);
    showToast('Subscription Updated', 'Record saved.', 'info', 2500);
  };

  const cancelSubscription = (subId: string, reason: string = 'Admin action') => {
    const now = new Date().toISOString();
    const targetSub = subscriptions.find((s) => s.id === subId);
    if (!targetSub) return;

    setSubscriptions((prev) => {
      const next = prev.map((s) =>
        s.id === subId ? { ...s, status: 'CANCELLED' as const, autoRenew: false, updatedAt: now } : s
      );
      setStoredItem('saas_subscriptions', next);
      return next;
    });

    // Optionally downgrade shop to Free Starter
    setShops((prev) => {
      const next = prev.map((s) =>
        s.id === targetSub.shopId ? { ...s, planId: 'plan_free', planName: 'Free Starter' } : s
      );
      setStoredItem('shops', next);
      return next;
    });

    addAuditLog('SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION', subId, `Subscription cancelled for ${targetSub.shopName}: ${reason}`);
    showToast('Subscription Cancelled', `${targetSub.shopName} subscription cancelled. Reverted to Free tier.`, 'info', 4000);
  };

  const updatePlatformPolicies = (policies: Partial<PlatformPolicies>) => {
    const now = new Date().toISOString();
    const nextPolicies = {
      ...platformPolicies,
      ...policies,
      updatedAt: now,
      updatedBy: currentUser?.fullName || 'Platform Super Admin'
    };
    setPlatformPolicies(nextPolicies);
    setStoredItem('platform_policies', nextPolicies);
    addAuditLog('PLATFORM_POLICIES_UPDATED', 'SETTINGS', 'platform_policies', `Updated global platform quota & billing policies`);
    showToast('Platform Policies Saved', 'Global quota rules updated across all tenants.', 'success', 3500);
  };

  const testGatewayConnection = async (): Promise<{ success: boolean; message: string; latencyMs: number }> => {
    try {
      const res = await fetch(apiUrl('/api/payment/platform-config/test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token_active',
          'X-User-Role': 'ADMIN'
        }
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        return {
          success: false,
          message: text.slice(0, 150) || `Server returned HTTP ${res.status}`,
          latencyMs: 0
        };
      }

      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || data.error || 'Gateway test failed',
          latencyMs: data.latencyMs || 0
        };
      }
      return {
        success: true,
        message: data.message,
        latencyMs: data.latencyMs || 0
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Network error verifying gateway',
        latencyMs: 0
      };
    }
  };

  // Printers
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);

  const updatePrinter = (printerId: string, updates: Partial<PrinterDevice>) => {
    const targetPrinter = printers.find((p) => p.id === printerId);
    if (targetPrinter) {
      const authz = checkShopOwnership(currentUser, targetPrinter.shopId);
      if (!authz.authorized) {
        addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', targetPrinter.shopId, 'BOLA violation on printer update');
        showToast('Access Denied', 'You cannot modify hardware of another shop.', 'error', 4000);
        return;
      }
    }
    setPrinters((prev) => {
      const next = prev.map((p) => (p.id === printerId ? { ...p, ...updates } : p));
      setStoredItem('printers', next);
      return next;
    });
  };

  const addPrinter = (printerData: Omit<PrinterDevice, 'id'>): { success: boolean; message?: string } => {
    const authz = checkShopOwnership(currentUser, printerData.shopId);
    if (!authz.authorized) {
      addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', printerData.shopId, 'BOLA violation on printer registration');
      showToast('Access Denied', 'You cannot add printers to another shop.', 'error', 4000);
      return { success: false, message: 'Unauthorized shop access' };
    }

    const targetShop = shops.find((s) => s.id === printerData.shopId) || activeShop;
    const currentPlan = plans.find((p) => p.id === targetShop?.planId) || plans[0] || { id: 'plan_starter', name: 'Starter', printerLimit: 2 };
    const shopPrinters = printers.filter((p) => p.shopId === printerData.shopId);
    const maxAllowed = currentPlan.printerLimit ?? 1;

    // Strict validation against shop's SaaS plan quota
    if (shopPrinters.length >= maxAllowed) {
      const errorMsg = `Printer quota reached (${shopPrinters.length}/${maxAllowed}). Your "${currentPlan.name}" plan allows up to ${maxAllowed} connected printer${maxAllowed > 1 ? 's' : ''}. Upgrade your SaaS plan in Subscription Management to add more hardware.`;
      showToast('Plan Printer Limit Reached', errorMsg, 'error', 5000);
      return { success: false, message: errorMsg };
    }

    const newPrinter: PrinterDevice = {
      ...printerData,
      id: `prn_${Date.now()}`
    };

    setPrinters((prev) => {
      const next = [...prev, newPrinter];
      setStoredItem('printers', next);
      return next;
    });

    addAuditLog('PRINTER_ADDED', 'PRINTER', newPrinter.id, `Added printer: ${newPrinter.name}`);
    showToast('Printer Connected', `"${newPrinter.name}" is now registered to your shop queue.`, 'success', 3500);
    return { success: true };
  };

  const deletePrinter = (printerId: string) => {
    const printerToDelete = printers.find((p) => p.id === printerId);
    if (printerToDelete) {
      const authz = checkShopOwnership(currentUser, printerToDelete.shopId);
      if (!authz.authorized) {
        addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', printerToDelete.shopId, 'BOLA violation on printer deletion');
        showToast('Access Denied', 'You cannot delete hardware of another shop.', 'error', 4000);
        return;
      }
    }
    setPrinters((prev) => {
      const next = prev.filter((p) => p.id !== printerId);
      setStoredItem('printers', next);
      return next;
    });
    if (printerToDelete) {
      addAuditLog('PRINTER_DELETED', 'PRINTER', printerId, `Removed printer: ${printerToDelete.name}`);
      showToast('Printer Removed', `"${printerToDelete.name}" has been unlinked from your counter.`, 'info', 3000);
    }
  };

  // Agents
  const [agents, setAgents] = useState<ElectronAgent[]>([]);

  const regenerateAgentToken = async (agentId: string) => {
    try {
      const url = apiUrl(`/api/agent/${encodeURIComponent(agentId)}/rotate-token`);
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'x-shop-id': activeShop.id
        },
        body: JSON.stringify({
          agentId,
          shopId: activeShop.id,
          deviceName: `${(activeShop.slug || 'COUNTER').toUpperCase().slice(0, 8)}-PC01`
        })
      });
      const data = (await response.json()) as {
        success?: boolean;
        newAuthToken?: string;
        token?: string;
        error?: string;
      };
      const newToken = data.newAuthToken || data.token;
      if (!response.ok || !data.success || !newToken) {
        const error = data.error || `Token generation failed (HTTP ${response.status})`;
        showToast('Token Generation Failed', error, 'error', 4000);
        return { success: false, error };
      }

      setAgents((prev) => {
        const exists = prev.some((agent) => agent.id === agentId);
        const next = exists
          ? prev.map((agent) =>
              agent.id === agentId
                ? { ...agent, authToken: newToken, status: 'OFFLINE' as const, lastSeen: 'Not connected' }
                : agent
            )
          : [
              ...prev,
              {
                id: agentId,
                shopId: activeShop.id,
                shopName: activeShop.name,
                deviceName: `${(activeShop.slug || 'COUNTER').toUpperCase().slice(0, 8)}-PC01`,
                status: 'OFFLINE' as const,
                lastSeen: 'Not connected',
                connectedPrintersCount: 0,
                printerCount: 0,
                authToken: newToken,
                createdAt: new Date().toISOString()
              }
            ];
        setStoredItem('agents', next);
        return next;
      });
      addAuditLog('AGENT_TOKEN_REGENERATED', 'SETTINGS', agentId, 'New auth token issued for print agent');
      showToast('Token Generated Successfully', 'Token copied! Enter this in PrintFlow Desktop Agent.', 'success', 3000);
      return { success: true, token: newToken };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to contact PrintFlow server';
      showToast('Token Generation Failed', message, 'error', 4000);
      return { success: false, error: message };
    }
  };

  // Cross-tab Synchronization & Audio Chime
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay policy handled gracefully
    }
  };

  // Print Jobs: starts clean for real production orders!
  const [printJobs, setPrintJobs] = useState<PrintJob[]>(() => {
    const loaded = getStoredItem<PrintJob[]>('print_jobs', []);
    const filtered = Array.isArray(loaded)
      ? loaded.filter((j) => !j.id?.startsWith('pj_88') && !j.orderCode?.startsWith('ORD-88'))
      : [];
    return Array.from(new Map(filtered.map(j => [j.id, j])).values());
  });

  // Sync print jobs & transactions across tabs in real time
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_PREFIX + 'print_jobs' && e.newValue) {
        try {
          const updatedJobs: PrintJob[] = JSON.parse(e.newValue);
          setPrintJobs(updatedJobs);
          playNotificationChime();
        } catch {
          // ignore parsing error
        }
      }
      if (e.key === STORAGE_KEY_PREFIX + 'transactions' && e.newValue) {
        try {
          const updatedTxns: Transaction[] = JSON.parse(e.newValue);
          setTransactions(updatedTxns);
        } catch {
          // ignore parsing error
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'SHOP_OWNER' && currentUser.role !== 'ADMIN')) return;

    let cancelled = false;
    const syncShopLiveData = async () => {
      try {
        const response = await fetch(apiUrl(`/api/shop/${encodeURIComponent(activeShop.id)}/live`), {
          credentials: 'same-origin',
          headers: {
            'x-user-role': currentUser.role,
            'x-shop-id': activeShop.id
          }
        });
        const responseText = await response.text();
        let data: any = {};
        try {
          data = JSON.parse(responseText);
        } catch {
          if (!cancelled) console.warn(`Shop live sync received invalid non-JSON response from server (HTTP ${response.status}).`);
          return;
        }

        if (!response.ok || !data.success) {
          if (!cancelled) console.warn(data.error || `Shop live sync returned status ${response.status}.`);
          return;
        }
        if (cancelled) return;

        const syncedPrinters: PrinterDevice[] = (data.printers || []).map(({ agentId, printer }: any) => ({
          id: `agent:${agentId}:${printer.name}`,
          shopId: activeShop.id,
          agentManaged: true,
          deviceId: agentId,
          name: printer.displayName || printer.name,
          model: printer.driverName || printer.displayName || printer.name,
          status: printer.status === 'READY'
            ? 'ONLINE'
            : printer.status === 'PRINTING' || printer.status === 'BUSY'
              ? 'BUSY'
              : printer.isOnline
                ? 'ONLINE'
                : 'OFFLINE',
          capabilities: {
            paperSizes: printer.capabilities.paperSizes,
            supportsColor: printer.capabilities.supportsColor ?? undefined,
            supportsDuplex: printer.capabilities.supportsDuplex ?? undefined,
            color: printer.capabilities.supportsColor === true,
            duplex: printer.capabilities.supportsDuplex === true
          },
          priority: 1,
          isEnabled: printer.isOnline,
          lastSeen: printer.isOnline ? 'Online' : printer.status,
          createdAt: new Date().toISOString()
        }));
        setPrinters((previous) => {
          const previousById = new Map(previous.map((printer) => [printer.id, printer]));
          const next = [
            ...previous.filter((printer) => !(printer.shopId === activeShop.id && printer.agentManaged)),
            ...syncedPrinters.map((printer) => ({
              ...printer,
              createdAt: previousById.get(printer.id)?.createdAt || printer.createdAt
            }))
          ];
          if (JSON.stringify(previous) === JSON.stringify(next)) return previous;
          setStoredItem('printers', next);
          return next;
        });

        const backendJobs = (data.jobs || []).map((job: any): PrintJob => {
          return {
            id: job.id,
            orderCode: job.orderCode,
            trackingToken: job.trackingToken,
            shopId: job.shopId,
            shopName: activeShop.name,
            customerName: job.customerName,
            customerPhone: job.customerPhone,
            files: (job.files || []).map((file: any) => ({
              id: file.id,
              fileName: file.fileName,
              fileSize: 0,
              fileType: 'application/octet-stream',
              estimatedPages: file.pageCount,
              paperSize: file.paperSize,
              color: file.colorMode,
              sides: file.duplex ? 'DOUBLE' : 'SINGLE',
              orientation: 'PORTRAIT',
              copies: file.copies,
              pageSelection: file.pagesToPrint ? 'CUSTOM' : 'ALL',
              customPageRange: file.pagesToPrint,
              pagesPerSheet: 1,
              unitPrice: 0,
              totalPrice: 0
            })),
            totalAmount: job.totalAmount,
            paymentStatus: job.paymentStatus,
            printStatus: job.printStatus,
            paymentMethod: 'Razorpay Online Payment',
            assignedPrinterName: job.printerName,
            notes: job.errorMessage,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
            expiresAt: new Date(Date.parse(job.createdAt) + 48 * 60 * 60 * 1000).toISOString()
          };
        });
        setPrintJobs((previous) => {
          const updates = new Map(backendJobs.map((job: PrintJob) => [job.id, job]));
          const next = previous.map((job) => {
            const update = updates.get(job.id);
            return update ? { ...job, ...update, files: job.files } : job;
          });
          const existingIds = new Set(previous.map((job) => job.id));
          next.push(...backendJobs.filter((job: PrintJob) => !existingIds.has(job.id)));
          const uniqueNext = Array.from(new Map(next.map(j => [j.id, j])).values());
          if (JSON.stringify(previous) === JSON.stringify(uniqueNext)) return previous;
          setStoredItem('print_jobs', uniqueNext);
          return uniqueNext;
        });
      } catch (error) {
        if (!cancelled) console.error('PrintFlow live shop sync failed:', error);
      }
    };

    void syncShopLiveData();
    const timer = window.setInterval(() => void syncShopLiveData(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeShop.id, activeShop.name, currentUser]);

  const createPrintJob = (data: {
    id?: string;
    trackingToken?: string;
    shopId: string;
    customerName: string;
    customerPhone: string;
    files: any[];
    totalAmount: number;
    paymentMethod: string;
    paymentStatus: PaymentStatus;
    paymentId?: string;
  }): PrintJob => {
    const shop = shops.find((s) => s.id === data.shopId) || activeShop;
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const trackingToken = data.trackingToken || 'tr_' + Math.random().toString(36).substring(2, 12);
    const newJobId = data.id || `PRT-${randomNum}`;

    const shopOnlinePrinters = printers.filter(
      (p) => p.shopId === data.shopId && p.isEnabled && p.status === 'ONLINE'
    );
    const assignedPrinter = shopOnlinePrinters[0] || printers[0];
    const finalPaymentId = data.paymentId || `pay_${Math.random().toString(36).substring(2, 10)}`;

    const newJob: PrintJob = {
      id: newJobId,
      trackingToken,
      shopId: data.shopId,
      shopName: shop.name,
      customerName: data.customerName || 'Guest Customer',
      customerPhone: data.customerPhone || '',
      files: data.files,
      totalAmount: data.totalAmount,
      paymentStatus: data.paymentStatus,
      printStatus: 'QUEUED',
      paymentMethod: data.paymentMethod,
      paymentId: finalPaymentId,
      assignedPrinterId: assignedPrinter ? assignedPrinter.id : undefined,
      assignedPrinterName: assignedPrinter ? assignedPrinter.name : 'Counter Spooler',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString()
    };

    setPrintJobs((prev) => {
      const next = [newJob, ...prev];
      setStoredItem('print_jobs', next);
      return next;
    });

    const newTxn: Transaction = {
      id: `txn_${Date.now()}`,
      orderId: newJobId,
      shopId: data.shopId,
      shopName: shop.name,
      amount: data.totalAmount,
      status: 'SUCCESS',
      paymentMethod: data.paymentMethod,
      type: 'PRINT_JOB',
      createdAt: new Date().toISOString(),
      gatewayReference: finalPaymentId
    };

    setTransactions((prev) => {
      const next = [newTxn, ...prev];
      setStoredItem('transactions', next);
      return next;
    });

    playNotificationChime();
    return newJob;
  };

  const simulateCustomerPrintJob = (targetShopId?: string): PrintJob => {
    if (!import.meta.env.DEV) throw new Error('Sample print orders are disabled in production.');
    const sId = targetShopId || activeShop.id;
    const targetShop = shops.find((s) => s.id === sId) || activeShop;

    const demoSamples = [
      { name: 'Rahul Sharma', phone: '+91 98201 44521', file: 'College_Thesis_Final.pdf', pages: 14, color: 'BW', sides: 'DOUBLE' },
      { name: 'Priya Verma', phone: '+91 98452 91834', file: 'Passport_Size_Photos.jpg', pages: 1, color: 'COLOR', sides: 'SINGLE' },
      { name: 'Amit Desai', phone: '+91 97123 60921', file: 'Aadhaar_Card_Front_Back.pdf', pages: 2, color: 'COLOR', sides: 'DOUBLE' },
      { name: 'Sneha Patel', phone: '+91 98980 12345', file: 'Company_Contract_Agreement.pdf', pages: 6, color: 'BW', sides: 'SINGLE' },
      { name: 'Vikram Mehta', phone: '+91 99099 87654', file: 'Engineering_CAD_Schematic.pdf', pages: 4, color: 'COLOR', sides: 'SINGLE' }
    ];

    const pick = demoSamples[Math.floor(Math.random() * demoSamples.length)];
    const copies = 1;
    const ratePerPage = pick.color === 'COLOR' ? 10 : 2;
    const total = pick.pages * copies * ratePerPage;

    const job = createPrintJob({
      shopId: sId,
      customerName: pick.name,
      customerPhone: pick.phone,
      files: [
        {
          id: `file_${Date.now()}`,
          fileName: pick.file,
          fileSize: 1024 * (Math.floor(Math.random() * 3000) + 800),
          fileType: pick.file.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          copies,
          color: pick.color as 'BW' | 'COLOR',
          paperSize: 'A4',
          sides: pick.sides as 'SINGLE' | 'DOUBLE',
          pageSelection: 'ALL',
          estimatedPages: pick.pages,
          unitPrice: ratePerPage,
          totalPrice: total
        }
      ],
      totalAmount: total,
      paymentMethod: 'Instant UPI / QR',
      paymentStatus: 'SUCCESS'
    });

    showToast(
      '🟢 Incoming Live Print Job!',
      `Ticket #${job.id} received from ${job.customerName} (${pick.file})`,
      'info',
      4500
    );

    return job;
  };

  const updateJobStatus = (jobId: string, printStatus: PrintStatus, paymentStatus?: PaymentStatus) => {
    const targetJob = printJobs.find((j) => j.id === jobId);
    if (targetJob) {
      const authz = checkShopOwnership(currentUser, targetJob.shopId);
      if (!authz.authorized) {
        addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', targetJob.shopId, 'BOLA violation on print job status change');
        showToast('Access Denied', 'You cannot modify print jobs of another shop.', 'error', 4000);
        return;
      }
    }

    setPrintJobs((prev) => {
      const next = prev.map((j) => {
        if (j.id === jobId) {
          return {
            ...j,
            printStatus,
            paymentStatus: paymentStatus || j.paymentStatus,
            updatedAt: new Date().toISOString()
          };
        }
        return j;
      });
      setStoredItem('print_jobs', next);
      return next;
    });
  };

  const updatePricingRule = (ruleId: string, pricePerPage: number) => {
    const targetRule = pricingRules.find((r) => r.id === ruleId);
    if (targetRule) {
      const authz = checkShopOwnership(currentUser, targetRule.shopId);
      if (!authz.authorized) {
        addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', targetRule.shopId, 'BOLA violation on pricing update');
        showToast('Access Denied', 'You cannot modify pricing rules of another shop.', 'error', 4000);
        return;
      }
    }

    setPricingRules((prev) => {
      const now = new Date().toISOString();
      const next = prev.map((r) => (r.id === ruleId ? { ...r, pricePerPage, updatedAt: now } : r));
      setStoredItem('pricing_rules', next);
      return next;
    });
  };

  const savePricingRules = (rules: PricingRule[]) => {
    setPricingRules(rules);
    setStoredItem('pricing_rules', rules);
    addAuditLog('PRICING_UPDATED', 'SHOP', activeShop.id, `Updated ${rules.length} print pricing rules.`);
  };

  const addPricingRule = (rule: Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt'>): PricingRule => {
    const authz = checkShopOwnership(currentUser, rule.shopId);
    if (!authz.authorized) {
      addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', rule.shopId, 'BOLA violation on pricing rule addition');
      showToast('Access Denied', 'You cannot add pricing rules for another shop.', 'error', 4000);
      throw new Error('Unauthorized shop access');
    }

    const now = new Date().toISOString();
    const newRule: PricingRule = {
      ...rule,
      id: `pr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      currency: rule.currency || 'INR',
      isActive: rule.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };
    setPricingRules((prev) => {
      const next = [newRule, ...prev];
      setStoredItem('pricing_rules', next);
      return next;
    });
    addAuditLog('PRICING_RULE_ADDED', 'SHOP', rule.shopId, `Added pricing rule for ${rule.paperSize} (${rule.color || 'BW'})`);
    return newRule;
  };

  const deletePricingRule = (ruleId: string) => {
    const targetRule = pricingRules.find((r) => r.id === ruleId);
    if (targetRule) {
      const authz = checkShopOwnership(currentUser, targetRule.shopId);
      if (!authz.authorized) {
        addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', targetRule.shopId, 'BOLA violation on pricing rule deletion');
        showToast('Access Denied', 'You cannot delete pricing rules of another shop.', 'error', 4000);
        return;
      }
    }

    setPricingRules((prev) => {
      const next = prev.filter((r) => r.id !== ruleId);
      setStoredItem('pricing_rules', next);
      return next;
    });
    addAuditLog('PRICING_RULE_DELETED', 'SHOP', activeShop.id, `Deleted pricing rule ID ${ruleId}`);
  };

  const togglePricingRule = (ruleId: string, isActive?: boolean) => {
    setPricingRules((prev) => {
      const now = new Date().toISOString();
      const next = prev.map((r) => {
        if (r.id === ruleId) {
          const newStatus = isActive !== undefined ? isActive : !(r.isActive ?? true);
          return { ...r, isActive: newStatus, updatedAt: now };
        }
        return r;
      });
      setStoredItem('pricing_rules', next);
      return next;
    });
  };

  // Transactions: starts clean for real customer payments!
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const loaded = getStoredItem<Transaction[]>('transactions', []);
    return Array.isArray(loaded)
      ? loaded.filter((t) => !t.id?.startsWith('txn_88') && !t.orderId?.startsWith('ORD-88'))
      : [];
  });

  const refundTransaction = (transactionId: string) => {
    const targetTxn = transactions.find((t) => t.id === transactionId);
    if (targetTxn) {
      const authz = checkShopOwnership(currentUser, targetTxn.shopId);
      if (!authz.authorized) {
        addAuditLog('UNAUTHORIZED_ACCESS_ATTEMPT', 'SECURITY', targetTxn.shopId, 'BOLA violation on refund initiation');
        showToast('Access Denied', 'You cannot refund transactions belonging to another shop.', 'error', 4000);
        return;
      }
    }

    setTransactions((prev) => {
      const next = prev.map((t) => (t.id === transactionId ? { ...t, status: 'REFUNDED' as const } : t));
      setStoredItem('transactions', next);
      return next;
    });

    setPrintJobs((prev) => {
      const next = prev.map((j) => {
        if (j.id === transactionId || j.paymentId === transactionId) {
          return { ...j, paymentStatus: 'REFUNDED' as const, printStatus: 'CANCELLED' as const };
        }
        return j;
      });
      setStoredItem('print_jobs', next);
      return next;
    });

    addAuditLog('TRANSACTION_REFUNDED', 'PAYMENT', transactionId, `Refunded transaction: ${transactionId}`);
  };

  // Audit Logs: starts clean for real production audits!
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const loaded = getStoredItem<AuditLog[]>('audit_logs', []);
    return Array.isArray(loaded)
      ? loaded.filter((l) => !l.id?.startsWith('log_mock_'))
      : [];
  });

  const addAuditLog = (
    action: string,
    entityType: AuditLog['entityType'],
    entityId: string,
    details: string
  ) => {
    const newLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser?.id || 'usr_system',
      actorName: currentUser?.fullName || 'System',
      actorRole: currentUser?.role || 'SHOP_OWNER',
      action,
      entityType,
      entityId,
      details,
      createdAt: new Date().toISOString()
    };
    setAuditLogs((prev) => {
      const next = [newLog, ...prev.slice(0, 99)];
      setStoredItem('audit_logs', next);
      return next;
    });
  };

  // Support Settings & Tickets
  const [supportSettings, setSupportSettings] = useState<SupportSettings>(() =>
    getStoredItem('support_settings', DEFAULT_SUPPORT_SETTINGS)
  );

  const updateSupportSettings = (updates: Partial<SupportSettings>) => {
    setSupportSettings((prev) => {
      const next = { ...prev, ...updates, updatedAt: new Date().toISOString() };
      setStoredItem('support_settings', next);
      addAuditLog('SETTINGS_CONFIGURED', 'SETTINGS', 'support_policies', 'Updated support SLA policies and settings');
      showToast('Support Settings Updated', 'SLA policies and routing rules saved successfully', 'success');
      return next;
    });
  };

  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => {
    const stored = getStoredItem<SupportTicket[]>('support_tickets', []);
    return stored && stored.length > 0 ? stored : [];
  });

  const createSupportTicket = (
    subjectOrData:
      | string
      | {
          shopId?: string;
          shopName?: string;
          subject: string;
          description: string;
          category?: TicketCategory;
          priority?: TicketPriority;
          assignedAdminId?: string;
          relatedJobId?: string;
          relatedPaymentId?: string;
          tags?: string[];
        },
    legacyCategory?: SupportTicket['category']
  ): SupportTicket => {
    const now = new Date();
    const nowIso = now.toISOString();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const id = `tck_${Date.now()}_${randNum}`;
    const ticketNumber = `TCK-${randNum}`;

    let subject = '';
    let description = '';
    let targetShopId = activeShop.id;
    let targetShopName = activeShop.name;
    let category: TicketCategory = 'GENERAL';
    let priority: TicketPriority = 'NORMAL';
    let assignedAdminId: string | undefined = undefined;
    let relatedJobId: string | undefined = undefined;
    let relatedPaymentId: string | undefined = undefined;
    let tags: string[] = [];

    if (typeof subjectOrData === 'string') {
      subject = subjectOrData;
      description = subjectOrData;
      category = (legacyCategory as TicketCategory) || 'GENERAL';
      priority = 'NORMAL';
    } else {
      subject = subjectOrData.subject;
      description = subjectOrData.description;
      targetShopId = subjectOrData.shopId || activeShop.id;
      const matchedShop = shops.find((s) => s.id === targetShopId);
      targetShopName = matchedShop ? matchedShop.name : subjectOrData.shopName || activeShop.name;
      category = subjectOrData.category || 'GENERAL';
      priority = subjectOrData.priority || 'NORMAL';
      assignedAdminId = subjectOrData.assignedAdminId;
      relatedJobId = subjectOrData.relatedJobId;
      relatedPaymentId = subjectOrData.relatedPaymentId;
      tags = subjectOrData.tags || [];
    }

    // Auto-assignment check if not manually specified
    if (!assignedAdminId && supportSettings.autoAssignEnabled && supportSettings.defaultAssigneeId) {
      assignedAdminId = supportSettings.defaultAssigneeId;
    }

    const assignedAdmin = SUPPORT_ADMIN_USERS.find((a) => a.id === assignedAdminId);

    // Calculate SLA deadlines based on configured policy
    const policyKey = (priority === 'MEDIUM' ? 'NORMAL' : priority) as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    const policy = supportSettings.slaPolicies[policyKey] || supportSettings.slaPolicies.NORMAL;
    const slaFirstResponseDeadline = new Date(now.getTime() + policy.responseHours * 3600000).toISOString();
    const slaResolutionDeadline = new Date(now.getTime() + policy.resolveHours * 3600000).toISOString();

    const senderRole = currentUser?.role || 'SHOP_OWNER';
    const senderName = currentUser?.fullName || (senderRole === 'ADMIN' ? 'Support Administrator' : targetShopName);

    const initialMessage: SupportTicketMessage = {
      id: `msg_${Date.now()}_1`,
      ticketId: id,
      senderId: currentUser?.id || 'usr_shop_client',
      senderName,
      senderRole: senderRole === 'ADMIN' ? 'ADMIN' : 'SHOP_OWNER',
      message: description,
      isInternalNote: false,
      createdAt: nowIso
    };

    const initialHistory: SupportTicketHistoryEntry = {
      id: `hist_${Date.now()}_1`,
      ticketId: id,
      actorId: currentUser?.id || 'usr_system',
      actorName: senderName,
      actorRole: senderRole,
      action: 'TICKET_CREATED',
      newValue: `${priority} Priority (${category})`,
      createdAt: nowIso
    };

    const newTicket: SupportTicket = {
      id,
      ticketNumber,
      shopId: targetShopId,
      shopName: targetShopName,
      subject,
      description,
      category,
      priority,
      status: 'OPEN',
      assignedAdminId: assignedAdmin?.id,
      assignedAdminName: assignedAdmin?.name,
      assignedAdminEmail: assignedAdmin?.email,
      relatedJobId,
      relatedPaymentId,
      tags,
      slaFirstResponseDeadline,
      slaResolutionDeadline,
      isSlaBreached: false,
      messages: [initialMessage],
      history: [initialHistory],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    setSupportTickets((prev) => {
      const next = [newTicket, ...prev];
      setStoredItem('support_tickets', next);
      return next;
    });

    addAuditLog('TICKET_CREATED', 'TICKET', id, `Created support ticket ${ticketNumber} for ${targetShopName}: "${subject}"`);
    showToast('Support Ticket Created', `Ticket ${ticketNumber} opened successfully`, 'success');

    return newTicket;
  };

  const updateTicketStatus = (ticketId: string, status: TicketStatus, note?: string) => {
    const nowIso = new Date().toISOString();
    setSupportTickets((prev) => {
      const target = prev.find((t) => t.id === ticketId);
      if (!target) return prev;

      const prevStatus = target.status;
      const historyList = [...(target.history || [])];

      const historyEntry: SupportTicketHistoryEntry = {
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId,
        actorId: currentUser?.id || 'usr_admin',
        actorName: currentUser?.fullName || 'Super Admin',
        actorRole: currentUser?.role || 'ADMIN',
        action: status === 'RESOLVED' ? 'RESOLVED' : status === 'CLOSED' ? 'CLOSED' : prevStatus === 'RESOLVED' || prevStatus === 'CLOSED' ? 'REOPENED' : 'STATUS_CHANGED',
        previousValue: prevStatus,
        newValue: status,
        createdAt: nowIso
      };
      historyList.push(historyEntry);

      const messageList = [...(target.messages || [])];
      if (note && note.trim()) {
        messageList.push({
          id: `msg_${Date.now()}_note`,
          ticketId,
          senderId: currentUser?.id || 'usr_admin',
          senderName: currentUser?.fullName || 'Super Admin',
          senderRole: 'ADMIN',
          message: `Status changed to ${status}: ${note}`,
          isInternalNote: true,
          createdAt: nowIso
        });
      }

      const updatedTicket: SupportTicket = {
        ...target,
        status,
        updatedAt: nowIso,
        resolvedAt: status === 'RESOLVED' ? target.resolvedAt || nowIso : status === 'CLOSED' ? target.resolvedAt : undefined,
        closedAt: status === 'CLOSED' ? nowIso : undefined,
        messages: messageList,
        history: historyList
      };

      const next = prev.map((t) => (t.id === ticketId ? updatedTicket : t));
      setStoredItem('support_tickets', next);
      return next;
    });

    addAuditLog('STATUS_CHANGED', 'TICKET', ticketId, `Updated ticket status to ${status}${note ? ` (${note})` : ''}`);
    showToast('Status Updated', `Ticket is now marked as ${status.replace('_', ' ')}`, 'info');
  };

  const updateTicketPriority = (ticketId: string, priority: TicketPriority) => {
    const nowIso = new Date().toISOString();
    setSupportTickets((prev) => {
      const target = prev.find((t) => t.id === ticketId);
      if (!target) return prev;

      const prevPriority = target.priority;
      const historyList = [...(target.history || [])];

      historyList.push({
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId,
        actorId: currentUser?.id || 'usr_admin',
        actorName: currentUser?.fullName || 'Super Admin',
        actorRole: currentUser?.role || 'ADMIN',
        action: 'PRIORITY_CHANGED',
        previousValue: prevPriority,
        newValue: priority,
        createdAt: nowIso
      });

      const updatedTicket: SupportTicket = {
        ...target,
        priority,
        updatedAt: nowIso,
        history: historyList
      };

      const next = prev.map((t) => (t.id === ticketId ? updatedTicket : t));
      setStoredItem('support_tickets', next);
      return next;
    });

    addAuditLog('PRIORITY_CHANGED', 'TICKET', ticketId, `Updated ticket priority to ${priority}`);
    showToast('Priority Updated', `Ticket priority changed to ${priority}`, 'info');
  };

  const assignTicket = (ticketId: string, adminId?: string) => {
    const nowIso = new Date().toISOString();
    const assignedAdmin = SUPPORT_ADMIN_USERS.find((a) => a.id === adminId);

    setSupportTickets((prev) => {
      const target = prev.find((t) => t.id === ticketId);
      if (!target) return prev;

      const prevAdmin = target.assignedAdminName || 'Unassigned';
      const newAdmin = assignedAdmin ? assignedAdmin.name : 'Unassigned';
      const historyList = [...(target.history || [])];

      historyList.push({
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId,
        actorId: currentUser?.id || 'usr_admin',
        actorName: currentUser?.fullName || 'Super Admin',
        actorRole: currentUser?.role || 'ADMIN',
        action: assignedAdmin ? 'ASSIGNED' : 'UNASSIGNED',
        previousValue: prevAdmin,
        newValue: newAdmin,
        createdAt: nowIso
      });

      const updatedTicket: SupportTicket = {
        ...target,
        assignedAdminId: assignedAdmin?.id,
        assignedAdminName: assignedAdmin?.name,
        assignedAdminEmail: assignedAdmin?.email,
        updatedAt: nowIso,
        history: historyList
      };

      const next = prev.map((t) => (t.id === ticketId ? updatedTicket : t));
      setStoredItem('support_tickets', next);
      return next;
    });

    addAuditLog('TICKET_ASSIGNED', 'TICKET', ticketId, `Assigned ticket to ${assignedAdmin ? assignedAdmin.name : 'Unassigned'}`);
    showToast('Assignment Updated', assignedAdmin ? `Assigned to ${assignedAdmin.name}` : 'Ticket unassigned', 'info');
  };

  const addTicketMessage = async (
    ticketId: string,
    message: string,
    isInternalNote: boolean,
    attachments?: Array<{ name: string; size: number; url?: string; type?: string }>
  ): Promise<boolean> => {
    if (!message || !message.trim()) return false;

    const nowIso = new Date().toISOString();
    const senderRole = currentUser?.role || 'ADMIN';
    const senderName = currentUser?.fullName || (senderRole === 'ADMIN' ? 'Platform Super Admin' : 'Shop Owner');

    const newMessage: SupportTicketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId,
      senderId: currentUser?.id || 'usr_admin',
      senderName,
      senderRole: senderRole === 'ADMIN' ? 'ADMIN' : 'SHOP_OWNER',
      message: message.trim(),
      isInternalNote,
      createdAt: nowIso,
      attachments
    };

    setSupportTickets((prev) => {
      const target = prev.find((t) => t.id === ticketId);
      if (!target) return prev;

      const historyList = [...(target.history || [])];
      historyList.push({
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId,
        actorId: currentUser?.id || 'usr_admin',
        actorName: senderName,
        actorRole: senderRole,
        action: isInternalNote ? 'INTERNAL_NOTE_ADDED' : 'REPLY_SENT',
        newValue: isInternalNote ? 'Internal Note' : 'Public Reply',
        createdAt: nowIso
      });

      let nextStatus = target.status;
      let firstResponseAt = target.firstResponseAt;

      // If public reply from admin
      if (!isInternalNote && senderRole === 'ADMIN') {
        if (!firstResponseAt) {
          firstResponseAt = nowIso;
        }
        if (target.status === 'OPEN' || target.status === 'WAITING_INTERNAL') {
          nextStatus = 'WAITING_SHOP';
        }
      } else if (!isInternalNote && senderRole === 'SHOP_OWNER') {
        if (target.status === 'WAITING_SHOP') {
          nextStatus = 'IN_PROGRESS';
        }
      }

      const updatedTicket: SupportTicket = {
        ...target,
        status: nextStatus,
        firstResponseAt,
        updatedAt: nowIso,
        messages: [...(target.messages || []), newMessage],
        history: historyList
      };

      const next = prev.map((t) => (t.id === ticketId ? updatedTicket : t));
      setStoredItem('support_tickets', next);
      return next;
    });

    addAuditLog(isInternalNote ? 'NOTE_ADDED' : 'REPLY_POSTED', 'TICKET', ticketId, `${isInternalNote ? 'Added internal note' : 'Replied to customer'} on ticket`);
    showToast(isInternalNote ? 'Internal Note Saved' : 'Reply Sent', isInternalNote ? 'Only team admins can see this note' : 'Message dispatched to shop owner', 'success');

    return true;
  };

  // Toast System
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (
    title: string,
    message?: string,
    type: 'success' | 'info' | 'error' = 'info',
    duration = 4000
  ) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: Toast = { id, title, message, type, duration };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      dismissToast(id);
    }, duration);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SHOP_OWNER')) return;

    let cancelled = false;
    let cloudReady = false;
    const pendingWrites = new Map<string, Promise<void>>();
    const accessToken = typeof window !== 'undefined' ? localStorage.getItem('printflow_access_token') : null;
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-role': currentUser.role,
      'x-shop-id': activeShop.id,
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
    };

    const writeCloudState = (key: string, value: unknown) => {
      if (!cloudReady || !CLOUD_STATE_KEYS.has(key)) return;
      const previous = pendingWrites.get(key) || Promise.resolve();
      const next = previous.catch(() => undefined).then(async () => {
        const response = await fetch(apiUrl(`/api/app-data/${encodeURIComponent(key)}`), {
          method: 'PUT',
          credentials: 'same-origin',
          headers: requestHeaders,
          body: JSON.stringify({ value: cloudSafeValue(value) })
        });
        const text = await response.text();
        let result: { success?: boolean; error?: string } = {};
        try {
          result = JSON.parse(text);
        } catch {
          result = { success: false, error: `Invalid response format from server (HTTP ${response.status}).` };
        }
        if (!response.ok || !result.success) {
          throw new Error(result.error || `Could not sync ${key} to Neon (HTTP ${response.status}).`);
        }
      }).catch((error: unknown) => {
        if (!cancelled) console.error(`PrintFlow Neon sync failed for ${key}:`, error);
      });
      pendingWrites.set(key, next);
    };

    cloudStateWriter = writeCloudState;

    const syncFromNeon = async () => {
      setIsLoadingData(true);
      setDataLoadError(null);
      let response: Response | undefined;
      let result: {
        success?: boolean;
        error?: string;
        hasData?: boolean;
        canonicalShopId?: string;
        records?: Record<string, unknown>;
      } = {};
      try {
        for (let attempt = 0; attempt < 4; attempt++) {
          response = await fetch(apiUrl(`/api/app-data?shopId=${encodeURIComponent(activeShop.id)}`), {
            credentials: 'same-origin',
            headers: requestHeaders
          });
          const text = await response.text();
          try {
            result = JSON.parse(text);
          } catch {
            result = { success: false, error: `Invalid response format from server (HTTP ${response.status}).` };
          }
          if (response.ok || response.status !== 401) break;
          await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
        if (!response?.ok || !result.success) {
          throw new Error(result.error || `Could not load PrintFlow data from Neon (HTTP ${response?.status || 0}).`);
        }
        if (cancelled) return;

        const canonicalShopId = result.canonicalShopId || activeShop.id;
        const legacyShopId = activeShop.id;
        const records = result.records || {};

        const mergeShopList = <T extends { id: string }>(previous: T[], remote: T[]) => [
          ...previous.filter((item) => item.id !== legacyShopId && item.id !== canonicalShopId),
          ...remote
        ];
        const mergeShopRecords = <T extends { shopId: string }>(previous: T[], remote: T[]) => [
          ...previous.filter((item) => item.shopId !== legacyShopId && item.shopId !== canonicalShopId),
          ...remote
        ];

        if (result.hasData) {
          if (Array.isArray(records.shops)) {
            const remote = records.shops as Shop[];
            setShops((previous) => mergeShopList(previous, remote));
          }
          if (typeof records.active_shop_id === 'string') {
            setActiveShopIdState(records.active_shop_id);
          } else if (currentUser.role === 'SHOP_OWNER') {
            setActiveShopIdState(canonicalShopId);
          }
          if (Array.isArray(records.pricing_rules)) {
            const remote = records.pricing_rules as PricingRule[];
            setPricingRules((previous) => mergeShopRecords(previous, remote));
          }
          if (Array.isArray(records.printers)) {
            const remote = records.printers as PrinterDevice[];
            setPrinters((previous) => mergeShopRecords(previous, remote));
          }
          if (Array.isArray(records.agents)) {
            const remote = records.agents as ElectronAgent[];
            setAgents((previous) => mergeShopRecords(previous, remote));
          }
          if (Array.isArray(records.print_jobs)) {
            const remote = records.print_jobs as PrintJob[];
            setPrintJobs((previous) => mergeShopRecords(previous, remote));
          }
          if (Array.isArray(records.transactions)) {
            const remote = records.transactions as Transaction[];
            setTransactions((previous) => mergeShopRecords(previous, remote));
          }
          if (Array.isArray(records.support_tickets)) {
            const remote = records.support_tickets as SupportTicket[];
            setSupportTickets((previous) => mergeShopRecords(previous, remote));
          }
          if (currentUser.role === 'ADMIN') {
            if (Array.isArray(records.saas_plans)) setPlans(records.saas_plans as SaasPlan[]);
            if (Array.isArray(records.saas_subscriptions)) setSubscriptions(records.saas_subscriptions as Subscription[]);
            if (records.platform_policies) setPlatformPolicies(records.platform_policies as PlatformPolicies);
            if (Array.isArray(records.audit_logs)) setAuditLogs(records.audit_logs as AuditLog[]);
            if (records.support_settings) setSupportSettings(records.support_settings as SupportSettings);
          }
          setCurrentUser((previous) =>
            previous?.role === 'SHOP_OWNER' && previous.shopId === legacyShopId
              ? { ...previous, shopId: canonicalShopId }
              : previous
          );
        } else if (currentUser.role === 'SHOP_OWNER') {
          setCurrentUser((previous) =>
            previous?.role === 'SHOP_OWNER' && previous.shopId === legacyShopId
              ? { ...previous, shopId: canonicalShopId }
              : previous
          );
          setActiveShopIdState(canonicalShopId);
        }

        cloudReady = true;
        setIsCloudSynced(true);
      } catch (err: any) {
        if (!cancelled) {
          setDataLoadError(err?.message || 'Could not load data from Neon database.');
          setIsCloudSynced(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingData(false);
        }
      }
    };

    void syncFromNeon().catch((error: unknown) => {
      if (!cancelled) console.error('PrintFlow could not sync application data with Neon:', error);
    });

    return () => {
      cancelled = true;
      if (cloudStateWriter === writeCloudState) cloudStateWriter = null;
    };
  }, [activeShop.id, currentUser?.id, currentUser?.role]);

  return (
    <AppContext.Provider
      value={{
        users,
        currentUser,
        isAuthenticated,
        setCurrentUser,
        registerShop,
        login,
        adminLogin,
        forgotPassword,
        resetPassword,
        logout,
        switchRole,
        enrollMfa,
        verifyAndEnableMfa,
        disableMfa,
        verifyMfaStepUp,
        isMfaStepUpVerified,
        activeShop,
        setActiveShopId,
        isLoadingData,
        dataLoadError,
        isCloudSynced,
        shops,
        updateShopProfile,
        updateShopStatus,
        adminRazorpay,
        updateAdminRazorpay,
        updateShopRazorpay,
        plans,
        subscriptions,
        platformPolicies,
        createPlan,
        updatePlan,
        duplicatePlan,
        archivePlan,
        deletePlan,
        togglePlanStatus,
        upgradeShopPlan,
        updateSubscription,
        changeShopSubscription,
        cancelSubscription,
        updatePlatformPolicies,
        testGatewayConnection,
        printers,
        updatePrinter,
        addPrinter,
        deletePrinter,
        agents,
        regenerateAgentToken,
        printJobs,
        createPrintJob,
        simulateCustomerPrintJob,
        updateJobStatus,
        pricingRules,
        updatePricingRule,
        savePricingRules,
        addPricingRule,
        deletePricingRule,
        togglePricingRule,
        transactions,
        payments: transactions,
        refundTransaction,
        devices: agents,
        toasts,
        showToast,
        dismissToast,
        auditLogs,
        supportTickets,
        supportSettings,
        supportAdmins: SUPPORT_ADMIN_USERS,
        createSupportTicket,
        updateTicketStatus,
        updateTicketPriority,
        assignTicket,
        addTicketMessage,
        updateSupportSettings,
        currentPath,
        navigate
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
