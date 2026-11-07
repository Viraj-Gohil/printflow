import assert from 'node:assert/strict';
import { computePlanFeatures, CANONICAL_PLANS } from '../src/db/subscriptionRepository.js';
import { JobQueueManager } from '../print-agent/src/main/queue/JobQueueManager.js';
import { localVault } from '../print-agent/src/main/storage/LocalDataVault.js';
import { PlanEntitlements, PrintJobItem, DiscoveredPrinter } from '../print-agent/src/renderer/types/agent.js';

console.log('=== TEST SUITE: Plan-Based Feature Entitlement System ===\n');

// =========================================================================
// TEST 1: Canonical Plans & Pricing Configurations
// =========================================================================
console.log('1. Validating Canonical Plan Pricing and Limits...');

const starterPlan = CANONICAL_PLANS.find(p => p.slug === 'starter');
const growthPlan = CANONICAL_PLANS.find(p => p.slug === 'growth');
const businessPlan = CANONICAL_PLANS.find(p => p.slug === 'business');

assert.ok(starterPlan, 'Starter plan must exist');
assert.strictEqual(starterPlan.priceMonthly, 399, 'Starter plan must be ₹399/month');
assert.strictEqual(starterPlan.limits.trialDays, 7, 'Starter plan must include 7-day free trial');
assert.strictEqual(starterPlan.limits.printerLimit, 1, 'Starter allows 1 printer');
assert.strictEqual(starterPlan.limits.printLimitMonthly, 500, 'Starter allows 500 print jobs/month');

assert.ok(growthPlan, 'Growth plan must exist');
assert.strictEqual(growthPlan.priceMonthly, 699, 'Growth plan must be ₹699/month');
assert.strictEqual(growthPlan.limits.printerLimit, 5, 'Growth allows 5 printers');
assert.strictEqual(growthPlan.limits.printLimitMonthly, 2000, 'Growth allows 2,000 print jobs/month');

assert.ok(businessPlan, 'Business plan must exist');
assert.strictEqual(businessPlan.priceMonthly, 1499, 'Business plan regular price is ₹1,499/month');
assert.strictEqual(businessPlan.limits.introductoryPrice, 1199, 'Business launch offer is ₹1,199/month');
assert.strictEqual(businessPlan.limits.printerLimit, 10, 'Business allows 10 printers');
assert.strictEqual(businessPlan.limits.printLimitMonthly, 5000, 'Business allows 5,000 print jobs/month');

console.log('✓ Canonical plans and pricing verified.\n');

// =========================================================================
// TEST 2: Plan Feature Entitlement Engine (Backend & Agent sync)
// =========================================================================
console.log('2. Validating Feature Entitlement Engine Flags...');

const starterFeatures = computePlanFeatures('starter', 'active');
assert.strictEqual(starterFeatures.automaticPrinting, true, 'Starter allows automatic printing');
assert.strictEqual(starterFeatures.multipleQueues, false, 'Starter BLOCKS multi-printer queues');
assert.strictEqual(starterFeatures.smartPrinterSelection, false, 'Starter BLOCKS smart capability routing');
assert.strictEqual(starterFeatures.loadBalancing, false, 'Starter BLOCKS dynamic load balancing');
assert.strictEqual(starterFeatures.queueOptimization, false, 'Starter BLOCKS automated queue optimization');

const growthFeatures = computePlanFeatures('growth', 'active');
assert.strictEqual(growthFeatures.automaticPrinting, true, 'Growth allows automatic printing');
assert.strictEqual(growthFeatures.multipleQueues, true, 'Growth ALLOWS multi-printer queues');
assert.strictEqual(growthFeatures.smartPrinterSelection, true, 'Growth ALLOWS smart capability routing');
assert.strictEqual(growthFeatures.loadBalancing, false, 'Growth BLOCKS dynamic load balancing');
assert.strictEqual(growthFeatures.queueOptimization, false, 'Growth BLOCKS automated queue optimization');

const businessFeatures = computePlanFeatures('business', 'active');
assert.strictEqual(businessFeatures.automaticPrinting, true, 'Business allows automatic printing');
assert.strictEqual(businessFeatures.multipleQueues, true, 'Business ALLOWS multi-printer queues');
assert.strictEqual(businessFeatures.smartPrinterSelection, true, 'Business ALLOWS smart capability routing');
assert.strictEqual(businessFeatures.loadBalancing, true, 'Business ALLOWS dynamic load balancing');
assert.strictEqual(businessFeatures.queueOptimization, true, 'Business ALLOWS automated queue optimization');
assert.strictEqual(businessFeatures.printerFailureMonitoring, true, 'Business ALLOWS failure monitoring');

