import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp, EMPTY_SHOP } from '../../lib/store';
import { PaperSize, FilePrintConfig, PrintJob, PagesPerSheet, Shop, PricingRule } from '../../types/index';
import { resolveUnitPrice } from '../../lib/utils/pricing';
import {
  Upload,
  FileText,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Check,
  Printer,
  ShieldCheck,
  RotateCw,
  ImageIcon,
  CheckCircle2,
  Lock,
  Copy,
  AlertCircle,
  AlertTriangle,
  Eye,
  Edit3,
  ChevronDown,
  ChevronUp,
  Minus,
  X,
  CreditCard,
  Layers,
  Camera,
  ExternalLink,
  Key,
  Zap,
  Search,
  Files,
  GripVertical,
  HelpCircle
} from 'lucide-react';
import { validatePhone, validatePageRange } from '../../lib/validation';
import { ContinuousPdfViewer } from './ContinuousPdfViewer';
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}
import { PDFDocument } from 'pdf-lib';
import {
  loadRazorpayScript,
  DEFAULT_RAZORPAY_TEST_KEY,
  isRealRazorpayKey,
  getEffectiveRazorpayKey,
  generateRazorpayPaymentId,
  createRazorpayOrder,
  verifyRazorpayPayment,
  checkRazorpayOrderStatus,
  reconcileRazorpayPayment
} from '../../lib/razorpay';
import { apiUrl } from '../../lib/apiConfig';
import { CustomerErrorModal } from './CustomerErrorModal';
import { validateClientDocument, DocumentValidationError } from '../../lib/validation/documentValidation';

interface CustomerPrintFlowProps {
  shopSlug: string;
}

interface UploadingItem {
  id: string;
  name: string;
  size: number;
  progress: number;
}

const MAX_PRINT_JOB_FILE_BYTES = 50 * 1024 * 1024;

const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(chunks.join(''));
};

