import React, { useState } from 'react';
import { Printer, Shield, ArrowUpRight, X, Mail, Phone } from 'lucide-react';
import { useApp } from '../../lib/store';

export const Footer: React.FC = () => {
  const { navigate, currentPath } = useApp();
  const [activeLegalModal, setActiveLegalModal] = useState<'privacy' | 'terms' | 'refund' | 'contact' | 'about' | null>(null);

  const scrollToSection = (id: string) => {
    if (currentPath !== '/') {
      navigate('/');
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-white border-t border-[#E1E7E1] text-[#646B65] text-sm font-['Manrope',sans-serif]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 lg:gap-12">
          {/* Brand & Purpose (2 cols on md) */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center shrink-0 border border-[#A7F3D0]/70">
                <Printer className="w-4.5 h-4.5 text-[#00B32D]" />
              </div>
              <span className="font-extrabold text-lg text-[#111111] tracking-tight font-['Manrope',sans-serif]">
                Easy<span className="text-[#00B32D]">To</span>Print
              </span>
            </div>
            <p className="text-xs text-[#646B65] leading-relaxed max-w-sm">
              EasyToPrint helps printing businesses simplify shop operations, automate print workflows, and deliver a smarter printing experience through one connected platform.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-[#646B65]">
              <Shield className="w-3.5 h-3.5 text-[#00B32D]" />
              <span>Enterprise Grade Windows Agent &amp; Cloud Queue</span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
              Product
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('features')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  Features
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('desktop-agent')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  EasyToPrint Agent
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('pricing')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  Pricing
                </button>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
              Company
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('about')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('contact')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  Contact Us
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('faq')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  Help Center
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('faq')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  FAQs
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('contact')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  Contact Support
                </button>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
              Legal
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('privacy')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('terms')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  Terms &amp; Conditions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('refund')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left"
                >
                  Refund Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/track-print')}
                  className="hover:text-[#00B32D] transition-colors cursor-pointer text-left flex items-center gap-1"
                >
                  <span>Track Customer Order</span>
                  <ArrowUpRight className="w-3 h-3 text-[#00B32D]" />
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-[#E1E7E1] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#646B65]">
          <p>© 2026 EasyToPrint. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs">
            <span className="text-[#111111] font-semibold">One Platform to Manage Your Entire Printing Business</span>
          </div>
        </div>
      </div>

      {/* Interactive Information & Legal Modals */}
      {activeLegalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in font-['Manrope',sans-serif]">
          <div className="bg-white border border-[#E1E7E1] p-6 sm:p-7 rounded-2xl shadow-xl max-w-lg w-full space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E1E7E1]">
              <h3 className="text-base font-bold text-[#111111]">
                {activeLegalModal === 'privacy' && 'Privacy Policy'}
                {activeLegalModal === 'terms' && 'Terms & Conditions'}
                {activeLegalModal === 'refund' && 'Refund Policy'}
                {activeLegalModal === 'contact' && 'Contact EasyToPrint'}
                {activeLegalModal === 'about' && 'About EasyToPrint'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveLegalModal(null)}
                className="p-1 rounded-lg text-[#646B65] hover:bg-[#F7F8F7] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#646B65] space-y-3 leading-relaxed">
              {activeLegalModal === 'privacy' && (
                <>
                  <p className="font-semibold text-[#111111]">100% Data Privacy &amp; Automatic Document Destruction</p>
                  <p>Customer print files uploaded through the QR ordering system are encrypted in transit via TLS 1.3. Once the physical printer marks the job complete, the temporary file payload is permanently purged.</p>
                  <p>Shop owners and customers can rest assured that personal files, documents, and identity photos are never indexed, stored permanently, or shared with third parties.</p>
                </>
              )}

              {activeLegalModal === 'terms' && (
                <>
                  <p className="font-semibold text-[#111111]">Service Terms &amp; Fair Usage</p>
                  <p>EasyToPrint provides SaaS management tools, cloud queue orchestration, and a Windows desktop print agent for Xerox and commercial print shops.</p>
                  <p>Subscribed shops can connect authorized physical printers up to their plan limit. Device authentication tokens are secured with Windows DPAPI safe storage.</p>
                </>
              )}

              {activeLegalModal === 'refund' && (
                <>
                  <p className="font-semibold text-[#111111]">Fair Refund Policy</p>
                  <p>Shop subscriptions come with a 7-day money-back guarantee for initial onboarding. If your printer setup is incompatible or not fully supported, contact our technical team for an immediate resolution or refund.</p>
                  <p>Customer print order payments are processed through Razorpay directly to shop accounts. In case of printer hardware jams, shops can re-print orders directly from the print queue.</p>
                </>
              )}

              {activeLegalModal === 'contact' && (
                <div className="space-y-4 pt-1">
                  <p>Have questions or need assistance connecting your printers? Our technical support team is ready to help.</p>
                  <div className="p-4 rounded-xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-2.5">
                    <div className="flex items-center gap-2.5 text-xs text-[#111111] font-semibold">
                      <Mail className="w-4 h-4 text-[#00B32D]" />
                      <span>support@easytoprint.in</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-[#111111] font-semibold">
                      <Phone className="w-4 h-4 text-[#00B32D]" />
                      <span>+91 98765 43210 (Mon–Sat, 9 AM – 8 PM IST)</span>
                    </div>
                  </div>
                </div>
              )}

              {activeLegalModal === 'about' && (
                <>
                  <p className="font-semibold text-[#111111]">Built for Modern Xerox &amp; Print Centers</p>
                  <p>EasyToPrint was designed specifically to eliminate counter chaos in photocopy and print shops. By combining QR-based customer self-ordering, online UPI payments, and an automated Windows Print Agent, shop owners save hours every day and eliminate counter queues.</p>
                </>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveLegalModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#00B32D] hover:bg-[#008F25] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
