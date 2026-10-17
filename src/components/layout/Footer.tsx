import React from 'react';
import { Printer, Shield, QrCode, Store, Lock } from 'lucide-react';
import { useApp } from '../../lib/store';

export const Footer: React.FC = () => {
  const { navigate } = useApp();

  return (
    <footer className="bg-white text-slate-600 text-sm border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand & Purpose */}
          <div className="md:col-span-1 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <Printer className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                PrintFlow
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Simple printing. Smarter counters. Touchless QR-powered ordering and hardware queue orchestration for modern xerox & photocopy centers.
            </p>
            <div className="pt-1 flex items-center gap-2 text-xs text-slate-500">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Multi-tenant Cloud Architecture</span>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3.5">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li>
                <button
                  onClick={() => {
                    navigate('/');
                    setTimeout(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }), 100);
                  }}
                  className="hover:text-blue-600 transition-colors cursor-pointer text-left"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    navigate('/');
                    setTimeout(() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }), 100);
                  }}
                  className="hover:text-blue-600 transition-colors cursor-pointer text-left"
                >
                  Features & Tools
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    navigate('/');
                    setTimeout(() => document.getElementById('print-agent')?.scrollIntoView({ behavior: 'smooth' }), 100);
                  }}
                  className="hover:text-blue-600 transition-colors cursor-pointer text-left"
                >
                  Desktop Print Agent
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    navigate('/');
                    setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 100);
                  }}
                  className="hover:text-blue-600 transition-colors cursor-pointer text-left"
                >
                  Pricing Plans
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    navigate('/');
                    setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 100);
                  }}
                  className="hover:text-blue-600 transition-colors cursor-pointer text-left"
                >
                  Frequently Asked Questions
                </button>
              </li>
            </ul>
          </div>

          {/* Solutions & Management */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3.5">
              Shop Solutions
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li>
                <button
                  onClick={() => navigate('/shop/settings')}
                  className="hover:text-blue-600 transition-colors cursor-pointer text-left"
                >
                  Shop Configuration & UPI
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/shop/pricing')}
                  className="hover:text-blue-600 transition-colors cursor-pointer text-left"
                >
                  Per-Page Rate Card
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/admin/subscriptions')}
                  className="hover:text-blue-600 transition-colors cursor-pointer text-left"
                >
                  SaaS Plans & Pricing
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/admin/audit-logs')}
                  className="hover:text-blue-600 transition-colors cursor-pointer text-left"
                >
                  Security & Audit Logs
                </button>
              </li>
            </ul>
          </div>

          {/* Instant Portals */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3.5">
              Quick Portals
            </h4>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('/auth/register')}
                className="w-full text-left px-3.5 py-2.5 bg-blue-50/70 hover:bg-blue-100 rounded-xl text-xs font-bold text-blue-700 transition-all border border-blue-200 flex items-center justify-between cursor-pointer"
              >
                <span>Register New Shop</span>
                <Store className="w-3.5 h-3.5 text-blue-600" />
              </button>
              <button
                onClick={() => navigate('/shop/dashboard')}
                className="w-full text-left px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs text-slate-700 hover:text-slate-900 transition-all border border-slate-200 flex items-center justify-between cursor-pointer"
              >
                <span>Shop Owner Dashboard</span>
                <Store className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="w-full text-left px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs text-slate-700 hover:text-slate-900 transition-all border border-slate-200 flex items-center justify-between cursor-pointer"
              >
                <span>Super Admin Console</span>
                <Shield className="w-3.5 h-3.5 text-purple-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <p>© 2026 PrintFlow Technologies. Built for modern xerox & print centers.</p>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span>Instant UPI Settlements</span>
            <span>·</span>
            <span>Hardware Printer Spooling</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
