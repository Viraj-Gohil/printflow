import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../lib/store';
import { apiUrl } from '../../lib/apiConfig';
import { QrScannerModal } from '../common/QrScannerModal';
import { PrintWorkflowSvg } from './PrintWorkflowSvg';
import {
  QrCode,
  SlidersHorizontal,
  CreditCard,
  Printer,
  CheckCircle2,
  ArrowRight,
  Shield,
  Smartphone,
  ChevronDown,
  Sparkles,
  Zap,
  Check,
  Store,
  FileText,
  Clock,
  Laptop,
  CheckCheck,
  Download,
  Layers,
  Play,
  BarChart3,
  HardDrive,
  Lock,
  Cpu,
  Wifi,
  Settings,
  X,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  PhoneCall,
  Mail,
  ShieldCheck,
  Sliders,
  DollarSign
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { navigate, plans, currentUser, activeShop } = useApp();
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Interactive Live Product Workflow state
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'CUSTOMER' | 'PAYMENT' | 'AGENT' | 'PRINTER'>('CUSTOMER');
  const [workflowAutoPlay, setWorkflowAutoPlay] = useState<boolean>(true);

  // Billing period toggle (Monthly / Yearly)
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  // Live SaaS Pricing Plans from Database with Optimized Fetching & Caching
  const [livePlans, setLivePlans] = useState<any[]>([]);

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
    return () => { cancelled = true; };
  }, []);

  const displayPlans = livePlans.length > 0 ? livePlans : (plans.length > 0 ? plans : [
    {
      id: 'starter',
      name: 'Starter',
      tagline: 'For small photocopy shops testing the platform',
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'INR',
      features: ['Up to 100 prints/month', '1 Counter QR Stand', 'Desktop Print Agent (1 PC)', 'Razorpay & UPI Payments'],
      isPopular: false
    },
    {
      id: 'growth',
      name: 'Growth',
      tagline: 'For busy college-area xerox & copy shops',
      priceMonthly: 499,
      priceYearly: 399,
      currency: 'INR',
      features: ['Unlimited Monthly Prints', '3 Printable Counter QR Stands', 'Multi-Printer Spooling (B&W + Color)', 'Daily Revenue & Accounting Reports', 'Priority WhatsApp Support'],
      isPopular: true
    },
    {
      id: 'pro',
      name: 'Commercial Pro Hub',
      tagline: 'For high-volume xerox centers & busy campus hubs',
      priceMonthly: 999,
      priceYearly: 799,
      currency: 'INR',
      features: ['Up to 20 Connected Printers', 'Multiple Cashier Logins', 'Custom Branding & Domain', 'Dedicated Account Manager'],
      isPopular: false
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      tagline: 'Multi-branch franchises, university hubs & print enterprises',
      priceMonthly: 2499,
      priceYearly: 1999,
      currency: 'INR',
      features: ['Unlimited Connected Printers', 'Unlimited Cashier Accounts', 'Dedicated Infrastructure & 99.99% SLA', 'Custom ERP & Accounting Sync', '24/7 Phone & WhatsApp Support'],
      isPopular: false
    }
  ]);

  // Accordion FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Schedule Demo / Contact Us Modal state
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);
  const [demoForm, setDemoForm] = useState({
    shopName: '',
    contactName: '',
    phone: '',
    city: '',
    dailyVolume: '100-300 prints/day'
  });
  const [demoSubmitted, setDemoSubmitted] = useState<boolean>(false);

  // Auto-play through workflow tabs
  useEffect(() => {
    if (!workflowAutoPlay) return;
    const tabs: ('CUSTOMER' | 'PAYMENT' | 'AGENT' | 'PRINTER')[] = ['CUSTOMER', 'PAYMENT', 'AGENT', 'PRINTER'];
    const timer = setInterval(() => {
      setActiveWorkflowTab((prev) => {
        const nextIndex = (tabs.indexOf(prev) + 1) % tabs.length;
        return tabs[nextIndex];
      });
    }, 4500);
    return () => clearInterval(timer);
  }, [workflowAutoPlay]);

  const faqs = [
    {
      q: 'Do I need to buy a new printer to use PrintFlow Cloud?',
      a: 'No. PrintFlow works seamlessly with your existing printers. Whether you use HP LaserJet, Canon imageRUNNER, Epson EcoTank, Brother, or Xerox multifunction machines connected via USB or Wi-Fi, the PrintFlow Agent detects and spools jobs directly.'
    },
    {
      q: 'Do customers need to install an app on their phones?',
      a: 'Never. Customers simply open their smartphone camera or Google Lens to scan the tabletop QR code at your counter. Your shop portal opens instantly in mobile Chrome or Safari with zero app installation and zero login required.'
    },
    {
      q: 'How do I get paid for prints?',
      a: 'Customer payments via UPI (Google Pay, PhonePe, Paytm, BHIM, CRED) and cards are verified instantly through secure Razorpay payment gateway integration. Funds settle directly into your registered business bank account with zero delay.'
    },
    {
      q: 'What happens if the shop internet temporarily disconnects?',
      a: 'PrintFlow uses cloud-buffered queues. Verified paid jobs stay safely queued in the cloud. As soon as your counter PC or network reconnects, the PrintFlow Agent automatically downloads and spools all pending print jobs without missing any order.'
    },
    {
      q: 'How long does the entire shop setup take?',
      a: 'Under 5 minutes. Simply register your shop, configure your per-page rates (B&W and Color), download your printable counter QR stand, install the lightweight desktop Print Agent, and you are ready to accept touchless orders.'
    },
    {
      q: 'Can I set custom rates for B&W, Color, and double-sided copies?',
      a: 'Yes, 100%. In your Shop Owner Console, you have full control over per-page rates for A4/A3/Letter sizes, Color vs Black & White, duplex discounts, and bulk volume rates. The customer sees exact prices automatically.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* ========================================================================= */}
      {/* 2. HERO SECTION                                                           */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-28 bg-white border-b border-slate-200/80">
        {/* Soft Ambient Radial Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-linear-to-b from-emerald-100/40 via-teal-50/20 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Headline, Trust Badges & CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="lg:col-span-7 space-y-6 text-center lg:text-left"
            >
              {/* Pill-Free Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-[#EAF8ED] border border-emerald-200 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-[#00B52D] animate-pulse" />
                <span className="font-mono text-[11px] tracking-wider uppercase font-extrabold">
                  SMART COUNTER PRINTING PLATFORM
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#080808] tracking-tight leading-[1.12]">
                Printing Shops. <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-linear-to-r from-[#00B52D] via-emerald-600 to-teal-700">Smarter, Faster, Better.</span>
              </h1>

              {/* Supporting Text */}
              <p className="text-base sm:text-lg text-[#777777] leading-relaxed font-normal max-w-2xl mx-auto lg:mx-0">
                Turn your photocopy and xerox counter into an automated touchless print hub. Customers scan your QR stand, upload documents, pay instantly via UPI, and collect printed pages in seconds.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="w-full sm:w-auto px-7 py-3.5 bg-[#00B52D] hover:bg-[#009424] active:scale-95 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2.5 cursor-pointer md:hidden"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan Counter QR</span>
                </button>

                <button
                  onClick={() => navigate('/auth/register')}
                  className="w-full sm:w-auto px-8 py-4 bg-[#00B52D] hover:bg-[#009424] active:scale-95 text-white font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/35 transition-all flex items-center justify-center gap-2.5 cursor-pointer group"
                >
                  <Store className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                  <span>Start Your Shop Free →</span>
                </button>

                <button
                  onClick={() => {
                    const el = document.getElementById('how-it-works');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto px-7 py-4 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 font-extrabold text-xs tracking-wider uppercase rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-[#00B52D] fill-current" />
                  <span>See How It Works</span>
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="pt-3 grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center lg:justify-start gap-3 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-1.5 bg-[#F7F7F7] px-3 py-1.5 rounded-xl border border-slate-200/80">
                  <CheckCircle2 className="w-4 h-4 text-[#00B52D] shrink-0" />
                  <span>0-App Customer Scan</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#F7F7F7] px-3 py-1.5 rounded-lg border border-slate-200/80">
                  <CheckCircle2 className="w-4 h-4 text-[#00B52D] shrink-0" />
                  <span>Instant UPI Payments</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#F7F7F7] px-3 py-1.5 rounded-lg border border-slate-200/80">
                  <CheckCircle2 className="w-4 h-4 text-[#00B52D] shrink-0" />
                  <span>Auto Hardware Spooling</span>
                </div>
                <div className="flex items-center gap-1.5 bg-[#F7F7F7] px-3 py-1.5 rounded-lg border border-slate-200/80">
                  <CheckCircle2 className="w-4 h-4 text-[#00B52D] shrink-0" />
                  <span>Works With Your Printers</span>
                </div>
              </div>
            </motion.div>

            {/* Right Column: Hero Visual - End-to-End Visual Workflow Pipeline SVG */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="lg:col-span-5 relative flex items-center justify-center"
            >
              <PrintWorkflowSvg className="w-full h-auto" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. HOW IT WORKS                                                           */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#00B52D] font-mono">
              TOUCHLESS FOUR-STEP PROCESS
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#080808] tracking-tight">
              Your Entire Counter, Automated.
            </h2>
            <p className="text-base text-[#777777]">
              No apps to install. No pendrive virus risks. No manual price counting.
            </p>
            {/* Visual Flow Indicator */}
            <div className="pt-2 flex items-center justify-center gap-2 text-xs font-bold font-mono text-slate-500">
              <span className="px-2.5 py-1 bg-[#EAF8ED] text-emerald-800 rounded-md border border-emerald-200 font-extrabold">01 SCAN</span>
              <span>→</span>
              <span className="px-2.5 py-1 bg-[#EAF8ED] text-emerald-800 rounded-md border border-emerald-200 font-extrabold">02 CONFIGURE</span>
              <span>→</span>
              <span className="px-2.5 py-1 bg-[#EAF8ED] text-emerald-800 rounded-md border border-emerald-200 font-extrabold">03 PAY</span>
              <span>→</span>
              <span className="px-2.5 py-1 bg-[#00B52D] text-white rounded-md border border-emerald-600 font-extrabold">04 PRINT</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 01 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-[#00B52D] hover:shadow-lg transition-all space-y-4 group">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#EAF8ED] text-[#00B52D] border border-emerald-200 group-hover:scale-110 transition-transform">
                  <QrCode className="w-6 h-6" />
                </div>
                <span className="text-3xl font-mono font-extrabold text-slate-200 group-hover:text-[#00B52D] transition-colors">
                  01
                </span>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#080808]">01 Scan</h3>
                <p className="text-xs text-[#00B52D] font-bold mt-0.5">Instant Mobile Web</p>
              </div>
              <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                Customer scans the shop QR code on your tabletop stand using any smartphone camera or Google Lens. No app install needed.
              </p>
            </div>

            {/* Step 02 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-[#00B52D] hover:shadow-lg transition-all space-y-4 group">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#EAF8ED] text-[#00B52D] border border-emerald-200 group-hover:scale-110 transition-transform">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <span className="text-3xl font-mono font-extrabold text-slate-200 group-hover:text-[#00B52D] transition-colors">
                  02
                </span>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#080808]">02 Upload & Configure</h3>
                <p className="text-xs text-[#00B52D] font-bold mt-0.5">Automated Page Detection</p>
              </div>
              <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                Customer uploads PDF or images and selects: Paper size (A4/A3), Color or B&W, Single or Duplex, number of copies, and orientation.
              </p>
            </div>

            {/* Step 03 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-[#00B52D] hover:shadow-lg transition-all space-y-4 group">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#EAF8ED] text-[#00B52D] border border-emerald-200 group-hover:scale-110 transition-transform">
                  <CreditCard className="w-6 h-6" />
                </div>
                <span className="text-3xl font-mono font-extrabold text-slate-200 group-hover:text-[#00B52D] transition-colors">
                  03
                </span>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#080808]">03 Pay</h3>
                <p className="text-xs text-[#00B52D] font-bold mt-0.5">Calculated Instant Rate</p>
              </div>
              <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                Customer sees the transparently calculated price and pays online via instant UPI (GPay, PhonePe, Paytm) or cards.
              </p>
            </div>

            {/* Step 04 */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-[#00B52D] hover:shadow-lg transition-all space-y-4 group">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#00B52D] text-white shadow-xs group-hover:scale-110 transition-transform">
                  <Printer className="w-6 h-6" />
                </div>
                <span className="text-3xl font-mono font-extrabold text-slate-200 group-hover:text-[#00B52D] transition-colors">
                  04
                </span>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#080808]">04 Auto Print</h3>
                <p className="text-xs text-[#00B52D] font-bold mt-0.5">Spool to Counter Tray</p>
              </div>
              <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                After payment verification, PrintFlow instantly sends the job to your local Print Agent. The printer spools pages with a pickup token slip.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. LIVE PRODUCT WORKFLOW                                                  */}
      {/* ========================================================================= */}
      <section id="live-workflow" className="py-16 sm:py-24 bg-[#F7F7F7] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#00B52D] font-mono">
              INTERACTIVE DEMO
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#080808] tracking-tight">
              See PrintFlow in Action
            </h2>
            <p className="text-sm text-[#777777]">
              Click through the tabs below to experience each stage of the automated counter workflow.
            </p>

            {/* Interactive Tab Switcher */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
              {[
                { id: 'CUSTOMER', label: '1. Customer', icon: Smartphone },
                { id: 'PAYMENT', label: '2. Payment', icon: CreditCard },
                { id: 'AGENT', label: '3. Print Agent', icon: Laptop },
                { id: 'PRINTER', label: '4. Printer', icon: Printer }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeWorkflowTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setWorkflowAutoPlay(false);
                      setActiveWorkflowTab(tab.id as any);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      isActive
                        ? 'bg-[#00B52D] text-white shadow-md shadow-emerald-500/20'
                        : 'bg-white text-slate-700 hover:text-[#00B52D] border border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Workflow Showcase Box */}
          <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-10">
            <AnimatePresence mode="wait">
              {/* Tab 1: Customer */}
              {activeWorkflowTab === 'CUSTOMER' && (
                <motion.div
                  key="workflow-customer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[#080808]">Customer Mobile Ordering Flow</h3>
                      <p className="text-xs text-[#777777]">Scan QR → Upload Document → Select Print Settings → Review Price → Pay</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-[#EAF8ED] text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                      Step 1 of 4
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="p-3 bg-[#F7F7F7] rounded-xl border border-slate-200 text-center">
                      <QrCode className="w-6 h-6 text-[#00B52D] mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-[#080808]">1. Scan QR</p>
                      <p className="text-[10px] text-[#777777] mt-0.5">Counter tabletop stand</p>
                    </div>
                    <div className="p-3 bg-[#F7F7F7] rounded-xl border border-slate-200 text-center">
                      <FileText className="w-6 h-6 text-emerald-700 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-[#080808]">2. Upload File</p>
                      <p className="text-[10px] text-[#777777] mt-0.5">PDF, Word, or JPG</p>
                    </div>
                    <div className="p-3 bg-[#F7F7F7] rounded-xl border border-slate-200 text-center">
                      <SlidersHorizontal className="w-6 h-6 text-teal-700 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-[#080808]">3. Print Settings</p>
                      <p className="text-[10px] text-[#777777] mt-0.5">B&W/Color, Duplex</p>
                    </div>
                    <div className="p-3 bg-[#F7F7F7] rounded-xl border border-slate-200 text-center">
                      <DollarSign className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-[#080808]">4. Review Price</p>
                      <p className="text-[10px] text-[#777777] mt-0.5">Exact auto-calculation</p>
                    </div>
                    <div className="p-3 bg-[#00B52D] text-white rounded-xl shadow-xs text-center">
                      <CreditCard className="w-6 h-6 text-white mx-auto mb-1.5" />
                      <p className="text-xs font-bold">5. Pay Now</p>
                      <p className="text-[10px] text-emerald-100 mt-0.5">Instant Razorpay UPI</p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#F7F7F7] rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center font-bold">
                        PDF
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#080808]">Project_Report_Final.pdf</p>
                        <p className="text-[11px] text-[#777777]">12 pages · Black & White · 2-Sided (Duplex) · 1 Copy</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[#777777]">Calculated Subtotal</span>
                      <p className="text-base font-extrabold text-[#00B52D] font-mono">₹24.00</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tab 2: Payment */}
              {activeWorkflowTab === 'PAYMENT' && (
                <motion.div
                  key="workflow-payment"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[#080808]">Verified Payment State</h3>
                      <p className="text-xs text-[#777777]">Razorpay Checkout → Cryptographic Verification → Order Status PAID</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-[#EAF8ED] text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                      Step 2 of 4
                    </span>
                  </div>

                  <div className="p-6 bg-[#EAF8ED]/70 rounded-3xl border border-emerald-200 text-center space-y-4 max-w-md mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-[#00B52D] text-white flex items-center justify-center mx-auto shadow-md">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold text-[#080808]">Payment Successful</h4>
                      <p className="text-xs text-emerald-800 font-bold">Order #PRT-84291 Verified ✓</p>
                    </div>

                    <div className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-2xs space-y-2 text-xs">
                      <div className="flex justify-between text-[#777777]">
                        <span>Order ID:</span>
                        <span className="font-mono font-bold text-[#080808]">#PRT-84291</span>
                      </div>
                      <div className="flex justify-between text-[#777777]">
                        <span>Amount Paid:</span>
                        <span className="font-mono font-extrabold text-[#00B52D]">₹24.00</span>
                      </div>
                      <div className="flex justify-between text-[#777777]">
                        <span>Payment Channel:</span>
                        <span className="font-bold text-[#080808]">UPI (Google Pay / PhonePe)</span>
                      </div>
                      <div className="flex justify-between text-[#777777]">
                        <span>Signature Status:</span>
                        <span className="text-[#00B52D] font-bold">HMAC Verified ✓</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#777777]">
                      Job automatically dispatched to shop printer queue without operator intervention.
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tab 3: Print Agent */}
              {activeWorkflowTab === 'AGENT' && (
                <motion.div
                  key="workflow-agent"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[#080808]">Local Print Agent Execution</h3>
                      <p className="text-xs text-[#777777]">Job Received → File Downloaded → Printer Selected → Sending to Tray 1</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-[#EAF8ED] text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                      Step 3 of 4
                    </span>
                  </div>

                  <div className="bg-[#F7F7F7] border border-slate-200 text-slate-800 rounded-2xl p-5 font-mono text-xs space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00B52D] animate-pulse" />
                        <span className="font-bold text-[#080808]">PrintFlow Desktop Agent v2.4</span>
                      </div>
                      <span className="text-emerald-800 text-[11px] font-bold bg-[#EAF8ED] px-2 py-0.5 rounded border border-emerald-200">
                        SHOP-AGENT-ONLINE
                      </span>
                    </div>

                    <div className="space-y-1.5 text-slate-700">
                      <p className="text-emerald-800 font-bold bg-[#EAF8ED] px-2 py-1 rounded border border-emerald-200">[12:42:01] Job Received: #PRT-84291 from Cloud Queue</p>
                      <p className="text-slate-800 bg-slate-200/70 px-2 py-1 rounded border border-slate-300">[12:42:02] File Downloaded: Project_Report_Final.pdf (1.4 MB)</p>
                      <p className="text-teal-800 bg-teal-50 px-2 py-1 rounded border border-teal-200">[12:42:02] Printer Selected: Canon imageRUNNER 2525 (Ready)</p>
                      <p className="text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">[12:42:03] Applying Specs: A4 · Duplex · B&W · 12 Pages</p>
                      <p className="text-[#00B52D] font-extrabold bg-[#EAF8ED] px-2 py-1 rounded border border-emerald-200">[12:42:04] Sending to Tray 1... Auto Spool Started ✓</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-[#F7F7F7] rounded-xl border border-slate-200">
                      <span className="text-[#777777] block">Queue Status</span>
                      <span className="font-bold text-[#00B52D]">Active (1 in spool)</span>
                    </div>
                    <div className="p-3 bg-[#F7F7F7] rounded-xl border border-slate-200">
                      <span className="text-[#777777] block">Assigned Machine</span>
                      <span className="font-bold text-[#080808]">Canon IR Tray 1</span>
                    </div>
                    <div className="p-3 bg-[#F7F7F7] rounded-xl border border-slate-200">
                      <span className="text-[#777777] block">Human Mouse Clicks</span>
                      <span className="font-bold text-[#00B52D]">0 Clicks (100% Automated)</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Tab 4: Printer */}
              {activeWorkflowTab === 'PRINTER' && (
                <motion.div
                  key="workflow-printer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[#080808]">Hardware Printing & Pickup</h3>
                      <p className="text-xs text-[#777777]">PRINTING... 100% → Ready for Pickup → Token #84291</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-[#EAF8ED] text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                      Step 4 of 4
                    </span>
                  </div>

                  <div className="bg-[#F7F7F7] text-[#080808] rounded-3xl p-6 sm:p-8 text-center space-y-4 max-w-lg mx-auto shadow-sm border border-slate-200">
                    <div className="w-14 h-14 rounded-2xl bg-[#00B52D] flex items-center justify-center mx-auto text-white shadow-md">
                      <Printer className="w-7 h-7" />
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-mono text-[#00B52D] font-extrabold uppercase tracking-wider">
                        PRINTING COMPLETED
                      </span>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden my-3">
                        <div className="bg-[#00B52D] h-full w-full" />
                      </div>
                      <p className="font-mono text-xs text-[#777777] font-semibold">100% Complete</p>
                    </div>

                    <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
                      <span className="text-xs text-[#777777] font-medium">Pickup Counter Token:</span>
                      <p className="text-3xl font-mono font-extrabold text-[#00B52D]">#84291</p>
                      <p className="text-xs text-emerald-700 font-bold pt-1">Ready on Counter Tray</p>
                    </div>

                    <p className="text-xs text-[#777777] leading-relaxed">
                      Customer simply matches Token #84291 and collects their printed document. Total turnaround time: 28 seconds.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. TRADITIONAL COUNTER VS PRINTFLOW                                       */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 font-mono">
              THE COUNTER COMPARISON
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#080808] tracking-tight">
              Still Running Your Xerox Counter Manually?
            </h2>
            <p className="text-base text-[#777777]">
              See the direct difference between traditional counter chaos and automated PrintFlow efficiency.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Traditional Counter Card */}
            <div className="bg-red-50/40 rounded-3xl p-6 sm:p-8 border border-red-200/80 space-y-5">
              <div className="flex items-center justify-between border-b border-red-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                    ✕
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#080808]">Traditional Counter</h3>
                    <span className="text-xs text-red-700 font-semibold">Slow, chaotic & vulnerable</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-red-600 bg-red-100 px-2.5 py-1 rounded-full font-bold">
                  5-10 Min Wait
                </span>
              </div>

              <div className="space-y-3.5 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">✕</span>
                  <div>
                    <strong className="text-[#080808]">USB/Pendrive malware risk:</strong> Students plug infected flash drives into your counter billing PC.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">✕</span>
                  <div>
                    <strong className="text-[#080808]">Manual price calculation:</strong> Counting pages by hand, multiplying rates, giving cash change.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">✕</span>
                  <div>
                    <strong className="text-[#080808]">Manual payment checking:</strong> Staring at student phone screenshots to check if UPI passed.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">✕</span>
                  <div>
                    <strong className="text-[#080808]">Manual print clicks:</strong> Opening Acrobat, clicking print dialog, selecting trays for every document.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">✕</span>
                  <div>
                    <strong className="text-[#080808]">Crowded counter:</strong> 15 students shouting over each other during peak college exam rush hours.
                  </div>
                </div>
              </div>
            </div>

            {/* PrintFlow Cloud Card */}
            <div className="bg-[#EAF8ED]/40 rounded-3xl p-6 sm:p-8 border-2 border-[#00B52D] shadow-xl space-y-5 relative">
              <div className="absolute -top-3.5 right-6 bg-[#00B52D] text-white text-[10px] font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                RECOMMENDED
              </div>

              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#00B52D] text-white flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#080808]">PrintFlow CLOUD</h3>
                    <span className="text-xs text-emerald-800 font-extrabold">Touchless, automated & instant</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-800 bg-[#EAF8ED] px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                  30s Turnaround
                </span>
              </div>

              <div className="space-y-3.5 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00B52D] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#080808]">Instant QR scan:</strong> Customers upload directly from mobile phone with zero pendrive connection.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00B52D] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#080808]">Automatic price calculation:</strong> Auto page count & instant rates for B&W, color and duplex.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00B52D] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#080808]">Verified online payment:</strong> Automated cryptographic verification before print spooling.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00B52D] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#080808]">Automatic print spooling:</strong> Desktop Agent sends verified jobs straight to the printer tray.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00B52D] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#080808]">Orderly pickup queue:</strong> Customers receive unique token numbers for effortless counter collection.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. FEATURES                                                               */}
      {/* ========================================================================= */}
      <section id="features" className="py-16 sm:py-24 bg-[#F7F7F7] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#00B52D] font-mono">
              ENGINEERED FOR COUNTER VELOCITY
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#080808] tracking-tight">
              Built for High-Speed Print Counters
            </h2>
            <p className="text-base text-[#777777]">
              Everything high-volume photocopy centers and college print shops need to operate friction-free.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: QrCode,
                title: 'Instant QR Ordering',
                desc: 'Students point camera at your counter stand. Mobile web opens in 2 seconds with zero app installation or signup.'
              },
              {
                icon: FileCheck,
                title: 'Auto Page Count Engine',
                desc: 'Uploads PDF, Word, or JPG documents and instantly analyzes page count, color detection, and paper format.'
              },
              {
                icon: DollarSign,
                title: 'Smart Price Engine',
                desc: 'Configure custom per-page rates for B&W (e.g. ₹2), Color (₹10), duplex discounts, and bulk volume rates.'
              },
              {
                icon: ShieldCheck,
                title: 'Verified Online Payments',
                desc: 'Razorpay and instant UPI payments with server-side signature verification. Orders only print once funds clear.'
              },
              {
                icon: Layers,
                title: 'Automatic Print Queue',
                desc: 'First-in-first-out cloud queue automatically routes jobs to your local printers without touching your mouse.'
              },
              {
                icon: Sparkles,
                title: 'Customer Pickup Tokens',
                desc: 'Every completed order prints with a token slip (e.g. #84291) so customers pick up their exact prints effortlessly.'
              },
              {
                icon: Printer,
                title: 'Multi-Printer Support',
                desc: 'Connect separate high-speed B&W laser printers and dedicated color printers. PrintFlow routes jobs intelligently.'
              },
              {
                icon: BarChart3,
                title: 'Shop Analytics & Reports',
                desc: 'Track daily counter earnings, total printed pages, peak hour trends, and export complete accounting reports.'
              }
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="bg-white rounded-3xl p-6 border border-slate-200/80 hover:border-[#00B52D] hover:shadow-lg transition-all space-y-3 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xs">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#080808]">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. PRINT AGENT                                                            */}
      {/* ========================================================================= */}
      <section id="print-agent" className="py-16 sm:py-24 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Explanation */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-[#EAF8ED] border border-emerald-200">
                <Laptop className="w-3.5 h-3.5 text-[#00B52D]" />
                <span className="font-mono uppercase tracking-wider">LOCAL DESKTOP UTILITY</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#080808] tracking-tight leading-tight">
                The Local Print Agent <br />
                That Powers Your Counter
              </h2>

              <p className="text-base text-[#777777] leading-relaxed">
                The PrintFlow Agent is a small, lightweight Windows & Mac background utility that connects your physical shop printers directly to PrintFlow Cloud.
              </p>

              <div className="space-y-3.5 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00B52D] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#080808]">Listens for verified paid jobs:</strong> Connects to your shop's encrypted cloud queue in real time.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00B52D] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#080808]">Zero operator intervention:</strong> Spools jobs directly to your printer without you clicking a mouse.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00B52D] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#080808]">Universal hardware compatibility:</strong> Works with HP, Canon, Epson, Brother, and Xerox USB or Wi-Fi printers.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#00B52D] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#080808]">Silent background execution:</strong> Runs quietly in your system tray without interrupting billing or accounting software.
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate('/auth/register')}
                  className="px-7 py-3.5 bg-[#00B52D] hover:bg-[#009424] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Agent for Windows / Mac</span>
                </button>
                <span className="text-xs text-[#777777] font-medium">Lightweight (18 MB)</span>
              </div>
            </div>

            {/* Right Column: Visual PC Agent Mockup with Live Logs */}
            <div className="lg:col-span-6">
              <div className="bg-white text-[#080808] rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl space-y-5">
                {/* Window Title Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400" />
                      <span className="w-3 h-3 rounded-full bg-amber-400" />
                      <span className="w-3 h-3 rounded-full bg-[#00B52D]" />
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-700 ml-2">
                      PrintFlow Agent - Counter Station PC
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#EAF8ED] text-emerald-800 px-2.5 py-1 rounded-full text-[11px] font-mono border border-emerald-200 font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#00B52D] animate-pulse" />
                    <span>CONNECTED TO CLOUD</span>
                  </div>
                </div>

                {/* Default Printer Selection */}
                <div className="bg-[#F7F7F7] p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#00B52D] text-white flex items-center justify-center shadow-xs">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-[#080808]">Canon imageRUNNER 2525</p>
                      <p className="text-[11px] text-[#777777]">USB Connected · Tray 1 (A4) Ready · Status: Online</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-800 bg-[#EAF8ED] px-2 py-0.5 rounded border border-emerald-200">
                    Default B&W
                  </span>
                </div>

                {/* Live Job Spooler Log */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-[#777777] uppercase tracking-wider block font-bold">
                    LIVE SPOOLER LOG STREAM:
                  </span>
                  <div className="bg-[#F7F7F7] rounded-xl p-3.5 font-mono text-[11px] space-y-1.5 text-slate-700 border border-slate-200">
                    <p className="text-emerald-800 font-semibold">[12:44:10] WebSocket connection established (wss://api.printflow.cloud)</p>
                    <p className="text-[#777777]">[12:44:11] Syncing offline buffer: 0 pending items</p>
                    <p className="text-teal-800 font-semibold">[12:44:18] INCOMING: Token #84291 · 12 Pages · ₹24 Paid</p>
                    <p className="text-slate-800 font-semibold">[12:44:19] Spooling to Canon imageRUNNER 2525...</p>
                    <p className="text-[#00B52D] font-extrabold">[12:44:22] Job #84291 printed successfully ✓</p>
                  </div>
                </div>

                {/* Hardware indicators */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#F7F7F7] p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[#777777] text-[10px] block">Paper Level</span>
                    <span className="text-[#00B52D] font-bold">Tray 1 (82%)</span>
                  </div>
                  <div className="bg-[#F7F7F7] p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[#777777] text-[10px] block">Toner Status</span>
                    <span className="text-[#00B52D] font-bold">Good (76%)</span>
                  </div>
                  <div className="bg-[#F7F7F7] p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[#777777] text-[10px] block">Queue Delay</span>
                    <span className="text-[#00B52D] font-bold">0.8 Seconds</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. CUSTOMER EXPERIENCE                                                    */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-24 bg-[#F7F7F7] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#00B52D] font-mono">
              EFFORTLESS STUDENT USABILITY
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#080808] tracking-tight">
              Zero-Friction for Your Customers
            </h2>
            <p className="text-base text-[#777777]">
              Designed so even a first-time customer can place an order and collect their prints within seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#080808]">No App Download</h3>
              <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                Opens directly in Chrome, Safari, or Google Lens. Zero storage taken on student phones.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#080808]">Mobile Document Upload</h3>
              <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                Customers choose PDFs or images from WhatsApp, Google Drive, or phone storage with instant preview.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#080808]">Instant UPI Payment</h3>
              <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                Seamless checkout with Google Pay, PhonePe, Paytm, and CRED. Real-time confirmation without manual checking.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#080808]">Pickup Token Number</h3>
              <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
                Live on-screen pickup slip with token number (e.g. #84291). Customers collect prints without shouting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. SHOP OWNER DASHBOARD                                                   */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#00B52D] font-mono">
              COMMAND & CONTROL
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#080808] tracking-tight">
              Total Control from Any Device
            </h2>
            <p className="text-base text-[#777777]">
              Manage your queue, customize rates, monitor printer hardware, and track earnings from your phone or PC.
            </p>
          </div>

          {/* Shop Dashboard Mockup */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-xl text-[#080808] max-w-5xl mx-auto space-y-6">
            {/* Top Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#F7F7F7] p-4 rounded-2xl border border-slate-200">
                <span className="text-xs text-[#777777] block font-medium">Today's Revenue</span>
                <p className="text-2xl font-extrabold text-[#00B52D] font-mono mt-1">₹3,480.00</p>
                <span className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 mt-1">↑ 24% vs yesterday</span>
              </div>
              <div className="bg-[#F7F7F7] p-4 rounded-2xl border border-slate-200">
                <span className="text-xs text-[#777777] block font-medium">Total Prints</span>
                <p className="text-2xl font-extrabold text-[#080808] font-mono mt-1">1,740 pgs</p>
                <span className="text-[10px] text-[#777777] mt-1 block">82 completed jobs</span>
              </div>
              <div className="bg-[#F7F7F7] p-4 rounded-2xl border border-slate-200">
                <span className="text-xs text-[#777777] block font-medium">Live Active Queue</span>
                <p className="text-2xl font-extrabold text-[#00B52D] font-mono mt-1">3 Jobs</p>
                <span className="text-[10px] text-[#00B52D] font-medium mt-1 block">Avg turnaround 28s</span>
              </div>
              <div className="bg-[#F7F7F7] p-4 rounded-2xl border border-slate-200">
                <span className="text-xs text-[#777777] block font-medium">Desktop Agent</span>
                <p className="text-2xl font-extrabold text-[#00B52D] font-mono mt-1">ONLINE</p>
                <span className="text-[10px] text-emerald-800 font-medium mt-1 block">Canon IR Tray 1</span>
              </div>
            </div>

            {/* Middle Configuration & Queue Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Rate Card Preview */}
              <div className="lg:col-span-5 bg-[#F7F7F7] p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-bold text-[#080808] uppercase tracking-wider">Per-Page Rate Card</h4>
                  <span className="text-[10px] font-bold text-emerald-800 bg-[#EAF8ED] px-2 py-0.5 rounded border border-emerald-200">
                    Live Rates
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/80">
                    <span className="text-slate-600">A4 Black & White (1-Sided)</span>
                    <span className="font-mono font-bold text-[#080808]">₹2.00 / page</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/80">
                    <span className="text-slate-600">A4 Black & White (2-Sided Duplex)</span>
                    <span className="font-mono font-bold text-[#080808]">₹1.50 / side</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/80">
                    <span className="text-slate-600">A4 Full Color Print</span>
                    <span className="font-mono font-bold text-[#080808]">₹10.00 / page</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-600">A3 Large Format B&W</span>
                    <span className="font-mono font-bold text-[#080808]">₹5.00 / page</span>
                  </div>
                </div>
              </div>

              {/* Active Print Queue List */}
              <div className="lg:col-span-7 bg-[#F7F7F7] p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h4 className="text-xs font-bold text-[#080808] uppercase tracking-wider">Live Active Queue</h4>
                  <span className="text-[10px] font-mono text-emerald-800 font-bold bg-[#EAF8ED] px-2 py-0.5 rounded border border-emerald-200">3 Verified Jobs</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl flex items-center justify-between border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#00B52D] animate-pulse" />
                      <div>
                        <p className="font-mono font-bold text-[#080808]">#84291</p>
                        <p className="text-[10px] text-[#777777]">12 pgs · B&W Duplex · ₹24</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-[#EAF8ED] px-2 py-0.5 rounded border border-emerald-200">
                      Printing on Tray 1
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl flex items-center justify-between border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-teal-600" />
                      <div>
                        <p className="font-mono font-bold text-[#080808]">#84292</p>
                        <p className="text-[10px] text-[#777777]">4 pgs · Color · ₹40</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      Queued next
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl flex items-center justify-between border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <div>
                        <p className="font-mono font-bold text-[#080808]">#84293</p>
                        <p className="text-[10px] text-[#777777]">8 pgs · B&W · ₹16</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      Queued
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. SECURITY & RELIABILITY                                                */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-24 bg-[#F7F7F7] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#00B52D] font-mono">
              ZERO RISK ARCHITECTURE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#080808] tracking-tight">
              Enterprise Security for Every Local Print Shop
            </h2>
            <p className="text-base text-[#777777]">
              Keep your counter computers malware-free and customer documents confidential.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#080808]">Auto File Deletion</h3>
              <p className="text-xs text-[#777777] leading-relaxed">
                Customer files are automatically purged from cloud servers immediately after print completion.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#080808]">End-to-End Encryption</h3>
              <p className="text-xs text-[#777777] leading-relaxed">
                All document uploads and print payloads travel through strict TLS 1.3 encrypted streams.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#080808]">Zero USB Virus Risk</h3>
              <p className="text-xs text-[#777777] leading-relaxed">
                No infected student flash drives touching your PC. Your counter computer stays safe.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center">
                <Wifi className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#080808]">99.9% Uptime Cloud</h3>
              <p className="text-xs text-[#777777] leading-relaxed">
                High-availability server infrastructure with automatic failover and local spool buffer.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#080808]">Bank-Grade Payments</h3>
              <p className="text-xs text-[#777777] leading-relaxed">
                PCI-DSS compliant payment processing with instant verification and direct bank settlements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 11. PRICING                                                               */}
      {/* ========================================================================= */}
      <section id="pricing" className="py-16 sm:py-24 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-14 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#00B52D] font-mono">
              PLANS & PRICING
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#080808] tracking-tight">
              Simple, Transparent Plans for Every Print Shop
            </h2>
            <p className="text-base text-[#777777]">
              Upgrade anytime as your counter volume grows. Zero hardware lock-in.
            </p>

            {/* Monthly / Yearly Toggle */}
            <div className="pt-3">
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setBillingPeriod('MONTHLY')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    billingPeriod === 'MONTHLY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod('YEARLY')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    billingPeriod === 'YEARLY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Yearly</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Plans Container - One unified flex view across desktop */}
          <div className="flex flex-col md:flex-row flex-wrap lg:flex-nowrap items-stretch justify-center gap-5 lg:gap-6 max-w-7xl mx-auto">
            {displayPlans.map((plan: any, i: number) => {
              const isPopular = plan.isPopular || i === 1;
              const monthlyPrice = plan.priceMonthly !== undefined ? plan.priceMonthly : (plan.price !== undefined ? plan.price : (i === 0 ? 0 : i === 1 ? 499 : i === 2 ? 999 : 2499));
              const yearlyPrice = plan.priceYearly !== undefined ? plan.priceYearly : Math.round(monthlyPrice * 0.8);
              const activePrice = billingPeriod === 'MONTHLY' ? monthlyPrice : yearlyPrice;
              const features = Array.isArray(plan.features) ? plan.features : (plan.perks || []);

              return (
                <div
                  key={plan.id || i}
                  className={`flex-1 min-w-[240px] max-w-full md:max-w-[calc(50%-12px)] lg:max-w-none bg-white rounded-3xl p-6 sm:p-7 transition-all flex flex-col justify-between relative ${
                    isPopular
                      ? 'border-2 border-[#00B52D] shadow-xl ring-1 ring-emerald-500/20'
                      : 'border border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#00B52D] text-white text-[10px] font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider shadow-xs whitespace-nowrap">
                      MOST POPULAR
                    </div>
                  )}

                  <div className="flex-1 flex flex-col">
                    <h3 className="text-xl font-extrabold text-[#080808]">{plan.name}</h3>
                    <p className="text-xs text-[#777777] mt-1 min-h-[34px] leading-relaxed">{plan.tagline || plan.description || ''}</p>

                    <div className="mt-4 mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-extrabold text-[#080808] font-mono">
                          ₹{activePrice}
                        </span>
                        <span className="text-xs text-[#777777]">
                          {monthlyPrice === 0 ? '/month (Free)' : '/month'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-100 text-xs text-slate-700 flex-1">
                      {features.map((feat: string, fIdx: number) => (
                        <div key={fIdx} className="flex items-start gap-2">
                          <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isPopular ? 'text-[#00B52D]' : 'text-emerald-600'}`} />
                          <span className={fIdx === 0 && isPopular ? 'font-bold text-[#080808]' : ''}>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 mt-auto">
                    <button
                      onClick={() => navigate('/auth/register')}
                      className={`w-full py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer active:scale-95 ${
                        isPopular
                          ? 'bg-[#00B52D] hover:bg-[#009424] text-white shadow-md shadow-emerald-500/25'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      {monthlyPrice === 0 ? 'Start Free' : isPopular ? 'Start 14-Day Free Trial' : 'Choose Plan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 12. FAQ                                                                   */}
      {/* ========================================================================= */}
      <section id="faq" className="py-16 sm:py-24 bg-[#F7F7F7] border-b border-slate-200/80">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#00B52D] font-mono">
              QUESTIONS & ANSWERS
            </span>
            <h2 className="text-3xl font-extrabold text-[#080808] tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-[#777777]">
              Everything you need to know about setting up PrintFlow at your xerox counter.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full text-left p-5 flex items-center justify-between gap-4 font-extrabold text-[#080808] hover:text-[#00B52D] focus:outline-none cursor-pointer text-sm transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                        isOpen ? 'rotate-180 text-[#00B52D]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-[#777777] leading-relaxed border-t border-slate-100 pt-3.5">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 13. FINAL CTA                                                             */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-linear-to-br from-[#EAF8ED]/90 via-emerald-50/40 to-white rounded-3xl p-8 sm:p-14 text-center text-[#080808] space-y-6 shadow-sm border border-emerald-200 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-4">
              <div className="w-12 h-12 bg-[#00B52D] text-white rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <Printer className="w-6 h-6" />
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#080808]">
                Ready to Automate Your Xerox Counter?
              </h2>

              <p className="text-xs sm:text-sm text-[#777777] leading-relaxed max-w-lg mx-auto">
                Start in under 5 minutes. No credit card required. Works with your existing printers and Windows or Mac PC.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
                <button
                  onClick={() => navigate('/auth/register')}
                  className="w-full sm:w-auto px-8 py-4 bg-[#00B52D] hover:bg-[#009424] active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <Store className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                  <span>Start Your Shop Free →</span>
                </button>

                <button
                  onClick={() => setIsDemoModalOpen(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#00B52D]" />
                  <span>Schedule Demo / Contact Us</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SCHEDULE DEMO / CONTACT US MODAL                                          */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isDemoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative"
            >
              <button
                onClick={() => {
                  setIsDemoModalOpen(false);
                  setDemoSubmitted(false);
                }}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {demoSubmitted ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#EAF8ED] text-[#00B52D] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-extrabold text-[#080808]">Demo Scheduled!</h3>
                  <p className="text-xs text-[#777777] max-w-sm mx-auto">
                    Thank you! Our print specialist will connect with you on WhatsApp within 15 minutes to demonstrate counter automation.
                  </p>
                  <button
                    onClick={() => {
                      setIsDemoModalOpen(false);
                      setDemoSubmitted(false);
                    }}
                    className="mt-4 px-6 py-2.5 bg-[#00B52D] text-white rounded-xl text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-emerald-800 bg-[#EAF8ED] border border-emerald-200">
                      <PhoneCall className="w-3 h-3 text-[#00B52D]" />
                      <span>DIRECT SHOP SPECIALIST</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-[#080808]">Schedule Your Counter Demo</h3>
                    <p className="text-xs text-[#777777]">
                      We will walk you through live printer spooling and counter tabletop QR stand setup.
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setDemoSubmitted(true);
                    }}
                    className="space-y-3 pt-2 text-xs"
                  >
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Shop / Xerox Center Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. City Xerox Center"
                        value={demoForm.shopName}
                        onChange={(e) => setDemoForm({ ...demoForm, shopName: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00B52D]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Contact Person</label>
                        <input
                          type="text"
                          required
                          placeholder="Your Name"
                          value={demoForm.contactName}
                          onChange={(e) => setDemoForm({ ...demoForm, contactName: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00B52D]"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">WhatsApp / Phone</label>
                        <input
                          type="tel"
                          required
                          placeholder="10-digit number"
                          value={demoForm.phone}
                          onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00B52D]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">City / Location</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Pune, Mumbai"
                          value={demoForm.city}
                          onChange={(e) => setDemoForm({ ...demoForm, city: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00B52D]"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Estimated Daily Prints</label>
                        <select
                          value={demoForm.dailyVolume}
                          onChange={(e) => setDemoForm({ ...demoForm, dailyVolume: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00B52D] bg-white"
                        >
                          <option>50-100 prints/day</option>
                          <option>100-300 prints/day</option>
                          <option>300-1000 prints/day</option>
                          <option>1000+ prints/day</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full py-3.5 bg-[#00B52D] hover:bg-[#009424] text-white font-extrabold rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all"
                      >
                        Request Demo Call →
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={(slug) => navigate('/s/' + slug)}
      />
    </div>
  );
};
