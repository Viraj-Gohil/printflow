export type Role = 'ADMIN' | 'SHOP_OWNER';
export type UserRole = Role;

export type ShopStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';
export type FileStatus = 'UPLOADING' | 'UPLOADED' | 'VERIFIED' | 'FAILED';

export type PaymentStatus = 
  | 'PENDING' 
  | 'SUCCESS' 
  | 'DEMO_SUCCESS'
  | 'FAILED' 
  | 'REFUND_PENDING' 
  | 'REFUNDED';

export type PrintStatus = 
  | 'CREATED' 
  | 'QUEUED' 
  | 'ASSIGNED' 
  | 'DOWNLOADING' 
  | 'PRINTING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'PRINT_INTERRUPTED' 
  | 'REQUIRES_ATTENTION' 
  | 'CANCELLED';

export type PaperSize =
  | 'A4'
  | 'A3'
  | 'A5'
  | 'A6'
  | 'A2'
  | 'A1'
  | 'A0'
  | 'Legal'
  | 'Letter'
  | 'Executive'
  | 'Custom Size'
  | string;
export type PrintColor = 'BW' | 'COLOR';
export type ColorMode = PrintColor;
export type PrintSides = 'SINGLE' | 'DOUBLE';
export type PageSides = PrintSides;
export type PrintOrientation = 'PORTRAIT' | 'LANDSCAPE';
export type PageOrientation = PrintOrientation;
export type PageSelection = 'ALL' | 'CUSTOM';
export type PagesPerSheet = 1 | 2 | 4 | 6 | 9;

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  shopId?: string; // If SHOP_OWNER
  password?: string;
  avatarUrl?: string;
  createdAt: string;
  isMfaEnabled?: boolean;
  mfaSecret?: string;
  hashedRecoveryCodes?: string[];
  mfaEnrolledAt?: string;
}

export interface ShopRazorpaySettings {
  enabled: boolean;
  isTestMode: boolean;
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  upiId?: string;
  autoCapture?: boolean;
  receiptPrefix?: string;
  lastVerifiedAt?: string;
}

export interface AdminRazorpaySettings {
  enabled: boolean;
  isTestMode: boolean;
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  currency: 'INR' | 'USD';
  platformFeePercent: number;
  lastVerifiedAt?: string;
}

export interface Shop {
  id: string;
  organizationId?: string;
  name: string;
  slug: string;
  tagline?: string;
  ownerId?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  phone?: string;
  email?: string;
  status: ShopStatus;
  isOpen?: boolean;
  planId: string;
  planName: string;
  currentPlanId?: string;
  address: string;
  city: string;
  businessHours: string;
  minimumOrder?: number;
  minOrderAmount?: number;
  autoAccept?: boolean;
  fileRetentionDays?: number;
  logoUrl?: string;
  primaryColor?: string;
  createdAt: string;
  razorpaySettings: ShopRazorpaySettings;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayUpiId?: string;
  razorpayEnabled?: boolean;
  razorpayTestMode?: boolean;
}