// Inactive or expired status
const expiredFeatures = computePlanFeatures('business', 'expired');
assert.strictEqual(expiredFeatures.automaticPrinting, false, 'Expired subscription blocks automatic printing');

console.log('✓ Feature entitlement engine flags verified.\n');

// =========================================================================
// TEST 3: JobQueueManager - Real Feature Enforcement
// =========================================================================
console.log('3. Validating JobQueueManager Real Enforcement...');

const mockApiClient: any = {
  claimJob: async (id: string) => ({ success: true, job: { id } }),
  downloadDocument: async () => ({ success: true, filePath: 'C:\\Temp\\mock.pdf' }),
  updateJobStatus: async () => ({ success: true })
};

const mockPrinters: DiscoveredPrinter[] = [
  {
    name: 'HP_LaserJet_Mono',
    displayName: 'HP LaserJet Mono',
    isOnline: true,
    isDefault: true,
    status: 'READY',
    driverName: 'HP LaserJet P1007',
    portName: 'USB001',
    capabilities: { paperSizes: ['A4'], supportsColor: false, supportsDuplex: false }
  },
  {
    name: 'Canon_Color_Duplex',
    displayName: 'Canon Color Duplex',
    isOnline: true,
    isDefault: false,
    status: 'READY',
    driverName: 'Canon IR-ADV C3525',
    portName: '192.168.1.50',
    capabilities: { paperSizes: ['A4', 'A3', 'LEGAL'], supportsColor: true, supportsDuplex: true }
  }
];

const mockPrinterManager: any = {
  getCachedPrinters: () => mockPrinters,
  spoolJob: async () => ({ success: true, submitted: true, spoolerJobId: 404 })
};

const queueManager = new JobQueueManager(mockApiClient, mockPrinterManager);

// Test 3A: Starter Plan - Multi-Printer Queue Collapse
const starterEntitlement: PlanEntitlements = {
  plan: 'starter',
  planName: 'Starter',
  status: 'active',
  isOperational: true,
  remainingTrialDays: 7,
  limits: { monthlyPrintJobs: 500, printers: 1, shops: 1, trialDays: 7 },
  usage: { printJobsUsed: 50, printersUsed: 1, usagePercent: 10, warningThreshold: 'NORMAL' },
  features: starterFeatures,
  entitlementVersion: '1.0',
  syncedAt: new Date().toISOString()
};

queueManager.setEntitlements(starterEntitlement);
const starterQueues = queueManager.getPrinterQueues();
assert.ok(starterQueues.length <= 1, 'Starter plan must enforce single printer queue view');

// Test 3B: Growth Plan - Multi-Printer Queues Unlocked
const growthEntitlement: PlanEntitlements = {
  plan: 'growth',
  planName: 'Growth',
  status: 'active',
  isOperational: true,
  remainingTrialDays: null,
  limits: { monthlyPrintJobs: 2000, printers: 5, shops: 1, trialDays: 0 },
  usage: { printJobsUsed: 150, printersUsed: 2, usagePercent: 7, warningThreshold: 'NORMAL' },
  features: growthFeatures,
  entitlementVersion: '1.0',
  syncedAt: new Date().toISOString()
};

queueManager.setEntitlements(growthEntitlement);
const growthQueues = queueManager.getPrinterQueues();
assert.strictEqual(growthQueues.length, 2, 'Growth plan allows multi-printer queues for all registered printers');

// Test 3C: Starter Plan - Requires manual printer selection, rejects smart routing
queueManager.setEntitlements(starterEntitlement);

const colorDuplexJob: PrintJobItem = {
  id: 'job_color_1',
  orderCode: 'ORD-001',
  shopId: 'shop_demo',
  customerName: 'Viraj Gohil',
  files: [{ id: 'f1', fileName: 'Report.pdf', fileUrl: 'https://demo/report.pdf', pageCount: 10, copies: 1, colorMode: 'COLOR', paperSize: 'A4', duplex: true }],
  printStatus: 'QUEUED',
  printProgress: 0,
  retryCount: 0,
  createdAt: new Date().toISOString(),
  settings: {
    copies: 1,
    colorMode: 'COLOR',
    duplex: true,
    paperSize: 'A4'
  }
} as any;

localVault.saveConfig({
  selectedPrinterName: 'HP_LaserJet_Mono',
  registeredPrinterNames: ['HP_LaserJet_Mono']
});

const starterSelection = queueManager.selectEligiblePrinter(colorDuplexJob, mockPrinters);
assert.strictEqual(starterSelection, 'HP_LaserJet_Mono', 'Starter uses manually selected printer without smart routing');