export const CustomerPrintFlow: React.FC<CustomerPrintFlowProps> = ({ shopSlug }) => {
  const { shops, activeShop, pricingRules, createPrintJob, updateShopRazorpay, navigate, showToast } = useApp();

  const [remoteShop, setRemoteShop] = useState<Shop | null>(null);
  const [remotePricingRules, setRemotePricingRules] = useState<PricingRule[] | null>(null);
  const [isLoadingPublicShop, setIsLoadingPublicShop] = useState<boolean>(false);
  const [publicShopError, setPublicShopError] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState<{ enabled: boolean; message: string; scope: string } | null>(null);

  const [agentStatus, setAgentStatus] = useState<{
    isAvailable: boolean;
    reason: string;
    message: string;
    agentOnline: boolean;
    printerReady: boolean;
    readyPrintersCount?: number;
    readyPrinters?: string[];
  } | null>(null);
  const [isCheckingAgentStatus, setIsCheckingAgentStatus] = useState<boolean>(false);
  const [isManualCheckingStatus, setIsManualCheckingStatus] = useState<boolean>(false);
  const [alternativeShops, setAlternativeShops] = useState<Array<{ id: string; name: string; slug: string; isAvailable?: boolean }>>([]);

  const [customerErrorModal, setCustomerErrorModal] = useState<DocumentValidationError | null>(null);

  const [shopCapabilities, setShopCapabilities] = useState<{
    supportedPaperSizes: string[];
    effectivePaperSizes?: Array<{ name: string; widthMm?: number; heightMm?: number }>;
    hasColorPrinter: boolean;
    hasDuplexPrinter: boolean;
    hasMonochromePrinter: boolean;
    isReadyForPrinting: boolean;
    validCombinations?: Array<{
      paperSize: string;
      colorMode: 'BW' | 'COLOR';
      duplex: boolean;
    }>;
    options?: {
      color: { supported: boolean; reason?: string };
      duplex: { supported: boolean; reason?: string };
      paperSizes: Array<{ name: string; supported: boolean; reason?: string }>;
    };
  } | null>(null);

  const isCombinationValid = React.useCallback(
    (paperSize: string, colorMode: 'BW' | 'COLOR', duplex: boolean): { isValid: boolean; reason?: string } => {
      if (!shopCapabilities) return { isValid: true };
      if (!shopCapabilities.isReadyForPrinting) {
        return { isValid: false, reason: 'No registered online printers are currently available at this shop.' };
      }

      // 1. Check color support
      if (colorMode === 'COLOR' && !shopCapabilities.hasColorPrinter) {
        return { isValid: false, reason: 'Colour printing is currently unavailable at this shop.' };
      }

      // 2. Check duplex support
      if (duplex && !shopCapabilities.hasDuplexPrinter) {
        return { isValid: false, reason: 'Double-sided printing is currently unavailable at this shop.' };
      }

      // 3. Multi-printer combinations check
      if (Array.isArray(shopCapabilities.validCombinations) && shopCapabilities.validCombinations.length > 0) {
        const normSize = (paperSize || 'A4').toUpperCase();
        const matches = shopCapabilities.validCombinations.some(
          (c) => c.paperSize.toUpperCase() === normSize && c.colorMode === colorMode && c.duplex === duplex
        );
        if (!matches) {
          if (colorMode === 'COLOR') {
            return {
              isValid: false,
              reason: `Colour printing is not available for ${paperSize} with ${duplex ? 'double-sided' : 'single-sided'} mode.`
            };
          }
          if (duplex) {
            return {
              isValid: false,
              reason: `Double-sided printing is not available for ${paperSize} at this shop.`
            };
          }
          return {
            isValid: false,
            reason: `The option combination (${paperSize}, ${colorMode}, ${duplex ? 'Double-sided' : 'Single-sided'}) is not available on any online printer.`
          };
        }
      }

      return { isValid: true };
    },
    [shopCapabilities]
  );

  const fetchCapabilities = React.useCallback(async (targetSlugOrId?: string) => {
    const queryTarget = targetSlugOrId || shopSlug || remoteShop?.slug || activeShop?.slug || activeShop?.id;
    if (!queryTarget) return;
    try {
      const res = await fetch(apiUrl(`/api/public/shops/${encodeURIComponent(queryTarget)}/capabilities`));
      const data = await res.json();
      if (data.success && data.capabilities) {
        setShopCapabilities(data.capabilities);
      }
    } catch {
      // Fail gracefully
    }
  }, [shopSlug, remoteShop?.slug, activeShop?.slug, activeShop?.id]);

  const checkAgentAvailability = React.useCallback(async (targetSlugOrId?: string) => {
    const queryTarget = targetSlugOrId || shopSlug || remoteShop?.slug || activeShop?.slug || activeShop?.id;
    if (!queryTarget) return null;
    setIsCheckingAgentStatus(true);
    try {
      void fetchCapabilities(queryTarget);
      const res = await fetch(apiUrl(`/api/public/shops/${encodeURIComponent(queryTarget)}/agent-status`));
      const data = await res.json();
      if (data.success && data.availability) {
        setAgentStatus(data.availability);
        return data.availability;
      }
    } catch {
      // Fail gracefully
    } finally {
      setIsCheckingAgentStatus(false);
    }
    return null;
  }, [shopSlug, remoteShop?.slug, activeShop?.slug, activeShop?.id, fetchCapabilities]);

  const handleManualRefreshStatus = async () => {
    if (isManualCheckingStatus || isCheckingAgentStatus) return;
    setIsManualCheckingStatus(true);
    try {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2000));
      const [freshStatus] = await Promise.all([
        checkAgentAvailability(),
        minDelay
      ]);
      if (freshStatus && freshStatus.isAvailable) {
        showToast('Shop Online', 'This print shop is online and ready for printing.', 'success', 3000);
      }
    } catch {
      // Gracefully handled
    } finally {
      setIsManualCheckingStatus(false);
    }
  };

  useEffect(() => {
    void checkAgentAvailability();
    const timer = setInterval(() => {
      void checkAgentAvailability();
    }, 10000);
    return () => clearInterval(timer);
  }, [checkAgentAvailability]);

  // Load alternative online shops if current shop is offline
  useEffect(() => {
    if (agentStatus && !agentStatus.isAvailable) {
      fetch(apiUrl('/api/public/shops'))
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.shops)) {
            setAlternativeShops(
              data.shops.filter((s: any) => s.slug !== shopSlug && s.id !== remoteShop?.id && s.isAvailable)
            );
          }
        })
        .catch(() => {});
    } else {
      setAlternativeShops([]);
    }
  }, [agentStatus, shopSlug, remoteShop?.id]);

  useEffect(() => {
    fetch(apiUrl('/api/maintenance/status'))
      .then(res => res.json())
      .then(data => {
        if (data.success && data.maintenance && data.maintenance.enabled) {
          if (data.maintenance.scope === 'entire_application' || data.maintenance.scope === 'customer_facing') {
            setMaintenanceMode(data.maintenance);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPublicShopData() {
      if (!shopSlug) return;
      setIsLoadingPublicShop(true);
      setPublicShopError(null);
      try {
        const res = await fetch(apiUrl(`/api/public/shops/${encodeURIComponent(shopSlug)}`));
        const data = await res.json();
        if (!res.ok || !data.success || !data.shop) {
          throw new Error(data.error || 'Shop not found in database.');
        }
        if (cancelled) return;
        const fetchedShop = data.shop as Shop;
        setRemoteShop(fetchedShop);

        // Fetch pricing rules for this shop directly from Neon
        const rulesRes = await fetch(apiUrl(`/api/shops/${encodeURIComponent(fetchedShop.id)}/pricing`));
        const rulesData = await rulesRes.json();
        if (rulesRes.ok && rulesData.success && Array.isArray(rulesData.rules)) {
          if (!cancelled) {
            setRemotePricingRules(rulesData.rules.map((r: any) => ({
              id: r.id,
              shopId: fetchedShop.id,
              paperSize: r.paperSize,
              color: r.colorMode,
              sides: r.sides,
              pricePerPage: r.pricePerPageMinor / 100,
              currency: 'INR',
              isActive: r.isActive
            })));
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn('[CustomerPrintFlow] Public shop lookup notice:', err?.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPublicShop(false);
        }
      }
    }
    loadPublicShopData();
    return () => { cancelled = true; };
  }, [shopSlug]);

  const shop = remoteShop || shops.find((s) => s.slug === shopSlug) || shops[0] || activeShop || EMPTY_SHOP;
  const effectivePricingRules = remotePricingRules || pricingRules;

  // Dynamically derive active paper sizes configured for this shop
  const activeShopSizes = React.useMemo(() => {
    const targetShopId = shop?.id || activeShop?.id || EMPTY_SHOP.id;
    const shopActiveRules = effectivePricingRules.filter(
      (r) => (r.shopId === targetShopId || (remoteShop && r.shopId === remoteShop.id)) && (r.isActive ?? true)
    );
    const sizeSet = new Set<string>();
    shopActiveRules.forEach((r) => sizeSet.add(r.paperSize));
    // Always ensure A4 is in the list
    sizeSet.add('A4');

    if (shopCapabilities && Array.isArray(shopCapabilities.supportedPaperSizes) && shopCapabilities.supportedPaperSizes.length > 0) {
      const allowedUpper = shopCapabilities.supportedPaperSizes.map((s) => s.toUpperCase());
      const filtered = Array.from(sizeSet).filter((s) => allowedUpper.includes(s.toUpperCase()));
      return filtered.length > 0 ? filtered : ['A4'];
    }

    return Array.from(sizeSet);
  }, [effectivePricingRules, shop?.id, remoteShop, activeShop?.id, shopCapabilities]);

  // 3-step state: 1. Upload, 2. Review, 3. Pay, 4. Tracking
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [files, setFiles] = useState<FilePrintConfig[]>([]);
  const sourceFilesRef = React.useRef(new Map<string, File>());
  const dispatchingOrdersRef = React.useRef(new Set<string>());
  const completedOrdersRef = React.useRef(new Set<string>());

  // Upload loading queue
  const [uploadingQueue, setUploadingQueue] = useState<UploadingItem[]>([]);

  // Expanded files state (which file accordions have settings open)
  const [expandedFileIds, setExpandedFileIds] = useState<Record<string, boolean>>({});

  // Document preview modal
  const [previewFile, setPreviewFile] = useState<FilePrintConfig | null>(null);

  // Help modal
  const [helpOpen, setHelpOpen] = useState(false);

  // Validation & error states
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [phoneTouched, setPhoneTouched] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  // Payment processing & transaction state
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [activeJob, setActiveJob] = useState<PrintJob | null>(null);
  const [paymentFailedState, setPaymentFailedState] = useState<{
    status: 'FAILED' | 'CANCELLED';
    message: string;
  } | null>(null);
  const [paymentPendingState, setPaymentPendingState] = useState<{
    status: 'PENDING';
    orderId: string;
    message: string;
    kind?: 'PAYMENT' | 'DISPATCH';
    paymentId?: string;
  } | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [razorpayError, setRazorpayError] = useState<string | null>(null);

  const pollingTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const activeRzpInstanceRef = React.useRef<any>(null);

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  useEffect(() => {
    if (
      !activeJob?.trackingToken ||
      ['COMPLETED', 'CANCELLED', 'REQUIRES_ATTENTION'].includes(activeJob.printStatus) ||
      (activeJob.printStatus === 'FAILED' && activeJob.retrySafe !== true)
    ) {
      return;
    }
    let cancelled = false;
    const refreshStatus = async () => {
      try {
        const response = await fetch(
          `/api/customer/print-jobs/${encodeURIComponent(activeJob.id)}/status`,
          { cache: 'no-store', headers: { 'x-print-tracking-token': activeJob.trackingToken } }
        );
        const data = await response.json() as {
          success?: boolean;
          job?: {
            printStatus?: PrintJob['printStatus'];
            updatedAt?: string;
            printerName?: string;
            errorMessage?: string;
            retrySafe?: boolean;
          };
        };
        if (!response.ok || !data.success || !data.job?.printStatus || cancelled) return;
        setActiveJob((previous) => previous?.id === activeJob.id
          ? {
              ...previous,
              printStatus: data.job!.printStatus!,
              updatedAt: data.job!.updatedAt || previous.updatedAt,
              assignedPrinterName: data.job!.printerName || previous.assignedPrinterName,
              notes: data.job!.errorMessage || previous.notes,
              retrySafe: data.job!.retrySafe
            }
          : previous);
      } catch {
        // Keep showing the last confirmed status while the backend is unreachable.
      }
    };
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJob?.id, activeJob?.trackingToken, activeJob?.printStatus, activeJob?.retrySafe]);

  const fileInputId = 'customer-file-upload-input';

  const stepVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } }
  };

  const calculateUnitPrice = (size: PaperSize, color: 'BW' | 'COLOR', sides: 'SINGLE' | 'DOUBLE') => {
    return resolveUnitPrice(effectivePricingRules, shop?.id || EMPTY_SHOP.id, size, color, sides);
  };

  const countPages = (config: Partial<FilePrintConfig>) => {
    if (config.pageSelection === 'CUSTOM' && config.customRange) {
      const check = validatePageRange(config.customRange, config.estimatedPages || 1);
      if (check.isValid && check.parsedPages && check.parsedPages.length > 0) {
        return check.parsedPages.length;
      }
    }
    return config.estimatedPages || 1;
  };

  const calculateFileTotal = (config: Partial<FilePrintConfig>) => {
    const pages = countPages(config);
    const copies = config.copies || 1;
    const rate = config.unitPrice || 2.0;
    return Math.round(pages * copies * rate);
  };

  // Prepare selected documents for secure upload after payment verification.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (maintenanceMode) {
      showToast('Maintenance Active', 'System is under maintenance. File uploads are disabled.', 'error', 4000);
      return;
    }
    if (agentStatus && !agentStatus.isAvailable) {
      showToast('Shop Offline', agentStatus.message || 'This print shop is currently offline. File uploads are disabled.', 'error', 5000);
      return;
    }
    setUploadError(null);
    setStepError(null);
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      // Perform deep client-side binary magic byte & format validation
      const validation = await validateClientDocument(file);
      if (!validation.isValid && validation.error) {
        setCustomerErrorModal(validation.error);
        // Do not upload or add to queue, but allow other valid selected files to proceed
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    // Set initial loading queue
    const queueItems: UploadingItem[] = validFiles.map((file, i) => ({
      id: `up_${Date.now()}_${i}`,
      name: file.name,
      size: file.size,
      progress: 35
    }));
    setUploadingQueue(queueItems);

    // Keep the preview preparation state responsive while document details are collected.
    setTimeout(() => {
      setUploadingQueue((prev) =>
        prev.map((item) => ({ ...item, progress: 85 }))
      );
    }, 280);

    // Finalize document metadata and previews with exact PDF.js page counting.
    (async () => {
      const newConfigs: FilePrintConfig[] = [];
      const newExpanded: Record<string, boolean> = { ...expandedFileIds };

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        let exactPages = 1;

        if (isPdf) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
            const pdfDoc = await loadingTask.promise;
            exactPages = pdfDoc.numPages || 1;
          } catch (err) {
            console.error('Failed to parse PDF page count:', err);
            exactPages = 1;
          }
        }

        const fileId = `f_${Date.now()}_${i}`;
        sourceFilesRef.current.set(fileId, file);

        const defaultConfig: FilePrintConfig = {
          id: fileId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          previewUrl: file.type.startsWith('image/') || isPdf ? URL.createObjectURL(file) : undefined,
          estimatedPages: exactPages,
          paperSize: 'A4',
          color: 'BW',
          sides: 'SINGLE',
          orientation: 'PORTRAIT',
          copies: 1,
          pageSelection: 'ALL',
          pagesPerSheet: 1,
          unitPrice: 2.0,
          totalPrice: 2.0 * exactPages
        };

        defaultConfig.unitPrice = calculateUnitPrice(defaultConfig.paperSize, defaultConfig.color || 'BW', defaultConfig.sides);
        defaultConfig.totalPrice = calculateFileTotal(defaultConfig);

        newConfigs.push(defaultConfig);
        newExpanded[fileId] = true;
      }

      setFiles((prev) => [...prev, ...newConfigs]);
      setExpandedFileIds(newExpanded);
      setUploadingQueue([]);
    })();

    e.target.value = '';
  };


  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleExpand = (id: string) => {
    setExpandedFileIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const updateFileConfig = (fileId: string, updates: Partial<FilePrintConfig>) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === fileId) {
          const merged = { ...f, ...updates };
          const unitPrice = calculateUnitPrice(merged.paperSize, merged.color || 'BW', merged.sides);
          const totalPrice = calculateFileTotal({ ...merged, unitPrice });
          return { ...merged, unitPrice, totalPrice };
        }
        return f;
      })
    );
  };

  // Pricing breakdown: Customers pay strictly actual printing charges calculated from pricing rules (zero platform/service fee)
  const subtotal = files.reduce((acc, f) => acc + f.totalPrice, 0);
  const serviceFee = 0;
  const grandTotal = subtotal;

  // Proceed from Upload (Step 1) to Review (Step 2)
  const handleProceedToReview = async () => {
    setStepError(null);
    if (files.length === 0) {
      setStepError('Please upload at least one file to continue.');
      return;
    }
    const freshStatus = await checkAgentAvailability();
    if (freshStatus && !freshStatus.isAvailable) {
      setStepError(freshStatus.message || 'This print shop is currently offline. Please try again later or select another available shop.');
      showToast('Shop Offline', freshStatus.message, 'error', 5000);
      return;
    }

    for (const f of files) {
      if (f.pageSelection === 'CUSTOM') {
        const check = validatePageRange(f.customRange || '', f.estimatedPages);
        if (!check.isValid) {
          setExpandedFileIds((prev) => ({ ...prev, [f.id]: true }));
          setStepError(`"${f.fileName}": ${check.error}`);
          return;
        }
      }
    }

    setCurrentStep(2); // Review step
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Proceed from Review (Step 2) to Payment (Step 3)
  const handleProceedToPayment = async () => {
    setStepError(null);
    const freshStatus = await checkAgentAvailability();
    if (freshStatus && !freshStatus.isAvailable) {
      setStepError(freshStatus.message || 'This print shop is currently offline. Please try again later or select another available shop.');
      showToast('Shop Offline', freshStatus.message, 'error', 5000);
      return;
    }

    const totalBytes = files.reduce((total, file) => {
      return total + (sourceFilesRef.current.get(file.id)?.size || 0);
    }, 0);
    if (files.some((file) => !sourceFilesRef.current.has(file.id))) {
      setStepError('Re-upload any merged or generated document as a PDF or image before continuing to payment.');
      return;
    }
    if (totalBytes > MAX_PRINT_JOB_FILE_BYTES) {
      setStepError('The combined size of your print files must be 50 MB or less.');
      return;
    }
    if (files.some((file) => !['A4', 'A3', 'A5', 'Letter', 'Legal'].includes(file.paperSize))) {
      setStepError('The selected paper size is not supported by the connected PrintFlow printer agent.');
      return;
    }
    setCurrentStep(3); // Payment step
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Complete verified payment callback (ONLY invoked upon actual successful transaction)
  const onPaymentSuccess = async (paymentId: string, orderId: string) => {
    if (!orderId || completedOrdersRef.current.has(orderId) || dispatchingOrdersRef.current.has(orderId)) return;
    dispatchingOrdersRef.current.add(orderId);
    setIsProcessingPayment(true);
    setPaymentFailedState(null);
    setPaymentPendingState({
      status: 'PENDING',
      orderId,
      message: 'Payment verified. Sending your files to the shop print queue.',
      kind: 'DISPATCH',
      paymentId
    });

    try {
      const payloadFiles = await Promise.all(files.map(async (file) => {
        const sourceFile = sourceFilesRef.current.get(file.id);
        if (!sourceFile) throw new Error(`The original file for "${file.fileName}" is unavailable. Re-upload it before retrying.`);
        return {
          fileName: sourceFile.name,
          fileType: sourceFile.type,
          fileBase64: await fileToBase64(sourceFile),
          pageCount: countPages(file),
          copies: file.copies,
          colorMode: file.color || 'BW',
          paperSize: file.paperSize,
          duplex: file.sides === 'DOUBLE',
          pagesToPrint: file.pageSelection === 'CUSTOM' ? file.customRange || file.customPageRange : undefined
        };
      }));

      const response = await fetch(apiUrl('/api/customer/print-jobs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentId,
          shopId: shop.id,
          customerName: 'Counter Customer',
          customerPhone: customerPhone.trim(),
          totalAmount: grandTotal,
          files: payloadFiles
        })
      });
      const result = await response.json() as {
        success?: boolean;
        code?: string;
        title?: string;
        message?: string;
        error?: string;
        filename?: string;
        detectedType?: string;
        supportedFormats?: string[];
        job?: { id?: string; trackingToken?: string };
        statusMessage?: string;
        agentOnline?: boolean;
      };
      if (!response.ok || !result.success || !result.job?.id) {
        if (result.code) {
          setCustomerErrorModal({
            isOpen: true,
            code: (result.code as any) || 'INVALID_CONTENT',
            title: result.title || 'Print Option Unavailable',
            message: result.message || result.error || 'Selected print settings are currently unavailable at this shop.',
            fileName: result.filename || 'Uploaded Document',
            detectedType: result.detectedType,
            supportedFormats: Array.isArray(result.supportedFormats) ? result.supportedFormats.join(', ') : undefined,
            actionText: 'Review Settings'
          });
        }
        throw new Error(result.error || `Could not dispatch the paid order (HTTP ${response.status}).`);
      }

      const job = createPrintJob({
        id: result.job.id,
        trackingToken: result.job.trackingToken,
        shopId: shop.id,
        customerName: 'Counter Customer',
        customerPhone: customerPhone.trim() || '',
        files,
        totalAmount: grandTotal,
        paymentMethod: 'Razorpay Online Payment',
        paymentStatus: 'SUCCESS',
        paymentId
      });
      completedOrdersRef.current.add(orderId);
      setPaymentPendingState(null);
      setActiveJob(job);
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast(
        'Payment Verified Successfully!',
        result.statusMessage || `Txn #${paymentId} confirmed. Order dispatched to ${shop.name} print queue.`,
        'success',
        5000
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Print job dispatch failed.';
      setPaymentPendingState({
        status: 'PENDING',
        orderId,
        message: `Payment is verified, but dispatch failed: ${message} Do not pay again; retry dispatch below.`,
        kind: 'DISPATCH',
        paymentId
      });
      showToast('Payment received; dispatch retry needed', message, 'error', 6000);
    } finally {
      dispatchingOrdersRef.current.delete(orderId);
      setIsProcessingPayment(false);
    }
  };

  // Pay Now triggers official Razorpay Checkout with server-validated order and HMAC verification
  const handlePayNow = async () => {
    setPaymentFailedState(null);
    setPaymentPendingState(null);
    setStepError(null);
    setRazorpayError(null);
    stopPolling();

    // Re-verify agent availability before initiating payment
    const freshStatus = await checkAgentAvailability();
    if (freshStatus && !freshStatus.isAvailable) {
      setIsProcessingPayment(false);
      setStepError(freshStatus.message || 'This print shop is currently offline. Please try again later or select another available shop.');
      showToast('Shop Offline', freshStatus.message, 'error', 5000);
      return;
    }

    if (customerPhone.trim()) {
      setPhoneTouched(true);
      const phoneCheck = validatePhone(customerPhone, false);
      if (!phoneCheck.isValid) {
        setStepError(phoneCheck.error || 'Please enter a valid 10-digit mobile number.');
        return;
      }
    }

    // Pre-checkout validation: Ensure all files match valid printer-supported option combinations
    for (const file of files) {
      const check = isCombinationValid(file.paperSize || 'A4', file.color || 'BW', file.sides === 'DOUBLE');
      if (!check.isValid) {
        setCustomerErrorModal({
          isOpen: true,
          code: 'NO_COMPATIBLE_PRINTER',
          title: 'Print Option Unavailable',
          message: `The print settings for "${file.fileName}" are unavailable: ${check.reason || 'No compatible printer available at this shop'}. Please adjust your settings.`,
          fileName: file.fileName,
          actionText: 'Adjust Settings'
        });
        return;
      }
    }

    const configuredKey = shop.razorpaySettings?.keyId?.trim();
    const effectiveKey = getEffectiveRazorpayKey(configuredKey);

    setIsProcessingPayment(true);
    let checkoutModalActive = false;
    let modalDismissedOrCompleted = false;
    let openWatchdog: NodeJS.Timeout | null = null;

    try {
      // 1. Ensure Razorpay Checkout script is loaded
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Payment gateway SDK could not be loaded. Please check your internet connection.');
      }

      // 2. Create server-validated Razorpay order (MUST return valid order ID before opening checkout)
      const orderRes = await createRazorpayOrder({
        amount: grandTotal,
        shopId: shop.id,
        notes: {
          shopName: shop.name,
          documentsCount: files.length.toString()
        }
      });

      if (!orderRes.success || (!orderRes.order_id && !orderRes.orderId)) {
        throw new Error(orderRes.error || 'Payment gateway failed to initialize order. Please try again.');
      }

      const backendOrderId = orderRes.order_id || orderRes.orderId;
      if (!backendOrderId || !backendOrderId.startsWith('order_')) {
        throw new Error('Payment gateway did not return a valid order ID.');
      }

      setActiveOrderId(backendOrderId);

      const activeKey = orderRes.key_id && isRealRazorpayKey(orderRes.key_id)
        ? orderRes.key_id.trim()
        : effectiveKey;

      const amountInPaise = orderRes.amount || Math.round(grandTotal * 100);

      // Start background polling to reconcile UPI payments completed on external apps
      const startPolling = (orderIdToPoll: string) => {
        stopPolling();
        let pollCount = 0;
        const maxPolls = 40; // 40 * 2.5s = ~100s

        pollingTimerRef.current = setInterval(async () => {
          pollCount++;
          if (pollCount > maxPolls) {
            stopPolling();
            return;
          }

          try {
            const check = await checkRazorpayOrderStatus(orderIdToPoll, shop.id);
            if (check.status === 'PAID' && check.paymentId) {
              stopPolling();
              if (activeRzpInstanceRef.current) {
                try {
                  activeRzpInstanceRef.current.close();
                } catch (_) {}
              }
              setPaymentPendingState(null);
              setPaymentFailedState(null);
              void onPaymentSuccess(check.paymentId, orderIdToPoll);
            } else if (check.status === 'FAILED') {
              stopPolling();
              if (activeRzpInstanceRef.current) {
                try {
                  activeRzpInstanceRef.current.close();
                } catch (_) {}
              }
              setIsProcessingPayment(false);
              setPaymentPendingState(null);
              setPaymentFailedState({
                status: 'FAILED',
                message: check.message || 'Payment was declined or failed.'
              });
            }
          } catch (_) {
            // Silently ignore transient network pauses during polling
          }
        }, 2500);
      };

      startPolling(backendOrderId);

      // Watchdog timer: If Razorpay checkout iframe takes > 12s without mounting or callback, reset loading state
      openWatchdog = setTimeout(() => {
        if (!modalDismissedOrCompleted && !document.querySelector('iframe.razorpay-checkout-frame')) {
          setIsProcessingPayment(false);
          setPaymentFailedState({
            status: 'FAILED',
            message: 'Payment window did not open. Please verify popups/extensions are not blocking checkout, then tap Retry.'
          });
          showToast('Checkout Window Notice', 'Payment window did not open. Please tap Retry below.', 'error', 5000);
        }
      }, 12000);

      const options: any = {
        key: activeKey,
        amount: amountInPaise,
        currency: 'INR',
        name: shop.name,
        description: `Print Order (${files.length} document${files.length > 1 ? 's' : ''})`,
        image: shop.logoUrl || undefined,
        order_id: backendOrderId,
        prefill: {
          name: 'Counter Customer',
          contact: customerPhone.trim() || undefined
        },
        notes: {
          shopId: shop.id,
          shopName: shop.name,
          documentsCount: files.length.toString()
        },
        theme: {
          color: '#059669' // Emerald Green matching Pay Now
        },
        modal: {
          backdropclose: false,
          escape: true,
          handleback: true,
          confirm_close: true,
          ondismiss: async () => {
            modalDismissedOrCompleted = true;
            if (openWatchdog) clearTimeout(openWatchdog);

            // Reconcile status with backend before assuming cancellation
            // (Crucial for customer scanning UPI QR code and closing or returning to modal)
            try {
              const check = await checkRazorpayOrderStatus(backendOrderId, shop.id);
              if (check.status === 'PAID' && check.paymentId) {
                stopPolling();
                void onPaymentSuccess(check.paymentId, backendOrderId);
                return;
              }

              const recon = await reconcileRazorpayPayment({ orderId: backendOrderId, shopId: shop.id });
              if (recon.status === 'PAID' && recon.paymentId) {
                stopPolling();
                void onPaymentSuccess(recon.paymentId, backendOrderId);
                return;
              }

              if (check.status === 'PENDING') {
                setIsProcessingPayment(false);
                setPaymentPendingState({
                  status: 'PENDING',
                  orderId: backendOrderId,
                  message: 'Payment processing. Please wait.'
                });
                showToast(
                  'Payment Processing',
                  'If you completed payment in your UPI app, tap "Refresh Status" below.',
                  'info',
                  5000
                );
                return;
              }

              if (check.status === 'FAILED') {
                stopPolling();
                setIsProcessingPayment(false);
                setPaymentFailedState({
                  status: 'FAILED',
                  message: check.message || 'Payment was declined or failed.'
                });
                return;
              }
            } catch (_) {
              // Fall through to cancellation notice
            }

            stopPolling();
            setIsProcessingPayment(false);
            setPaymentFailedState({
              status: 'CANCELLED',
              message: 'Payment window was closed. If your money was deducted, tap "Check Status" below to reconcile.'
            });
            showToast(
              'Payment Cancelled',
              'Payment window was closed. No amount was deducted. Tap Retry below whenever ready.',
              'info',
              4000
            );
          }
        },
        handler: async (response: any) => {
          modalDismissedOrCompleted = true;
          stopPolling();
          if (openWatchdog) clearTimeout(openWatchdog);

          // STRICT: Verify transaction on server before marking PAID
          if (!response || !response.razorpay_payment_id) {
            setIsProcessingPayment(false);
            setPaymentFailedState({
              status: 'FAILED',
              message: 'Payment verification failed: No payment ID returned by gateway. Order was not placed.'
            });
            showToast(
              'Payment Failed',
              'No payment ID returned by payment gateway. Order was not placed.',
              'error',
              6000
            );
            return;
          }

          try {
            const verification = await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id || backendOrderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              shopId: shop.id
            });

            if (verification.success) {
              void onPaymentSuccess(response.razorpay_payment_id, response.razorpay_order_id || backendOrderId);
            } else {
              // Fallback to server reconciliation before declaring failure
              const recon = await reconcileRazorpayPayment({
                orderId: response.razorpay_order_id || backendOrderId,
                paymentId: response.razorpay_payment_id,
                shopId: shop.id
              });
              if (recon.success && recon.status === 'PAID') {
                void onPaymentSuccess(recon.paymentId || response.razorpay_payment_id, backendOrderId);
              } else {
                setIsProcessingPayment(false);
                const errMsg = verification.error || 'Payment signature verification failed. Order was not placed.';
                setPaymentFailedState({
                  status: 'FAILED',
                  message: errMsg
                });
                showToast('Payment Verification Failed', errMsg, 'error', 6000);
              }
            }
          } catch (verErr: any) {
            console.error('Payment verification error, attempting reconciliation:', verErr);
            const recon = await reconcileRazorpayPayment({
              orderId: response.razorpay_order_id || backendOrderId,
              paymentId: response.razorpay_payment_id,
              shopId: shop.id
            });
            if (recon.success && recon.status === 'PAID') {
              void onPaymentSuccess(recon.paymentId || response.razorpay_payment_id, backendOrderId);
            } else {
              setIsProcessingPayment(false);
              const errMsg = verErr.message || 'Failed to verify payment with server. Order was not placed.';
              setPaymentFailedState({
                status: 'FAILED',
                message: errMsg
              });
              showToast('Payment Verification Failed', errMsg, 'error', 6000);
            }
          }
        }
      };

      if (!window.Razorpay) {
        throw new Error('Payment gateway SDK object is not available on window.');
      }

      const rzpInstance = new window.Razorpay(options);
      activeRzpInstanceRef.current = rzpInstance;

      rzpInstance.on('payment.failed', (errResp: any) => {
        modalDismissedOrCompleted = true;
        stopPolling();
        if (openWatchdog) clearTimeout(openWatchdog);
        setIsProcessingPayment(false);
        console.warn('Payment failed:', errResp);
        const errMsg = errResp?.error?.description || 'Transaction declined or failed. Amount was not deducted. Order was not placed.';
        setPaymentFailedState({
          status: 'FAILED',
          message: errMsg
        });
        showToast('Payment Failed', errMsg, 'error', 6000);
      });

      rzpInstance.open();
      checkoutModalActive = true;
    } catch (err: any) {
      stopPolling();
      if (openWatchdog) clearTimeout(openWatchdog);
      setIsProcessingPayment(false);
      console.warn('Payment gateway error:', err);
      const errMsg = err.message || 'Payment gateway could not be opened. Please try again.';
      setPaymentFailedState({
        status: 'FAILED',
        message: errMsg
      });
      showToast('Payment Error', errMsg, 'error', 6000);
    } finally {
      if (!checkoutModalActive) {
        setIsProcessingPayment(false);
      }
    }
  };

  // Safe manual status refresh & reconciliation handler
  const handleManualStatusCheck = async (targetOrderId?: string) => {
    const oId = targetOrderId || activeOrderId;
    if (!oId) return;

    setIsCheckingStatus(true);
    setStepError(null);

    try {
      const check = await checkRazorpayOrderStatus(oId, shop.id);
      if (check.status === 'PAID' && check.paymentId) {
        stopPolling();
        if (activeRzpInstanceRef.current) {
          try {
            activeRzpInstanceRef.current.close();
          } catch (_) {}
        }
        setPaymentPendingState(null);
        setPaymentFailedState(null);
        void onPaymentSuccess(check.paymentId, oId);
        return;
      }

      const recon = await reconcileRazorpayPayment({ orderId: oId, shopId: shop.id });
      if (recon.status === 'PAID' && recon.paymentId) {
        stopPolling();
        if (activeRzpInstanceRef.current) {
          try {
            activeRzpInstanceRef.current.close();
          } catch (_) {}
        }
        setPaymentPendingState(null);
        setPaymentFailedState(null);
        void onPaymentSuccess(recon.paymentId, oId);
        return;
      }

      if (check.status === 'FAILED' || recon.status === 'FAILED') {
        setPaymentPendingState(null);
        setPaymentFailedState({
          status: 'FAILED',
          message: check.message || recon.message || 'Payment declined or failed. Please retry.'
        });
        showToast('Payment Incomplete', 'No successful payment detected. You can retry below.', 'error', 4000);
      } else {
        setPaymentPendingState({
          status: 'PENDING',
          orderId: oId,
          message: 'Payment processing. Please wait.'
        });
        showToast('Payment Processing', 'Payment is still processing on UPI. Please wait a moment...', 'info', 3000);
      }
    } catch (err: any) {
      showToast('Status Check', 'Could not verify status right now. Please try again.', 'error', 3000);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-screen customer-page text-[#111111] font-['Manrope',sans-serif] pb-24">
      {maintenanceMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-900 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 sticky top-0 z-40 shadow-xs">
          <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold block">Scheduled Maintenance Mode Active</span>
              <span>{maintenanceMode.message} File uploads and new orders are temporarily disabled.</span>
            </div>
          </div>
        </div>
      )}
      {/* 1. TOP HEADER (EasyToPrint Official Branding & Shop Identity) */}
      <header className="bg-white border-b border-[#E1E7E1] sticky top-0 z-30 shadow-2xs font-['Manrope',sans-serif]">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left Section: [Printer Icon] [Shop Name / EasyToPrint] */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* 1. Printer Icon */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center shrink-0 border border-[#A7F3D0]/70">
              <Printer className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#00B32D]" />
            </div>

            {/* 2 & 3. Vertically Stacked: Dynamic Shop Name + EasyToPrint Brand */}
            <div className="min-w-0 flex-1">
              <span
                className="font-semibold text-xs sm:text-sm md:text-base text-[#111111] leading-tight block truncate"
                title={shop.name}
              >
                {shop.name}
              </span>
              <span className="text-[10px] sm:text-xs text-[#646B65] font-normal leading-tight block truncate">
                EasyToPrint
              </span>
            </div>
          </div>

          {/* Right Section: [Track] [?] */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 1. Track Button (position it on the left of right section) */}
            <a
              href="#/track-print"
              className="h-8 sm:h-9 px-2.5 sm:px-3 bg-[#E8F8EC] hover:bg-[#d5f3dc] text-[#008F25] font-medium text-xs rounded-xl border border-[#A7F3D0] transition-colors flex items-center gap-1 sm:gap-1.5 shrink-0 shadow-2xs"
              title="Track Print Order"
            >
              <Search className="w-3.5 h-3.5 text-[#00B32D] shrink-0" />
              <span>Track</span>
            </a>

            {/* 2. Info Button (?) (position it at the extreme right) */}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="h-8 sm:h-9 w-8 sm:w-9 bg-white hover:bg-slate-50 text-[#646B65] font-medium text-xs rounded-xl border border-[#E1E7E1] transition-colors flex items-center justify-center shrink-0 shadow-2xs cursor-pointer"
              title="How to Print / Information"
              aria-label="Info"
            >
              <HelpCircle className="w-4 h-4 text-[#646B65] shrink-0" />
            </button>
          </div>
        </div>

        {/* 2. PROGRESS STEPPER (Only Upload, Review, Pay) */}
        {currentStep <= 3 && (
          <div className="border-t border-[#E1E7E1] bg-white py-3 px-4">
            <div className="max-w-md mx-auto flex items-center justify-between text-xs">
              {/* Step 1: Upload */}
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep > 1
                      ? 'bg-[#00B32D] text-white'
                      : 'bg-[#00B32D] text-white ring-2 ring-[#00B32D]/20'
                  }`}
                >
                  {currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
                </div>
                <span className={currentStep >= 1 ? 'text-[#008F25]' : 'text-[#646B65]'}>Upload</span>
              </button>

              <div
                className={`h-0.5 flex-1 mx-3 sm:mx-4 transition-colors ${
                  currentStep >= 2 ? 'bg-[#00B32D]' : 'bg-[#E1E7E1]'
                }`}
              />

              {/* Step 2: Review */}
              <button
                type="button"
                onClick={() => files.length > 0 && setCurrentStep(2)}
                disabled={files.length === 0}
                className={`flex items-center gap-1.5 font-bold cursor-pointer ${
                  files.length === 0 ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep > 2
                      ? 'bg-[#00B32D] text-white'
                      : currentStep === 2
                      ? 'bg-[#00B32D] text-white ring-2 ring-[#00B32D]/20'
                      : 'bg-[#F7F8F7] text-[#646B65] border border-[#E1E7E1]'
                  }`}
                >
                  {currentStep > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
                </div>
                <span className={currentStep >= 2 ? 'text-[#008F25]' : 'text-[#646B65]'}>Review</span>
              </button>

              <div
                className={`h-0.5 flex-1 mx-3 sm:mx-4 transition-colors ${
                  currentStep >= 3 ? 'bg-[#00B32D]' : 'bg-[#E1E7E1]'
                }`}
              />

              {/* Step 3: Pay */}
              <button
                type="button"
                onClick={() => files.length > 0 && setCurrentStep(3)}
                disabled={files.length === 0}
                className={`flex items-center gap-1.5 font-bold cursor-pointer ${
                  files.length === 0 ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === 3
                      ? 'bg-[#00B32D] text-white ring-2 ring-[#00B32D]/20'
                      : 'bg-[#F7F8F7] text-[#646B65] border border-[#E1E7E1]'
                  }`}
                >
                  3
                </div>
                <span className={currentStep === 3 ? 'text-[#008F25]' : 'text-[#646B65]'}>Pay</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 3. MAIN WORKSPACE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-8">
        <AnimatePresence mode="wait">
          {/* ========================================================================= */}
          {/* STEP 1: UPLOAD & CUSTOMIZE (3-STEP FLOW: UPLOAD -> REVIEW -> PAY)        */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <motion.div
              key="step-upload"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-3xl mx-auto space-y-3.5 sm:space-y-6"
            >
              {/* COMPACT OFFLINE STATUS BADGE */}
              {agentStatus && !agentStatus.isAvailable && (
                <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-rose-50 border border-rose-200 rounded-xl sm:rounded-2xl text-rose-950 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium text-xs sm:text-sm text-rose-950">
                          {agentStatus.reason === 'PRINTER_UNAVAILABLE'
                            ? 'Print Agent Connected · No Printer Ready'
                            : 'Shop is currently offline'}
                        </span>
                        <span className="hidden sm:inline text-xs text-rose-700/80 font-normal">
                          · Uploads paused
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wide">
                        Offline
                      </span>
                      <button
                        type="button"
                        onClick={handleManualRefreshStatus}
                        disabled={isCheckingAgentStatus || isManualCheckingStatus}
                        className="px-2.5 py-1 bg-white hover:bg-rose-100/60 active:scale-95 text-rose-700 font-bold text-xs rounded-lg border border-rose-200 shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Check shop availability"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${(isCheckingAgentStatus || isManualCheckingStatus) ? 'animate-spin' : ''}`} />
                        <span className="text-[11px]">Refresh</span>
                      </button>
                    </div>
                  </div>

                  {alternativeShops.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-rose-200/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-medium text-rose-800 truncate">
                        Nearby online: <strong>{alternativeShops[0].name}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/print/${alternativeShops[0].slug}`)}
                        className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-0.5 ml-2 shrink-0"
                      >
                        Switch
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Header Section */}
              <div className="text-center space-y-2 mb-6">
                <h1 className="text-2xl font-semibold text-[#111111]">Upload Your Documents</h1>
                <p className="text-sm font-normal text-[#646B65]">Upload your files for printing. PDF, JPG and PNG supported.</p>
              </div>

              {/* Standard Upload Box */}
              <div className="border-2 border-dashed border-[#E1E7E1] hover:border-[#00B32D] bg-white rounded-3xl p-6 sm:p-8 text-center shadow-xs transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center mx-auto mb-3 shadow-2xs">
                  {uploadingQueue.length > 0 ? (
                    <RotateCw className="w-6 h-6 animate-spin text-[#00B32D]" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>
                <h2 className="text-base font-medium text-[#111111]">
                  {uploadingQueue.length > 0 ? 'Preparing documents...' : 'Click or Drag to Upload'}
                </h2>
                <p className="text-xs font-normal text-[#646B65] mt-0.5 mb-5">
                  Supported formats: PDF, JPG and PNG · Up to 50 MB each
                </p>

                <div className="flex items-center justify-center">
                  <label
                    htmlFor={uploadingQueue.length > 0 || maintenanceMode || (agentStatus !== null && !agentStatus.isAvailable) ? undefined : fileInputId}
                    className={`h-11 px-6 font-medium text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all ${
                      maintenanceMode || (agentStatus !== null && !agentStatus.isAvailable)
                        ? 'bg-slate-300 text-slate-600 cursor-not-allowed opacity-90'
                        : uploadingQueue.length > 0
                        ? 'bg-[#00B32D]/70 text-white cursor-wait opacity-80'
                        : 'bg-[#00B32D] hover:bg-[#008F25] active:scale-95 text-white cursor-pointer'
                    }`}
                  >
                    {maintenanceMode ? (
                      <>
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
                        <span>Maintenance (Uploads Disabled)</span>
                      </>
                    ) : agentStatus && !agentStatus.isAvailable ? (
                      <>
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
                        <span>Shop Offline (Uploads Paused)</span>
                      </>
                    ) : uploadingQueue.length > 0 ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin shrink-0" />
                        <span>Uploading files...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 shrink-0" />
                        <span>Choose Files</span>
                      </>
                    )}
                    <input
                      id={fileInputId}
                      type="file"
                      multiple
                      disabled={uploadingQueue.length > 0 || Boolean(maintenanceMode) || Boolean(agentStatus && !agentStatus.isAvailable)}
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <p className="text-[11px] font-normal text-[#646B65] mt-3">or drag and drop files here</p>
              </div>

                {/* Live Upload Loading Progress Status Card */}
                {uploadingQueue.length > 0 && (
                  <div className="space-y-2.5">
                    {uploadingQueue.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-[#A7F3D0] p-4 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center shrink-0">
                              <RotateCw className="w-4 h-4 animate-spin" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-[#111111] truncate block max-w-[200px] sm:max-w-md">
                                {item.name}
                              </span>
                              <span className="text-[11px] text-[#646B65]">
                                {(item.size / 1024 / 1024).toFixed(1)} MB · Uploading & processing pages...
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-[#008F25] text-xs shrink-0">
                            {item.progress}%
                          </span>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="w-full h-1.5 bg-[#F7F8F7] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00B32D] rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {stepError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{stepError}</span>
                  </div>
                )}

                {/* Section Title: Your files + Add more files button */}
                {files.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <h2 className="text-base font-bold text-[#111111]">Your files</h2>
                        <span className="text-xs text-[#646B65] font-medium">
                          {files.length} document{files.length !== 1 ? 's' : ''} added
                        </span>
                      </div>

                      <label
                        htmlFor={fileInputId}
                        className="px-3.5 py-1.5 bg-white border border-[#E1E7E1] hover:bg-[#F7F8F7] text-[#111111] text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all hover:border-[#00B32D]/40 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#00B32D]" />
                        <span>Add more files</span>
                      </label>
                    </div>

                    {/* Expandable File Cards List */}
                    <div className="space-y-4">
                      {files.map((file) => {
                        const isExpanded = expandedFileIds[file.id] ?? false;
                        const isPdf = file.fileType.includes('pdf') || file.fileName.endsWith('.pdf');

                        return (
                          <div
                            key={file.id}
                            className="bg-white rounded-2xl border border-[#E1E7E1] shadow-2xs overflow-hidden transition-all"
                          >
                            {/* Card Header Row */}
                            <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                                    isPdf ? 'bg-red-50 text-red-600' : 'bg-[#E8F8EC] text-[#00B32D]'
                                  }`}
                                >
                                  {isPdf ? (
                                    <FileText className="w-5 h-5 text-red-600" />
                                  ) : (
                                    <ImageIcon className="w-5 h-5 text-[#00B32D]" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-sm font-bold text-[#111111] truncate max-w-[200px] sm:max-w-md">
                                    {file.fileName}
                                  </h3>
                                  <div className="flex items-center gap-2 text-xs text-[#646B65] mt-0.5 flex-wrap">
                                    <span>{(file.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                                    <span>·</span>
                                    <span>{file.estimatedPages} page{file.estimatedPages > 1 ? 's' : ''}</span>
                                    <span>·</span>
                                    <span>{file.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'}</span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#008F25] bg-[#E8F8EC] px-2 py-0.2 rounded-full border border-[#A7F3D0]">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#00B32D]" />
                                      <span>Ready</span>
                                    </span>
                                    {file.isMerged && (
                                      <span className="px-2 py-0.5 rounded-full bg-[#E8F8EC] border border-[#A7F3D0] text-[#008F25] text-[10px] font-bold inline-flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-[#00B32D]" />
                                        <span>Merged Document</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => removeFile(file.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer shrink-0"
                                title="Delete file"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Action Bar: Preview (Left) & Hide settings / Configure (Right) */}
                            <div className="px-4 sm:px-5 py-2.5 bg-[#F7F8F7] border-t border-[#E1E7E1] flex items-center justify-between text-xs font-semibold">
                              <button
                                onClick={() => setPreviewFile(file)}
                                className="text-[#008F25] hover:text-[#00B32D] flex items-center gap-1.5 cursor-pointer font-bold"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                              </button>

                              <button
                                onClick={() => toggleExpand(file.id)}
                                className="text-[#008F25] hover:text-[#00B32D] flex items-center gap-1 cursor-pointer font-bold"
                              >
                                <span>{isExpanded ? 'Hide settings' : 'Configure'}</span>
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>

                            {/* Collapsible Print Settings Area */}
                            {isExpanded && (
                              <div className="p-4 sm:p-5 border-t border-[#E1E7E1] space-y-4 bg-white">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-[#111111]">Print settings</h4>
                                  <span className="text-[10px] font-semibold text-[#008F25] bg-[#E8F8EC] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                                    For this file only
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                  {(() => {
                                    const isColorSupported = isCombinationValid(file.paperSize || 'A4', 'COLOR', file.sides === 'DOUBLE');
                                    const isDuplexSupported = isCombinationValid(file.paperSize || 'A4', file.color || 'BW', true);

                                    return (
                                      <>
                                        {/* 1. Print Type (B&W vs Colour) */}
                                        <div>
                                          <label className="text-xs font-bold text-[#111111] block mb-1.5">Print type</label>
                                          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl">
                                            <button
                                              type="button"
                                              onClick={() => updateFileConfig(file.id, { color: 'BW' })}
                                              className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                                file.color === 'BW'
                                                  ? 'bg-[#E8F8EC] text-[#008F25] border border-[#00B32D] shadow-2xs font-extrabold'
                                                  : 'text-[#646B65] hover:text-[#111111]'
                                              }`}
                                            >
                                              B&W
                                            </button>
                                            <button
                                              type="button"
                                              disabled={!isColorSupported.isValid}
                                              onClick={() => isColorSupported.isValid && updateFileConfig(file.id, { color: 'COLOR' })}
                                              title={!isColorSupported.isValid ? isColorSupported.reason : 'Colour'}
                                              className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all ${
                                                !isColorSupported.isValid
                                                  ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50'
                                                  : file.color === 'COLOR'
                                                    ? 'bg-[#E8F8EC] text-[#008F25] border border-[#00B32D] shadow-2xs cursor-pointer font-extrabold'
                                                    : 'text-[#646B65] hover:text-[#111111] cursor-pointer'
                                              }`}
                                            >
                                              Colour
                                            </button>
                                          </div>
                                          {!isColorSupported.isValid && (
                                            <p className="text-[10px] text-amber-700 mt-1 flex items-start gap-1 font-medium leading-tight">
                                              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                              <span>{isColorSupported.reason || 'Colour printing unavailable'}</span>
                                            </p>
                                          )}
                                        </div>

                                        {/* 2. Print Sides (Single vs Double) */}
                                        <div>
                                          <label className="text-xs font-bold text-[#111111] block mb-1.5">Print sides</label>
                                          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl">
                                            <button
                                              type="button"
                                              onClick={() => updateFileConfig(file.id, { sides: 'SINGLE' })}
                                              className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer truncate px-0.5 ${
                                                file.sides === 'SINGLE'
                                                  ? 'bg-[#E8F8EC] text-[#008F25] border border-[#00B32D] shadow-2xs font-extrabold'
                                                  : 'text-[#646B65] hover:text-[#111111]'
                                              }`}
                                            >
                                              Single Side
                                            </button>
                                            <button
                                              type="button"
                                              disabled={!isDuplexSupported.isValid}
                                              onClick={() => isDuplexSupported.isValid && updateFileConfig(file.id, { sides: 'DOUBLE' })}
                                              title={!isDuplexSupported.isValid ? isDuplexSupported.reason : 'Double Side'}
                                              className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all truncate px-0.5 ${
                                                !isDuplexSupported.isValid
                                                  ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50'
                                                  : file.sides === 'DOUBLE'
                                                    ? 'bg-[#E8F8EC] text-[#008F25] border border-[#00B32D] shadow-2xs cursor-pointer font-extrabold'
                                                    : 'text-[#646B65] hover:text-[#111111] cursor-pointer'
                                              }`}
                                            >
                                              Double Side
                                            </button>
                                          </div>
                                          {!isDuplexSupported.isValid && (
                                            <p className="text-[10px] text-amber-700 mt-1 flex items-start gap-1 font-medium leading-tight">
                                              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                              <span>{isDuplexSupported.reason || 'Double-sided printing unavailable'}</span>
                                            </p>
                                          )}
                                        </div>

                                        {/* 3. Paper Size Selection */}
                                        <div>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-bold text-[#111111] block">Paper size</label>
                                            <span className="text-[10px] text-[#008F25] font-bold">{file.paperSize || 'A4'}</span>
                                          </div>
                                          <div className="flex flex-wrap gap-1 p-1 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl">
                                            {activeShopSizes.map((sz) => {
                                              const isSelected = (file.paperSize || 'A4') === sz;
                                              const isSizeSupported = isCombinationValid(sz, file.color || 'BW', file.sides === 'DOUBLE');
                                              return (
                                                <button
                                                  key={sz}
                                                  type="button"
                                                  disabled={!isSizeSupported.isValid}
                                                  onClick={() => isSizeSupported.isValid && updateFileConfig(file.id, { paperSize: sz as PaperSize })}
                                                  className={`flex-1 min-w-[50px] py-1.5 px-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all text-center truncate ${
                                                    !isSizeSupported.isValid
                                                      ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50'
                                                      : isSelected
                                                        ? 'bg-[#E8F8EC] text-[#008F25] border border-[#00B32D] shadow-2xs font-extrabold cursor-pointer'
                                                        : 'text-[#646B65] hover:text-[#111111] cursor-pointer'
                                                  }`}
                                                  title={!isSizeSupported.isValid ? isSizeSupported.reason : sz}
                                                >
                                                  {sz}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </>
                                    );
                                  })()}

                                  {/* 4. Copies Counter [-] 1 [+] */}
                                  <div>
                                    <label className="text-xs font-bold text-[#111111] block mb-1.5">Copies</label>
                                    <div className="flex items-center justify-between p-1 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl h-10 px-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateFileConfig(file.id, { copies: Math.max(1, (file.copies || 1) - 1) })
                                        }
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white hover:bg-[#E1E7E1] active:scale-95 flex items-center justify-center font-bold text-[#111111] cursor-pointer shadow-2xs border border-[#E1E7E1]"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>
                                      <span className="font-extrabold text-sm font-mono text-[#111111]">
                                        {file.copies || 1}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateFileConfig(file.id, { copies: (file.copies || 1) + 1 })
                                        }
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white hover:bg-[#E1E7E1] active:scale-95 flex items-center justify-center font-bold text-[#111111] cursor-pointer shadow-2xs border border-[#E1E7E1]"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-[#00B32D]" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* 5. Orientation */}
                                  <div>
                                    <label className="text-xs font-bold text-[#111111] block mb-1.5">Orientation</label>
                                    <select
                                      value={file.orientation || 'PORTRAIT'}
                                      onChange={(e) =>
                                        updateFileConfig(file.id, { orientation: e.target.value as any })
                                      }
                                      className="w-full h-10 px-3 bg-[#F7F8F7] hover:bg-[#E1E7E1]/50 border border-[#E1E7E1] rounded-xl text-[11px] sm:text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#00B32D] cursor-pointer transition-colors"
                                    >
                                      <option value="PORTRAIT">Auto (Portrait)</option>
                                      <option value="LANDSCAPE">Auto (Landscape)</option>
                                    </select>
                                  </div>

                                  {/* 6. Pages per sheet */}
                                  <div>
                                    <label className="text-xs font-bold text-[#111111] block mb-1.5">Pages per sheet</label>
                                    <select
                                      value={file.pagesPerSheet || 1}
                                      onChange={(e) =>
                                        updateFileConfig(file.id, { pagesPerSheet: Number(e.target.value) as PagesPerSheet })
                                      }
                                      className="w-full h-10 px-3 bg-[#F7F8F7] hover:bg-[#E1E7E1]/50 border border-[#E1E7E1] rounded-xl text-[11px] sm:text-xs font-bold text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#00B32D] cursor-pointer transition-colors"
                                    >
                                      <option value={1}>1 page/sheet</option>
                                      <option value={2}>2 pages/sheet (N-up)</option>
                                      <option value={4}>4 pages/sheet</option>
                                    </select>
                                  </div>

                                  {/* 7. Pages to Print (Spans 2 columns) */}
                                  <div className="col-span-2 pt-1">
                                    <label className="text-xs font-bold text-[#111111] block mb-1.5">Pages to print</label>
                                    <div className="grid grid-cols-2 gap-1 p-1 bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl mb-2">
                                      <button
                                        type="button"
                                        onClick={() => updateFileConfig(file.id, { pageSelection: 'ALL' })}
                                        className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                          file.pageSelection === 'ALL'
                                            ? 'bg-[#E8F8EC] text-[#008F25] border border-[#00B32D] shadow-2xs font-extrabold'
                                            : 'text-[#646B65] hover:text-[#111111]'
                                        }`}
                                      >
                                        All Pages
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateFileConfig(file.id, { pageSelection: 'CUSTOM' })}
                                        className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                          file.pageSelection === 'CUSTOM'
                                            ? 'bg-[#E8F8EC] text-[#008F25] border border-[#00B32D] shadow-2xs font-extrabold'
                                            : 'text-[#646B65] hover:text-[#111111]'
                                        }`}
                                      >
                                        Custom Pages
                                      </button>
                                    </div>

                                    {file.pageSelection === 'CUSTOM' && (
                                      <div className="space-y-1">
                                        <input
                                          type="text"
                                          placeholder="e.g. 1-3, 5, 8"
                                          value={file.customRange || ''}
                                          onChange={(e) => updateFileConfig(file.id, { customRange: e.target.value })}
                                          className="w-full h-10 px-3.5 bg-white border border-[#E1E7E1] rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#00B32D]"
                                        />
                                        <p className="text-[10px] text-[#646B65]">
                                          Specify page ranges separated by commas.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Action Bar for Upload Step */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3.5 bg-white p-5 rounded-3xl border border-[#E1E7E1] shadow-2xs">
                      <div>
                        <span className="text-xs font-semibold text-[#646B65] block">Ready to print</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-black font-mono text-[#111111]">
                            {files.length} Document{files.length > 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-[#646B65]">· Review details in next step</span>
                        </div>
                      </div>

                      <button
                        onClick={handleProceedToReview}
                        className="w-full sm:w-auto h-12 px-7 bg-[#00B32D] hover:bg-[#008F25] active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Continue to Review</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: REVIEW YOUR PRINT ORDER (3-STEP FLOW: UPLOAD -> REVIEW -> PAY)    */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <motion.div
              key="step-review"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-xl mx-auto space-y-5"
            >
              {/* Top Navigation Row with Back Button */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#111111] hover:text-black bg-white hover:bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#646B65]" />
                  <span>Back to Upload</span>
                </button>
                <span className="text-[10px] font-bold tracking-widest text-[#008F25] uppercase font-mono">
                  STEP 2 OF 3
                </span>
              </div>

              <div className="text-center space-y-0.5">
                <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
                  Review your print order
                </h1>
                <p className="text-xs text-[#646B65]">
                  Check the details before continuing to payment.
                </p>
              </div>

              {/* Review File Cards */}
              <div className="space-y-3">
                {files.map((file) => {
                  const isPdf = file.fileType.includes('pdf') || file.fileName.endsWith('.pdf');
                  const pagesToPrint = countPages(file);

                  return (
                    <div
                      key={file.id}
                      className="bg-white rounded-2xl border border-[#E1E7E1] p-4 shadow-2xs space-y-3"
                    >
                      {/* Top Row: Icon + Title/Details + Price */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isPdf ? 'bg-red-50 text-red-600' : 'bg-[#E8F8EC] text-[#00B32D]'
                            }`}
                          >
                            {isPdf ? (
                              <FileText className="w-4 h-4 text-red-600" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-[#00B32D]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs sm:text-sm font-bold text-[#111111] truncate">
                              {file.fileName}
                            </h3>
                            <p className="text-[11px] text-[#646B65] mt-0.5">
                              {pagesToPrint} page{pagesToPrint > 1 ? 's' : ''} · {file.copies} cop{file.copies > 1 ? 'ies' : 'y'}
                            </p>
                          </div>
                        </div>

                        {/* Top-Right Price */}
                        <div className="shrink-0 text-right">
                          <span className="font-mono font-black text-base sm:text-lg text-[#111111]">
                            ₹{file.totalPrice.toFixed(0)}
                          </span>
                        </div>
                      </div>

                      {/* Middle Row: Pill Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-[#111111]">
                        <span className="px-2 py-0.5 bg-[#F7F8F7] border border-[#E1E7E1] rounded-md">
                          {file.color === 'COLOR' ? 'Colour' : 'B&W'}
                        </span>
                        <span className="px-2 py-0.5 bg-[#F7F8F7] border border-[#E1E7E1] rounded-md">{file.paperSize}</span>
                        <span className="px-2 py-0.5 bg-[#F7F8F7] border border-[#E1E7E1] rounded-md">
                          {file.sides === 'DOUBLE' ? 'Double Side' : 'Single Side'}
                        </span>
                        <span className="px-2 py-0.5 bg-[#F7F8F7] border border-[#E1E7E1] rounded-md">
                          {file.pagesPerSheet || 1} page/sheet
                        </span>
                        <span className="px-2 py-0.5 bg-[#F7F8F7] border border-[#E1E7E1] rounded-md">
                          Auto ({file.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'})
                        </span>
                        {file.pageSelection === 'CUSTOM' && file.customRange && (
                          <span className="px-2 py-0.5 bg-[#E8F8EC] text-[#008F25] border border-[#A7F3D0] rounded-md font-mono">
                            Pages: {file.customRange}
                          </span>
                        )}
                      </div>

                      {/* Bottom Row: Actions */}
                      <div className="pt-2 border-t border-[#E1E7E1] flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#646B65] font-medium">Print specification</span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewFile(file);
                            }}
                            className="h-7 px-2.5 bg-[#E8F8EC] hover:bg-[#d5f3dc] text-[#008F25] border border-[#A7F3D0] text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#00B32D]" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setExpandedFileIds((p) => ({ ...p, [file.id]: true }));
                              setCurrentStep(1);
                            }}
                            className="h-7 px-2.5 bg-[#F7F8F7] hover:bg-[#E1E7E1] text-[#111111] border border-[#E1E7E1] text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#00B32D]" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Calculation Card */}
              <div className="bg-white rounded-2xl border border-[#E1E7E1] p-4 sm:p-5 shadow-2xs space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#646B65]">
                  <span>Printing Charges</span>
                  <span className="font-mono font-bold text-[#111111]">₹{subtotal.toFixed(0)}</span>
                </div>

                <div className="pt-2 border-t border-dashed border-[#E1E7E1] flex items-baseline justify-between">
                  <span className="text-sm font-extrabold text-[#111111]">Total</span>
                  <span className="text-xl font-black font-mono text-[#008F25]">₹{grandTotal.toFixed(0)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleProceedToPayment}
                  className="w-full h-12 bg-[#00B32D] hover:bg-[#008F25] active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setCurrentStep(1)}
                  className="w-full py-2.5 text-xs font-semibold text-[#646B65] hover:text-[#111111] text-center transition-colors cursor-pointer"
                >
                  ← Back to Upload
                </button>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: PAYMENT (3-STEP FLOW: UPLOAD -> REVIEW -> PAY)                    */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <motion.div
              key="step-pay"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-md mx-auto space-y-5"
            >
              {/* Top Navigation Row with Back Button */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#111111] hover:text-black bg-white hover:bg-[#F7F8F7] border border-[#E1E7E1] rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#646B65]" />
                  <span>Back to Review</span>
                </button>
                <span className="text-[10px] font-bold tracking-widest text-[#008F25] uppercase font-mono">
                  STEP 3 OF 3
                </span>
              </div>

              <div className="text-center space-y-0.5">
                <h1 className="text-xl sm:text-2xl font-bold text-[#111111] tracking-tight">
                  Complete Payment
                </h1>
                <p className="text-xs text-[#646B65]">
                  Pay securely to dispatch your print order to <strong>{shop.name}</strong>
                </p>
              </div>

              {/* Payment Card: Clean, Modern & Direct */}
              <div className="bg-white rounded-3xl border border-[#E1E7E1] p-5 sm:p-7 shadow-sm space-y-5">
                {/* Header Price & Security Badge */}
                <div className="flex items-center justify-between pb-4 border-b border-[#E1E7E1]">
                  <div>
                    <span className="text-[11px] font-bold text-[#646B65] uppercase tracking-wider block">
                      Total Payable Amount
                    </span>
                    <span className="font-mono font-black text-3xl text-[#111111] tracking-tight">
                      ₹{grandTotal.toFixed(0)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#008F25] bg-[#E8F8EC] px-3 py-1 rounded-full border border-[#A7F3D0]">
                      <ShieldCheck className="w-4 h-4 text-[#00B32D]" />
                      <span>100% Secure Payment</span>
                    </span>
                    <span className="text-[10px] text-[#646B65] font-mono block mt-1">
                      Official Payment Gateway
                    </span>
                  </div>
                </div>

                {/* Print Order Summary Card */}
                <div className="bg-[#F7F8F7] rounded-2xl border border-[#E1E7E1] p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between text-[#111111] font-bold">
                    <span className="uppercase tracking-wider text-[11px]">Order Summary</span>
                    <span className="text-[11px] text-[#646B65] font-normal">
                      {files.length} document{files.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {files.map((f, i) => (
                      <div key={f.id || i} className="p-2.5 bg-white rounded-xl border border-[#E1E7E1] space-y-1 text-left">
                        <div className="flex items-center justify-between font-bold text-[#111111]">
                          <span className="truncate max-w-[220px]">{f.fileName}</span>
                          <span className="font-mono">₹{f.totalPrice.toFixed(0)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#646B65]">
                          <span>{f.estimatedPages} {f.estimatedPages === 1 ? 'Page' : 'Pages'}</span>
                          <span>·</span>
                          <span>{f.color === 'COLOR' ? 'Color' : 'B&W'}</span>
                          <span>·</span>
                          <span>{f.sides === 'DOUBLE' ? 'Double Side' : 'Single Side'}</span>
                          <span>·</span>
                          <span>{f.paperSize}</span>
                          <span>·</span>
                          <span>{f.copies} {f.copies > 1 ? 'Copies' : 'Copy'}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[#E1E7E1] space-y-1.5 text-[#646B65] text-left">
                    <div className="flex items-center justify-between">
                      <span>Printing Charges</span>
                      <span className="font-mono font-semibold text-[#111111]">₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="pt-2 border-t border-[#E1E7E1] flex items-center justify-between font-bold text-[#111111] text-sm">
                      <span>Total Amount</span>
                      <span className="font-mono text-[#008F25] text-base font-extrabold">₹{grandTotal.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {/* Optional Mobile Number for SMS Token */}
                <div className="text-left space-y-1.5">
                  <label className="text-xs font-bold text-[#111111] flex items-center justify-between">
                    <span>Mobile Number for SMS Token <span className="text-[10px] text-[#646B65] font-normal">(Optional)</span></span>
                    <span className="text-[10px] text-[#646B65] font-mono">10 digits</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={10}
                    placeholder="Enter mobile number for pickup code"
                    value={customerPhone}
                    onChange={(e) => {
                      setStepError(null);
                      setPaymentFailedState(null);
                      setCustomerPhone(e.target.value.replace(/\D/g, ''));
                    }}
                    onBlur={() => setPhoneTouched(true)}
                    className="w-full h-11 px-3.5 bg-white border border-[#E1E7E1] rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#00B32D] focus:border-[#00B32D]"
                  />
                  {phoneTouched && customerPhone.trim() && !validatePhone(customerPhone, false).isValid && (
                    <p className="text-[11px] text-red-600 font-medium">
                      {validatePhone(customerPhone, false).error}
                    </p>
                  )}
                </div>

                {/* PAYMENT PENDING BANNER (UPI AUTO-POLL & SAFE STATUS REFRESH) */}
                {paymentPendingState && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-amber-950">
                        <RotateCw className={`w-4 h-4 text-amber-600 shrink-0 ${isProcessingPayment ? 'animate-spin' : ''}`} />
                        <span>{paymentPendingState.kind === 'DISPATCH' ? 'Payment verified; print dispatch pending.' : 'Payment processing. Please wait.'}</span>
                      </div>
                      {paymentPendingState.kind !== 'DISPATCH' && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-mono font-bold px-2 py-0.5 rounded-full">
                          UPI QR / APP
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-800">
                      {paymentPendingState.kind === 'DISPATCH'
                        ? paymentPendingState.message
                        : 'If you scanned the QR code or authorized payment on your UPI app (Google Pay, PhonePe, Paytm, etc.), we are verifying the payment with the gateway.'}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => paymentPendingState.kind === 'DISPATCH' && paymentPendingState.paymentId
                          ? void onPaymentSuccess(paymentPendingState.paymentId, paymentPendingState.orderId)
                          : handleManualStatusCheck(paymentPendingState.orderId)}
                        disabled={isCheckingStatus || isProcessingPayment}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isCheckingStatus ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Checking Bank...</span>
                          </>
                        ) : (
                          <>
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>{paymentPendingState.kind === 'DISPATCH' ? 'Retry Dispatch' : 'Refresh Status'}</span>
                          </>
                        )}
                      </button>
                      {paymentPendingState.kind !== 'DISPATCH' && (
                        <button
                          type="button"
                          onClick={() => {
                            stopPolling();
                            setPaymentPendingState(null);
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-800 font-medium text-xs rounded-xl border border-amber-300 transition-all cursor-pointer"
                        >
                          Cancel / Start Over
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* PAYMENT FAILED / CANCELLED STATE BANNER */}
                {paymentFailedState && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 space-y-2 text-left"
                  >
                    <div className="flex items-center gap-2 font-bold text-red-900">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Payment Incomplete · Order Not Placed</span>
                    </div>
                    <p className="text-[11px] text-red-700 pl-6">
                      {paymentFailedState.message}
                    </p>
                    {activeOrderId && (
                      <div className="pl-6 pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleManualStatusCheck(activeOrderId)}
                          disabled={isCheckingStatus}
                          className="px-2.5 py-1 bg-white border border-red-300 hover:bg-red-100 text-red-800 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCw className={`w-3 h-3 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                          <span>Check If Amount Was Deducted</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {stepError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium text-left flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    <span>{stepError}</span>
                  </div>
                )}

                {/* THE HERO "PAY NOW" BUTTON (OFFICIAL RAZORPAY CHECKOUT) */}
                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    disabled={isProcessingPayment || isCheckingStatus || paymentPendingState?.kind === 'DISPATCH'}
                    onClick={handlePayNow}
                    className="w-full h-14 bg-[#00B32D] hover:bg-[#008F25] active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {isProcessingPayment ? (
                      <>
                        <RotateCw className="w-5 h-5 animate-spin" />
                        <span>Creating payment...</span>
                      </>
                    ) : isCheckingStatus ? (
                      <>
                        <RotateCw className="w-5 h-5 animate-spin" />
                        <span>Verifying payment...</span>
                      </>
                    ) : paymentPendingState?.kind === 'DISPATCH' ? (
                      <>
                        <RotateCw className="w-5 h-5" />
                        <span>Payment received · Retry dispatch above</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-emerald-100" />
                        <span>{paymentFailedState ? 'Retry Payment' : 'Pay Now'} · ₹{grandTotal.toFixed(0)}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Safe reconciliation link if an order was created */}
                  {activeOrderId && !paymentPendingState && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => handleManualStatusCheck(activeOrderId)}
                        disabled={isCheckingStatus}
                        className="text-[11px] font-semibold text-[#008F25] hover:text-[#00B32D] underline underline-offset-2 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                      >
                        <RotateCw className={`w-3 h-3 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                        <span>Already completed UPI payment? Click here to check status</span>
                      </button>
                    </div>
                  )}

                  {/* Supported Payment Channels */}
                  <div className="pt-2 text-center space-y-2">
                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-[#646B65] font-medium px-1">
                      <span className="shrink-0">Supported:</span>
                      <span className="font-bold text-[#111111] shrink-0">UPI</span>
                      <span className="text-[#E1E7E1]">·</span>
                      <span className="font-bold text-[#111111] shrink-0">Google Pay</span>
                      <span className="text-[#E1E7E1]">·</span>
                      <span className="font-bold text-[#111111] shrink-0">PhonePe</span>
                      <span className="text-[#E1E7E1]">·</span>
                      <span className="font-bold text-[#111111] shrink-0">Paytm</span>
                      <span className="text-[#E1E7E1]">·</span>
                      <span className="font-bold text-[#111111] shrink-0">Cards</span>
                      <span className="text-[#E1E7E1]">·</span>
                      <span className="font-bold text-[#111111] shrink-0">NetBanking</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-[#646B65] font-mono px-1">
                      <Lock className="w-3.5 h-3.5 text-[#00B32D] shrink-0" />
                      <span className="text-center">Razorpay Secure Checkout · Instant Printer Dispatch</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-semibold text-[#646B65] hover:text-[#111111] transition-colors"
                >
                  ← Back to Order Review
                </button>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: ORDER TRACKING SCREEN WITH CODE COPY & STATUS                     */}
          {/* ========================================================================= */}
          {currentStep === 4 && activeJob && (
            <motion.div
              key="step-tracking"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="max-w-md mx-auto space-y-6"
            >
              <div className="bg-white rounded-3xl border border-[#E1E7E1] p-6 sm:p-8 shadow-sm space-y-5 text-center">
                <div className="w-14 h-14 rounded-full bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center mx-auto shadow-2xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#008F25] uppercase tracking-widest font-mono">
                    Payment Confirmed · Order Dispatched
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-black text-[#111111] mt-1 font-mono tracking-tight">
                    {activeJob.id}
                  </h1>
                  <div className="pt-2 flex items-center justify-center">
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(activeJob.id);
                        showToast('Token Copied!', `Order code #${activeJob.id} copied to clipboard`, 'info', 3000);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F7F8F7] hover:bg-[#E1E7E1] active:scale-95 text-[#111111] border border-[#E1E7E1] text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#00B32D]" />
                      <span>Copy Order Token</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#646B65] mt-2">
                    Show this token code at <strong>{shop.name}</strong> counter to collect your prints.
                  </p>
                </div>

                {/* Queue Status Box */}
                <div className="p-4 bg-[#F7F8F7] rounded-2xl text-left space-y-2 border border-[#E1E7E1]">
                  <span className="text-xs font-bold text-[#111111] block">Queue Status</span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-[#008F25] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00B32D] shrink-0" />
                      <span>Payment Verified</span>
                    </div>
                    {(() => {
                      const status = activeJob.printStatus;
                      if (status === 'COMPLETED') {
                        return (
                          <div className="flex items-center gap-2 font-semibold text-[#008F25]">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#00B32D]" />
                            <span>Printed & Ready for Pickup</span>
                          </div>
                        );
                      }
                      if (status === 'SUBMITTED_TO_SPOOLER') {
                        return (
                          <div className="flex items-center gap-2 font-semibold text-emerald-700">
                            <RotateCw className="w-3.5 h-3.5 animate-spin text-[#00B32D] shrink-0" />
                            <span>Printer Processing Document</span>
                          </div>
                        );
                      }
                      if (status === 'AWAITING_RECONCILIATION' || status === 'REQUIRES_ATTENTION') {
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-amber-800">
                              <Printer className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              <span>Printing in Progress at Counter</span>
                            </div>
                            <p className="text-[11px] text-amber-700">
                              Your pages are queued at the shop counter. Please show your token #{activeJob.id} to collect them.
                            </p>
                          </div>
                        );
                      }
                      if (status === 'FAILED') {
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-rose-700">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                              <span>Print Queue Notice</span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Please ask the shop operator to release your print job or check printer paper.
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-2 font-semibold text-[#008F25]">
                          <RotateCw className="w-3.5 h-3.5 animate-spin text-[#00B32D] shrink-0" />
                          <span>Preparing & Spooling Document...</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="pt-2 text-xs text-[#646B65] flex justify-between border-t border-[#E1E7E1]">
                  <span>Total Paid: ₹{activeJob.totalAmount.toFixed(0)}</span>
                  <span>{files.length} document(s)</span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setCurrentStep(1);
                      setActiveJob(null);
                      setFiles([]);
                    }}
                    className="flex-1 h-11 bg-[#F7F8F7] hover:bg-[#E1E7E1] active:scale-95 text-[#111111] border border-[#E1E7E1] font-bold text-xs rounded-xl cursor-pointer transition-all"
                  >
                    Print More
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="flex-1 h-11 bg-[#00B32D] hover:bg-[#008F25] active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 4. PDF & DOCUMENT PRINT PREVIEW MODAL */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-[#E1E7E1] space-y-4 my-auto font-sans"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3 border-b border-[#E1E7E1] gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      previewFile.fileType.includes('pdf') || previewFile.fileName.endsWith('.pdf')
                        ? 'bg-[#E8F8EC] text-[#00B32D]'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {previewFile.fileType.includes('pdf') || previewFile.fileName.endsWith('.pdf') ? (
                      <FileText className="w-5 h-5 text-[#00B32D]" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm sm:text-base text-[#111111] truncate" title={previewFile.fileName}>
                      {previewFile.fileName}
                    </h3>
                    <p className="text-xs text-[#646B65] mt-0.5 font-medium">
                      {(previewFile.fileSize / 1024 / 1024).toFixed(1)} MB · {previewFile.estimatedPages} page
                      {previewFile.estimatedPages > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 text-slate-400 hover:text-[#111111] rounded-xl hover:bg-[#F7F8F7] cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Print Config Summary Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                <span className="px-2.5 py-1 bg-[#E8F8EC] text-[#008F25] border border-[#A7F3D0] rounded-xl">
                  {previewFile.color === 'COLOR' ? '🎨 Colour Print' : '⬛ B&W Print'}
                </span>
                <span className="px-2.5 py-1 bg-[#F7F8F7] text-[#111111] border border-[#E1E7E1] rounded-xl">
                  📄 {previewFile.paperSize}
                </span>
                <span className="px-2.5 py-1 bg-[#F7F8F7] text-[#111111] border border-[#E1E7E1] rounded-xl">
                  {previewFile.sides === 'DOUBLE' ? '🔁 Double Sided' : '⏹ Single Sided'}
                </span>
                <span className="px-2.5 py-1 bg-[#F7F8F7] text-[#111111] border border-[#E1E7E1] rounded-xl">
                  {previewFile.orientation === 'LANDSCAPE' ? '↔ Landscape' : '↕ Portrait'}
                </span>
                <span className="px-2.5 py-1 bg-[#F7F8F7] text-[#111111] border border-[#E1E7E1] rounded-xl">
                  {previewFile.pagesPerSheet || 1} page/sheet
                </span>
                {previewFile.pageSelection === 'CUSTOM' && previewFile.customRange && (
                  <span className="px-2.5 py-1 bg-[#E8F8EC] text-[#008F25] border border-[#A7F3D0] rounded-xl font-mono">
                    Pages: {previewFile.customRange}
                  </span>
                )}
              </div>

              {/* Unified Document Preview Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-[#111111] uppercase tracking-wider">
                    Document Preview
                  </h4>
                  <span className="text-[11px] text-[#646B65] font-medium">
                    {previewFile.estimatedPages} page{previewFile.estimatedPages > 1 ? 's' : ''} · {previewFile.paperSize}
                  </span>
                </div>

                <div className="bg-[#F7F8F7] rounded-2xl border border-[#E1E7E1] p-2 sm:p-3 flex items-center justify-center min-h-[340px] max-h-[490px] overflow-hidden w-full">
                  {previewFile.fileType.startsWith('image/') && previewFile.previewUrl ? (
                    <div
                      className={`bg-white p-3 rounded-xl shadow-md border border-[#E1E7E1] max-h-80 overflow-hidden flex items-center justify-center ${
                        previewFile.color === 'BW' ? 'grayscale contrast-125' : ''
                      }`}
                    >
                      <img
                        src={previewFile.previewUrl}
                        alt={previewFile.fileName}
                        className="max-h-72 w-auto object-contain rounded-lg"
                      />
                    </div>
                  ) : (
                    <ContinuousPdfViewer
                      fileBlob={sourceFilesRef.current.get(previewFile.id)}
                      fileUrl={previewFile.previewUrl}
                      fileName={previewFile.fileName}
                      colorMode={previewFile.color}
                      onClose={() => setPreviewFile(null)}
                    />
                  )}
                </div>
              </div>

              {/* Modal Footer with Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs text-[#646B65]">
                  <span>Price for this file: </span>
                  <span className="font-mono font-extrabold text-[#111111] text-sm">
                    ₹{previewFile.totalPrice.toFixed(0)}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedFileIds((p) => ({ ...p, [previewFile.id]: true }));
                      setPreviewFile(null);
                      setCurrentStep(1);
                    }}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-[#F7F8F7] hover:bg-[#E1E7E1] text-[#111111] border border-[#E1E7E1] text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#00B32D]" />
                    <span>Change Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFile(null)}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-[#00B32D] hover:bg-[#008F25] text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs"
                  >
                    Done Reviewing
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer Error Popup Modal */}
      <CustomerErrorModal
        error={customerErrorModal}
        onClose={() => setCustomerErrorModal(null)}
        onChooseAnother={() => {
          setCustomerErrorModal(null);
          const el = document.getElementById(fileInputId);
          if (el) el.click();
        }}
      />

      {/* Help Modal */}
      <AnimatePresence>
        {helpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-['Manrope',sans-serif]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#111111]/40 backdrop-blur-sm"
              onClick={() => setHelpOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden relative flex flex-col z-10 border border-[#E1E7E1]"
            >
              <div className="p-6 border-b border-[#E1E7E1] flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-[#111111]">How to Print</h2>
                <button onClick={() => setHelpOpen(false)} className="p-2 hover:bg-[#F7F8F7] rounded-full transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-[#646B65]" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 bg-[#F7F8F7]/50">
                <p className="text-sm text-[#646B65]">Follow these simple steps to upload your documents and get your prints.</p>
                
                <div className="space-y-4">
                  {[
                    { icon: Upload, title: 'Upload Documents', desc: 'Choose PDF, JPG or PNG files from your device. You can upload multiple documents.' },
                    { icon: Edit3, title: 'Choose Print Settings', desc: 'Select your preferred print options, such as black & white or colour, paper size, number of copies and orientation.' },
                    { icon: Eye, title: 'Review Your Documents', desc: 'Check your document preview, selected print settings and estimated price before continuing.' },
                    { icon: CreditCard, title: 'Make Payment', desc: 'Complete your order payment using the available payment options.' },
                    { icon: Printer, title: 'Collect Your Prints', desc: 'Once your order is processed, visit the shop and collect your printed documents.' },
                  ].map((step, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white border border-[#E1E7E1] shadow-2xs">
                      <div className="w-10 h-10 rounded-xl bg-[#E8F8EC] flex items-center justify-center shrink-0 border border-[#A7F3D0]">
                        <step.icon className="w-5 h-5 text-[#00B32D]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-[#111111]">{i + 1}. {step.title}</h4>
                        <p className="text-xs text-[#646B65] mt-1 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-[#E1E7E1] space-y-4">
                  <h3 className="text-sm font-bold text-[#111111]">Frequently Asked Questions</h3>
                  <div className="space-y-3">
                    {[
                      { q: 'Which file formats are supported?', a: 'PDF, JPG and PNG, subject to the displayed file size limit.' },
                      { q: 'Can I print multiple copies?', a: 'Yes. Select the required number of copies in Print Settings.' },
                      { q: 'Can I select specific pages?', a: 'Yes. Use Custom Pages in Print Settings.' },
                      { q: 'Why can\'t I upload documents?', a: 'Uploading may be paused when the print shop or its connected agent is offline. Try again when the shop is online.' },
                    ].map((faq, i) => (
                      <div key={i}>
                        <p className="text-xs font-bold text-[#111111]">{faq.q}</p>
                        <p className="text-xs text-[#646B65] mt-0.5 leading-relaxed">{faq.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Temporary Status Popup for Refresh Button Loading Feedback */}
      <AnimatePresence>
        {isManualCheckingStatus && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-white border border-[#E1E7E1] rounded-2xl shadow-xl text-[#111111] font-['Manrope',sans-serif] text-xs sm:text-sm font-medium pointer-events-none"
          >
            <RotateCw className="w-4 h-4 text-[#00B32D] animate-spin shrink-0" />
            <span>Checking shop status...</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
