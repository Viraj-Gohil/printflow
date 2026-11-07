import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  HelpCircle,
  MessageCircle,
  Phone,
  Mail,
  ArrowRight,
  Sparkles,
  Check
} from 'lucide-react';

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category?: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 1,
    question: 'What is EasyToPrint?',
    answer:
      'EasyToPrint is an all-in-one print shop management and printing automation platform. It bridges QR-based customer self-ordering, online UPI payments, and an automated Windows desktop Print Agent to eliminate counter chaos and automate printing workflows for Xerox shops and cyber centres.'
  },
  {
    id: 2,
    question: 'How does EasyToPrint work?',
    answer:
      'Customers scan your counter QR code on their smartphone, upload PDF documents, choose print settings (color/B&W, copies, duplex), and complete an instant UPI payment. The EasyToPrint Windows Agent immediately receives the paid order and automatically streams it to your connected printer without USB drives or manual intervention.'
  },
  {
    id: 3,
    question: 'What is the EasyToPrint Windows Agent?',
    answer:
      'The Windows Agent is a lightweight, secure desktop software running on your shop PC. It monitors your physical printers, connects via TLS 1.3 to your cloud queue, and silently dispatches print jobs through the native Win32 Print Spooler with DPAPI vault protection.'
  },
  {
    id: 4,
    question: 'Which printers are supported?',
    answer:
      'EasyToPrint supports all major desktop and commercial printers with Windows drivers—including HP, Canon, Epson, Brother, Ricoh, Konica Minolta, Kyocera, and Xerox. Both USB and local network printers are supported without requiring special hardware.'
  },
  {
    id: 5,
    question: 'Can I connect multiple printers?',
    answer:
      'Yes. You can connect and manage multiple physical printers simultaneously (such as a dedicated black-and-white high-speed laser printer and a high-resolution color photo inkjet). The platform automatically detects capabilities and routes customer orders to the correct device.'
  },
  {
    id: 6,
    question: 'Do customers need to install an application?',
    answer:
      'No. Customers do not need to download or install any app. The entire upload, customization, and payment process runs seamlessly in their mobile browser (Chrome, Safari, Firefox) within seconds of scanning your counter QR code.'
  },
  {
    id: 7,
    question: 'How do customer payments work?',
    answer:
      'Customers pay directly online using instant UPI (Google Pay, PhonePe, Paytm, BHIM) or cards powered by secure payment gateways like Razorpay. Print jobs are only dispatched to the printer queue after successful payment confirmation, eliminating unpaid prints and change calculation.'
  }
];

export const FaqAccordion: React.FC = () => {
  // Single open accordion index, or null if all closed. Default first open.
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [allExpanded, setAllExpanded] = useState<boolean>(false);

  const handleToggle = (index: number) => {
    if (allExpanded) {
      setAllExpanded(false);
      setOpenIndex(null);
      return;
    }
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  const handleToggleAll = () => {
    if (allExpanded) {
      setAllExpanded(false);
      setOpenIndex(null);
    } else {
      setAllExpanded(true);
      setOpenIndex(null);
    }
  };

  return (
    <section id="faq" className="py-16 sm:py-24 border-b border-[#E1E7E1] bg-white font-['Manrope',sans-serif]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F8EC] border border-[#A7F3D0] text-[#008F25] text-xs font-bold">
            <HelpCircle className="w-3.5 h-3.5 text-[#00B32D]" />
            <span>Got Questions? We Have Answers</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
            Frequently Asked Questions
          </h2>

          <p className="text-sm sm:text-base text-[#646B65] max-w-2xl mx-auto">
            Everything you need to know about setting up EasyToPrint, connecting your printers, and automating your shop's printing workflow.
          </p>

          {/* Quick Controls: Expand / Collapse All Toggle */}
          <div className="pt-2 flex items-center justify-center">
            <button
              type="button"
              onClick={handleToggleAll}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#008F25] bg-[#E8F8EC] hover:bg-[#A7F3D0]/40 border border-[#A7F3D0] transition-colors cursor-pointer"
            >
              {allExpanded ? 'Collapse All Answers' : 'Expand All Answers'}
            </button>
          </div>
        </div>

        {/* Accordion List – Exactly 7 Questions */}
        <div className="space-y-3.5">
          {FAQ_ITEMS.map((faq, idx) => {
            const isOpen = allExpanded || openIndex === idx;

            return (
              <div
                key={faq.id}
                className={`rounded-2xl transition-all border ${
                  isOpen
                    ? 'border-[#00B32D] bg-[#F7F8F7] shadow-sm'
                    : 'border-[#E1E7E1] bg-[#F7F8F7] hover:border-[#A7F3D0]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(idx)}
                  aria-expanded={isOpen}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-hidden"
                >
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <span
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isOpen
                          ? 'bg-[#00B32D] text-white shadow-xs'
                          : 'bg-white border border-[#E1E7E1] text-[#646B65]'
                      }`}
                    >
                      0{faq.id}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-[#111111] leading-snug">
                      {faq.question}
                    </h3>
                  </div>

                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      isOpen
                        ? 'bg-[#E8F8EC] text-[#008F25] rotate-180'
                        : 'bg-white border border-[#E1E7E1] text-[#646B65] hover:text-[#111111]'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4 stroke-[2.2]" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key={`content-${faq.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-1 text-xs sm:text-sm text-[#646B65] leading-relaxed border-t border-[#E1E7E1]/80">
                        <p>{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Bottom Support Banner */}
        <div className="mt-12 p-6 rounded-2xl bg-[#F7F8F7] border border-[#E1E7E1] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-[#111111]">Still have questions about printer setup?</h4>
            <p className="text-xs text-[#646B65]">Our technical support team helps you connect and test your printers in under 10 minutes.</p>
          </div>
          <a
            href="mailto:support@easytoprint.in"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E1E7E1] hover:border-[#00B32D] text-xs font-bold text-[#111111] hover:text-[#00B32D] shadow-2xs transition-colors shrink-0"
          >
            <Mail className="w-4 h-4 text-[#00B32D]" />
            <span>Contact Technical Support</span>
          </a>
        </div>
      </div>
    </section>
  );
};
