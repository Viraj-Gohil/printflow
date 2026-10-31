import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../lib/store';
import { authenticatedFetch, safeJsonFetch } from '../../lib/apiConfig';
import {
  Printer,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  Layers,
  Crown,
  ShieldCheck,
  Info,
  Clock,
  Wifi,
  WifiOff,
  Sliders,
  Check,
  X,
  LogIn,
  ShieldAlert
} from 'lucide-react';

interface BackendPrinter {
  id: string;
  name: string;
  model?: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR';
  isOnline: boolean;
  isDefault: boolean;
  isRegistered: boolean;
  connectionType?: string;
  driverName?: string;
  portName?: string;
  isManualOverride: boolean;
  detectionSource: 'AUTO' | 'MANUAL';
  capabilities: {
    paperSizes: string[];
    supportsColor: boolean | null;
    supportsDuplex: boolean | null;
  };
  lastSeen?: string | null;
  lastSyncedAt?: string | null;
}

export const ShopPrinters: React.FC = () => {
  const { activeShop, navigate, currentUser, isAuthenticated, isAuthRestored } = useApp();

  const [printers, setPrinters] = useState<BackendPrinter[]>([]);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [printerLimit, setPrinterLimit] = useState(1);
  const [planName, setPlanName] = useState('Starter Plan');
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [remainingSlots, setRemainingSlots] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [authErrorType, setAuthErrorType] = useState<'NONE' | 'UNAUTHENTICATED' | 'EXPIRED' | 'FORBIDDEN'>('NONE');

  const printersSeqRef = React.useRef(0);

  const fetchPrinters = useCallback(async (manual = false) => {
    if (!activeShop?.id) return;
    if (manual) setIsRefreshing(true);
    else setIsLoading(true);

    const seq = ++printersSeqRef.current;

    try {
      const { ok, status, data, error } = await safeJsonFetch(`/api/shop/${encodeURIComponent(activeShop.id)}/printers`, {
        method: 'GET'
      });
      if (seq !== printersSeqRef.current) return;

      if (status === 401) {
        setAuthErrorType('EXPIRED');
        setErrorMessage('Authentication required or session expired. Please sign in to your shop owner account.');
        setPrinters([]);
        return;
      }

      if (status === 403) {
        setAuthErrorType('FORBIDDEN');
        setErrorMessage(data?.error || 'Access denied. You are not authorized to view printer details for this shop.');
        setPrinters([]);
        return;
      }

      if (!ok || !data?.success) {
        setErrorMessage(error || data?.error || 'Failed to retrieve shop printers from backend.');
        setPrinters([]);
        return;
      }

      setAuthErrorType('NONE');
      setPrinters(data.printers || []);
      setRegisteredCount(data.registeredCount || 0);
      setPrinterLimit(data.printerLimit || 1);
      setPlanName(data.planName || 'Starter Plan');
      setIsLimitReached(Boolean(data.isLimitReached));
      setRemainingSlots(data.remainingSlots || 0);
      setErrorMessage(null);
    } catch (err: any) {
      if (seq === printersSeqRef.current) {
        setErrorMessage(err?.message || 'Could not communicate with server.');
      }
    } finally {
      if (seq === printersSeqRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [activeShop?.id]);

  useEffect(() => {
    if (!isAuthRestored) return;
    if (!isAuthenticated || !currentUser) {
      setAuthErrorType('UNAUTHENTICATED');
      setIsLoading(false);
      return;
    }

    void fetchPrinters();
    const timer = setInterval(() => {
      void fetchPrinters();
    }, 15000);
    return () => clearInterval(timer);
  }, [isAuthRestored, isAuthenticated, currentUser, fetchPrinters]);

  const handleToggleRegistration = async (printer: BackendPrinter) => {
    const nextRegistered = !printer.isRegistered;
    setActionLoadingId(printer.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { ok, status, data, error } = await safeJsonFetch(`/api/shop/${encodeURIComponent(activeShop.id)}/printers/${encodeURIComponent(printer.id)}/register`, {
        method: 'POST',
        body: JSON.stringify({ registered: nextRegistered })
      });

      if (status === 401) {
        setAuthErrorType('EXPIRED');
        setErrorMessage('Session expired. Please sign in again.');
        return;
      }

      if (status === 403) {
        setErrorMessage('Unauthorized access: Tenant boundary restriction enforced.');
        return;
      }

      if (!ok || !data?.success) {
        throw new Error(error || data?.error || 'Failed to update printer registration.');
      }

      setSuccessMessage(nextRegistered ? `Successfully registered "${printer.name}".` : `Unregistered "${printer.name}".`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchPrinters(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update printer registration.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const usagePercent = Math.min(100, Math.round((registeredCount / Math.max(1, printerLimit)) * 100));

  // 1. Session Restoration Loading State
  if (!isAuthRestored) {
    return (
      <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3 max-w-xl mx-auto my-12 shadow-2xs">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-800">Initializing Session...</p>
        <p className="text-xs text-slate-500">Restoring authenticated shop session credentials.</p>
      </div>
    );
  }

  // 2. Unauthenticated or Expired Session State
  if (authErrorType === 'UNAUTHENTICATED' || authErrorType === 'EXPIRED' || (!isAuthenticated && isAuthRestored)) {
    return (
      <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-slate-200 space-y-4 max-w-lg mx-auto my-12 shadow-2xs animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900">
            {authErrorType === 'EXPIRED' ? 'Session Expired' : 'Authentication Required'}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
            {authErrorType === 'EXPIRED'
              ? 'Your shop session has expired. Please sign in to your shop owner account to manage printers.'
              : 'Please sign in to your shop owner account to access Printers & Hardware.'}
          </p>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In to Shop Account</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Forbidden (Cross-Tenant) State
  if (authErrorType === 'FORBIDDEN') {
    return (
      <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-red-200 space-y-4 max-w-lg mx-auto my-12 shadow-2xs animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7 text-red-600" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
            {errorMessage || 'You are not authorized to view hardware configuration for this shop.'}
          </p>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate('/shop/dashboard')}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-2xs inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 text-slate-800 animate-fade-in">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Printers & Hardware
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Synchronized Windows printers detected by the PrintFlow Desktop Agent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchPrinters(true)}
            disabled={isRefreshing}
            className="secondary-button !min-h-[38px] !text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Printers'}</span>
          </button>
        </div>
      </div>

      {/* 2. SUCCESS / ERROR FEEDBACK */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. SUBSCRIPTION QUOTA & LIMITS BANNER */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                Subscription Quota
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Crown className="w-3 h-3 text-blue-600" />
                <span>{planName}</span>
              </span>
              {isLimitReached ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Quota Full ({registeredCount}/{printerLimit})
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {remainingSlots} Slot{remainingSlots > 1 ? 's' : ''} Available
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-slate-900">
              Registered Printers ({registeredCount} of {printerLimit} Allowed)
            </h2>
            <p className="text-xs text-slate-500 max-w-xl">
              Only registered counter printers receive production print orders. Unregistered printers remain visible for detection but cannot process paying jobs.
            </p>

            {/* Quota Progress Bar */}
            <div className="pt-2 max-w-md space-y-1">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/80">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isLimitReached ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.max(10, usagePercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>{registeredCount} registered</span>
                <span>Max: {printerLimit} printer{printerLimit > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isLimitReached && (
              <button
                type="button"
                onClick={() => navigate('/shop/subscription')}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Crown className="w-4 h-4" />
                <span>Upgrade Plan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. READ-ONLY NOTE & PRINTER LIST */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-center gap-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0" />
        <div>
          <strong>Read-Only Configuration:</strong> Printer capabilities and settings are automatically detected by your Windows printer driver. 
          To edit capabilities or add hardware, use the <a href="/shop/print-agent" className="underline font-bold text-blue-700">PrintFlow Desktop Agent</a>.
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Synchronizing printers from agent...</p>
        </div>
      ) : printers.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Printer className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">No Printers Detected</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Start your PrintFlow Desktop Agent on the shop PC to automatically discover and synchronize local USB and network Windows printers.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {printers.map((printer) => {
            const isOnline = printer.status === 'ONLINE' && printer.isOnline;
            const isRegistered = printer.isRegistered;
            const isActionLoading = actionLoadingId === printer.id;

            return (
              <div
                key={printer.id || printer.name}
                className={`bg-white p-5 rounded-2xl border transition-all space-y-4 ${
                  isRegistered ? 'border-blue-200 shadow-xs' : 'border-slate-200 opacity-85'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Printer className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 truncate" title={printer.name}>
                          {printer.name}
                        </h3>
                        {printer.isDefault && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase font-mono">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {printer.model || printer.driverName || 'Standard Windows Printer'} · {printer.connectionType || 'USB / Local'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOnline
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {printer.status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {printer.detectionSource === 'MANUAL' ? 'Manual Override' : 'Agent Detected'}
                    </span>
                  </div>
                </div>

                {/* Capabilities Read-Only Grid */}
                <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Color Support:</span>
                    <span className="font-semibold text-slate-900">
                      {printer.capabilities.supportsColor === true
                        ? 'Full Color'
                        : printer.capabilities.supportsColor === false
                        ? 'Monochrome (B&W)'
                        : 'Unknown / Not Verified'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Duplex Unit:</span>
                    <span className="font-semibold text-slate-900">
                      {printer.capabilities.supportsDuplex === true
                        ? 'Automatic 2-Sided'
                        : printer.capabilities.supportsDuplex === false
                        ? 'Single-Sided Only'
                        : 'Unknown / Not Verified'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Paper Sizes:</span>
                    <div className="flex gap-1 flex-wrap">
                      {Array.isArray(printer.capabilities.paperSizes) && printer.capabilities.paperSizes.length > 0 ? (
                        printer.capabilities.paperSizes.map((s) => (
                          <span key={s} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[10px]">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">A4 (Default)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer status & Register Action */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Synced: {printer.lastSyncedAt ? new Date(printer.lastSyncedAt).toLocaleTimeString() : 'Recently'}</span>
                  </div>

                  <button
                    type="button"
                    disabled={isActionLoading || (!isRegistered && isLimitReached)}
                    onClick={() => void handleToggleRegistration(printer)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isRegistered
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : isLimitReached
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                    }`}
                  >
                    {isActionLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isRegistered ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>{isRegistered ? 'Registered (Active)' : 'Register Printer'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
