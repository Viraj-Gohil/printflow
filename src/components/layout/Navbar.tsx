import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../lib/store';
import {
  Printer,
  Shield,
  Store,
  Menu,
  X,
  ArrowRight,
  ChevronDown,
  HelpCircle,
  BookOpen,
  Headphones,
  Phone,
  MessageCircle,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  Send,
  QrCode
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, logout, currentPath, navigate, activeShop, showToast, createSupportTicket, setIsQrScannerOpen } = useApp();

  // Mobile menu & Dropdown states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  // Modals
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const [contactSupportOpen, setContactSupportOpen] = useState(false);

  // Support inquiry form state
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportShopName, setSupportShopName] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitted, setSupportSubmitted] = useState(false);

  // Help search query
  const [helpSearchQuery, setHelpSearchQuery] = useState('');
  const [helpCategoryFilter, setHelpCategoryFilter] = useState<string>('All');
  const [selectedGuideArticle, setSelectedGuideArticle] = useState<any | null>(null);

  // Active section spy
  const [activeSection, setActiveSection] = useState<string>('');

  const resourcesDropdownRef = useRef<HTMLDivElement>(null);

  // Detect customer flow route
  const isCustomerFlow =
    currentPath.startsWith('/s/') ||
    currentPath.startsWith('#s/') ||
    currentPath.startsWith('s/') ||
    currentPath.startsWith('/customer');

  // Close resources dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        resourcesDropdownRef.current &&
        !resourcesDropdownRef.current.contains(event.target as Node)
      ) {
        setResourcesOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Listen for Escape key to close dropdowns and modals
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setResourcesOpen(false);
        setHelpCenterOpen(false);
        setContactSupportOpen(false);
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll spy to highlight active section
  useEffect(() => {
    const handleScroll = () => {
      if (currentPath === '/' || currentPath === '') {
        const sections = ['faq', 'pricing', 'features', 'how-it-works', 'platform'];
        const scrollPosition = window.scrollY + 160;

        for (const sectionId of sections) {
          const el = document.getElementById(sectionId);
          if (el) {
            const top = el.offsetTop;
            const height = el.offsetHeight;
            if (scrollPosition >= top && scrollPosition < top + height) {
              setActiveSection(sectionId);
              return;
            }
          }
        }
        if (window.scrollY < 200) {
          setActiveSection('');
        }
      } else if (currentPath === '/pricing' || currentPath.startsWith('/pricing')) {
        setActiveSection('pricing');
      } else {
        setActiveSection('');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentPath]);

  // Unified smooth scroll helper
  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    setResourcesOpen(false);

    if (currentPath !== '/') {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 150);
    } else {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName || !supportEmail || !supportMessage) {
      showToast('Missing Details', 'Please fill in your name, email and message.', 'error');
      return;
    }
    setSupportSubmitted(true);
    if (createSupportTicket) {
      createSupportTicket({
        subject: `Inquiry from ${supportName}${supportShopName ? ` (${supportShopName})` : ''}`,
        description: supportMessage,
        category: 'HARDWARE',
        priority: 'MEDIUM',
        tags: ['public_header_contact', supportEmail]
      });
    }
    showToast('Support Ticket Submitted', 'Our engineering team will respond within 2 hours.', 'success');
    setTimeout(() => {
      setSupportSubmitted(false);
      setContactSupportOpen(false);
      setSupportName('');
      setSupportEmail('');
      setSupportShopName('');
      setSupportMessage('');
    }, 1800);
  };

  const helpArticles = [
    {
      title: 'Connecting Windows PrintFlow Agent to your physical printer',
      category: 'Agent Setup',
      readTime: '3 min read',
      snippet: 'Download and launch the PrintFlow Windows Agent (.exe). It automatically discovers your local USB and network printers via Windows Print Spooler.'
    },
    {
      title: 'Configuring Counter QR Signage & Customer Rates',
      category: 'Shop Management',
      readTime: '2 min read',
      snippet: 'Generate your shop QR stand from the Shop Console. Configure per-page rates for A4 B&W, Color, Duplex, and Legal paper sizes.'
    },
    {
      title: 'Direct UPI & Razorpay Settlement Setup',
      category: 'Payments',
      readTime: '4 min read',
      snippet: 'Connect your UPI VPA or Razorpay merchant account to receive instant customer payments directly with zero counter balance reconciliation.'
    },
    {
      title: 'Multi-Printer Automatic Job Routing',
      category: 'Queue Management',
      readTime: '3 min read',
      snippet: 'Set up rules to automatically route high-volume jobs to your high-speed laser printer and photo jobs to your color ink-tank device.'
    },
    {
      title: 'Printer Offline or Spooler Stall Recovery',
      category: 'Diagnostics',
      readTime: '2 min read',
      snippet: 'If Windows Spooler stops responding, PrintFlow features an automatic 1-click driver restart and queue unjam recovery tool.'
    }
  ];

  const filteredArticles = helpArticles.filter((item) => {
    const matchesQuery =
      item.title.toLowerCase().includes(helpSearchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(helpSearchQuery.toLowerCase()) ||
      item.snippet.toLowerCase().includes(helpSearchQuery.toLowerCase());
    const matchesCat = helpCategoryFilter === 'All' || item.category === helpCategoryFilter;
    return matchesQuery && matchesCat;
  });

  const getDetailedGuideText = (category: string) => {
    switch (category) {
      case 'Agent Setup':
        return [
          'Step 1: Download the PrintFlow Windows Agent (.exe) installer from your Shop Console or setup email.',
          'Step 2: Double-click the installer and complete the quick wizard on your counter Windows PC.',
          'Step 3: Enter your Shop Slug and API credentials securely (stored in Windows DPAPI vault).',
          'Step 4: The Agent automatically connects to the cloud queue and discovers all USB and network printers installed in Windows Print Spooler.',
          'Step 5: Status indicator turns green ("Win32 Spooler Active") and you are ready to receive customer print orders automatically.'
        ];
      case 'Shop Management':
        return [
          'Step 1: Access your Shop Console dashboard to manage live orders, printer statuses, and daily revenue.',
          'Step 2: Configure your shop per-page pricing for A4 Black & White, Color, Duplex, and Legal paper sizes.',
          'Step 3: Generate and download your high-resolution Tabletop QR Standee for counter customers.',
          'Step 4: Manage staff operator pins and monitor print job auto-routing.'
        ];
      default:
        return [
          'Follow the on-screen instructions in your EasyToPrint Shop Console.',
          'Ensure your device is connected to active internet and printer drivers are installed correctly.',
          'For further assistance, check our documentation or contact technical support.'
        ];
    }
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* FLOATING PILL NAVBAR (MATCHING QWIKPRINT REFERENCE DESIGN)                 */}
      {/* ========================================================================= */}
      <header className="sticky top-3 sm:top-5 z-50 w-full px-4 sm:px-6 flex justify-center pointer-events-none font-['Manrope',sans-serif] mb-1">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-full border border-[#E1E7E1] shadow-[0_10px_35px_-5px_rgba(0,0,0,0.07),0_2px_8px_-2px_rgba(0,0,0,0.04)] px-5 py-2.5 sm:px-7 sm:py-2.5 flex items-center justify-between gap-5 sm:gap-7 transition-all duration-300 max-w-5xl w-full sm:w-auto">
          
          {/* --------------------------------------------------------------------- */}
          {/* DESKTOP LEFT LINKS: About Us | Features | How It Works               */}
          {/* --------------------------------------------------------------------- */}
          {!isCustomerFlow && (
            <div className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-medium text-[#111111]">
              <button
                type="button"
                onClick={() => scrollToSection('platform')}
                className={`transition-colors hover:text-[#00B32D] cursor-pointer whitespace-nowrap ${
                  activeSection === 'platform' ? 'text-[#00B32D] font-bold' : 'text-[#111111]'
                }`}
              >
                About Us
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('features')}
                className={`transition-colors hover:text-[#00B32D] cursor-pointer whitespace-nowrap ${
                  activeSection === 'features' ? 'text-[#00B32D] font-bold' : 'text-[#111111]'
                }`}
              >
                Features
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className={`transition-colors hover:text-[#00B32D] cursor-pointer whitespace-nowrap ${
                  activeSection === 'how-it-works' ? 'text-[#00B32D] font-bold' : 'text-[#111111]'
                }`}
              >
                How It Works
              </button>
            </div>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* CENTRE: BRAND LOGO (EXACTLY AS IN REFERENCE IMAGE)                   */}
          {/* --------------------------------------------------------------------- */}
          <div className="flex items-center gap-2.5 shrink-0 mx-auto md:mx-0 text-bold">
            <button
              type="button"
              onClick={() => {
                if (currentPath !== '/') {
                  navigate('/');
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 text-left group focus:outline-hidden cursor-pointer shrink-0"
              title="EasyToPrint - Home"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center shrink-0 border border-[#A7F3D0]/70">
                <Printer className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#00B32D]" />
              </div>
              <span className="font-extrabold text-base sm:text-lg text-[#111111] tracking-tight font-['Manrope',sans-serif]">
                Easy<span className="text-[#00B32D]">To</span>Print
              </span>
            </button>

            {/* Context indicator if inside Customer or Console */}
            {isCustomerFlow && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-[#008F25] bg-[#E8F8EC] rounded-full border border-[#A7F3D0] max-w-[150px] truncate">
                <Store className="w-3 h-3 text-[#00B32D] shrink-0" />
                <span className="truncate">{activeShop.name}</span>
              </span>
            )}
            {currentPath.startsWith('/shop') && (
              <span className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-[#008F25] bg-[#E8F8EC] rounded-full border border-[#A7F3D0]">
                <Store className="w-3 h-3 text-[#00B32D]" />
                <span>Shop</span>
              </span>
            )}
            {currentPath.startsWith('/admin') && (
              <span className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-50 rounded-full border border-purple-200">
                <Shield className="w-3 h-3 text-purple-600" />
                <span>Admin</span>
              </span>
            )}
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* DESKTOP RIGHT LINKS & ACTIONS: Pricing | Contact Us | Login/CTA      */}
          {/* --------------------------------------------------------------------- */}
          {!isCustomerFlow && (
            <div className="hidden md:flex items-center gap-4 lg:gap-5 text-sm font-medium text-[#111111]">
              <button
                type="button"
                onClick={() => scrollToSection('pricing')}
                className={`transition-colors hover:text-[#00B32D] cursor-pointer whitespace-nowrap ${
                  activeSection === 'pricing' ? 'text-[#00B32D] font-bold' : 'text-[#111111]'
                }`}
              >
                Pricing
              </button>

              {/* Resources dropdown trigger */}
              <div className="relative" ref={resourcesDropdownRef}>
                <button
                  type="button"
                  onClick={() => setResourcesOpen(!resourcesOpen)}
                  className={`inline-flex items-center gap-1 transition-colors hover:text-[#00B32D] cursor-pointer whitespace-nowrap ${
                    resourcesOpen || activeSection === 'faq' ? 'text-[#00B32D] font-bold' : 'text-[#111111]'
                  }`}
                >
                  <span>Resources</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      resourcesOpen ? 'rotate-180 text-[#00B32D]' : 'text-[#646B65]'
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {resourcesOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="absolute right-0 mt-3 w-64 rounded-2xl bg-white border border-[#E1E7E1] shadow-xl p-2 z-50"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setResourcesOpen(false);
                          scrollToSection('faq');
                        }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F7F8F7] text-left transition-colors cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#E8F8EC] text-[#00B32D] group-hover:bg-[#00B32D] group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                          <HelpCircle className="w-4 h-4 stroke-[2.2]" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#111111] group-hover:text-[#00B32D] transition-colors">
                            FAQ
                          </div>
                          <p className="text-[11px] text-[#646B65]">Frequently asked questions</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setResourcesOpen(false);
                          setHelpCenterOpen(true);
                        }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F7F8F7] text-left transition-colors cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#E8F8EC] text-[#00B32D] group-hover:bg-[#00B32D] group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 stroke-[2.2]" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#111111] group-hover:text-[#008F25] transition-colors">
                            Help Center
                          </div>
                          <p className="text-[11px] text-[#646B65]">Guides &amp; printer manuals</p>
                        </div>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Direct Contact us action as in the reference image */}
              <button
                type="button"
                onClick={() => setContactSupportOpen(true)}
                className="transition-colors hover:text-[#00B32D] cursor-pointer whitespace-nowrap"
              >
                Contact us
              </button>

              {/* Separation divider */}
              <div className="h-4 w-px bg-[#E1E7E1] mx-0.5" />

              {!currentUser ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/auth/login')}
                    className="text-xs lg:text-sm font-semibold text-[#111111] hover:text-[#008F25] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Login
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/auth/register')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs lg:text-sm font-bold text-white bg-[#00B32D] hover:bg-[#008F25] active:scale-[0.98] rounded-full transition-all shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.4]" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(currentUser.role === 'ADMIN' ? '/admin/dashboard' : '/shop/dashboard')
                    }
                    className="inline-flex items-center justify-center gap-1 px-3 py-1 text-xs font-bold text-white bg-[#00B32D] hover:bg-[#008F25] active:scale-[0.98] rounded-full transition-all shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <span>Console</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="text-xs font-medium text-[#646B65] hover:text-[#DC2626] transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* MOBILE TOGGLE BUTTON                                                  */}
          {/* --------------------------------------------------------------------- */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQrScannerOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold text-white bg-[#00A61C] hover:bg-[#008F25] rounded-full transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shadow-2xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="p-1.5 rounded-full text-[#111111] hover:bg-[#F7F8F7] border border-[#E1E7E1] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* MOBILE FLOATING MENU DROPDOWN                                          */}
        {/* ======================================================================= */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto absolute top-16 left-4 right-4 sm:left-auto sm:right-auto sm:w-96 mx-auto rounded-3xl bg-white/98 backdrop-blur-md border border-[#E1E7E1] shadow-2xl p-5 space-y-3 font-['Manrope',sans-serif] z-50"
            >
              <div className="flex flex-col space-y-1 text-sm font-semibold text-[#111111]">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsQrScannerOpen(true);
                  }}
                  className="px-3.5 py-2.5 text-left rounded-xl bg-[#E8F8EC] hover:bg-[#d5f3dc] text-[#00A61C] flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#00A61C]" />
                    <span>Scan Counter QR</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#00A61C]" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('platform')}
                  className="px-3.5 py-2.5 text-left rounded-xl hover:bg-[#F7F8F7] flex items-center justify-between"
                >
                  <span>About Us</span>
                  <ArrowRight className="w-4 h-4 text-[#646B65]" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('features')}
                  className="px-3.5 py-2.5 text-left rounded-xl hover:bg-[#F7F8F7] flex items-center justify-between"
                >
                  <span>Features</span>
                  <ArrowRight className="w-4 h-4 text-[#646B65]" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="px-3.5 py-2.5 text-left rounded-xl hover:bg-[#F7F8F7] flex items-center justify-between"
                >
                  <span>How It Works</span>
                  <ArrowRight className="w-4 h-4 text-[#646B65]" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('pricing')}
                  className="px-3.5 py-2.5 text-left rounded-xl hover:bg-[#F7F8F7] flex items-center justify-between"
                >
                  <span>Pricing</span>
                  <ArrowRight className="w-4 h-4 text-[#646B65]" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setContactSupportOpen(true);
                  }}
                  className="px-3.5 py-2.5 text-left rounded-xl hover:bg-[#F7F8F7] flex items-center justify-between"
                >
                  <span>Contact us</span>
                  <Headphones className="w-4 h-4 text-[#00B32D]" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('faq')}
                  className="px-3.5 py-2.5 text-left rounded-xl hover:bg-[#F7F8F7] flex items-center justify-between"
                >
                  <span>FAQ</span>
                  <HelpCircle className="w-4 h-4 text-[#646B65]" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setHelpCenterOpen(true);
                  }}
                  className="px-3.5 py-2.5 text-left rounded-xl hover:bg-[#F7F8F7] flex items-center justify-between"
                >
                  <span>Help Center</span>
                  <BookOpen className="w-4 h-4 text-[#646B65]" />
                </button>
              </div>

              {/* Mobile Actions */}
              <div className="pt-3 border-t border-[#E1E7E1] flex flex-col gap-2">
                {!currentUser ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('/auth/login');
                      }}
                      className="w-full py-2.5 px-4 bg-[#F7F8F7] hover:bg-[#E1E7E1] text-[#111111] rounded-full text-sm font-semibold transition-colors text-center cursor-pointer"
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate('/auth/register');
                      }}
                      className="w-full py-2.5 px-4 bg-[#00B32D] hover:bg-[#008F25] text-white rounded-full text-sm font-bold transition-colors text-center shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Get Started</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.4]" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate(
                          currentUser.role === 'ADMIN' ? '/admin/dashboard' : '/shop/dashboard'
                        );
                      }}
                      className="w-full py-2.5 px-4 bg-[#00B32D] hover:bg-[#008F25] text-white rounded-full text-sm font-semibold transition-colors text-center shadow-xs cursor-pointer"
                    >
                      {currentUser.role === 'ADMIN' ? 'Admin Console' : 'Shop Console'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logout();
                      }}
                      className="w-full py-2 px-4 text-xs font-semibold text-[#DC2626] hover:bg-rose-50 rounded-full transition-colors text-center cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ========================================================================= */}
      {/* MODAL: HELP CENTER                                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {helpCenterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs font-['Manrope',sans-serif]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-2xl bg-white rounded-3xl border border-[#E1E7E1] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#E1E7E1] bg-[#F7F8F7] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center">
                    <BookOpen className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#111111]">EasyToPrint Help Center</h2>
                    <p className="text-xs text-[#646B65]">Guides, setup manuals &amp; printing troubleshooting</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHelpCenterOpen(false)}
                  className="p-2 rounded-xl text-[#646B65] hover:text-[#111111] hover:bg-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-5 border-b border-[#E1E7E1] bg-white">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#646B65] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={helpSearchQuery}
                    onChange={(e) => {
                      setHelpSearchQuery(e.target.value);
                      if (selectedGuideArticle) setSelectedGuideArticle(null);
                    }}
                    placeholder="Search setup guides, Windows agent errors, UPI payments..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-hidden focus:border-[#00B32D] focus:bg-white transition-all"
                  />
                  {helpSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHelpSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#646B65] hover:text-[#111111]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="px-5 py-3 border-b border-[#E1E7E1] bg-[#F7F8F7] flex items-center gap-2 overflow-x-auto">
                {['All', 'Agent Setup', 'Shop Management', 'Payments', 'Diagnostics'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setHelpCategoryFilter(cat);
                      setSelectedGuideArticle(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      helpCategoryFilter === cat
                        ? 'bg-[#00B32D] text-white shadow-2xs'
                        : 'bg-white text-[#646B65] border border-[#E1E7E1] hover:text-[#111111]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Content Articles List or Guide Reader View */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {selectedGuideArticle ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setSelectedGuideArticle(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008F25] hover:underline cursor-pointer"
                    >
                      <span>← Back to Articles</span>
                    </button>

                    <div className="p-4 rounded-xl bg-[#E8F8EC]/40 border border-[#A7F3D0] space-y-2">
                      <span className="text-[11px] font-bold text-[#008F25] bg-white px-2 py-0.5 rounded border border-[#A7F3D0]">
                        {selectedGuideArticle.category} Guide
                      </span>
                      <h3 className="text-base font-bold text-[#111111]">
                        {selectedGuideArticle.title}
                      </h3>
                      <p className="text-xs text-[#646B65]">
                        {selectedGuideArticle.snippet}
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                        Step-by-Step Instructions &amp; Guide Text
                      </h4>
                      <div className="space-y-2.5">
                        {getDetailedGuideText(selectedGuideArticle.category).map((stepText, sIdx) => (
                          <div key={sIdx} className="p-3.5 rounded-xl bg-[#F7F8F7] border border-[#E1E7E1] flex items-start gap-3">
                            <span className="w-6 h-6 rounded-lg bg-[#00B32D] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                              {sIdx + 1}
                            </span>
                            <span className="text-xs text-[#111111] leading-relaxed font-medium">
                              {stepText.replace(/^Step \d+: /, '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : filteredArticles.length > 0 ? (
                  filteredArticles.map((article, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-[#E1E7E1] hover:border-[#A7F3D0] hover:bg-[#F7F8F7]/50 transition-all cursor-pointer group"
                      onClick={() => {
                        setSelectedGuideArticle(article);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-bold text-[#008F25] bg-[#E8F8EC] px-2 py-0.5 rounded">
                          {article.category}
                        </span>
                        <span className="text-[11px] text-[#646B65] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {article.readTime}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#111111] group-hover:text-[#008F25] transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-xs text-[#646B65] mt-1.5 leading-relaxed">
                        {article.snippet}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 space-y-2">
                    <p className="text-sm font-bold text-[#111111]">No matching articles found</p>
                    <p className="text-xs text-[#646B65]">Try searching for "agent", "printer", "UPI" or "rates".</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CONTACT SUPPORT                                                    */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {contactSupportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs font-['Manrope',sans-serif]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-xl bg-white rounded-3xl border border-[#E1E7E1] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#E1E7E1] bg-[#F7F8F7] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center">
                    <Headphones className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#111111]">EasyToPrint Support</h2>
                    <p className="text-xs text-[#646B65]">We are here to help your print shop run smoothly</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setContactSupportOpen(false)}
                  className="p-2 rounded-xl text-[#646B65] hover:text-[#111111] hover:bg-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {/* Instant Channels */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href="https://wa.me/919876543210?text=Hello%20EasyToPrint%20Support,%20I%20need%20help%20with%20my%20print%20shop"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 rounded-2xl border border-[#A7F3D0] bg-[#E8F8EC]/50 hover:bg-[#E8F8EC] transition-all flex items-center gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#00B32D] text-white flex items-center justify-center shrink-0">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111111] group-hover:text-[#008F25] transition-colors flex items-center gap-1">
                        <span>WhatsApp Chat</span>
                        <ExternalLink className="w-3 h-3 text-[#00B32D]" />
                      </div>
                      <p className="text-[11px] text-[#646B65]">Instant reply under 2 mins</p>
                    </div>
                  </a>

                  <a
                    href="tel:+919876543210"
                    className="p-3.5 rounded-2xl border border-[#E1E7E1] bg-[#F7F8F7] hover:bg-white transition-all flex items-center gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-white border border-[#E1E7E1] text-[#111111] flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-[#00B32D]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111111] group-hover:text-[#008F25] transition-colors">
                        Toll-Free Phone
                      </div>
                      <p className="text-[11px] text-[#646B65]">Mon–Sat · 9 AM to 9 PM</p>
                    </div>
                  </a>
                </div>

                {/* Form */}
                <form onSubmit={handleSupportSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#111111]">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      value={supportName}
                      onChange={(e) => setSupportName(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full px-3.5 py-2.5 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-hidden focus:border-[#00B32D] focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#111111]">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        placeholder="rajesh@printshop.com"
                        className="w-full px-3.5 py-2.5 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-hidden focus:border-[#00B32D] focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-[#111111]">Shop Name (Optional)</label>
                      <input
                        type="text"
                        value={supportShopName}
                        onChange={(e) => setSupportShopName(e.target.value)}
                        placeholder="e.g. Sai Xerox &amp; Cyber Hub"
                        className="w-full px-3.5 py-2.5 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-hidden focus:border-[#00B32D] focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#111111]">How can we help? *</label>
                    <textarea
                      required
                      rows={3}
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Describe your question or printer setup issue..."
                      className="w-full px-3.5 py-2.5 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl text-sm text-[#111111] placeholder:text-[#646B65] focus:outline-hidden focus:border-[#00B32D] focus:bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={supportSubmitted}
                    className="w-full py-3 px-4 bg-[#00B32D] hover:bg-[#008F25] text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {supportSubmitted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Ticket Submitted!</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Support Ticket</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#E1E7E1] bg-[#F7F8F7] text-center text-xs text-[#646B65]">
                Direct technical escalation: <span className="font-semibold text-[#111111]">support@easytoprint.in</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
