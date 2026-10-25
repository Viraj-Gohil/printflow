import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import { apiUrl } from '../../lib/apiConfig';
import {
  Printer,
  Clock,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  QrCode,
  SlidersHorizontal,
  ChevronRight,
  Copy,
  ExternalLink,
  Sparkles,
  Check,
  Cpu,
  TrendingUp,
  Loader2,
  FileText
} from 'lucide-react';
import { PrintStatus } from '../../types';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../ui/Table';

export const ShopDashboard: React.FC = () => {
  const {
    activeShop,
    printJobs,
    printers,
    plans,
    navigate,
    updateJobStatus,
    showToast,
    simulateCustomerPrintJob
  } = useApp();

  const [copied, setCopied] = useState<boolean>(false);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);

  const [agentStatus, setAgentStatus] = useState<{
    isAvailable: boolean;
    agentOnline: boolean;
    printerReady: boolean;
    reason: string;
  } | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      if (!activeShop?.slug) return;
      try {
        const res = await fetch(apiUrl(`/api/public/shops/${encodeURIComponent(activeShop.slug)}/agent-status`));
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.availability && isMounted) {
            setAgentStatus(data.availability);
          }
        }
      } catch {
        // ignore
      }
    };
    void fetchStatus();
    const interval = window.setInterval(() => void fetchStatus(), 10000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [activeShop?.slug]);

  const currentPlan = plans.find((p) => p.id === activeShop.planId) || plans[0];
  const shopJobs = printJobs.filter((j) => j.shopId === activeShop.id);
  const queuedJobs = shopJobs.filter((j) => j.printStatus === 'QUEUED' || j.printStatus === 'ASSIGNED');
  const printingJobs = shopJobs.filter((j) => j.printStatus === 'PRINTING' || j.printStatus === 'DOWNLOADING');
  const completedJobs = shopJobs.filter((j) => j.printStatus === 'COMPLETED');

  const todayRevenue = shopJobs
    .filter((j) => j.paymentStatus === 'SUCCESS')
    .reduce((sum, j) => sum + j.totalAmount, 0);

  const shopPrinters = printers.filter((p) => p.shopId === activeShop.id);
  const onlinePrinters = shopPrinters.filter((p) => p.isEnabled && p.status === 'ONLINE');

  const customerPortalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/s/${activeShop.slug}`
    : `/s/${activeShop.slug}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(customerPortalUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = customerPortalUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      showToast('Customer Link Copied!', `URL for ${activeShop.name} copied to clipboard`, 'info', 3000);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Copy Failed', 'Unable to copy customer link to clipboard', 'error');
    }
  };

  const handleStatusUpdate = async (jobId: string, nextStatus: PrintStatus) => {
    if (updatingJobId) return;
    setUpdatingJobId(jobId);
    try {
      await updateJobStatus(jobId, nextStatus);
      showToast(
        nextStatus === 'PRINTING' ? 'Print Initiated' : 'Order Ready',
        `Job ${jobId} updated to ${nextStatus}`,
        'success'
      );
    } catch {
      showToast('Status Update Failed', 'Failed to update print job status. Please try again.', 'error');
    } finally {
      setUpdatingJobId(null);
    }
  };

  const renderStatusChip = (status: PrintStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <Chip variant="success" size="sm" dot>{status}</Chip>;
      case 'PRINTING':
      case 'DOWNLOADING':
        return <Chip variant="special" size="sm" dot className="animate-pulse">{status}</Chip>;
      case 'QUEUED':
      case 'ASSIGNED':
        return <Chip variant="warning" size="sm" dot>{status}</Chip>;
      case 'FAILED':
      case 'CANCELLED':
      case 'REQUIRES_ATTENTION':
        return <Chip variant="danger" size="sm" dot>{status}</Chip>;
      default:
        return <Chip variant="default" size="sm">{status}</Chip>;
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10 text-slate-800">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Monitor printing activity and manage today's orders.
          </p>
        </div>
      </div>

      {/* 2. CUSTOMER QR & ORDERING LINK UTILITY PANEL */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                  Shop Customer QR & Ordering Link
                </h2>
                <Chip variant="success" size="sm" dot>
                  Ready for Customers
                </Chip>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Customers scan this QR code or open this link at your counter to upload files, configure print options, and pay via UPI.
              </p>
              <div className="pt-0.5 flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-medium text-slate-400 shrink-0">Counter Link:</span>
                <code className="text-xs font-mono font-medium text-blue-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 truncate select-all">
                  {customerPortalUrl}
                </code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{copied ? 'Copied' : 'Copy Link'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/s/${activeShop.slug}`)}
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Open Customer View</span>
            </Button>

            <Button
              variant="soft"
              size="sm"
              onClick={() => navigate('/shop/qr-codes')}
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>Print Tabletop Stand</span>
            </Button>
          </div>
        </div>
      </div>

      {/* AGENT DISCONNECTED ALERT BANNER */}
      {agentStatus && !agentStatus.agentOnline && (
        <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100/80 text-amber-800 rounded-xl shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">Desktop Print Agent Offline</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                The Electron Print Agent on your counter PC is currently disconnected. Customers will see an offline banner and uploads will be blocked until the desktop agent connects.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => navigate('/shop/print-agent')}
            className="bg-white hover:bg-amber-100 text-amber-900 border-amber-300 font-bold shrink-0 cursor-pointer"
          >
            Connect Agent →
          </Button>
        </div>
      )}

      {/* 3. KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Today's Revenue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-slate-500">Today's Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            ₹{todayRevenue.toFixed(2)}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>Direct UPI Settlement</span>
          </div>
        </div>

        {/* Queue Pending */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-slate-500">Queue Pending</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            {queuedJobs.length}
          </p>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">
            Awaiting print agent
          </span>
        </div>

        {/* Printing Now */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-slate-500">Printing Now</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Printer className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600 font-mono tracking-tight">
            {printingJobs.length}
          </p>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">
            Active on trays
          </span>
        </div>

        {/* Completed Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-slate-500">Completed Today</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            {completedJobs.length}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            Delivered to counter
          </span>
        </div>

        {/* Printers Online */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium text-slate-500">Printers Online</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            {onlinePrinters.length} / {shopPrinters.length}
          </p>
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span className="text-slate-400 font-medium">Max {currentPlan.printerLimit} ({currentPlan.name})</span>
            <button
              type="button"
              onClick={() => navigate('/shop/printers')}
              className="text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
            >
              Hardware →
            </button>
          </div>
        </div>
      </div>

      {/* 4. COMPACT QUICK ACTIONS TOOLBAR */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-800">Quick Actions:</span>
          <span className="text-xs text-slate-500 hidden md:inline">
            Fast access to countertop flyers, per-page rates, and queue details.
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="xs"
            onClick={() => navigate('/shop/qr-codes')}
          >
            <QrCode className="w-3.5 h-3.5 text-slate-500" />
            <span>Generate Counter QR</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={() => navigate('/shop/pricing')}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Pricing</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={() => navigate('/shop/print-jobs')}
          >
            <span>View All in Queue</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* 5. LIVE PRINT QUEUE */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:px-5 sm:py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-slate-900">Live Print Queue</h2>
                <Chip variant="success" size="sm" dot>
                  Real-Time
                </Chip>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Orders placed by customers via counter QR scan appear here instantly</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {import.meta.env.DEV && (
              <Button
                variant="soft"
                size="xs"
                onClick={() => simulateCustomerPrintJob()}
                title="Generate a sample test print order"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>+ Test Order</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="xs"
              onClick={() => navigate('/shop/print-jobs')}
            >
              <span>View All</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Document / Settings</TableHead>
              <TableHead>Assigned Printer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Quick Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shopJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">No Orders in Live Queue</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        When customers scan your counter QR code, orders flow here automatically.
                      </p>
                    </div>
                    {import.meta.env.DEV && (
                      <Button
                        variant="solid"
                        size="xs"
                        onClick={() => simulateCustomerPrintJob()}
                        className="mx-auto"
                      >
                        <Sparkles className="w-3 h-3 text-white" />
                        <span>Send Sample Test Order</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              shopJobs.slice(0, 8).map((job) => {
                const firstFile = job.files[0];
                const isUpdating = updatingJobId === job.id;

                return (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono font-semibold text-blue-700">
                      {job.id}
                    </TableCell>

                    <TableCell>
                      <span className="font-medium text-slate-900 block">{job.customerName}</span>
                      <span className="text-[11px] text-slate-400">{job.customerPhone || 'Walk-in Guest'}</span>
                    </TableCell>

                    <TableCell>
                      <p className="font-medium text-slate-800 truncate max-w-[200px]" title={firstFile?.fileName}>
                        {firstFile?.fileName || 'Document'}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <span>{firstFile?.paperSize || 'A4'}</span>
                        <span>·</span>
                        <span>{firstFile?.color === 'COLOR' ? 'Color' : 'B&W'}</span>
                        <span>·</span>
                        <span>{firstFile?.copies || 1} {firstFile?.copies === 1 ? 'copy' : 'copies'}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-slate-700 font-medium">
                        {job.assignedPrinterName || 'Auto-Dispatch'}
                      </span>
                    </TableCell>

                    <TableCell className="font-mono font-semibold text-slate-900">
                      ₹{job.totalAmount.toFixed(2)}
                    </TableCell>

                    <TableCell>
                      {renderStatusChip(job.printStatus)}
                    </TableCell>

                    <TableCell className="text-right">
                      {(job.printStatus === 'QUEUED' || job.printStatus === 'ASSIGNED') && (
                        <Button
                          variant="solid"
                          size="xs"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(job.id, 'PRINTING')}
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Printer className="w-3 h-3" />
                          )}
                          <span>Send to Print</span>
                        </Button>
                      )}

                      {(job.printStatus === 'PRINTING' || job.printStatus === 'DOWNLOADING') && (
                        <Button
                          variant="solid"
                          size="xs"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(job.id, 'COMPLETED')}
                          className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Mark Ready</span>
                        </Button>
                      )}

                      {job.printStatus === 'COMPLETED' && (
                        <span className="text-xs text-slate-400 font-medium">Delivered</span>
                      )}

                      {(job.printStatus === 'FAILED' || job.printStatus === 'CANCELLED' || job.printStatus === 'REQUIRES_ATTENTION') && (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={isUpdating}
                          onClick={() => handleStatusUpdate(job.id, 'QUEUED')}
                        >
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
