import assert from 'node:assert/strict';
import { PrintJobItem, PrinterQueueState } from '../print-agent/src/renderer/types/agent';
import { JobQueueManager } from '../print-agent/src/main/queue/JobQueueManager';

console.log('=== TEST SUITE: Multi-Printer Queue Management System ===');

// Mock ApiClient
const mockApiClient: any = {
  claimJob: async (id: string) => ({ success: true, job: { id } }),
  downloadDocument: async (jobId: string, url: string) => ({ success: true, filePath: 'C:\\Temp\\mock.pdf' }),
  updateJobStatus: async () => ({ success: true })
};

// Mock WindowsPrinterManager
const mockPrinters = [
  {
    name: 'HP_LaserJet_P1007',
    displayName: 'HP LaserJet P1007',
    isOnline: true,
    isDefault: true,
    status: 'READY' as const,
    driverName: 'HP LaserJet P1007',
    portName: 'USB001',
    capabilities: { paperSizes: ['A4', 'LETTER'], supportsColor: false, supportsDuplex: false }
  },
  {
    name: 'Canon_IR2525_Network',
    displayName: 'Canon IR2525 (Office)',
    isOnline: true,
    isDefault: false,
    status: 'READY' as const,
    driverName: 'Canon IR2525 UFRII',
    portName: '192.168.1.120',
    capabilities: { paperSizes: ['A4', 'A3', 'LETTER'], supportsColor: true, supportsDuplex: true }
  },
  {
    name: 'HP_LaserJet_P1007_Alias',
    displayName: 'HP LaserJet P1007 (Alias Front Desk)',
    isOnline: true,
    isDefault: false,
    status: 'READY' as const,
    driverName: 'HP LaserJet P1007',
    portName: 'USB001', // Same physical port as HP_LaserJet_P1007!
    capabilities: { paperSizes: ['A4'], supportsColor: false, supportsDuplex: false }
  }
];

const mockPrinterManager: any = {
  getCachedPrinters: () => mockPrinters,
  spoolJob: async () => ({ success: true, submitted: true, spoolerJobId: 101 })
};

// Instantiate JobQueueManager
const queueManager = new JobQueueManager(mockApiClient, mockPrinterManager);

// 1. Validate Physical Device Identification for Aliases
const hwId1 = queueManager.getPhysicalDeviceId('HP_LaserJet_P1007');
const hwId2 = queueManager.getPhysicalDeviceId('HP_LaserJet_P1007_Alias');
const hwIdCanon = queueManager.getPhysicalDeviceId('Canon_IR2525_Network');

assert.equal(hwId1, 'HW:HP LASERJET P1007:USB001');
assert.equal(hwId2, 'HW:HP LASERJET P1007:USB001');
assert.equal(hwId1, hwId2, 'Logical printer aliases on same USB port share physical device lock ID');
assert.notEqual(hwId1, hwIdCanon, 'Different physical printers have distinct physical device lock IDs');
console.log('✓ Physical device lock key matching test passed.');

// 2. Validate Multi-Printer Queue States
const initialQueues = queueManager.getPrinterQueues();
assert.equal(initialQueues.length, 3);
assert.equal(initialQueues[0].isQueuePaused, false);
assert.equal(initialQueues[0].waitingQueue.length, 0);
console.log('✓ Multi-printer queue discovery initialized successfully.');

// 3. Pause & Resume Individual Printer Queue
queueManager.pausePrinterQueue('HP_LaserJet_P1007');
const pausedQueues = queueManager.getPrinterQueues();
const hpQueue = pausedQueues.find(q => q.printerName === 'HP_LaserJet_P1007');
assert.equal(hpQueue?.isQueuePaused, true);
assert.equal(hpQueue?.status, 'PAUSED');

// 4. Test Enqueueing into Paused Queue (Job stays in WAITING queue)
const mockJob1: PrintJobItem = {
  id: 'JOB-101',
  orderCode: 'PF-101',
  shopId: 'SHOP-1',
  customerName: 'Alice',
  files: [{ id: 'f1', fileName: 'Resume.pdf', pageCount: 2, copies: 1, colorMode: 'BW', paperSize: 'A4', duplex: false }],
  totalAmount: 10,
  paymentStatus: 'SUCCESS',
  printStatus: 'QUEUED',
  printerName: 'HP_LaserJet_P1007',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const mockJob2: PrintJobItem = {
  id: 'JOB-102',
  orderCode: 'PF-102',
  shopId: 'SHOP-1',
  customerName: 'Bob',
  files: [{ id: 'f2', fileName: 'Notes.pdf', pageCount: 5, copies: 1, colorMode: 'BW', paperSize: 'A4', duplex: false }],
  totalAmount: 15,
  paymentStatus: 'SUCCESS',
  printStatus: 'QUEUED',
  printerName: 'HP_LaserJet_P1007',
  createdAt: new Date(Date.now() + 1000).toISOString(),
  updatedAt: new Date(Date.now() + 1000).toISOString()
};

queueManager.enqueueJobs([mockJob1, mockJob2]);
const queuesWithPausedJobs = queueManager.getPrinterQueues();
const hpPausedQueue = queuesWithPausedJobs.find(q => q.printerName === 'HP_LaserJet_P1007');

assert.ok(hpPausedQueue?.waitingQueue.length! >= 1, 'Waiting queue contains jobs while paused');
assert.equal(hpPausedQueue?.waitingQueue[0].queuePosition, 1, 'First waiting job has queue position 1');
console.log('✓ Per-printer queue isolation and waiting position assignment test passed.');

// Resume queue
queueManager.resumePrinterQueue('HP_LaserJet_P1007');
const hpResumedQueue = queueManager.getPrinterQueues().find(q => q.printerName === 'HP_LaserJet_P1007');
assert.equal(hpResumedQueue?.isQueuePaused, false);
console.log('✓ Pause and Resume per-printer queue controls test passed.');

console.log('✓ All Multi-Printer Queue tests completed successfully.');