export interface PricingRule {
  id: string;
  shopId: string;
  paperSize: PaperSize;
  customWidth?: number;
  customHeight?: number;
  unit?: 'mm' | 'inch';
  color?: PrintColor;
  colorMode?: ColorMode;
  sides: PrintSides;
  pricePerPage: number;
  currency?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FilePrintConfig {
  id: string;
  name?: string;
  fileName: string;
  fileSize: number;
  size?: number;
  fileType: string;
  type?: string;
  previewUrl?: string;
  storagePath?: string;
  pageCount?: number;
  estimatedPages: number;
  paperSize: PaperSize;
  color?: PrintColor;
  colorMode?: ColorMode;
  sides: PrintSides;
  orientation: PrintOrientation;
  copies: number;
  pageSelection: PageSelection;
  customPageRange?: string;
  customRange?: string;
  pagesPerSheet: PagesPerSheet;
  unitPrice: number;
  pricePerPage?: number;
  totalPrice: number;
  itemTotal?: number;
  isIdCardMerge?: boolean;
  frontPreviewUrl?: string;
  backPreviewUrl?: string;
  idCardType?: string;
}
export type PrintFileItem = FilePrintConfig;

export interface PrintJob {
  id: string;
  orderCode?: string;
  trackingToken: string;
  shopId: string;
  shopName: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  files: FilePrintConfig[];
  totalAmount: number;
  fileStatus?: FileStatus;
  paymentStatus: PaymentStatus;
  printStatus: PrintStatus;
  paymentMethod: string;
  paymentId?: string;
  retrySafe?: boolean;
  pagesPrinted?: number;
  assignedPrinterId?: string;
  assignedPrinterName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface PrinterDevice {
  id: string;
  shopId: string;
  agentManaged?: boolean;
  deviceId: string;
  name: string;
  model: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'PAUSED';
  capabilities: {
    paperSizes: PaperSize[];
    supportsColor?: boolean;
    supportsDuplex?: boolean;
    color?: boolean;
    duplex?: boolean;
  };
  priority: number;
  isEnabled: boolean;
  lastSeen: string;
  createdAt?: string;
}
export type Printer = PrinterDevice;

export interface ElectronAgent {
  id: string;
  shopId: string;
  shopName: string;
  deviceName: string;
  version?: string;
  agentVersion?: string;
  status: 'ONLINE' | 'OFFLINE';
  lastSeen: string;
  connectedPrintersCount?: number;
  printerCount?: number;
  lastSync?: string;
  authToken?: string;
  ipAddress?: string;
  apiToken?: string;
  createdAt?: string;
}
export type DeviceAgent = ElectronAgent;

export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type PlanChangePolicy = 'NEW_ONLY' | 'AT_RENEWAL' | 'IMMEDIATE';

export interface PlanFeatureEntitlements {
  qrPrinting: boolean;
  multiFileUpload: boolean;
  automatedQueue: boolean;
  multiplePrinters: boolean;
  smartPrinterSelection: boolean;
  analytics: boolean;
  customBranding: boolean;
  staffManagement: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

export interface SaasPlan {
  id: string;
  slug?: string;
  name: string;
  tagline: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  isFree?: boolean;
  billingInterval?: 'MONTHLY' | 'YEARLY' | 'BOTH';
  trialDays?: number;
  taxInclusive?: boolean;
  status?: PlanStatus;
  isActive: boolean;
  displayOrder?: number;
  adminNotes?: string;

  currency?: string;
  isPublic?: boolean;
  sortOrder?: number;
  limits?: {
    printLimitMonthly?: number;
    printerLimit?: number;
    storageLimitMb?: number;
    staffLimit?: number;
    maxUploadSizeMb?: number;
    fileRetentionHours?: number;
    [key: string]: any;
  };

  // Quotas (Strictly Single Independent Shop Architecture)
  printLimitMonthly?: number;
  printLimit?: number;
  isUnlimitedPrintJobs?: boolean;
  printerLimit: number;
  isUnlimitedPrinters?: boolean;
  storageLimitMb?: number;
  storageLimitGb?: number;
  isUnlimitedStorage?: boolean;
  staffLimit?: number;
  isUnlimitedStaff?: boolean;
  maxUploadSizeMb?: number;
  fileRetentionHours?: number;

