import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { AppProvider, useApp } from './lib/store';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './components/landing/LandingPage';
import { CustomerPrintFlow } from './components/customer/CustomerPrintFlow';
import { TrackPrintPage } from './components/customer/TrackPrintPage';
import { AuthPages } from './components/auth/AuthPages';
import { AdminLogin } from './components/admin/AdminLogin';
import { ToastContainer } from './components/common/ToastContainer';
import { ShieldAlert, Shield, LogOut } from 'lucide-react';

// Shop Owner Components & Layout
import { ShopLayout } from './components/shop/ShopLayout';
import { ShopDashboard } from './components/shop/ShopDashboard';
import { ShopPrintJobs } from './components/shop/ShopPrintJobs';
import { ShopPrinters } from './components/shop/ShopPrinters';
import { ShopQrCodes } from './components/shop/ShopQrCodes';
import { ShopPricing } from './components/shop/ShopPricing';
import { ShopPayments } from './components/shop/ShopPayments';
import { ShopSubscription } from './components/shop/ShopSubscription';
import { ShopAnalytics } from './components/shop/ShopAnalytics';
import { ShopPrintAgent } from './components/shop/ShopPrintAgent';
import { ShopSettings } from './components/shop/ShopSettings';

// Platform Admin Components & Layout
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminAnalytics } from './components/admin/AdminAnalytics';
import { AdminShops } from './components/admin/AdminShops';
import { AdminPrintJobs } from './components/admin/AdminPrintJobs';
import { AdminSubscriptions } from './components/admin/AdminSubscriptions';
import { AdminShopSubscriptions } from './components/admin/AdminShopSubscriptions';
import { AdminPayments } from './components/admin/AdminPayments';
import { AdminAgents } from './components/admin/AdminAgents';
import { AdminAuditLogs } from './components/admin/AdminAuditLogs';
import { AdminSystemHealth } from './components/admin/AdminSystemHealth';
import { AdminPlatformSettings } from './components/admin/AdminPlatformSettings';
import { AdminSupport } from './components/admin/AdminSupport';

const pageTransitionVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: 'easeOut' as const }
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15, ease: 'easeIn' as const }
  }
};

