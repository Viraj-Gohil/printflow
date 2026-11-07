import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../lib/store';
import {
  Check,
  Zap,
  Sparkles,
  Printer,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  Clock,
  Layers,
  Activity,
  ChevronRight,
  Lock,
  Star
} from 'lucide-react';
import { FaqAccordion } from '../landing/FaqAccordion';

interface PlanDetail {
  id: string;
  name: string;
  monthlyPrice: number;
  regularMonthlyPrice?: number;
  description: string;
  badge?: string;
  highlighted?: boolean;
  limits: {
    monthlyJobs: number;
    printers: number;
    shops: number;
  };
  features: string[];
  blockedFeatures?: string[];
  ctaText: string;
  trialDays: number;
}

const CANONICAL_PLANS: PlanDetail[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 399,
    description: 'Essential automated printing for independent photocopy counters and single-printer Xerox shops.',
    limits: {
      monthlyJobs: 500,
      printers: 1,
      shops: 1
    },
    features: [
      '500 customer print jobs / month',
      '1 registered Windows printer connection',
      '7-day free trial included',
      'Instant counter QR code generation',
      'Customer document upload & instant PDF preview',
      'Customer UPI & QR online payment integration',
      'Automatic print execution to selected printer',
      'Basic sequential print queue (FIFO)',
      'Manual printer selection & paper matching',
      'Pause, resume, retry & cancel job controls',
      'Crash recovery & interrupted print handling',
      'Basic counter sales dashboard & metrics'
    ],
    blockedFeatures: [
      'Smart capability routing',
      'Concurrent multi-printer queues',
      'Dynamic load balancing',
      'Automated queue optimization'
    ],
    ctaText: 'Start 7-Day Free Trial',
    trialDays: 7
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 699,
    description: 'Smart routing and multi-printer concurrency for expanding print shops with multiple workstations.',
    badge: 'Most Popular',
    highlighted: true,
    limits: {
      monthlyJobs: 2000,
      printers: 5,
      shops: 1
    },
    features: [
      '2,000 customer print jobs / month',
      'Up to 5 registered Windows printer connections',
      'Everything included in Starter plan',
      'Smart capability-based printer routing (A4, A3, Legal, Color, Duplex)',
      'Multiple independent printer queues (concurrent printing)',
      'Advanced priority queue management',
      'Shop operator priority override controls',
      'Printer performance & speed reports',
      'Detailed job volume & revenue analytics',
      'Advanced multi-device hardware monitoring'
    ],
    blockedFeatures: [
      'Dynamic workload load balancing',
      'Automated queue optimization'
    ],
    ctaText: 'Upgrade to Growth',
    trialDays: 0
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 1199,
    regularMonthlyPrice: 1499,
    description: 'Full automated fleet orchestration, dynamic load balancing, and intelligent throughput optimization.',
    badge: 'Launch Offer: ₹300 OFF',
    limits: {
      monthlyJobs: 5000,
      printers: 10,
      shops: 1
    },
    features: [
      '5,000 customer print jobs / month',
      'Up to 10 registered Windows printer connections',
      'Everything included in Growth plan',
      'Advanced dynamic load balancing across compatible printers',
      'Automated queue optimization (page count & paper batching)',
      'Printer hardware failure monitoring & automatic job failover',
      'Fleet utilization & bottleneck analytics',
      'VIP customer prioritization rules',
      'Multi-counter agent session coordination',
      'Priority telephone & WhatsApp technical support'
    ],
    ctaText: 'Get Business Plan',
    trialDays: 0
  }
];