  // Features
  features: string[];
  featureEntitlements?: Partial<PlanFeatureEntitlements>;
  isPopular?: boolean;
  version?: number;
  updatedAt?: string;
  createdAt?: string;
}
export type SaaSPlan = SaasPlan;

export interface Subscription {
  id: string;
  shopId: string;
  shopName: string;
  planId: string;
  planName: string;
  status: 'ACTIVE' | 'EXPIRED' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED';
  billingPeriod: 'MONTHLY' | 'YEARLY';
  amount?: number;
  amountPaid?: number;
  currency?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  jobsUsedThisMonth?: number;
  storageUsedMb?: number;
  devicesUsed?: number;
  staffUsed?: number;
  paymentId?: string;
  paymentStatus?: 'PAID' | 'PENDING' | 'FAILED';
  autoRenew?: boolean;
  planSnapshot?: Partial<SaasPlan>;
  createdAt?: string;
  updatedAt?: string;
}
export type ShopSubscription = Subscription;

export interface PlatformPolicies {
  defaultFileRetentionHours: number;
  maxAllowedUploadSizeMb: number;
  globalRateLimitPerMin: number;
  trialDurationDays: number;
  trialPerShopEligibility: boolean;
  failedPaymentGracePeriodDays: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  overagePolicy: 'BLOCK_PRINTS' | 'SOFT_WARNING';
  cancellationPolicy: 'END_OF_CYCLE' | 'IMMEDIATE';
  updatedAt?: string;
  updatedBy?: string;
}

export interface Transaction {
  id: string;
  orderId: string;
  orderCode?: string;
  shopId: string;
  shopName: string;
  customerName?: string;
  amount: number;
  platformFee?: number;
  netAmount?: number;
  status: PaymentStatus;
  paymentMethod?: string;
  paymentGateway?: 'RAZORPAY' | 'DEMO';
  gatewayPaymentId?: string;
  type?: 'PRINT_JOB' | 'PRINT_ORDER' | 'SAAS_SUBSCRIPTION';
  createdAt: string;
  gatewayReference?: string;
}
export type PaymentTransaction = Transaction;

export interface PlatformSettings {
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  razorpayTestMode: boolean;
  currency: string;
  platformFeePercent: number;
  supportEmail: string;
  autoShopApproval: boolean;
  fileRetentionHoursDefault: number;
}

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | 'MEDIUM';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_SHOP' | 'WAITING_INTERNAL' | 'RESOLVED' | 'CLOSED';
export type TicketCategory =
  | 'PRINTING_ISSUE'
  | 'PRINTER_OFFLINE'
  | 'JOB_FAILURE'
  | 'PAYMENT_REFUND'
  | 'SUBSCRIPTION_BILLING'
  | 'QR_CODE'
  | 'FILE_UPLOAD'
  | 'ACCOUNT_LOGIN'
  | 'FEATURE_REQUEST'
  | 'OTHER'
  | 'AGENT'
  | 'BILLING'
  | 'HARDWARE'
  | 'GENERAL';

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: 'ADMIN' | 'SHOP_OWNER' | 'SYSTEM';
  message: string;
  isInternalNote: boolean;
  createdAt: string;
  attachments?: Array<{ name: string; size: number; url?: string; type?: string }>;
}

export interface SupportTicketHistoryEntry {
  id: string;
  ticketId: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  previousValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber?: string;
  shopId: string;
  shopName: string;
  subject: string;
  description?: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedAdminId?: string;
  assignedAdminName?: string;
  assignedAdminEmail?: string;
  relatedJobId?: string;
  relatedPaymentId?: string;
  message?: string;
  tags?: string[];
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  slaFirstResponseDeadline?: string;
  slaResolutionDeadline?: string;
  isSlaBreached?: boolean;
  messages?: SupportTicketMessage[];
  history?: SupportTicketHistoryEntry[];
  createdAt: string;
  updatedAt?: string;
}

export interface SupportSettings {
  autoAssignEnabled: boolean;
  defaultAssigneeId?: string;
  emailNotifications: boolean;
  slaPolicies: {
    LOW: { responseHours: number; resolveHours: number };
    NORMAL: { responseHours: number; resolveHours: number };
    HIGH: { responseHours: number; resolveHours: number };
    CRITICAL: { responseHours: number; resolveHours: number };
  };
  businessHoursOnly: boolean;
  supportEmail: string;
  escalationEmail: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entityType: 'SHOP' | 'JOB' | 'SUBSCRIPTION' | 'PAYMENT' | 'SETTING' | 'SETTINGS' | 'AGENT' | 'PRINT_JOB' | 'PRINTER' | 'TICKET' | 'USER' | 'SECURITY';
  entityId: string;
  details?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  targetRole: 'ALL' | 'SHOP_OWNER' | 'ADMIN';
  createdAt: string;
  read?: boolean;
}