const AppRouter: React.FC = () => {
  const { currentPath, activeShop, currentUser, navigate, logout } = useApp();

  // Normalize path
  const path = currentPath || '/';

  // Dedicated Fixed Admin Login URL: /admin/login
  if (path === '/admin/login' || path === '#/admin/login' || path.startsWith('/admin/login')) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        <Navbar />
        <AnimatePresence mode="wait">
          <motion.main
            key="admin-login-page"
            variants={pageTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1"
          >
            <AdminLogin />
          </motion.main>
        </AnimatePresence>
      </div>
    );
  }

  // 1. Customer QR Print Flow: /s/:shopSlug or #s/:shopSlug
  if (path.startsWith('/s/') || path.startsWith('#s/') || path.startsWith('s/')) {
    const slug = path.replace(/^[/#]*s\//, '').split('/')[0] || activeShop.slug;
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        <AnimatePresence mode="wait">
          <motion.main
            key={`customer-flow-${slug}`}
            variants={pageTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1"
          >
            <CustomerPrintFlow shopSlug={slug} />
          </motion.main>
        </AnimatePresence>
      </div>
    );
  }

  // 1.5. Track Print Page: /track-print
  if (path === '/track-print' || path === '#/track-print' || path.startsWith('/track-print')) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        <Navbar />
        <AnimatePresence mode="wait">
          <motion.main
            key="track-print-page"
            variants={pageTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1"
          >
            <TrackPrintPage />
          </motion.main>
        </AnimatePresence>
      </div>
    );
  }

  // 2. Redirect /customer to QR ordering flow
  if (path.startsWith('/customer')) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        <AnimatePresence mode="wait">
          <motion.main
            key="customer-flow-redirect"
            variants={pageTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1"
          >
            <CustomerPrintFlow shopSlug={activeShop.slug} />
          </motion.main>
        </AnimatePresence>
      </div>
    );
  }

  // 3. Authentication
  if (path.startsWith('/auth')) {
    const isRegister = path.includes('register');
    const isForgot = path.includes('forgot') || path.includes('reset');
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        <Navbar />
        <AnimatePresence mode="wait">
          <motion.main
            key={`auth-${isRegister ? 'register' : isForgot ? 'forgot' : 'login'}`}
            variants={pageTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1"
          >
            <AuthPages initialView={isRegister ? 'register' : isForgot ? 'forgot' : 'login'} />
          </motion.main>
        </AnimatePresence>
      </div>
    );
  }

  // 4. Shop Owner Panel (/shop/*)
  if (path.startsWith('/shop')) {
    // Super Admin is explicitly prohibited from directly accessing Shop Portal
    if (currentUser?.role === 'ADMIN') {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
          <Navbar />
          <main className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-7 sm:p-8 rounded-2xl border border-rose-200 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/60 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 tracking-wide uppercase">
                  RBAC Enforcement
                </span>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Access Denied: Super Admin Restricted</h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Super Admin accounts are strictly prohibited from directly accessing individual Shop Portals. Platform administration and shop oversight must be conducted through the Admin Panel.
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/admin/dashboard')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                >
                  <Shield className="w-4 h-4" />
                  <span>Return to Admin Dashboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-xs sm:text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    // Require authenticated Shop Owner with an active shop membership
    if (!currentUser || currentUser.role !== 'SHOP_OWNER' || !currentUser.shopId) {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
          <Navbar />
          <AnimatePresence mode="wait">
            <motion.main
              key="auth-required-shop"
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex-1"
            >
              <AuthPages initialView="login" />
            </motion.main>
          </AnimatePresence>
        </div>
      );
    }

    const tab = path.replace('/shop/', '').replace('/shop', '') || 'dashboard';
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        <ShopLayout activeTab={tab}>
          {tab === 'dashboard' && <ShopDashboard />}
          {tab === 'print-jobs' && <ShopPrintJobs />}
          {tab === 'printers' && <ShopPrinters />}
          {tab === 'qr-codes' && <ShopQrCodes />}
          {tab === 'pricing' && <ShopPricing />}
          {tab === 'payments' && <ShopPayments />}
          {tab === 'subscription' && <ShopSubscription />}
          {tab === 'analytics' && <ShopAnalytics />}
          {tab === 'print-agent' && <ShopPrintAgent />}
          {tab === 'settings' && <ShopSettings />}
        </ShopLayout>
      </div>
    );
  }

  // 5. Platform Admin Panel (/admin/*)
  if (path.startsWith('/admin')) {
    // If logged in as non-admin (e.g. Shop Owner), block with Access Denied view
    if (currentUser && currentUser.role !== 'ADMIN') {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
          <Navbar />
          <main className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-7 sm:p-8 rounded-2xl border border-amber-200 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 tracking-wide uppercase">
                  Privileged Area
                </span>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Access Denied: Master Admin Required</h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Platform Master Admin privileges are required to access this administration console. Your current session is registered as a Shop Owner.
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/shop/dashboard')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                >
                  <span>Return to Shop Console</span>
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-xs sm:text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    // If unauthenticated, show Admin Login
    if (!currentUser) {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
          <Navbar />
          <AnimatePresence mode="wait">
            <motion.main
              key="auth-required-admin"
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex-1"
            >
              <AdminLogin />
            </motion.main>
          </AnimatePresence>
        </div>
      );
    }

    const tab = path.replace('/admin/', '').replace('/admin', '') || 'dashboard';
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        <AdminLayout activeTab={tab}>
          {tab === 'dashboard' && <AdminDashboard />}
          {tab === 'analytics' && <AdminAnalytics />}
          {tab === 'shops' && <AdminShops />}
          {tab === 'print-jobs' && <AdminPrintJobs />}
          {(tab === 'plans' || tab === 'saas-plans') && <AdminSubscriptions />}
          {tab === 'subscriptions' && <AdminShopSubscriptions />}
          {tab === 'payments' && <AdminPayments />}
          {tab === 'agents' && <AdminAgents />}
          {tab === 'support' && <AdminSupport />}
          {tab === 'audit-logs' && <AdminAuditLogs />}
          {(tab === 'health' || tab === 'system-health') && <AdminSystemHealth />}
          {(tab === 'platform-settings' || tab === 'settings') && <AdminPlatformSettings />}
        </AdminLayout>
      </div>
    );
  }

  // 6. Default: Public Marketing Landing Page
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key="landing-page"
          variants={pageTransitionVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex-1"
        >
          <LandingPage />
        </motion.main>
      </AnimatePresence>
      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
      <ToastContainer />
    </AppProvider>
  );
}