export const PricingPage: React.FC = () => {
  const { currentUser, navigate, showToast } = useApp();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const handleSelectPlan = (plan: PlanDetail) => {
    if (!currentUser) {
      navigate(`/auth/register?plan=${plan.id}&billing=${billingCycle}`);
      return;
    }

    if (currentUser.role === 'SHOP_OWNER') {
      navigate(`/shop/subscription?upgrade=${plan.id}&billing=${billingCycle}`);
    } else {
      showToast('Admin accounts manage subscriptions from the Admin Console.', 'info');
      navigate('/admin/subscriptions');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#00B52D]" />
            Transparent Xerox SaaS Pricing
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#080808] tracking-tight">
            Plans built to scale your <span className="text-[#00B52D]">counter profits</span>.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Eliminate WhatsApp queues, automate customer UPI payments, and let your Windows printers spool jobs hands-free.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-500'}`}>
              Monthly Billing
            </span>
            <button
              type="button"
              onClick={() => setBillingCycle((prev) => (prev === 'monthly' ? 'annual' : 'monthly'))}
              className="relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-200 transition-colors duration-200 ease-in-out focus:outline-hidden data-checked:bg-[#00B52D]"
              data-checked={billingCycle === 'annual' ? '' : undefined}
              role="switch"
              aria-checked={billingCycle === 'annual'}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-sm font-semibold flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-slate-900' : 'text-slate-500'}`}>
              Annual Billing
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                Save 20%
              </span>
            </span>
          </div>

          {/* Launch Offer Callout Banner */}
          <div className="mt-4 p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-2xl flex items-center justify-center gap-2.5 text-xs text-purple-900 shadow-xs max-w-xl mx-auto">
            <Zap className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="font-semibold">
              <strong>Launch Offer Active:</strong> Business Plan discounted to ₹1,199/mo (Regular ₹1,499/mo). Free 7-day trial available on Starter for new shops.
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {CANONICAL_PLANS.map((plan) => {
            const rawMonthly = plan.monthlyPrice;
            const effectivePrice = billingCycle === 'annual' ? Math.round(rawMonthly * 0.8) : rawMonthly;
            const regularEffectivePrice = plan.regularMonthlyPrice
              ? billingCycle === 'annual'
                ? Math.round(plan.regularMonthlyPrice * 0.8)
                : plan.regularMonthlyPrice
              : null;

            return (
              <motion.div
                key={plan.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className={`relative flex flex-col rounded-3xl p-8 transition-all ${
                  plan.highlighted
                    ? 'bg-white border-2 border-[#00B52D] shadow-xl ring-4 ring-emerald-500/10'
                    : 'bg-white border border-slate-200 shadow-md'
                }`}
              >
                {/* Badge if present */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#00B52D] text-white shadow-sm flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="space-y-4 flex-1">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 min-h-[36px]">{plan.description}</p>
                  </div>

                  {/* Pricing Display */}
                  <div className="pt-2 pb-4 border-b border-slate-100 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                      ₹{effectivePrice.toLocaleString('en-IN')}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">
                      / month
                    </span>
                    {regularEffectivePrice && (
                      <span className="text-xs line-through text-slate-400 font-semibold ml-1">
                        ₹{regularEffectivePrice.toLocaleString('en-IN')}/mo
                      </span>
                    )}
                  </div>

                  {billingCycle === 'annual' && (
                    <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 p-2 rounded-xl text-center border border-emerald-100">
                      Billed annually (₹{(effectivePrice * 12).toLocaleString('en-IN')}/year)
                    </div>
                  )}

                  {/* Hardware & Job Quota Summary */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Printer className="w-3.5 h-3.5 text-blue-600" />
                        Printers Connected:
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {plan.limits.printers} {plan.limits.printers === 1 ? 'Printer' : 'Printers'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Monthly Jobs:
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {plan.limits.monthlyJobs.toLocaleString()} / mo
                      </span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2.5 pt-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                      Included Capabilities
                    </span>
                    <ul className="space-y-2.5 text-xs text-slate-700">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-[#00B52D] shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Blocked Features if any */}
                    {plan.blockedFeatures && plan.blockedFeatures.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Locked on {plan.name}
                        </span>
                        <ul className="space-y-1.5 text-xs text-slate-400">
                          {plan.blockedFeatures.map((feat, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                              <span className="line-through">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-8">
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99] ${
                      plan.highlighted
                        ? 'bg-[#00B52D] text-white hover:bg-[#009b26] hover:shadow-emerald-500/25'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  {plan.trialDays > 0 && (
                    <p className="text-center text-[11px] text-slate-400 font-medium mt-2">
                      No upfront payment required · Instant activation
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Feature Comparison Matrix */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Detailed Feature Comparison
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Understand the exact differences in printer dispatching, capacity, and automation.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-4 px-4 font-bold text-slate-900 text-sm">Feature &amp; Limit</th>
                  <th className="py-4 px-4 font-bold text-slate-900 text-sm">Starter (₹399/mo)</th>
                  <th className="py-4 px-4 font-bold text-emerald-600 text-sm">Growth (₹699/mo)</th>
                  <th className="py-4 px-4 font-bold text-purple-700 text-sm">Business (₹1,199/mo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Monthly Print Job Quota</td>
                  <td className="py-3 px-4 font-mono">500 jobs</td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-700">2,000 jobs</td>
                  <td className="py-3 px-4 font-mono font-bold text-purple-700">5,000 jobs</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Registered Windows Printers</td>
                  <td className="py-3 px-4 font-mono">1 printer</td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-700">Up to 5 printers</td>
                  <td className="py-3 px-4 font-mono font-bold text-purple-700">Up to 10 printers</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Free Trial Period</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">7-Day Free Trial</td>
                  <td className="py-3 px-4 text-slate-400">—</td>
                  <td className="py-3 px-4 text-slate-400">—</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Customer QR Upload &amp; UPI Payment</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">✓ Included</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">✓ Included</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">✓ Included</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Automatic Windows Spooler Printing</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">✓ Direct to printer</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">✓ Included</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">✓ Included</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Queue Architecture</td>
                  <td className="py-3 px-4 text-slate-500">Single sequential queue</td>
                  <td className="py-3 px-4 text-emerald-700 font-semibold">Multiple concurrent queues (5)</td>
                  <td className="py-3 px-4 text-purple-700 font-semibold">Fleet multi-queues (10)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Smart Capability Routing</td>
                  <td className="py-3 px-4 text-slate-300">Locked (Manual selection)</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">✓ Automatic paper &amp; color match</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">✓ Automatic paper &amp; color match</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Dynamic Intelligent Load Balancing</td>
                  <td className="py-3 px-4 text-slate-300">Locked</td>
                  <td className="py-3 px-4 text-slate-300">Locked</td>
                  <td className="py-3 px-4 text-purple-700 font-bold">✓ Active workload distribution</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Automated Queue Optimization</td>
                  <td className="py-3 px-4 text-slate-300">Locked</td>
                  <td className="py-3 px-4 text-slate-300">Locked</td>
                  <td className="py-3 px-4 text-purple-700 font-bold">✓ Urgency &amp; batch reordering</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Hardware Failure Auto-Failover</td>
                  <td className="py-3 px-4 text-slate-300">Locked</td>
                  <td className="py-3 px-4 text-slate-300">Locked</td>
                  <td className="py-3 px-4 text-purple-700 font-bold">✓ Reroute to ready printer</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900">Analytics &amp; Revenue Reports</td>
                  <td className="py-3 px-4 text-slate-600">Basic sales summary</td>
                  <td className="py-3 px-4 text-emerald-700 font-semibold">Advanced analytics &amp; speed</td>
                  <td className="py-3 px-4 text-purple-700 font-bold">Full fleet intelligence</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Interactive FAQ Section */}
        <FaqAccordion />
      </div>
    </div>
  );
};
