import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../lib/store';
import { apiUrl } from '../../lib/apiConfig';
import { FaqAccordion } from './FaqAccordion';
import {
  Printer,
  QrCode,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  Shield,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Zap,
  Check,
  X,
  FileText,
  Clock,
  Laptop,
  Layers,
  HardDrive,
  Lock,
  Wifi,
  SlidersHorizontal,
  RefreshCw,
  Store,
  Sliders,
  DollarSign,
  Activity,
  ArrowUpRight,
  Flame,
  CheckCheck,
  HelpCircle,
  ShieldCheck,
  Monitor,
  Eye,
  Sparkles
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { navigate, plans, currentUser, activeShop, setIsQrScannerOpen } = useApp();

  // Billing period toggle (Monthly / Yearly)
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  // Live SaaS Pricing Plans from Database
  const [livePlans, setLivePlans] = useState<any[]>([]);

  // Interactive Agent Preview active printer tab
  const [agentPrinterTab, setAgentPrinterTab] = useState<'laser' | 'color' | 'heavy'>('laser');

  useEffect(() => {
    let cancelled = false;
    async function fetchLivePlans() {
      try {
        const res = await fetch(apiUrl('/api/public/plans'));
        const data = await res.json();
        if (!cancelled && data.success && Array.isArray(data.plans) && data.plans.length > 0) {
          setLivePlans(data.plans);
        }
      } catch (err) {
        console.warn('[LandingPage] Using fallback store plans:', err);
      }
    }
    fetchLivePlans();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayPlans = livePlans.length > 0 ? livePlans : (plans.length > 0 ? plans : [
    {
      id: 'starter',
      name: 'Starter Plan',
      tagline: 'Ideal for independent Xerox & photocopy counters',
      priceMonthly: 499,
      priceYearly: 4990,
      maxPrinters: 1,
      isRecommended: false,
      features: [
        '1 Physical Printer Connection',
        'Windows PrintFlow Agent Included',
        'Customer QR Self-Service',
        'Direct UPI & Razorpay Payments',
        'Automated Print Spooling',
        'Standard Email Support'
      ]
    },
    {
      id: 'pro',
      name: 'Professional Plan',
      tagline: 'Best for busy printing stores with dual printer setups',
      priceMonthly: 999,
      priceYearly: 9990,
      maxPrinters: 3,
      isRecommended: true,
      features: [
        'Up to 3 Physical Printers (B&W + Color)',
        'Multi-Printer Smart Routing',
        'Real-Time Job Queue Management',
        'Driver Capability Auto-Detection',
        'Priority Spooler Crash Recovery',
        'Instant WhatsApp & Phone Support'
      ]
    },
    {
      id: 'business',
      name: 'Enterprise Hub',
      tagline: 'For commercial print presses & campus cyber centers',
      priceMonthly: 1999,
      priceYearly: 19990,
      maxPrinters: 10,
      isRecommended: false,
      features: [
        'Up to 10 Physical Printers',
        'Multi-Station Windows Agents',
        'High-Volume Parallel Spooling',
        'Detailed Shop Analytics & Logs',
        'Custom QR Signage & Branding',
        'Dedicated Technical Onboarding'
      ]
    }
  ]);


  return (
    <div className="min-h-screen bg-[#F7F8F7] text-[#111111] font-['Manrope',sans-serif] selection:bg-[#E8F8EC] selection:text-[#008F25]">
      {/* Subtle Background Grid Pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.45] z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, #E1E7E1 1px, transparent 1px),
            linear-gradient(to bottom, #E1E7E1 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px'
        }}
      />

      <div className="relative z-10">
        {/* ========================================================================= */}
        {/* SECTION 1: HERO SECTION                                                   */}
        {/* ========================================================================= */}
        <section id="hero" className="pt-10 sm:pt-16 pb-16 sm:pb-24 overflow-hidden border-b border-[#E1E7E1]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Value Proposition & Copy */}
              <div className="lg:col-span-7 space-y-6 text-left">
                {/* Badge (Matching reference image green bordered pill with star) */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#00B32D] text-[#008F25] text-xs font-bold tracking-wide shadow-2xs">
                  <span className="text-[#00B32D] text-sm">★</span>
                  <span>India's Smartest Xerox &amp; Print Shop Automation Platform</span>
                </div>

                {/* Main Heading */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-extrabold text-[#111111] leading-[1.12] tracking-tight text-balance">
                  Run Your Xerox Shop on <span className="text-[#00B32D]">Autopilot.</span>
                  <br />
                  <span className="text-[#111111]">Save Time. Automate Printing. Grow More.</span>
                </h1>

                {/* Subheading */}
                <p className="text-base sm:text-lg text-[#646B65] max-w-2xl leading-relaxed text-balance">
                  Manage print orders, automate printer workflows, accept online payments, and grow your printing business with one powerful platform.
                </p>

                {/* CTA Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Customer Scan QR Button */}
                  <button
                    type="button"
                    onClick={() => setIsQrScannerOpen(true)}
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#00A61C] hover:bg-[#008F25] text-white text-base font-semibold shadow-md shadow-[#00A61C]/25 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                    title="Scan EasyToPrint Counter QR Code"
                  >
                    <QrCode className="w-5 h-5 stroke-[2.2]" />
                    <span>Scan QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/auth/register')}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-[#F7F8F7] text-[#111111] border border-[#E1E7E1] text-base font-semibold active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                  >
                    <span>Get Started for Free</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.2]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-transparent hover:bg-slate-100/70 text-[#646B65] hover:text-[#111111] text-base font-medium active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span>See How It Works</span>
                  </button>
                </div>

                {/* 4 Feature Badges */}
                <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: 'No App Required', icon: <Smartphone className="w-4 h-4 text-[#00B32D]" /> },
                    { label: 'Instant UPI Payments', icon: <CreditCard className="w-4 h-4 text-[#00B32D]" /> },
                    { label: 'Automated Printing', icon: <Zap className="w-4 h-4 text-[#00B32D]" /> },
                    { label: 'Desktop Compatible', icon: <Printer className="w-4 h-4 text-[#00B32D]" /> }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white border border-[#E1E7E1] flex items-center gap-2 text-xs font-semibold text-[#111111] shadow-2xs"
                    >
                      <div className="p-1 rounded-md bg-[#E8F8EC] shrink-0">
                        {item.icon}
                      </div>
                      <span className="truncate">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Hero Visual Product Showcase */}
              <div className="lg:col-span-5 relative">
                {/* Floating Status Indicator Badges */}
                <div className="relative mx-auto max-w-lg lg:max-w-none">
                  {/* Floating Indicator 1: Agent Connected */}
                  <motion.div
                    initial={{ y: -8, opacity: 0 }}
                    animate={{ y: [0, -6, 0], opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                    className="absolute -top-4 -left-3 sm:-left-6 z-20 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#E1E7E1] shadow-lg flex items-center gap-2 text-xs font-bold text-[#111111]"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#00B32D] animate-ping" />
                    <span>Agent Connected</span>
                  </motion.div>

                  {/* Floating Indicator 2: Payment Successful */}
                  <motion.div
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: [0, 6, 0], opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut', delay: 0.5 }}
                    className="absolute top-1/4 -right-3 sm:-right-6 z-20 px-3.5 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#A7F3D0] shadow-lg flex items-center gap-2 text-xs font-bold text-[#008F25]"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#00B32D]" />
                    <span>₹24.00 UPI Received</span>
                  </motion.div>

                  {/* Floating Indicator 3: Printer Online */}
                  <motion.div
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: [0, -5, 0], opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 1 }}
                    className="absolute -bottom-4 left-4 z-20 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#E1E7E1] shadow-lg flex items-center gap-2 text-xs font-bold text-[#111111]"
                  >
                    <Printer className="w-4 h-4 text-[#00B32D]" />
                    <span>HP LaserJet Online</span>
                  </motion.div>

                  {/* Floating Indicator 4: Spooling Job */}
                  <motion.div
                    initial={{ y: -8, opacity: 0 }}
                    animate={{ y: [0, 5, 0], opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 4.2, ease: 'easeInOut', delay: 1.5 }}
                    className="absolute bottom-16 -right-2 sm:-right-4 z-20 px-3 py-1.5 rounded-xl bg-[#E8F8EC] border border-[#A7F3D0] shadow-lg flex items-center gap-2 text-xs font-bold text-[#008F25]"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#00B32D] animate-spin" />
                    <span>Auto-Spooling (8 pgs)</span>
                  </motion.div>

                  {/* Main Desktop Showcase Frame */}
                  <div className="rounded-2xl border border-[#E1E7E1] bg-white shadow-xl overflow-hidden">
                    {/* Window Titlebar */}
                    <div className="bg-[#F7F8F7] border-b border-[#E1E7E1] px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-400/80" />
                        <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                        <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                        <span className="text-xs font-semibold text-[#646B65] ml-2">EasyToPrint Shop Console</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-[#008F25] bg-[#E8F8EC] px-2 py-0.5 rounded border border-[#A7F3D0]">
                        LIVE CONNECTED
                      </span>
                    </div>

                    {/* Dashboard Preview Body */}
                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Metric Strips */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-[#F7F8F7] border border-[#E1E7E1]">
                          <span className="text-[10px] text-[#646B65] font-semibold block">Today's Orders</span>
                          <span className="text-lg font-bold text-[#111111] tabular-nums">48 Jobs</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#F7F8F7] border border-[#E1E7E1]">
                          <span className="text-[10px] text-[#646B65] font-semibold block">Counter Revenue</span>
                          <span className="text-lg font-bold text-[#008F25] tabular-nums">₹1,420</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#F7F8F7] border border-[#E1E7E1]">
                          <span className="text-[10px] text-[#646B65] font-semibold block">Active Queue</span>
                          <span className="text-lg font-bold text-[#111111] tabular-nums">2 Spooling</span>
                        </div>
                      </div>

                      {/* Windows Print Agent Interface Mockup Sub-card */}
                      <div className="rounded-xl border border-[#A7F3D0] bg-[#E8F8EC]/40 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-[#00B32D] text-white flex items-center justify-center">
                              <Laptop className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold text-[#111111]">EasyToPrint Windows Agent v1.4.2</span>
                          </div>
                          <span className="text-[10px] font-semibold text-[#008F25] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00B32D]" />
                            Win32 Spooler Active
                          </span>
                        </div>

                        {/* Connected Printers Table */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E1E7E1] text-xs">
                            <div className="flex items-center gap-2">
                              <Printer className="w-3.5 h-3.5 text-[#00B32D]" />
                              <span className="font-semibold text-[#111111]">HP LaserJet P1007</span>
                              <span className="text-[10px] text-[#646B65]">(A4 Black &amp; White)</span>
                            </div>
                            <span className="text-[10px] font-bold text-[#008F25] bg-[#E8F8EC] px-1.5 py-0.5 rounded">Ready</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E1E7E1] text-xs">
                            <div className="flex items-center gap-2">
                              <Printer className="w-3.5 h-3.5 text-[#00B32D]" />
                              <span className="font-semibold text-[#111111]">Canon G3000 Series</span>
                              <span className="text-[10px] text-[#646B65]">(Color + Photo)</span>
                            </div>
                            <span className="text-[10px] font-bold text-[#008F25] bg-[#E8F8EC] px-1.5 py-0.5 rounded">Ready</span>
                          </div>
                        </div>
                      </div>

                      {/* Live Print Job Feed */}
                      <div className="border border-[#E1E7E1] rounded-xl p-3 bg-white space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#111111]">Recent Auto-Dispatched Print Job</span>
                          <span className="text-[11px] text-[#646B65]">Order #EP-8902</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-[#646B65]">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#00B32D]" />
                            <span className="font-semibold text-[#111111]">Admit_Card_2026.pdf</span>
                            <span>· 2 Copies · Double Sided</span>
                          </div>
                          <span className="font-bold text-[#008F25] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Printed
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: KEY BENEFITS / PRODUCT HIGHLIGHTS                              */}
        {/* ========================================================================= */}
        <section id="platform" className="py-16 sm:py-24 border-b border-[#E1E7E1] bg-white scroll-mt-20">
          <div id="benefits" className="scroll-mt-20" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="text-xs font-bold text-[#008F25] bg-[#E8F8EC] px-3 py-1 rounded-full border border-[#A7F3D0]">
                Built for Printing Business Owners
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
                Designed for Speed, Security &amp; Zero Counter Chaos
              </h2>
              <p className="text-sm sm:text-base text-[#646B65]">
                EasyToPrint connects customer smartphones, your shop dashboard, Windows agent, and physical printers into a unified, touch-free ecosystem.
              </p>
            </div>

            {/* 6-Column / 3-Column Benefits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Benefit 1 */}
              <div className="p-5 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-2 hover:border-[#A7F3D0] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h3 className="text-base font-bold text-[#111111]">100% Data Privacy</h3>
                <p className="text-xs text-[#646B65] leading-relaxed">
                  Customer documents are strictly encrypted in transit via TLS 1.3 and automatically destroyed as soon as the print finishes. No pen drive viruses.
                </p>
              </div>

              {/* Benefit 2 */}
              <div className="p-5 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-2 hover:border-[#A7F3D0] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h3 className="text-base font-bold text-[#111111]">Instant UPI Checkout</h3>
                <p className="text-xs text-[#646B65] leading-relaxed">
                  Zero payment chasing. Customers scan, choose print settings, and pay instantly via Google Pay, PhonePe, or Paytm before jobs reach the printer.
                </p>
              </div>

              {/* Benefit 3 */}
              <div className="p-5 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-2 hover:border-[#A7F3D0] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <Printer className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h3 className="text-base font-bold text-[#111111]">Broad Printer Compatibility</h3>
                <p className="text-xs text-[#646B65] leading-relaxed">
                  Compatible with your existing office and counter printers—HP, Canon, Epson, Brother, Ricoh—without purchasing expensive new hardware.
                </p>
              </div>

              {/* Benefit 4 */}
              <div className="p-5 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-2 hover:border-[#A7F3D0] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h3 className="text-base font-bold text-[#111111]">Superfast Print Processing</h3>
                <p className="text-xs text-[#646B65] leading-relaxed">
                  Lightning-fast cloud queue processing. Paid jobs dispatch to your Windows spooler within seconds, eliminating long counter wait times.
                </p>
              </div>

              {/* Benefit 5 */}
              <div className="p-5 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-2 hover:border-[#A7F3D0] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h3 className="text-base font-bold text-[#111111]">Touch-Free Experience</h3>
                <p className="text-xs text-[#646B65] leading-relaxed">
                  Customers manage file selection and payment on their own devices. Counter staff simply hand over the finished printed documents.
                </p>
              </div>

              {/* Benefit 6 */}
              <div className="p-5 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-2 hover:border-[#A7F3D0] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h3 className="text-base font-bold text-[#111111]">Automated Print Workflow</h3>
                <p className="text-xs text-[#646B65] leading-relaxed">
                  Automatic page counting, color / B&amp;W auto-routing, and paper size validation without manual driver dialog tweaking.
                </p>
              </div>
            </div>

            {/* Reference-Styled Single Green Ticker Ribbon Banner */}
            <div className="mt-16 overflow-hidden rounded-2xl bg-[#00B32D] shadow-md shadow-emerald-600/20 py-3.5 sm:py-4">
              <div className="relative flex overflow-x-hidden">
                <div className="animate-marquee whitespace-nowrap flex items-center gap-7 sm:gap-9 text-xs sm:text-sm md:text-[15px] font-bold text-white tracking-wide">
                  <span>Smart Printing</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>24/7 Service</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Encrypted Files</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Zero Queues</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Contactless Prints</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Instant Print</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Smart Printing</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>24/7 Service</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Encrypted Files</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Zero Queues</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Contactless Prints</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Instant Print</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Smart Printing</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>24/7 Service</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Encrypted Files</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Zero Queues</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Contactless Prints</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                  <span>Instant Print</span>
                  <span className="text-white/80 text-xs sm:text-sm">✦</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: HOW EASYTOPRINT WORKS (4 SIMPLE STEPS)                        */}
        {/* ========================================================================= */}
        <section id="how-it-works" className="py-16 sm:py-24 border-b border-[#E1E7E1] bg-[#F7F8F7]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
              <span className="text-xs font-bold text-[#008F25] bg-[#E8F8EC] px-3 py-1 rounded-full border border-[#A7F3D0]">
                Quick 10-Minute Setup
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
                Get Your Printing Shop Running in 4 Simple Steps
              </h2>
              <p className="text-sm sm:text-base text-[#646B65]">
                Start managing your printing business with a simple setup process. No complicated server setup or IT degree needed.
              </p>
            </div>

            {/* 4 Connected Step Cards with Numbered Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {/* Step 1 */}
              <div className="p-6 rounded-2xl bg-white border border-[#E1E7E1] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#A7F3D0] transition-colors relative group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-[#00B32D] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      01
                    </span>
                    <span className="text-[11px] font-semibold text-[#008F25] bg-[#E8F8EC] px-2 py-0.5 rounded">
                      Step 1
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#111111]">Create Your Shop Account</h3>
                  <p className="text-xs text-[#646B65] leading-relaxed">
                    Register your printing business and set up your shop on EasyToPrint. Choose your shop slug, pricing per page, and payment details.
                  </p>
                </div>
                {/* Step Mockup visual */}
                <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E1E7E1] text-[11px] space-y-1.5 font-mono">
                  <div className="flex items-center gap-1.5 text-[#008F25]">
                    <Check className="w-3.5 h-3.5" />
                    <span>Shop Created: /s/counter1</span>
                  </div>
                  <div className="text-[#646B65]">UPI Payout: Linked</div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-6 rounded-2xl bg-white border border-[#E1E7E1] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#A7F3D0] transition-colors relative group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-[#00B32D] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      02
                    </span>
                    <span className="text-[11px] font-semibold text-[#008F25] bg-[#E8F8EC] px-2 py-0.5 rounded">
                      Step 2
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#111111]">Connect EasyToPrint Agent</h3>
                  <p className="text-xs text-[#646B65] leading-relaxed">
                    Install the Windows desktop Agent and securely connect it to your shop account using your shop credentials and safe DPAPI vault token.
                  </p>
                </div>
                {/* Step Mockup visual */}
                <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E1E7E1] text-[11px] space-y-1.5 font-mono">
                  <div className="flex items-center gap-1.5 text-[#008F25]">
                    <Check className="w-3.5 h-3.5" />
                    <span>Agent Connected: Win32 PC</span>
                  </div>
                  <div className="text-[#646B65]">Secure Storage: DPAPI Encrypted</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-2xl bg-white border border-[#E1E7E1] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#A7F3D0] transition-colors relative group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-[#00B32D] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      03
                    </span>
                    <span className="text-[11px] font-semibold text-[#008F25] bg-[#E8F8EC] px-2 py-0.5 rounded">
                      Step 3
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#111111]">Connect Your Printers</h3>
                  <p className="text-xs text-[#646B65] leading-relaxed">
                    Discover, configure and register your physical printers. Automatically detect supported printer capabilities (paper sizes, B&amp;W/Color).
                  </p>
                </div>
                {/* Step Mockup visual */}
                <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E1E7E1] text-[11px] space-y-1.5 font-mono">
                  <div className="flex items-center gap-1.5 text-[#008F25]">
                    <Check className="w-3.5 h-3.5" />
                    <span>2 Printers Registered</span>
                  </div>
                  <div className="text-[#646B65]">Spooler: Ready &amp; Listening</div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-6 rounded-2xl bg-white border border-[#E1E7E1] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#A7F3D0] transition-colors relative group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-[#00B32D] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      04
                    </span>
                    <span className="text-[11px] font-semibold text-[#008F25] bg-[#E8F8EC] px-2 py-0.5 rounded">
                      Step 4
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#111111]">Start Accepting Orders</h3>
                  <p className="text-xs text-[#646B65] leading-relaxed">
                    Generate your branded shop QR code counter standee and start receiving customer print orders automatically. Zero manual steps.
                  </p>
                </div>
                {/* Step Mockup visual */}
                <div className="p-3 rounded-xl bg-[#E8F8EC] border border-[#A7F3D0] text-[11px] space-y-1.5 font-mono text-[#008F25]">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>QR Code Generated</span>
                  </div>
                  <div className="text-xs">Ready for Customer Scans 🚀</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: CUSTOMER EXPERIENCE                                            */}
        {/* ========================================================================= */}
        <section id="features" className="py-16 sm:py-24 border-b border-[#E1E7E1] bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
              <span className="text-xs font-bold text-[#008F25] bg-[#E8F8EC] px-3 py-1 rounded-full border border-[#A7F3D0]">
                Frictionless Ordering
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
                Printing Made Smarter with EasyToPrint
              </h2>
              <p className="text-sm sm:text-base text-[#646B65]">
                Give your customers a faster, easier and more convenient way to print documents without standing in long queues or sharing sensitive files over WhatsApp.
              </p>
            </div>

            {/* 6 Features in a Clean Modern 3x2 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="p-6 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-4 hover:border-[#A7F3D0] transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <QrCode className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-[#111111]">1. Scan &amp; Get Started</h3>
                  <p className="text-xs text-[#646B65] leading-relaxed">
                    Scan the shop's counter QR code to access printing services instantly in any mobile browser, without installing an application or creating an account.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsQrScannerOpen(true)}
                    className="w-full p-2.5 rounded-xl bg-white hover:bg-[#E8F8EC] border border-[#E1E7E1] hover:border-[#A7F3D0] text-[#00A61C] flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  >
                    <QrCode className="w-4 h-4 text-[#00A61C]" />
                    <span>Scan Counter QR Code</span>
                  </button>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-4 hover:border-[#A7F3D0] transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <FileText className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-[#111111]">2. Easy File Upload</h3>
                  <p className="text-xs text-[#646B65] leading-relaxed">
                    Upload PDF documents directly from smartphone storage, Google Drive, or WhatsApp shares in just a couple of taps with live page count inspection.
                  </p>
                </div>
                <div className="pt-2">
                  <div className="p-3 rounded-xl bg-white border border-[#E1E7E1] flex items-center gap-3 text-xs">
                    <Check className="w-4 h-4 text-[#00B32D]" />
                    <span className="font-semibold text-[#111111]">Automatic Page Counter &amp; Previews</span>
                  </div>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-4 hover:border-[#A7F3D0] transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <SlidersHorizontal className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-[#111111]">3. Customize Your Prints</h3>
                  <p className="text-xs text-[#646B65] leading-relaxed">
                    Choose paper size (A4, Legal), color mode (Black &amp; White vs Color), single or double-sided, and number of copies with live price calculations.
                  </p>
                </div>
                <div className="pt-2">
                  <div className="p-3 rounded-xl bg-white border border-[#E1E7E1] flex items-center gap-3 text-xs">
                    <Check className="w-4 h-4 text-[#00B32D]" />
                    <span className="font-semibold text-[#111111]">Real-time Printer Capability Sync</span>
                  </div>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-4 hover:border-[#A7F3D0] transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <CreditCard className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-[#111111]">4. Secure Online Payments</h3>
                  <p className="text-xs text-[#646B65] leading-relaxed">
                    Pay for print orders quickly and securely using supported digital payment methods (Google Pay, PhonePe, Paytm, Cards) with automated instant receipts.
                  </p>
                </div>
                <div className="pt-2">
                  <div className="p-3 rounded-xl bg-white border border-[#E1E7E1] flex items-center gap-3 text-xs">
                    <Check className="w-4 h-4 text-[#00B32D]" />
                    <span className="font-semibold text-[#111111]">Instant UPI Webhook Reconciliation</span>
                  </div>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="p-6 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-4 hover:border-[#A7F3D0] transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <Zap className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-[#111111]">5. Automatic Printing</h3>
                  <p className="text-xs text-[#646B65] leading-relaxed">
                    Once payment is confirmed, the print job is automatically sent to the connected counter printer for processing. Staff don't have to touch a mouse.
                  </p>
                </div>
                <div className="pt-2">
                  <div className="p-3 rounded-xl bg-white border border-[#E1E7E1] flex items-center gap-3 text-xs">
                    <Check className="w-4 h-4 text-[#00B32D]" />
                    <span className="font-semibold text-[#111111]">Zero-click Spooler Dispatch</span>
                  </div>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="p-6 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-4 hover:border-[#A7F3D0] transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center font-bold">
                  <Clock className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-[#111111]">6. Real-Time Order Tracking</h3>
                  <p className="text-xs text-[#646B65] leading-relaxed">
                    Track print job status live on the customer's phone—from Uploaded, to Spooling, to Printing, to Completed. Customers know the exact moment their papers are ready.
                  </p>
                </div>
                <div className="pt-2">
                  <div className="p-3 rounded-xl bg-white border border-[#E1E7E1] flex items-center gap-3 text-xs">
                    <Check className="w-4 h-4 text-[#00B32D]" />
                    <span className="font-semibold text-[#111111]">Live Progress Indicator Screen</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: EASYTOPRINT AGENT / DESKTOP MANAGEMENT                        */}
        {/* ========================================================================= */}
        <section id="desktop-agent" className="py-16 sm:py-24 border-b border-[#E1E7E1] bg-[#F7F8F7]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Key Features List */}
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8F8EC] border border-[#A7F3D0] text-[#008F25] text-xs font-bold">
                  <Laptop className="w-3.5 h-3.5 text-[#00B32D]" />
                  <span>Native Windows x64 Spooler Engine</span>
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
                    Meet Your Smart Printing Assistant
                  </h2>
                  <p className="text-sm sm:text-base text-[#646B65] leading-relaxed">
                    Take complete control of your shop's printing operations with the EasyToPrint Windows Agent. Runs quietly in your system tray and manages hardware queues effortlessly.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {[
                    {
                      title: 'Multiple Printer Management',
                      desc: 'Connect and manage multiple physical printers from one desktop application.'
                    },
                    {
                      title: 'Live Printer Status',
                      desc: 'Monitor printer connectivity and paper availability in real time.'
                    },
                    {
                      title: 'Smart Print Queue',
                      desc: 'View, manage, pause, and resume print jobs from a centralized queue.'
                    },
                    {
                      title: 'Automatic Job Processing',
                      desc: 'Process eligible customer print orders automatically after payment confirmation.'
                    },
                    {
                      title: 'Printer Capability Detection',
                      desc: 'Detect supported paper sizes, color modes and driver capabilities automatically.'
                    },
                    {
                      title: 'Desktop-Based Control',
                      desc: 'Manage your entire counter printing workflow directly from your Windows computer.'
                    }
                  ].map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#111111]">{feat.title}</h4>
                        <p className="text-xs text-[#646B65] mt-0.5">{feat.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/auth/register')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-[#E1E7E1] hover:border-[#00B32D] text-xs font-bold text-[#111111] hover:text-[#00B32D] shadow-2xs transition-all cursor-pointer"
                  >
                    <span>Explore EasyToPrint Agent</span>
                    <ArrowRight className="w-4 h-4 text-[#00B32D]" />
                  </button>
                </div>
              </div>

              {/* Right Column: Large Windows Desktop Application Mockup */}
              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-[#E1E7E1] bg-white shadow-xl overflow-hidden font-['Manrope',sans-serif]">
                  {/* Windows Title Bar */}
                  <div className="bg-[#F7F8F7] border-b border-[#E1E7E1] px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Printer className="w-4 h-4 text-[#00B32D]" />
                      <span className="text-xs font-bold text-[#111111]">EasyToPrint Desktop Agent (Win32 Spooler)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-[#008F25] bg-[#E8F8EC] px-2 py-0.5 rounded border border-[#A7F3D0] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00B32D]" />
                        ONLINE &amp; SPOOLING
                      </span>
                    </div>
                  </div>

                  {/* Agent Header Bar */}
                  <div className="p-4 border-b border-[#E1E7E1] flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div>
                      <h4 className="text-base font-bold text-[#111111]">Counter Hardware Orchestrator</h4>
                      <p className="text-xs text-[#646B65]">Paired Shop: Main Station (ID: AP-8849-WIN)</p>
                    </div>

                    {/* Printer Switch Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-[#F7F8F7] rounded-lg border border-[#E1E7E1] text-xs">
                      <button
                        type="button"
                        onClick={() => setAgentPrinterTab('laser')}
                        className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          agentPrinterTab === 'laser' ? 'bg-white text-[#111111] shadow-2xs' : 'text-[#646B65]'
                        }`}
                      >
                        HP LaserJet (B&amp;W)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAgentPrinterTab('color')}
                        className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                          agentPrinterTab === 'color' ? 'bg-white text-[#111111] shadow-2xs' : 'text-[#646B65]'
                        }`}
                      >
                        Canon Inkjet (Color)
                      </button>
                    </div>
                  </div>

                  {/* Printer Cards & Status */}
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl border border-[#A7F3D0] bg-[#E8F8EC]/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#111111]">HP LaserJet P1007</span>
                          <span className="text-[10px] font-bold text-[#008F25] bg-white px-2 py-0.5 rounded border border-[#A7F3D0]">
                            Ready &bull; Active
                          </span>
                        </div>
                        <p className="text-[11px] text-[#646B65]">A4 Mono &bull; Spooler Lock Clear &bull; 0 Queue Lag</p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-[#E1E7E1] bg-white space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#111111]">Canon G3000 Series</span>
                          <span className="text-[10px] font-bold text-[#008F25] bg-[#E8F8EC] px-2 py-0.5 rounded border border-[#A7F3D0]">
                            Ready &bull; Idle
                          </span>
                        </div>
                        <p className="text-[11px] text-[#646B65]">A4 Color / Photo &bull; Capabilities Synced</p>
                      </div>
                    </div>

                    {/* Realistic Print Queue Table */}
                    <div className="border border-[#E1E7E1] rounded-xl overflow-hidden">
                      <div className="bg-[#F7F8F7] px-4 py-2 border-b border-[#E1E7E1] flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111111]">Active Print Queue</span>
                        <span className="text-[11px] text-[#646B65]">Real-time Auto Polling (5s)</span>
                      </div>
                      <div className="divide-y divide-[#E1E7E1] text-xs">
                        <div className="p-3 flex items-center justify-between bg-[#E8F8EC]/20">
                          <div className="space-y-0.5">
                            <span className="font-bold text-[#111111] block">Job #4829 — Annual_Report.pdf</span>
                            <span className="text-[11px] text-[#646B65]">Customer: +91 98*** · 14 Pages · Double Sided</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#008F25] bg-[#E8F8EC] border border-[#A7F3D0] flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Spooling
                            </span>
                          </div>
                        </div>

                        <div className="p-3 flex items-center justify-between bg-white">
                          <div className="space-y-0.5">
                            <span className="font-bold text-[#111111] block">Job #4828 — Project_Synopsis.pdf</span>
                            <span className="text-[11px] text-[#646B65]">Customer: +91 97*** · 4 Pages · Single Sided</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200">
                            Queued
                          </span>
                        </div>

                        <div className="p-3 flex items-center justify-between bg-white">
                          <div className="space-y-0.5">
                            <span className="font-bold text-[#111111] block">Job #4827 — Resume_Final.pdf</span>
                            <span className="text-[11px] text-[#646B65]">Customer: +91 99*** · 2 Pages · Color</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#008F25] bg-[#E8F8EC]">
                            Completed
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 6: SMARTER VS TRADITIONAL COMPARISON                              */}
        {/* ========================================================================= */}
        <section id="comparison" className="py-16 sm:py-24 border-b border-[#E1E7E1] bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
              <span className="text-xs font-bold text-[#008F25] bg-[#E8F8EC] px-3 py-1 rounded-full border border-[#A7F3D0]">
                Modernize Your Counter
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
                Smarter Printing. Better Business.
              </h2>
              <p className="text-sm sm:text-base text-[#646B65]">
                Discover how EasyToPrint transforms traditional printing headaches into a fast, automated, and profitable operation.
              </p>
            </div>

            {/* Two-Column Comparison Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Traditional Side (Neutral appearance) */}
              <div className="p-6 sm:p-8 rounded-3xl bg-[#F7F8F7] border border-[#E1E7E1] space-y-6">
                <div className="border-b border-[#E1E7E1] pb-4">
                  <span className="text-xs font-bold text-[#646B65] uppercase tracking-wider block">
                    The Old Way
                  </span>
                  <h3 className="text-xl font-bold text-[#111111] mt-1">Traditional Printing</h3>
                  <p className="text-xs text-[#646B65] mt-1">Manual chaos, USB viruses, and lost revenue.</p>
                </div>

                <div className="space-y-4">
                  {[
                    'Manual order handling at the counter',
                    'Carry files using USB drives & infected pen drives',
                    'Explain print settings manually for every customer',
                    'Collect cash & calculate loose change at the counter',
                    'Manage printers individually with manual driver dialogs',
                    'Manually monitor print jobs and resolve printer jams'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm text-[#646B65]">
                      <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* EasyToPrint Side (Brand Green highlight) */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-[#00B32D] shadow-lg shadow-emerald-500/10 space-y-6 relative">
                <div className="border-b border-[#E1E7E1] pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#008F25] uppercase tracking-wider">
                      The Modern Way
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E8F8EC] text-[#008F25] text-[11px] font-bold border border-[#A7F3D0]">
                      Automated
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-[#111111] mt-1">With EasyToPrint</h3>
                  <p className="text-xs text-[#646B65] mt-1">Touch-free customer self-service and auto-printing.</p>
                </div>

                <div className="space-y-4">
                  {[
                    'Automated order processing directly to printers',
                    'QR-based file uploads from customer smartphones',
                    'Customers select print options & paper sizes themselves',
                    'Online payment integration via instant UPI (GPay/PhonePe)',
                    'Centralized multi-printer management on one screen',
                    'Organized digital print queue with live status tracking'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm font-semibold text-[#111111]">
                      <div className="w-5 h-5 rounded-full bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 7: PRICING PLANS                                                  */}
        {/* ========================================================================= */}
        <section id="pricing" className="py-16 sm:py-24 border-b border-[#E1E7E1] bg-[#F7F8F7]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
              <span className="text-xs font-bold text-[#008F25] bg-[#E8F8EC] px-3 py-1 rounded-full border border-[#A7F3D0]">
                Transparent Pricing
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
                Simple Plans. Smarter Printing.
              </h2>
              <p className="text-sm sm:text-base text-[#646B65]">
                Choose a plan that fits your printing business. Start small and upgrade as your business grows.
              </p>

              {/* Monthly / Yearly Billing Toggle */}
              <div className="pt-4 flex items-center justify-center">
                <div className="p-1 rounded-xl bg-white border border-[#E1E7E1] inline-flex items-center gap-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setBillingPeriod('MONTHLY')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      billingPeriod === 'MONTHLY'
                        ? 'bg-[#00B32D] text-white shadow-xs'
                        : 'text-[#646B65] hover:text-[#111111]'
                    }`}
                  >
                    Monthly Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingPeriod('YEARLY')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      billingPeriod === 'YEARLY'
                        ? 'bg-[#00B32D] text-white shadow-xs'
                        : 'text-[#646B65] hover:text-[#111111]'
                    }`}
                  >
                    <span>Yearly Billing</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#E8F8EC] text-[#008F25]">
                      Save 17%
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
              {displayPlans.map((plan: any, idx: number) => {
                const isRec = plan.isRecommended || idx === 1;
                const price = billingPeriod === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
                const perMonthEquiv = billingPeriod === 'YEARLY' ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;

                return (
                  <div
                    key={plan.id || idx}
                    className={`rounded-3xl p-7 flex flex-col justify-between transition-all bg-white border ${
                      isRec
                        ? 'border-2 border-[#00B32D] shadow-xl shadow-emerald-500/10 relative scale-[1.02]'
                        : 'border-[#E1E7E1] shadow-xs hover:border-[#A7F3D0]'
                    }`}
                  >
                    {isRec && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#00B32D] text-white text-[11px] font-bold uppercase tracking-wider shadow-sm">
                        Most Popular for Xerox Shops
                      </div>
                    )}

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-bold text-[#111111]">{plan.name}</h3>
                        <p className="text-xs text-[#646B65] mt-1 min-h-[32px]">{plan.tagline}</p>
                      </div>

                      {/* Pricing Value */}
                      <div className="border-b border-[#E1E7E1] pb-5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl sm:text-4xl font-extrabold text-[#111111] tabular-nums">
                            ₹{billingPeriod === 'YEARLY' ? perMonthEquiv : price}
                          </span>
                          <span className="text-xs text-[#646B65] font-semibold">/ month</span>
                        </div>
                        {billingPeriod === 'YEARLY' && (
                          <span className="text-[11px] text-[#008F25] font-bold block mt-1">
                            Billed annually at ₹{plan.priceYearly}
                          </span>
                        )}
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F8F7] border border-[#E1E7E1] text-xs font-semibold text-[#111111]">
                          <Printer className="w-3.5 h-3.5 text-[#00B32D]" />
                          <span>Supports up to {plan.maxPrinters || 1} Physical Printer{(plan.maxPrinters || 1) > 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Features List */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-[#111111] uppercase tracking-wider block">
                          Included Features:
                        </span>
                        {(plan.features || []).map((feat: string, fIdx: number) => (
                          <div key={fIdx} className="flex items-start gap-2.5 text-xs text-[#111111]">
                            <Check className="w-4 h-4 text-[#00B32D] shrink-0 mt-0.5 stroke-[2.2]" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA Button */}
                    <div className="pt-8">
                      <button
                        type="button"
                        onClick={() => navigate('/auth/register')}
                        className={`w-full py-3 rounded-xl text-sm font-bold transition-all cursor-pointer shadow-xs ${
                          isRec
                            ? 'bg-[#00B32D] hover:bg-[#008F25] text-white shadow-emerald-500/20'
                            : 'bg-[#F7F8F7] hover:bg-[#E1E7E1] text-[#111111] border border-[#E1E7E1]'
                        }`}
                      >
                        Get Started
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION: CTA BANNER (REDUCED HEIGHT & Modern Green Shop Counter Image)      */}
        {/* ========================================================================= */}


        {/* ========================================================================= */}
        {/* SECTION 8: INTERACTIVE FAQ ACCORDION                                      */}
        {/* ========================================================================= */}
        <FaqAccordion />


      </div>
    </div>
  );
};