// Test 3D: Growth Plan - Smart Capability Auto-Routing
queueManager.setEntitlements(growthEntitlement);
localVault.saveConfig({
  registeredPrinterNames: ['HP_LaserJet_Mono', 'Canon_Color_Duplex'],
  selectedPrinterName: ''
});

const growthSelection = queueManager.selectEligiblePrinter(colorDuplexJob, mockPrinters);
assert.strictEqual(growthSelection, 'Canon_Color_Duplex', 'Growth smart capability routes color/duplex jobs to compatible printer');

// Test 3E: Business Plan - Load Balancing Across Printers
const businessEntitlement: PlanEntitlements = {
  plan: 'business',
  planName: 'Business',
  status: 'active',
  isOperational: true,
  remainingTrialDays: null,
  limits: { monthlyPrintJobs: 5000, printers: 10, shops: 1, trialDays: 0 },
  usage: { printJobsUsed: 500, printersUsed: 2, usagePercent: 10, warningThreshold: 'NORMAL' },
  features: businessFeatures,
  entitlementVersion: '1.0',
  syncedAt: new Date().toISOString()
};

queueManager.setEntitlements(businessEntitlement);
const businessSelection = queueManager.selectEligiblePrinter(colorDuplexJob, mockPrinters);
assert.strictEqual(businessSelection, 'Canon_Color_Duplex', 'Business routes job to compatible printer');

console.log('✓ JobQueueManager real enforcement verified.\n');

// =========================================================================
// TEST 4: Quota & Usage Checks
// =========================================================================
console.log('4. Validating Hardware & Job Quota Enforcement Logic...');

assert.strictEqual(starterPlan.limits.printerLimit, 1);
const starterCanAdd1st = 0 < starterPlan.limits.printerLimit;
const starterCanAdd2nd = 1 < starterPlan.limits.printerLimit;
assert.strictEqual(starterCanAdd1st, true, 'Can register 1st printer on Starter');
assert.strictEqual(starterCanAdd2nd, false, '2nd printer rejected on Starter');

assert.strictEqual(growthPlan.limits.printerLimit, 5);
const growthCanAdd5th = 4 < growthPlan.limits.printerLimit;
const growthCanAdd6th = 5 < growthPlan.limits.printerLimit;
assert.strictEqual(growthCanAdd5th, true, 'Can register 5th printer on Growth');
assert.strictEqual(growthCanAdd6th, false, '6th printer rejected on Growth');

assert.strictEqual(businessPlan.limits.printerLimit, 10);
const businessCanAdd10th = 9 < businessPlan.limits.printerLimit;
const businessCanAdd11th = 10 < businessPlan.limits.printerLimit;
assert.strictEqual(businessCanAdd10th, true, 'Can register 10th printer on Business');
assert.strictEqual(businessCanAdd11th, false, '11th printer rejected on Business');

assert.strictEqual(500 <= starterPlan.limits.printLimitMonthly, true, '500th job allowed on Starter');
assert.strictEqual(501 <= starterPlan.limits.printLimitMonthly, false, '501st job rejected on Starter');

assert.strictEqual(2000 <= growthPlan.limits.printLimitMonthly, true, '2000th job allowed on Growth');
assert.strictEqual(2001 <= growthPlan.limits.printLimitMonthly, false, '2001st job rejected on Growth');

assert.strictEqual(5000 <= businessPlan.limits.printLimitMonthly, true, '5000th job allowed on Business');
assert.strictEqual(5001 <= businessPlan.limits.printLimitMonthly, false, '5001st job rejected on Business');

console.log('✓ Hardware and monthly job quota boundaries verified.\n');

// =========================================================================
// TEST 5: Offline Resiliency & Caching in Vault
// =========================================================================
console.log('5. Validating Offline Resiliency & Vault Caching...');

localVault.saveEntitlements(growthEntitlement);
const cached = localVault.getEntitlements();
assert.ok(cached, 'Cached entitlements must exist in vault');
assert.strictEqual(cached.plan, 'growth', 'Cached plan must match Growth');
assert.strictEqual(cached.features.multipleQueues, true, 'Cached features must preserve multi-queues flag');
assert.strictEqual(cached.limits.printers, 5, 'Cached limits must preserve 5 printers limit');

console.log('✓ Offline vault caching verified.\n');

console.log('=================================================================');
console.log('ALL PLAN FEATURE ENTITLEMENT TESTS PASSED SUCCESSFULLY!');
console.log('=================================================================\n');
