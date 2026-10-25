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
  Search
} from 'lucide-react';
import { validatePhone, validatePageRange } from '../../lib/validation';
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
  const [alternativeShops, setAlternativeShops] = useState<Array<{ id: string; name: string; slug: string; isAvailable?: boolean }>>([]);

  const checkAgentAvailability = React.useCallback(async (targetSlugOrId?: string) => {
    const queryTarget = targetSlugOrId || shopSlug || remoteShop?.slug || activeShop?.slug || activeShop?.id;
    if (!queryTarget) return null;
    setIsCheckingAgentStatus(true);
    try {
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
  }, [shopSlug, remoteShop?.slug, activeShop?.slug, activeShop?.id]);

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
    return Array.from(sizeSet);
  }, [effectivePricingRules, shop?.id, remoteShop, activeShop?.id]);

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
  const [previewMode, setPreviewMode] = useState<'SHEET' | 'NATIVE'>('SHEET');

  // 2-in-1 ID Card Merge State
  const [uploadMode, setUploadMode] = useState<'STANDARD' | 'ID_MERGE'>('STANDARD');
  const [idCardType, setIdCardType] = useState<string>('Aadhaar Card');
  const [frontSide, setFrontSide] = useState<{ file: File; url: string; name: string } | null>(null);
  const [backSide, setBackSide] = useState<{ file: File; url: string; name: string } | null>(null);

  // Existing files merge modal
  const [showExistingMergeModal, setShowExistingMergeModal] = useState<boolean>(false);
  const [mergeSelectedFrontId, setMergeSelectedFrontId] = useState<string>('');
  const [mergeSelectedBackId, setMergeSelectedBackId] = useState<string>('');

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
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      if (file.size <= 0) {
        setUploadError(`"${file.name}" is empty (0 bytes).`);
        continue;
      }

      if (file.size > 50 * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the 50MB file size limit.`);
        continue;
      }

      const lowerName = file.name.toLowerCase();
      const isAllowedExt =
        lowerName.endsWith('.pdf') ||
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.webp');

      const isAllowedMime =
        !file.type ||
        file.type === 'application/pdf' ||
        file.type === 'image/jpeg' ||
        file.type === 'image/png' ||
        file.type === 'image/webp';

      if (!isAllowedExt || !isAllowedMime) {
        setUploadError(`"${file.name}" is not permitted. Only PDF, JPEG, PNG, and WEBP are accepted.`);
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

    // Finalize document metadata and previews.
    setTimeout(() => {
      const newConfigs: FilePrintConfig[] = [];
      const newExpanded: Record<string, boolean> = { ...expandedFileIds };

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        const estimatedPages = isPdf ? Math.floor(Math.random() * 3) + 2 : 1;
        const fileId = `f_${Date.now()}_${i}`;
        sourceFilesRef.current.set(fileId, file);

        const defaultConfig: FilePrintConfig = {
          id: fileId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'application/octet-stream',
          previewUrl: file.type.startsWith('image/') || isPdf ? URL.createObjectURL(file) : undefined,
          estimatedPages,
          paperSize: 'A4',
          color: 'BW',
          sides: 'SINGLE',
          orientation: 'PORTRAIT',
          copies: 1,
          pageSelection: 'ALL',
          pagesPerSheet: 1,
          unitPrice: 2.0,
          totalPrice: 2.0 * estimatedPages
        };

        defaultConfig.unitPrice = calculateUnitPrice(defaultConfig.paperSize, defaultConfig.color || 'BW', defaultConfig.sides);
        defaultConfig.totalPrice = calculateFileTotal(defaultConfig);

        newConfigs.push(defaultConfig);
        newExpanded[fileId] = true;
      }

      setFiles((prev) => [...prev, ...newConfigs]);
      setExpandedFileIds(newExpanded);
      setUploadingQueue([]);
    }, 600);

    e.target.value = '';
  };

  // Handler for ID Card Front side upload
  const handleFrontSideUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (agentStatus && !agentStatus.isAvailable) {
      showToast('Shop Offline', agentStatus.message || 'This print shop is currently offline. File uploads are disabled.', 'error', 5000);
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setUploadError(`"${file.name}" exceeds the 50MB file size limit.`);
      return;
    }
    const url = URL.createObjectURL(file);
    setFrontSide({ file, url, name: file.name });
    setUploadError(null);
    e.target.value = '';
  };

  // Handler for ID Card Back side upload
  const handleBackSideUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (agentStatus && !agentStatus.isAvailable) {
      showToast('Shop Offline', agentStatus.message || 'This print shop is currently offline. File uploads are disabled.', 'error', 5000);
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setUploadError(`"${file.name}" exceeds the 50MB file size limit.`);
      return;
    }
    const url = URL.createObjectURL(file);
    setBackSide({ file, url, name: file.name });
    setUploadError(null);
    e.target.value = '';
  };

  // Merge the Front + Back ID Card into 1 Single A4 Page item
  const handleMergeIdCard = () => {
    if (!frontSide && !backSide) {
      setUploadError('Please upload at least the Front side or Back side of the ID card.');
      return;
    }

    setUploadError(null);
    const fileId = `id_merge_${Date.now()}`;
    const cleanTypeName = idCardType.trim().replace(/\s+/g, '_');
    const fileName = `${cleanTypeName}_Front_Back_1Page.pdf`;

    const mergedConfig: FilePrintConfig = {
      id: fileId,
      fileName,
      fileSize: (frontSide?.file.size || 0) + (backSide?.file.size || 0) || 1.2 * 1024 * 1024,
      fileType: 'application/pdf',
      previewUrl: frontSide?.url || backSide?.url,
      frontPreviewUrl: frontSide?.url,
      backPreviewUrl: backSide?.url,
      isIdCardMerge: true,
      idCardType,
      estimatedPages: 1, // Crucial: Both sides on 1 page!
      paperSize: 'A4',
      color: 'COLOR',
      sides: 'SINGLE',
      orientation: 'PORTRAIT',
      copies: 1,
      pageSelection: 'ALL',
      pagesPerSheet: 1,
      unitPrice: 10.0,
      totalPrice: 10.0
    };

    mergedConfig.unitPrice = calculateUnitPrice(mergedConfig.paperSize, mergedConfig.color || 'COLOR', mergedConfig.sides);
    mergedConfig.totalPrice = calculateFileTotal(mergedConfig);

    setFiles((prev) => [...prev, mergedConfig]);
    setExpandedFileIds((prev) => ({ ...prev, [fileId]: true }));

    // Reset front and back
    setFrontSide(null);
    setBackSide(null);

    showToast(
      'ID Card 2-in-1 Merged!',
      `Configured ${idCardType} (Front & Back) on 1 single page.`,
      'success',
      4000
    );
  };

  // Merge 2 existing uploaded files from the list into 1 Page
  const handleMergeExistingFiles = () => {
    if (!mergeSelectedFrontId || !mergeSelectedBackId) {
      setUploadError('Please select both Front side and Back side files to merge.');
      return;
    }
    if (mergeSelectedFrontId === mergeSelectedBackId) {
      setUploadError('Please select two distinct files (Front and Back cannot be the same file).');
      return;
    }

    const frontF = files.find((f) => f.id === mergeSelectedFrontId);
    const backF = files.find((f) => f.id === mergeSelectedBackId);
    if (!frontF || !backF) return;

    const fileId = `id_merge_${Date.now()}`;
    const mergedConfig: FilePrintConfig = {
      id: fileId,
      fileName: `ID_Card_Front_Back_Merged_1Page.pdf`,
      fileSize: frontF.fileSize + backF.fileSize,
      fileType: 'application/pdf',
      previewUrl: frontF.previewUrl || backF.previewUrl,
      frontPreviewUrl: frontF.previewUrl,
      backPreviewUrl: backF.previewUrl,
      isIdCardMerge: true,
      idCardType: 'ID / Aadhaar Card',
      estimatedPages: 1,
      paperSize: 'A4',
      color: frontF.color || 'BW',
      sides: 'SINGLE',
      orientation: 'PORTRAIT',
      copies: frontF.copies || 1,
      pageSelection: 'ALL',
      pagesPerSheet: 1,
      unitPrice: 2.0,
      totalPrice: 2.0
    };

    mergedConfig.unitPrice = calculateUnitPrice(mergedConfig.paperSize, mergedConfig.color || 'BW', mergedConfig.sides);
    mergedConfig.totalPrice = calculateFileTotal(mergedConfig);

    setFiles((prev) => [
      ...prev.filter((f) => f.id !== frontF.id && f.id !== backF.id),
      mergedConfig
    ]);
    setExpandedFileIds((prev) => ({ ...prev, [fileId]: true }));
    setShowExistingMergeModal(false);
    setMergeSelectedFrontId('');
    setMergeSelectedBackId('');

    showToast(
      'Files Merged to 1 Page!',
      `Merged into 1 single A4 page with Front and Back sides.`,
      'success',
      4000
    );
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
        error?: string;
        job?: { id?: string; trackingToken?: string };
        statusMessage?: string;
        agentOnline?: boolean;
      };
      if (!response.ok || !result.success || !result.job?.id) {
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-24">
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
      {/* 1. TOP HEADER (Matching Reference QuickPrint / Campus Copy Centre) */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs font-heading">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Printer className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="font-heading font-bold text-base sm:text-xl text-slate-900 block truncate max-w-[180px] sm:max-w-xs leading-tight tracking-tight">
                  {shop.name}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold tracking-tight truncate block max-w-[180px] sm:max-w-xs">
                  {shop.city || 'Counter Print Portal'}
                </span>
              </div>
            </div>

            {/* Mobile Track Print button inside top row on small screens */}
            <div className="flex sm:hidden items-center gap-2">
              <a
                href="#/track-print"
                className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 flex items-center gap-1 shrink-0"
              >
                <Search className="w-3 h-3" />
                <span>Track</span>
              </a>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <div className="hidden sm:flex items-center gap-2">
              <a
                href="#/track-print"
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition-colors flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Track Print</span>
              </a>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 truncate w-full sm:w-auto justify-center sm:justify-start">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
              <span className="hidden md:inline">Files are automatically deleted after printing</span>
              <span className="inline md:hidden">Auto-deleted after printing</span>
            </div>
          </div>
        </div>

        {/* 2. PROGRESS STEPPER (Only Upload, Review, Pay) */}
        {currentStep <= 3 && (
          <div className="border-t border-slate-100 bg-white py-3 px-4">
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
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-600 text-white ring-2 ring-blue-600/20'
                  }`}
                >
                  {currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
                </div>
                <span className={currentStep >= 1 ? 'text-blue-700' : 'text-slate-400'}>Upload</span>
              </button>

              <div
                className={`h-0.5 flex-1 mx-3 sm:mx-4 transition-colors ${
                  currentStep >= 2 ? 'bg-blue-600' : 'bg-slate-200'
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
                      ? 'bg-blue-600 text-white'
                      : currentStep === 2
                      ? 'bg-blue-600 text-white ring-2 ring-blue-600/20'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {currentStep > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
                </div>
                <span className={currentStep >= 2 ? 'text-blue-700' : 'text-slate-400'}>Review</span>
              </button>

              <div
                className={`h-0.5 flex-1 mx-3 sm:mx-4 transition-colors ${
                  currentStep >= 3 ? 'bg-blue-600' : 'bg-slate-200'
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
                      ? 'bg-blue-600 text-white ring-2 ring-blue-600/20'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  3
                </div>
                <span className={currentStep === 3 ? 'text-blue-700' : 'text-slate-400'}>Pay</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 3. MAIN WORKSPACE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
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
              className="max-w-3xl mx-auto space-y-6"
            >
              <div>
                <span className="text-[11px] font-bold tracking-wider text-blue-600 uppercase block mb-1 font-mono">
                  STEP 1 OF 3
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Upload Documents
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Upload your files, then choose print settings for each one.
                </p>
              </div>

              {/* SHOP AGENT OFFLINE / PRINTER UNAVAILABLE WARNING BANNER */}
              {agentStatus && !agentStatus.isAvailable && (
                <div className="p-5 bg-rose-50 border-2 border-rose-200 rounded-3xl text-rose-950 space-y-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-rose-950">
                        {agentStatus.reason === 'PRINTER_UNAVAILABLE' ? 'Print Agent Connected · No Printer Ready' : 'This Print Shop is Currently Offline'}
                      </h3>
                      <p className="text-xs text-rose-800 mt-0.5 font-medium leading-relaxed">
                        {agentStatus.message}
                      </p>
                      <p className="text-[11px] text-rose-700/90 mt-1 italic">
                        Document uploads and orders are paused until the shop agent connects.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void checkAgentAvailability()}
                      disabled={isCheckingAgentStatus}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isCheckingAgentStatus ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {alternativeShops.length > 0 && (
                    <div className="pt-3 border-t border-rose-200/80 text-xs">
                      <span className="font-bold text-rose-900 block mb-2 uppercase text-[10px] tracking-wider">
                        Available Nearby Print Shops (Online):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {alternativeShops.map((alt) => (
                          <button
                            key={alt.id}
                            type="button"
                            onClick={() => navigate(`/print/${alt.slug}`)}
                            className="p-2.5 bg-white hover:bg-rose-100/50 border border-rose-200 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate">{alt.name}</span>
                              <span className="text-[10px] text-emerald-600 font-bold">● Online & Ready</span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-rose-600 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Mode Switcher: Standard Documents vs ID / Aadhaar 2-in-1 Merge */}
              <div className="flex flex-col sm:flex-row p-1 bg-slate-200/80 rounded-2xl max-w-md mx-auto gap-1">
                <button
                  type="button"
                  onClick={() => setUploadMode('STANDARD')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    uploadMode === 'STANDARD'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Standard Files</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('ID_MERGE')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    uploadMode === 'ID_MERGE'
                      ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-blue-600/20'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>ID / Aadhaar 2-in-1</span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md shrink-0">
                    Merge
                  </span>
                </button>
              </div>

              {uploadMode === 'STANDARD' ? (
                /* Standard Upload Box */
                <div className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-white rounded-3xl p-6 sm:p-8 text-center shadow-xs transition-colors">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                    {uploadingQueue.length > 0 ? (
                      <RotateCw className="w-6 h-6 animate-spin text-blue-600" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    {uploadingQueue.length > 0 ? 'Preparing documents...' : 'Upload your documents'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-5">
                    PDF, JPG and PNG supported · Up to 50 MB each
                  </p>

                  <div className="flex items-center justify-center">
                    <label
                      htmlFor={uploadingQueue.length > 0 || maintenanceMode || (agentStatus !== null && !agentStatus.isAvailable) ? undefined : fileInputId}
                      className={`h-11 px-6 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all ${
                        maintenanceMode || (agentStatus !== null && !agentStatus.isAvailable)
                          ? 'bg-slate-300 text-slate-600 cursor-not-allowed opacity-90'
                          : uploadingQueue.length > 0
                          ? 'bg-blue-400 text-white cursor-wait opacity-80'
                          : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white cursor-pointer'
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

                  <p className="text-[11px] text-slate-400 mt-3 font-medium">or drag and drop files here</p>
                </div>
              ) : (
                /* ID / Aadhaar 2-in-1 Merger Box */
                <div className="bg-white rounded-3xl border border-blue-200/90 p-5 sm:p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                        <h2 className="text-base font-bold text-slate-900">
                          Aadhaar / ID Card 2-in-1 Print (Single Page)
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Upload Front & Back sides — both print neatly on 1 single A4 sheet (standard Xerox format)
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                      1 Page Xerox Rate
                    </span>
                  </div>

                  {/* ID Card Type Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Select Document Type:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Aadhaar Card', 'PAN Card', 'Driving License', 'Voter ID', 'Student / Work ID'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setIdCardType(type)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            idCardType === type
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2 Side Upload Boxes: Front Side & Back Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* 1. FRONT SIDE */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/70 rounded-2xl p-4 text-center transition-colors relative flex flex-col items-center justify-center min-h-[160px]">
                      {frontSide ? (
                        <div className="w-full space-y-2">
                          <div className="relative w-full max-w-[220px] aspect-[85.6/53.98] mx-auto rounded-xl border border-slate-300 shadow-2xs overflow-hidden bg-white">
                            <img src={frontSide.url} alt="Front ID" className="w-full h-full object-cover" />
                            <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-black tracking-wide">
                              FRONT SIDE ✓
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-bold truncate max-w-[200px] mx-auto">
                            {frontSide.name}
                          </p>
                          <div className="flex items-center justify-center gap-2">
                            <label className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer">
                              Replace
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleFrontSideUpload}
                                className="hidden"
                              />
                            </label>
                            <span className="text-slate-300">·</span>
                            <button
                              type="button"
                              onClick={() => setFrontSide(null)}
                              className="text-[11px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="cursor-pointer w-full flex flex-col items-center justify-center p-2">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                            <Camera className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-slate-900 block">1. Front Side</span>
                          <span className="text-[11px] text-slate-500 mt-0.5">Photo & Details side</span>
                          <span className="mt-2.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-600 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs inline-block">
                            Choose Front Side
                          </span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFrontSideUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* 2. BACK SIDE */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/70 rounded-2xl p-4 text-center transition-colors relative flex flex-col items-center justify-center min-h-[160px]">
                      {backSide ? (
                        <div className="w-full space-y-2">
                          <div className="relative w-full max-w-[220px] aspect-[85.6/53.98] mx-auto rounded-xl border border-slate-300 shadow-2xs overflow-hidden bg-white">
                            <img src={backSide.url} alt="Back ID" className="w-full h-full object-cover" />
                            <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-black tracking-wide">
                              BACK SIDE ✓
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-bold truncate max-w-[200px] mx-auto">
                            {backSide.name}
                          </p>
                          <div className="flex items-center justify-center gap-2">
                            <label className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer">
                              Replace
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleBackSideUpload}
                                className="hidden"
                              />
                            </label>
                            <span className="text-slate-300">·</span>
                            <button
                              type="button"
                              onClick={() => setBackSide(null)}
                              className="text-[11px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="cursor-pointer w-full flex flex-col items-center justify-center p-2">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                            <Camera className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-slate-900 block">2. Back Side</span>
                          <span className="text-[11px] text-slate-500 mt-0.5">Address & QR Code side</span>
                          <span className="mt-2.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-600 text-xs font-bold rounded-xl border border-blue-200 shadow-2xs inline-block">
                            Choose Back Side
                          </span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleBackSideUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Merge Action Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleMergeIdCard}
                      disabled={!frontSide && !backSide}
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Merge Front & Back onto 1 Page · Add to Print</span>
                    </button>
                  </div>
                </div>
              )}

                {/* Live Upload Loading Progress Status Card */}
                {uploadingQueue.length > 0 && (
                  <div className="space-y-2.5">
                    {uploadingQueue.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-blue-200 p-4 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <RotateCw className="w-4 h-4 animate-spin" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 truncate block max-w-[200px] sm:max-w-md">
                                {item.name}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {(item.size / 1024 / 1024).toFixed(1)} MB · Uploading & processing pages...
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-blue-600 text-xs shrink-0">
                            {item.progress}%
                          </span>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
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
                        <h2 className="text-base font-bold text-slate-900">Your files</h2>
                        <span className="text-xs text-slate-500 font-medium">
                          {files.length} document{files.length !== 1 ? 's' : ''} added
                        </span>
                      </div>

                      <label
                        htmlFor={fileInputId}
                        className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all hover:border-slate-300 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 text-slate-600" />
                        <span>Add more files</span>
                      </label>
                    </div>

                    {/* Expandable File Cards List (Matching Reference UI) */}
                    <div className="space-y-4">
                      {files.map((file) => {
                        const isExpanded = expandedFileIds[file.id] ?? false;
                        const isPdf = file.fileType.includes('pdf') || file.fileName.endsWith('.pdf');

                        return (
                          <div
                            key={file.id}
                            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
                          >
                            {/* Card Header Row */}
                            <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                                    isPdf ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                                  }`}
                                >
                                  {isPdf ? (
                                    <FileText className="w-5 h-5 text-red-600" />
                                  ) : (
                                    <ImageIcon className="w-5 h-5 text-emerald-600" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-md">
                                    {file.fileName}
                                  </h3>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                                    <span>{(file.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                                    <span>·</span>
                                    <span>{file.estimatedPages} page{file.estimatedPages > 1 ? 's' : ''}</span>
                                    <span>·</span>
                                    <span>{file.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'}</span>
                                  </div>
                                  <div className="mt-1">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      <span>Ready</span>
                                    </span>
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
                            <div className="px-4 sm:px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                              <button
                                onClick={() => setPreviewFile(file)}
                                className="text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview</span>
                              </button>

                              <button
                                onClick={() => toggleExpand(file.id)}
                                className="text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer font-bold"
                              >
                                <span>{isExpanded ? 'Hide settings' : 'Configure'}</span>
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>

                            {/* Collapsible Print Settings Area */}
                            {isExpanded && (
                              <div className="p-4 sm:p-5 border-t border-slate-100 space-y-4 bg-white">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-slate-900">Print settings</h4>
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                    For this file only
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                  {/* 1. Print Type (B&W vs Colour) */}
                                  <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Print type</label>
                                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                                      <button
                                        type="button"
                                        onClick={() => updateFileConfig(file.id, { color: 'BW' })}
                                        className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                          file.color === 'BW'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-600 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                      >
                                        B&W
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateFileConfig(file.id, { color: 'COLOR' })}
                                        className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                          file.color === 'COLOR'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-600 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                      >
                                        Colour
                                      </button>
                                    </div>
                                  </div>

                                  {/* 2. Print Sides (Single vs Double) */}
                                  <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Print sides</label>
                                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                                      <button
                                        type="button"
                                        onClick={() => updateFileConfig(file.id, { sides: 'SINGLE' })}
                                        className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer truncate px-0.5 ${
                                          file.sides === 'SINGLE'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-600 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                      >
                                        Single Side
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateFileConfig(file.id, { sides: 'DOUBLE' })}
                                        className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer truncate px-0.5 ${
                                          file.sides === 'DOUBLE'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-600 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                      >
                                        Double Side
                                      </button>
                                    </div>
                                  </div>

                                  {/* 3. Paper Size Selection */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <label className="text-xs font-bold text-slate-700 block">Paper size</label>
                                      <span className="text-[10px] text-blue-600 font-bold">{file.paperSize || 'A4'}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
                                      {activeShopSizes.map((sz) => {
                                        const isSelected = (file.paperSize || 'A4') === sz;
                                        return (
                                          <button
                                            key={sz}
                                            type="button"
                                            onClick={() => updateFileConfig(file.id, { paperSize: sz as PaperSize })}
                                            className={`flex-1 min-w-[50px] py-1.5 px-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center truncate ${
                                              isSelected
                                                ? 'bg-blue-50 text-blue-700 border border-blue-600 shadow-2xs font-extrabold'
                                                : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                            title={sz}
                                          >
                                            {sz}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* 4. Copies Counter [-] 1 [+] */}
                                  <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Copies</label>
                                    <div className="flex items-center justify-between p-1 bg-slate-100 rounded-xl h-10 px-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateFileConfig(file.id, { copies: Math.max(1, (file.copies || 1) - 1) })
                                        }
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white hover:bg-slate-200 active:scale-95 flex items-center justify-center font-bold text-slate-700 cursor-pointer shadow-2xs"
                                      >
                                        <Minus className="w-3.5 h-3.5" />
                                      </button>
                                      <span className="font-extrabold text-sm font-mono text-slate-900">
                                        {file.copies || 1}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateFileConfig(file.id, { copies: (file.copies || 1) + 1 })
                                        }
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white hover:bg-slate-200 active:scale-95 flex items-center justify-center font-bold text-slate-700 cursor-pointer shadow-2xs"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* 5. Orientation */}
                                  <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Orientation</label>
                                    <select
                                      value={file.orientation || 'PORTRAIT'}
                                      onChange={(e) =>
                                        updateFileConfig(file.id, { orientation: e.target.value as any })
                                      }
                                      className="w-full h-10 px-3 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-xl text-[11px] sm:text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer transition-colors"
                                    >
                                      <option value="PORTRAIT">Auto (Portrait)</option>
                                      <option value="LANDSCAPE">Auto (Landscape)</option>
                                    </select>
                                  </div>

                                  {/* 6. Pages per sheet */}
                                  <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Pages per sheet</label>
                                    <select
                                      value={file.pagesPerSheet || 1}
                                      onChange={(e) =>
                                        updateFileConfig(file.id, { pagesPerSheet: Number(e.target.value) as PagesPerSheet })
                                      }
                                      className="w-full h-10 px-3 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-xl text-[11px] sm:text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer transition-colors"
                                    >
                                      <option value={1}>1 page/sheet</option>
                                      <option value={2}>2 pages/sheet (N-up)</option>
                                      <option value={4}>4 pages/sheet</option>
                                    </select>
                                  </div>

                                  {/* 7. Pages to Print (Spans 2 columns) */}
                                  <div className="col-span-2 pt-1">
                                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Pages to print</label>
                                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-2">
                                      <button
                                        type="button"
                                        onClick={() => updateFileConfig(file.id, { pageSelection: 'ALL' })}
                                        className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                          file.pageSelection === 'ALL'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-600 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                      >
                                        All Pages
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateFileConfig(file.id, { pageSelection: 'CUSTOM' })}
                                        className={`py-2 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                          file.pageSelection === 'CUSTOM'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-600 shadow-2xs'
                                            : 'text-slate-600 hover:text-slate-900'
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
                                          className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-600"
                                        />
                                        <p className="text-[10px] text-slate-400">
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
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3.5 bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 block">Ready to print</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-black font-mono text-slate-900">
                            {files.length} Document{files.length > 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-slate-400">· Review details in next step</span>
                        </div>
                      </div>

                      <button
                        onClick={handleProceedToReview}
                        className="w-full sm:w-auto h-12 px-7 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
                  <span>Back to Upload</span>
                </button>
                <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase font-mono">
                  STEP 2 OF 3
                </span>
              </div>

              <div className="text-center space-y-0.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Review your print order
                </h1>
                <p className="text-xs text-slate-500">
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
                      className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3"
                    >
                      {/* Top Row: Icon + Title/Details + Price */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isPdf ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {isPdf ? (
                              <FileText className="w-4 h-4 text-red-600" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {file.fileName}
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {pagesToPrint} page{pagesToPrint > 1 ? 's' : ''} · {file.copies} cop{file.copies > 1 ? 'ies' : 'y'}
                            </p>
                          </div>
                        </div>

                        {/* Top-Right Price */}
                        <div className="shrink-0 text-right">
                          <span className="font-mono font-black text-base sm:text-lg text-slate-900">
                            ₹{file.totalPrice.toFixed(0)}
                          </span>
                        </div>
                      </div>

                      {/* Middle Row: Pill Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                          {file.color === 'COLOR' ? 'Colour' : 'B&W'}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">{file.paperSize}</span>
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                          {file.sides === 'DOUBLE' ? 'Double Side' : 'Single Side'}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                          {file.pagesPerSheet || 1} page/sheet
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                          Auto ({file.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'})
                        </span>
                        {file.pageSelection === 'CUSTOM' && file.customRange && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono">
                            Pages: {file.customRange}
                          </span>
                        )}
                      </div>

                      {/* Bottom Row: Actions */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400 font-medium">Print specification</span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewFile(file);
                              setPreviewMode('SHEET');
                            }}
                            className="h-7 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setExpandedFileIds((p) => ({ ...p, [file.id]: true }));
                              setCurrentStep(1);
                            }}
                            className="h-7 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Calculation Card */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Printing Charges</span>
                  <span className="font-mono font-bold text-slate-800">₹{subtotal.toFixed(0)}</span>
                </div>

                <div className="pt-2 border-t border-dashed border-slate-200 flex items-baseline justify-between">
                  <span className="text-sm font-extrabold text-slate-900">Total</span>
                  <span className="text-xl font-black font-mono text-slate-950">₹{grandTotal.toFixed(0)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleProceedToPayment}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setCurrentStep(1)}
                  className="w-full py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 text-center transition-colors cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
                  <span>Back to Review</span>
                </button>
                <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase font-mono">
                  STEP 3 OF 3
                </span>
              </div>

              <div className="text-center space-y-0.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Complete Payment
                </h1>
                <p className="text-xs text-slate-500">
                  Pay securely to dispatch your print order to <strong>{shop.name}</strong>
                </p>
              </div>

              {/* Payment Card: Clean, Modern & Direct */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-sm space-y-5">
                {/* Header Price & Security Badge */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Total Payable Amount
                    </span>
                    <span className="font-mono font-black text-3xl text-slate-900 tracking-tight">
                      ₹{grandTotal.toFixed(0)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>100% Secure Payment</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">
                      Official Payment Gateway
                    </span>
                  </div>
                </div>

                {/* Print Order Summary Card */}
                <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between text-slate-800 font-bold">
                    <span className="uppercase tracking-wider text-[11px]">Order Summary</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {files.length} document{files.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {files.map((f, i) => (
                      <div key={f.id || i} className="p-2.5 bg-white rounded-xl border border-slate-200/70 space-y-1 text-left">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span className="truncate max-w-[220px]">{f.fileName}</span>
                          <span className="font-mono">₹{f.totalPrice.toFixed(0)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
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

                  <div className="pt-2 border-t border-slate-200 space-y-1.5 text-slate-600 text-left">
                    <div className="flex items-center justify-between">
                      <span>Printing Charges</span>
                      <span className="font-mono font-semibold text-slate-900">₹{subtotal.toFixed(0)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900 text-sm">
                      <span>Total Amount</span>
                      <span className="font-mono text-emerald-700 text-base">₹{grandTotal.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {/* Optional Mobile Number for SMS Token */}
                <div className="text-left space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Mobile Number for SMS Token <span className="text-[10px] text-slate-400 font-normal">(Optional)</span></span>
                    <span className="text-[10px] text-slate-400 font-mono">10 digits</span>
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
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
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
                        <Lock className="w-4 h-4 text-emerald-200" />
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
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                      >
                        <RotateCw className={`w-3 h-3 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                        <span>Already completed UPI payment? Click here to check status</span>
                      </button>
                    </div>
                  )}

                  {/* Supported Payment Channels */}
                  <div className="pt-2 text-center space-y-2">
                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-slate-500 font-medium px-1">
                      <span className="shrink-0">Supported:</span>
                      <span className="font-bold text-slate-800 shrink-0">UPI</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-bold text-slate-800 shrink-0">Google Pay</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-bold text-slate-800 shrink-0">PhonePe</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-bold text-slate-800 shrink-0">Paytm</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-bold text-slate-800 shrink-0">Cards</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-bold text-slate-800 shrink-0">NetBanking</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-slate-400 font-mono px-1">
                      <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-center">Razorpay Secure Checkout · Instant Printer Dispatch</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
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
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>

                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest font-mono">
                    Payment Confirmed · Order Dispatched
                  </span>
                  <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mt-1 font-mono tracking-tight">
                    {activeJob.id}
                  </h1>
                  <div className="pt-2 flex items-center justify-center">
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(activeJob.id);
                        showToast('Token Copied!', `Order code #${activeJob.id} copied to clipboard`, 'info', 3000);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Order Token</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Show this token code at <strong>{shop.name}</strong> counter to collect your prints.
                  </p>
                </div>

                {/* Queue Status Box */}
                <div className="p-4 bg-slate-50 rounded-2xl text-left space-y-2 border border-slate-100">
                  <span className="text-xs font-bold text-slate-800 block">Queue Status</span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Payment Verified</span>
                    </div>
                    <div className={`flex items-center gap-2 font-semibold ${
                      activeJob.printStatus === 'COMPLETED'
                        ? 'text-emerald-700'
                        : activeJob.printStatus === 'FAILED' || activeJob.printStatus === 'REQUIRES_ATTENTION'
                          ? 'text-amber-700'
                          : 'text-blue-700'
                    }`}>
                      {activeJob.printStatus === 'COMPLETED'
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        : activeJob.printStatus === 'FAILED' || activeJob.printStatus === 'REQUIRES_ATTENTION'
                          ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          : <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />}
                      <span>{activeJob.printStatus.replaceAll('_', ' ')}</span>
                    </div>
                    {activeJob.notes && (
                      <p className="text-xs text-amber-800">{activeJob.notes}</p>
                    )}
                  </div>
                </div>

                <div className="pt-2 text-xs text-slate-500 flex justify-between border-t border-slate-100">
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
                    className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-xs rounded-xl cursor-pointer transition-all"
                  >
                    Print More
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs"
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
              className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      previewFile.fileType.includes('pdf') || previewFile.fileName.endsWith('.pdf')
                        ? 'bg-red-50 text-red-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {previewFile.fileType.includes('pdf') || previewFile.fileName.endsWith('.pdf') ? (
                      <FileText className="w-5 h-5 text-red-600" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{previewFile.fileName}</h3>
                    <p className="text-[11px] text-slate-500">
                      {(previewFile.fileSize / 1024 / 1024).toFixed(1)} MB · {previewFile.estimatedPages} page
                      {previewFile.estimatedPages > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Print Config Summary Badges */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-600">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                  {previewFile.color === 'COLOR' ? '🎨 Colour Print' : '⬛ B&W Print'}
                </span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">📄 {previewFile.paperSize}</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                  {previewFile.sides === 'DOUBLE' ? '🔁 Double Sided' : '⏹ Single Sided'}
                </span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                  {previewFile.orientation === 'LANDSCAPE' ? '↔ Landscape' : '↕ Portrait'}
                </span>
                <span className="px-2 py-0.5 bg-slate-100 rounded-md">
                  {previewFile.pagesPerSheet || 1} page/sheet
                </span>
                {previewFile.pageSelection === 'CUSTOM' && previewFile.customRange && (
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md font-mono">
                    Pages: {previewFile.customRange}
                  </span>
                )}
              </div>

              {/* View Mode Switcher (For PDFs) */}
              {(previewFile.fileType.includes('pdf') || previewFile.fileName.endsWith('.pdf')) && previewFile.previewUrl && (
                <div className="flex items-center justify-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('SHEET')}
                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                      previewMode === 'SHEET'
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Print Sheet Simulation
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('NATIVE')}
                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                      previewMode === 'NATIVE'
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    PDF Document Viewer
                  </button>
                </div>
              )}

              {/* Preview Body */}
              <div className="bg-slate-100/90 rounded-2xl p-4 sm:p-6 flex items-center justify-center min-h-[300px] max-h-[420px] overflow-hidden">
                {/* 1. Image Preview with selected color filter */}
                {previewFile.fileType.startsWith('image/') && previewFile.previewUrl ? (
                  <div
                    className={`bg-white p-3 rounded-xl shadow-md border border-slate-200/80 max-h-72 overflow-hidden flex items-center justify-center ${
                      previewFile.color === 'BW' ? 'grayscale contrast-125' : ''
                    }`}
                  >
                    <img
                      src={previewFile.previewUrl}
                      alt={previewFile.fileName}
                      className="max-h-64 w-auto object-contain rounded-lg"
                    />
                  </div>
                ) : previewMode === 'NATIVE' && previewFile.previewUrl ? (
                  /* 2. Native PDF Document Viewer Embed */
                  <div className="w-full h-80 bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <iframe
                      src={`${previewFile.previewUrl}#toolbar=0&navpanes=0`}
                      title="PDF Preview"
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  /* 3. High-Fidelity Generated Print Sheet Simulation */
                  <div
                    className={`bg-white rounded-lg shadow-xl border border-slate-300/80 p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden transition-all ${
                      previewFile.orientation === 'LANDSCAPE'
                        ? 'w-full max-w-[380px] aspect-[1.414/1]'
                        : 'w-60 sm:w-64 aspect-[1/1.414]'
                    } ${previewFile.color === 'BW' ? 'grayscale' : ''}`}
                  >
                    {/* Background Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 rotate-[-30deg]">
                      <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-slate-900">
                        PRINT PREVIEW
                      </span>
                    </div>

                    {/* Sheet Header */}
                    <div className="space-y-2 z-10">
                      <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white ${
                              previewFile.color === 'COLOR' ? 'bg-blue-600' : 'bg-slate-700'
                            }`}
                          >
                            P
                          </div>
                          <span className="text-[10px] font-bold text-slate-800 truncate max-w-[140px]">
                            {previewFile.fileName}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400">
                          {previewFile.paperSize} · {previewFile.color === 'COLOR' ? 'Color' : 'B&W'}
                        </span>
                      </div>

                      {/* Header Highlight Band */}
                      <div
                        className={`h-2 rounded-full w-3/4 ${
                          previewFile.color === 'COLOR' ? 'bg-blue-600/80' : 'bg-slate-800'
                        }`}
                      />
                      <div className="h-1.5 rounded-full w-1/2 bg-slate-300" />
                    </div>

                    {/* Sheet Content Simulation (Simulated Paragraphs or 2-up layout) */}
                    <div className="py-2 space-y-2 z-10 flex-1 flex flex-col justify-center">
                      {previewFile.pagesPerSheet === 2 ? (
                        <div className="grid grid-cols-2 gap-2 h-full border border-dashed border-slate-200 p-2 rounded">
                          <div className="space-y-1.5">
                            <div className="h-1.5 bg-slate-300 rounded w-full" />
                            <div className="h-1.5 bg-slate-200 rounded w-5/6" />
                            <div className="h-1.5 bg-slate-200 rounded w-4/6" />
                            <div className="h-1.5 bg-slate-200 rounded w-full" />
                          </div>
                          <div className="space-y-1.5 border-l border-dashed border-slate-200 pl-2">
                            <div className="h-1.5 bg-slate-300 rounded w-full" />
                            <div className="h-1.5 bg-slate-200 rounded w-5/6" />
                            <div className="h-1.5 bg-slate-200 rounded w-4/6" />
                            <div className="h-1.5 bg-slate-200 rounded w-full" />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="h-1.5 bg-slate-200 rounded w-full" />
                          <div className="h-1.5 bg-slate-200 rounded w-11/12" />
                          <div className="h-1.5 bg-slate-200 rounded w-4/5" />
                          <div className="h-1.5 bg-slate-200 rounded w-full" />
                          <div className="h-1.5 bg-slate-200 rounded w-3/4" />
                          <div className="h-1.5 bg-slate-200 rounded w-5/6" />
                        </div>
                      )}
                    </div>

                    {/* Sheet Footer */}
                    <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[8px] text-slate-400 font-mono z-10">
                      <span>{shop.name} Print Counter</span>
                      <span>
                        Page 1 of {countPages(previewFile)} ({previewFile.copies} cop
                        {previewFile.copies > 1 ? 'ies' : 'y'})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer with Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-500">
                  <span>Price for this file: </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
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
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Change Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFile(null)}
                    className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-xs"
                  >
                    Done Reviewing
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
