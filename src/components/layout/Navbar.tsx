import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../lib/store';
import {
  Printer,
  Shield,
  Store,
  QrCode,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Menu,
  X,
  LayoutDashboard
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, logout, currentPath, navigate, activeShop } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isMarketing = currentPath === '/' || currentPath.startsWith('/#');
  const isCustomerFlow =
    currentPath.startsWith('/s/') ||
    currentPath.startsWith('#s/') ||
    currentPath.startsWith('s/') ||
    currentPath.startsWith('/customer');

  const isShopActive = currentUser?.role === 'SHOP_OWNER' && currentPath.startsWith('/shop');
  const isAdminActive = currentUser?.role === 'ADMIN' && currentPath.startsWith('/admin');

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (currentPath !== '/') {
      navigate('/');
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 transition-all font-heading">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Element */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer shrink-0"
          >
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-linear-to-br from-blue-600 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xs group-hover:scale-105 group-hover:shadow-blue-500/25 transition-all">
                <Printer className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-semibold text-2xl sm:text-3xl tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors leading-tight flex items-center gap-2 brand-text">
                PrintFlow
                <span className="text-[11px] font-medium text-blue-600 bg-blue-50/90 px-2.5 py-0.5 rounded-md border border-blue-200 uppercase tracking-wider">
                  Cloud
                </span>
              </span>
              <span className="text-xs font-normal text-slate-500 hidden sm:inline tracking-tight">
                Instant Counter Xerox Platform
              </span>
            </div>
          </button>

          {/* Context indicators */}
          {isCustomerFlow && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50/90 rounded-xl border border-blue-200/80 max-w-[140px] sm:max-w-[220px] truncate shadow-2xs">
              <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{activeShop.name}</span>
            </span>
          )}
          {currentPath.startsWith('/shop') && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50/90 rounded-xl border border-blue-200/80 shadow-2xs">
              <Store className="w-3.5 h-3.5 text-blue-600" />
              <span>Shop Console</span>
            </span>
          )}
          {currentPath.startsWith('/admin') && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-purple-700 bg-purple-50/90 rounded-xl border border-purple-200/80 shadow-2xs">
              <Shield className="w-3.5 h-3.5 text-purple-600" />
              <span>Super Admin</span>
            </span>
          )}
        </div>

        {/* Marketing Navigation Links */}
        {isCustomerFlow ? (
          <div className="hidden md:flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50/90 px-3.5 py-1.5 rounded-full border border-emerald-200 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Files are encrypted & auto-deleted after printing</span>
          </div>
        ) : isMarketing ? (
          <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium text-slate-600">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="px-3.5 py-2 rounded-xl hover:text-blue-600 hover:bg-blue-50/80 transition-all cursor-pointer font-heading font-medium text-slate-600"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="px-3.5 py-2 rounded-xl hover:text-blue-600 hover:bg-blue-50/80 transition-all cursor-pointer font-heading font-medium text-slate-600"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('print-agent')}
              className="px-3.5 py-2 rounded-xl hover:text-blue-600 hover:bg-blue-50/80 transition-all cursor-pointer font-heading font-medium text-slate-600"
            >
              Print Agent
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="px-3.5 py-2 rounded-xl hover:text-blue-600 hover:bg-blue-50/80 transition-all cursor-pointer font-heading font-medium text-slate-600"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="px-3.5 py-2 rounded-xl hover:text-blue-600 hover:bg-blue-50/80 transition-all cursor-pointer font-heading font-medium text-slate-600"
            >
              FAQ
            </button>
          </nav>
        ) : null}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {!currentUser ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/auth/login')}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:text-blue-600 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer font-heading"
              >
                Shop Login
              </button>
              <button
                onClick={() => navigate('/auth/register')}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-linear-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 rounded-xl shadow-xs shadow-blue-500/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 group font-heading"
              >
                <span>Register Your Shop</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          ) : currentUser.role === 'ADMIN' ? (
            <div className="flex items-center gap-2">
              {!currentPath.startsWith('/admin') && (
                <button
                  onClick={() => navigate('/admin/dashboard')}
                  className="px-3.5 py-2 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all cursor-pointer shadow-2xs font-heading"
                >
                  Admin Console
                </button>
              )}
              <button
                onClick={logout}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-all cursor-pointer"
                title="Sign out from account"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {!currentPath.startsWith('/shop') ? (
                <button
                  onClick={() => navigate('/shop/dashboard')}
                  className="px-4 py-2 text-xs font-bold text-white bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs shadow-blue-500/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Shop Console</span>
                </button>
              ) : null}
              <button
                onClick={logout}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-all cursor-pointer"
                title="Sign out"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Mobile hamburger menu toggle */}
          {isMarketing && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && isMarketing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-xl px-4 py-4 space-y-3 shadow-lg"
          >
            <div className="flex flex-col space-y-1 text-sm font-semibold text-slate-700">
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="px-3 py-2 text-left rounded-xl hover:bg-slate-100 transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('features')}
                className="px-3 py-2 text-left rounded-xl hover:bg-slate-100 transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection('print-agent')}
                className="px-3 py-2 text-left rounded-xl hover:bg-slate-100 transition-colors"
              >
                Print Agent
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="px-3 py-2 text-left rounded-xl hover:bg-slate-100 transition-colors"
              >
                Pricing
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="px-3 py-2 text-left rounded-xl hover:bg-slate-100 transition-colors"
              >
                FAQ
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/auth/login');
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all text-center"
              >
                Shop Login
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/auth/register');
                }}
                className="w-full py-2.5 px-4 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs text-center flex items-center justify-center gap-2"
              >
                <span>Register Your Shop</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
