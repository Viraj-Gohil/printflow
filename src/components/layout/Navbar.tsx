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
  LayoutDashboard,
  LogIn,
  UserPlus
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
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-left group focus:outline-none cursor-pointer shrink-0"
          >
            <div className="relative shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-blue-600 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xs group-hover:scale-105 group-hover:shadow-blue-500/25 transition-all">
                <Printer className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-heading font-semibold text-base sm:text-2xl tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors leading-tight flex items-center gap-1.5 brand-text">
                PrintFlow
                <span className="hidden sm:inline-flex text-[10px] sm:text-[11px] font-medium text-blue-600 bg-blue-50/90 px-1.5 sm:px-2.5 py-0.5 rounded-md border border-blue-200 uppercase tracking-wider shrink-0">
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
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {!currentUser ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <button
    onClick={() => navigate('/auth/login')}
    className="inline-flex items-center justify-center gap-1.5
      rounded-xl border border-slate-200 bg-white
      px-3 py-2 sm:px-4 sm:py-2.5
      text-xs sm:text-sm font-semibold text-slate-700
      hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600
      active:scale-95 transition-all duration-200
      cursor-pointer whitespace-nowrap"
  >
    <LogIn className="hidden sm:block h-4 w-4" />
    <span>Login</span>
  </button>

  {/* Register Button */}
  <button
    onClick={() => navigate('/auth/register')}
    className="inline-flex items-center justify-center gap-1.5
      rounded-xl bg-blue-600
      px-3 py-2 sm:px-4 sm:py-2.5
      text-xs sm:text-sm font-bold text-white
      shadow-sm shadow-blue-500/25
      hover:bg-blue-700 hover:shadow-md
      active:scale-95 transition-all duration-200
      cursor-pointer whitespace-nowrap"
  >
    <UserPlus className="hidden sm:block h-4 w-4" />
    <span>Register</span>
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
              className="md:hidden p-1.5 sm:p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shrink-0"
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

            {!currentUser ? (
              <div className="pt-3 border-t border-slate-200/80 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/auth/login');
                  }}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4 text-slate-600" />
                  <span>Login</span>
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/auth/register');
                  }}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all text-center shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register Free</span>
                </button>
              </div>
            ) : (
              <div className="pt-3 border-t border-slate-200/80 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(currentUser.role === 'ADMIN' ? '/admin/dashboard' : '/shop/dashboard');
                  }}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all text-center shadow-xs cursor-pointer"
                >
                  {currentUser.role === 'ADMIN' ? 'Admin Console' : 'Shop Console'}
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full py-2 px-4 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-all text-center cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
