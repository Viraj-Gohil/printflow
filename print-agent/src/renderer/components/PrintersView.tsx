import React, { useState, useMemo } from 'react';
import { AgentConfig, DiscoveredPrinter, TestPrintResult, PlanEntitlements } from '../types/agent';
import {
  Printer,
  RefreshCw,
  CheckCircle2,
  Play,
  AlertCircle,
  HardDrive,
  Check,
  ShieldAlert,
  ShieldCheck,
  Power,
  PowerOff,
  Sliders,
  Lock,
  ArrowUpRight,
  Sparkles,
  Wifi,
  Laptop
} from 'lucide-react';
import { PrinterConfigModal } from './PrinterConfigModal.js';
import { PrinterDriverSetupModal } from './PrinterDriverSetupModal.js';

interface PrintersViewProps {
  printers: DiscoveredPrinter[];
  config: AgentConfig;
  isScanning: boolean;
  entitlements?: PlanEntitlements | null;
  onRescan: () => void;
  onTestPrint: (printerName: string) => Promise<TestPrintResult>;
  onSelectPrinter: (printerName: string) => void;
  onSetPrinterEnabled: (printerName: string, enabled: boolean) => void;
  onSetPrinterRegistered: (printerName: string, registered: boolean) => Promise<void>;
}

export const PrintersView: React.FC<PrintersViewProps> = ({
  printers,
  config,
  isScanning,
  entitlements,
  onRescan,
  onTestPrint,
  onSelectPrinter,
  onSetPrinterEnabled,
  onSetPrinterRegistered
}) => {
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [registeringPrinter, setRegisteringPrinter] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestPrintResult | null>(null);
  const [configModalPrinter, setConfigModalPrinter] = useState<DiscoveredPrinter | null>(null);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);

  const registeredNames = config.registeredPrinterNames || [];
  const printerLimit = config.printerLimit ?? 1;
  const isLimitReached = registeredNames.length >= printerLimit;

  // Separate physical printers from virtual drivers (PDF, XPS, Fax, OneNote)
  const physicalPrinters = useMemo(() => {
    return printers.filter((p) => {
      const name = (p.name || p.displayName || '').toLowerCase();
      return !name.includes('pdf') && !name.includes('xps') && !name.includes('onenote') && !name.includes('fax');
    });
  }, [printers]);

  const virtualPrinters = useMemo(() => {
    return printers.filter((p) => {
      const name = (p.name || p.displayName || '').toLowerCase();
      return name.includes('pdf') || name.includes('xps') || name.includes('onenote') || name.includes('fax');
    });
  }, [printers]);

  const counts = useMemo(() => {
    const totalPhysical = physicalPrinters.length;
    const onlinePhysical = physicalPrinters.filter((p) => p.isOnline).length;
    const offlinePhysical = totalPhysical - onlinePhysical;
    const registeredCount = registeredNames.length;
    const unregisteredCount = physicalPrinters.filter((p) => !registeredNames.includes(p.name)).length;

    return {
      totalPhysical,
      onlinePhysical,
      offlinePhysical,
      registeredCount,
      unregisteredCount,
      virtualCount: virtualPrinters.length
    };
  }, [physicalPrinters, virtualPrinters, registeredNames]);

  const handleSavePrinterConfig = async (printerName: string, ownerConfig: any) => {
    if (window.electronAgentAPI?.savePrinterOwnerConfig) {
      const res = await window.electronAgentAPI.savePrinterOwnerConfig(printerName, ownerConfig);
      if (!res.success) {
        throw new Error(res.error || 'Failed to save printer configuration.');
      }
    }
    onRescan();
  };

  const handleResetPrinterConfig = async (printerName: string) => {
    if (window.electronAgentAPI?.resetPrinterConfig) {
      const res = await window.electronAgentAPI.resetPrinterConfig(printerName);
      if (!res.success) {
        throw new Error(res.error || 'Failed to reset printer configuration.');
      }
    }
    onRescan();
  };

  const handleRefreshCapabilities = async (_printerName: string) => {
    onRescan();
  };

  const handleTest = async (printerName: string) => {
    setTestingPrinter(printerName);
    setTestResult(null);
    try {
      const res = await onTestPrint(printerName);
      setTestResult(res);
    } catch (error) {
      setTestResult({
        success: false,
        printerName,
        message: error instanceof Error ? error.message : 'Test print could not be initiated.'
      });
    } finally {
      setTestingPrinter(null);
    }
  };

  const handleToggleRegistration = async (printerName: string, nextRegistered: boolean) => {
    setRegisteringPrinter(printerName);
    try {
      await onSetPrinterRegistered(printerName, nextRegistered);
    } catch (err: any) {
      setTestResult({
        success: false,
        printerName,
        message: err?.message || 'Failed to update printer registration.'
      });
    } finally {
      setRegisteringPrinter(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* 2. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E1E7E1] dark:border-slate-800">
        <div>
          <h1 className="text-[24px] font-bold text-[#111111] dark:text-white tracking-tight leading-tight">
            Printers
          </h1>
          <p className="text-[14px] text-[#646B65] dark:text-slate-400 mt-1">
            Discover, configure and manage physical printers connected to this Windows workstation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsSetupWizardOpen(true)}
            className="primary-button !min-h-[34px] !py-1.5 !px-3.5 text-xs font-semibold cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Driver Setup Assistant</span>
          </button>

          <button
            type="button"
            onClick={onRescan}
            disabled={isScanning}
            className="secondary-button !min-h-[34px] !py-1.5 !px-3.5 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#00B32D] ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Discovering...' : 'Refresh Hardware'}</span>
          </button>
        </div>
      </div>

      {/* 3. PRINTER OVERVIEW SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Physical Printers */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Physical Printers</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">
              {counts.totalPhysical}
            </span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center">
              <Printer className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#646B65] dark:text-slate-400 mt-2 block truncate">
            {counts.virtualCount} Virtual Drivers Excluded
          </span>
        </div>

        {/* Metric 2: Registered for Shop */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Registered for Shop</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">
              {counts.registeredCount} / {printerLimit}
            </span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#008F25] font-semibold mt-2 block truncate">
            {isLimitReached ? 'Plan Limit Reached' : `${printerLimit - counts.registeredCount} Slot(s) Free`}
          </span>
        </div>

        {/* Metric 3: Online Printers */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Online &amp; Ready</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">
              {counts.onlinePhysical}
            </span>
            <div className="w-7 h-7 rounded-md bg-[#E8F8EC] text-[#00B32D] flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#008F25] font-semibold mt-2 block truncate">
            Ready to Spool
          </span>
        </div>

        {/* Metric 4: Offline Printers */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Offline Devices</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">
              {counts.offlinePhysical}
            </span>
            <div className="w-7 h-7 rounded-md bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center">
              <PowerOff className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className={`text-[11px] font-semibold mt-2 block truncate ${
            counts.offlinePhysical > 0 ? 'text-[#DC2626]' : 'text-[#848D86]'
          }`}>
            {counts.offlinePhysical > 0 ? 'Power or Cable Check' : 'Zero Devices Offline'}
          </span>
        </div>

        {/* Metric 5: Unregistered / Attention */}
        <div className="pf-card p-4 border border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-[10px] shadow-card">
          <span className="text-[12px] font-semibold text-[#646B65] dark:text-slate-400 block">Unregistered</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[28px] font-bold text-[#111111] dark:text-white font-mono leading-none">
              {counts.unregisteredCount}
            </span>
            <div className="w-7 h-7 rounded-md bg-[#FFFBEB] text-[#E6A000] flex items-center justify-center">
              <ShieldAlert className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <span className="text-[11px] text-[#E6A000] font-semibold mt-2 block truncate">
            Local Windows Devices
          </span>
        </div>
      </div>

      {/* 4. DISCOVERY LOADING BAR */}
      {isScanning && (
        <div className="p-3.5 rounded-[10px] bg-[#E8F8EC] border border-[#BCEAC4] text-[#008F25] dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 animate-spin text-[#00B32D]" />
            <span className="font-semibold">Discovering installed Windows Win32 printers and hardware capabilities...</span>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-0.5 bg-[#BCEAC4] text-[#008F25] rounded-full">Hardware Scan Active</span>
        </div>
      )}

      {/* PLAN CAPACITY WARNING */}
      {isLimitReached && (
        <div className="p-4 rounded-[10px] bg-[#E8F8EC] border border-[#BCEAC4] text-xs text-[#111111] dark:bg-emerald-950/30 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-card">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#BCEAC4] text-[#008F25] flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-[#111111] dark:text-white">
                Printer Connection Limit Reached ({registeredNames.length} / {printerLimit} Slots Used)
              </p>
              <p className="text-[#646B65] dark:text-slate-400 mt-0.5">
                Your current {entitlements?.planName || config.shopDetails?.planName || 'Starter'} plan allows up to {printerLimit} printer connection(s). Upgrade to Growth (5 printers) or Business (10 printers) to register additional counter machines.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const server = (config.serverUrl || 'https://printflow.devpixel.space').replace(/\/+$/, '');
              const url = `${server}/shop/subscription`;
              if (window.electronAgentAPI?.openExternal) {
                window.electronAgentAPI.openExternal(url);
              } else {
                window.open(url, '_blank');
              }
            }}
            className="primary-button !min-h-[32px] !text-xs font-semibold shrink-0 cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Upgrade Subscription</span>
          </button>
        </div>
      )}

      {/* TEST PRINT RESULT TOAST */}
      {testResult && (
        <div
          className={`p-3.5 rounded-[10px] border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            testResult.success
              ? 'bg-[#E8F8EC] border-[#BCEAC4] text-[#008F25] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-[#00B32D] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
            )}
            <div>
              <span className="font-bold">{testResult.message}</span>
              <p className="text-[11px] opacity-80 mt-0.5 font-mono">Target: {testResult.printerName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="text-xs font-bold underline hover:opacity-80 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* EMPTY STATE */}
      {printers.length === 0 && (
        <div className="pf-card p-12 text-center rounded-[10px] border border-dashed border-[#E1E7E1] dark:border-slate-800 bg-white dark:bg-[#131D33] space-y-4">
          <div className="w-14 h-14 rounded-lg bg-[#F0F4F1] dark:bg-slate-800 text-[#848D86] flex items-center justify-center mx-auto">
            <Printer className="w-7 h-7 stroke-[1.75]" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-[#111111] dark:text-white">No Windows Printers Detected</h3>
            <p className="text-xs text-[#646B65] dark:text-slate-400 leading-relaxed">
              Ensure your photocopy machine or printer is powered on and connected via USB or local network, with appropriate Windows Win32 drivers installed.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsSetupWizardOpen(true)}
              className="primary-button text-xs font-semibold cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Driver Setup Assistant</span>
            </button>
            <button
              type="button"
              onClick={onRescan}
              disabled={isScanning}
              className="secondary-button text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#00B32D] ${isScanning ? 'animate-spin' : ''}`} />
              <span>Rescan Windows Hardware</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. PRINTER CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {printers.map((printer) => {
          const isEnabled = !(config.disabledPrinterNames || []).includes(printer.name);
          const isRegistered = registeredNames.includes(printer.name);
          const isSelected =
            isEnabled &&
            isRegistered &&
            (config.selectedPrinterName ? config.selectedPrinterName === printer.name : printer.isDefault);
          const canRegister = !isRegistered && (!isLimitReached || registeredNames.length < printerLimit);

          const isVirtual = virtualPrinters.some(v => v.name === printer.name);

          return (
            <div
              key={printer.name}
              className={`pf-card p-5 space-y-4 rounded-[10px] border transition-all duration-200 ${
                isSelected
                  ? 'border-[#00B32D] ring-2 ring-[#00B32D]/20 shadow-md'
                  : isRegistered
                  ? 'border-[#BCEAC4] dark:border-emerald-900 bg-white dark:bg-[#131D33]'
                  : 'border-[#E1E7E1] dark:border-slate-800 hover:border-[#C8D1C8] opacity-95'
              } bg-white dark:bg-[#131D33] shadow-card`}
            >
              {/* Header: Icon, Name, and Status Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4]'
                        : isRegistered
                        ? 'bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4]'
                        : 'bg-[#F0F4F1] dark:bg-slate-900 text-[#646B65] border border-[#E1E7E1] dark:border-slate-800'
                    }`}
                  >
                    <Printer className="w-5 h-5 stroke-[2]" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-[#111111] dark:text-white truncate" title={printer.displayName}>
                        {printer.displayName}
                      </h3>
                      {printer.isDefault && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4]">
                          Windows Default
                        </span>
                      )}
                      {isVirtual && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          Virtual Driver
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#646B65] dark:text-slate-400 truncate mt-0.5 flex items-center gap-1 font-mono">
                      <HardDrive className="w-3 h-3 text-[#848D86] shrink-0" />
                      <span className="truncate">{printer.name}</span>
                    </p>
                  </div>
                </div>

                {/* Online / Offline status badge */}
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    printer.isOnline
                      ? 'bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4]'
                      : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${printer.isOnline ? 'bg-[#00B32D]' : 'bg-[#DC2626]'}`} />
                  <span>{printer.isOnline ? 'Online' : 'Offline'}</span>
                </span>
              </div>

              {/* Status Badges Row */}
              <div className="flex items-center gap-2 flex-wrap">
                {isRegistered ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#00B32D]" />
                    <span>Registered for Shop</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[#F0F4F1] dark:bg-slate-800 text-[#646B65] dark:text-slate-400 border border-[#E1E7E1] dark:border-slate-700">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#848D86]" />
                    <span>Unregistered (Local Only)</span>
                  </span>
                )}

                {!isEnabled && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                    <PowerOff className="w-3 h-3" />
                    <span>Disabled</span>
                  </span>
                )}

                {isSelected && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4]">
                    <Check className="w-3 h-3 text-[#00B32D]" />
                    <span>Primary Spool Target</span>
                  </span>
                )}
              </div>

              {/* Hardware Specs & Capabilities */}
              <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-lg bg-[#F0F4F1] dark:bg-slate-900 border border-[#E1E7E1] dark:border-slate-800">
                <div>
                  <span className="text-[11px] text-[#646B65] dark:text-slate-400 block font-medium">Color Capability</span>
                  <span className="font-bold text-[#111111] dark:text-slate-200">
                    {printer.capabilities.supportsColor ? 'Color & Monochrome' : 'Monochrome (B&W)'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#646B65] dark:text-slate-400 block font-medium">Duplex Printing</span>
                  <span className="font-bold text-[#111111] dark:text-slate-200">
                    {printer.capabilities.supportsDuplex ? 'Double-sided' : 'Single-sided'}
                  </span>
                </div>
                <div className="col-span-2 pt-1.5 border-t border-[#E1E7E1] dark:border-slate-800">
                  <span className="text-[11px] text-[#646B65] dark:text-slate-400 block font-medium">Supported Media Sizes</span>
                  <span className="text-[12px] text-[#111111] dark:text-slate-300 font-medium">
                    {printer.capabilities.paperSizes && printer.capabilities.paperSizes.length > 0
                      ? printer.capabilities.paperSizes.slice(0, 5).join(', ')
                      : 'A4, Letter, Legal'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-1 border-t border-[#E1E7E1] dark:border-slate-800">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Register / Unregister Toggle */}
                  {isRegistered ? (
                    <button
                      type="button"
                      onClick={() => handleToggleRegistration(printer.name, false)}
                      disabled={registeringPrinter === printer.name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-[#E1E7E1] text-[#646B65] hover:text-[#DC2626] hover:border-[#FECACA] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                      title="Unregister this printer to free a subscription slot"
                    >
                      {registeringPrinter === printer.name ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <PowerOff className="w-3 h-3" />
                      )}
                      <span>Unregister from Shop</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleRegistration(printer.name, true)}
                      disabled={registeringPrinter === printer.name || !printer.isOnline || (!canRegister && printerLimit > 0) || isVirtual}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                        !canRegister && printerLimit > 0
                          ? 'bg-[#F0F4F1] dark:bg-slate-800 text-[#848D86] dark:text-slate-500 border border-[#E1E7E1] dark:border-slate-700 cursor-not-allowed'
                          : 'bg-[#00B32D] text-white hover:bg-[#008F25] shadow-xs'
                      }`}
                      title={isVirtual ? 'Virtual drivers cannot be registered' : !canRegister && printerLimit > 0 ? `Plan limit reached (${printerLimit} allowed). Upgrade subscription.` : 'Register printer for customer orders'}
                    >
                      {registeringPrinter === printer.name ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : !canRegister && printerLimit > 0 ? (
                        <Lock className="w-3.5 h-3.5 text-[#848D86]" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>{!canRegister && printerLimit > 0 ? 'Plan Limit Reached' : 'Register for Shop'}</span>
                    </button>
                  )}

                  {/* Enable / Disable Button */}
                  <button
                    type="button"
                    onClick={() => onSetPrinterEnabled(printer.name, !isEnabled)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-[#646B65] dark:text-slate-300 border border-[#E1E7E1] dark:border-slate-700 hover:bg-[#F0F4F1] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Power className={`w-3 h-3 ${isEnabled ? 'text-[#00B32D]' : 'text-[#848D86]'}`} />
                    <span>{isEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  {/* Configure Options */}
                  <button
                    type="button"
                    onClick={() => setConfigModalPrinter(printer)}
                    className="secondary-button !min-h-[32px] !py-1 !px-3 text-xs font-semibold cursor-pointer"
                    title="Customize allowed paper sizes, color modes, and duplex options for this printer"
                  >
                    <Sliders className="w-3 h-3 text-[#00B32D]" />
                    <span>Configure Options</span>
                  </button>

                  {/* Test Print button */}
                  <button
                    type="button"
                    onClick={() => handleTest(printer.name)}
                    disabled={testingPrinter === printer.name || !printer.isOnline}
                    className="secondary-button !min-h-[32px] !py-1 !px-3 text-xs font-semibold cursor-pointer"
                    title="Spool a test page to this device"
                  >
                    <Play className={`w-3 h-3 text-[#00B32D] ${testingPrinter === printer.name ? 'animate-spin' : ''}`} />
                    <span>{testingPrinter === printer.name ? 'Printing...' : 'Test Print'}</span>
                  </button>

                  {/* Primary Target Selection */}
                  <button
                    type="button"
                    onClick={() => onSelectPrinter(printer.name)}
                    disabled={!isRegistered || !isEnabled}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                      !isRegistered || !isEnabled
                        ? 'opacity-40 cursor-not-allowed text-[#848D86] border border-[#E1E7E1]'
                        : isSelected
                        ? 'bg-[#E8F8EC] text-[#008F25] border border-[#BCEAC4] cursor-default'
                        : 'bg-white text-[#646B65] border border-[#E1E7E1] hover:bg-[#F0F4F1] cursor-pointer'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#00B32D]" />}
                    <span>{isSelected ? 'Primary Target' : 'Set Primary'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {configModalPrinter && (
        <PrinterConfigModal
          printer={configModalPrinter}
          isOpen={Boolean(configModalPrinter)}
          onClose={() => setConfigModalPrinter(null)}
          onSaveConfig={handleSavePrinterConfig}
          onResetToDefaults={handleResetPrinterConfig}
          onRefreshCapabilities={handleRefreshCapabilities}
        />
      )}

      {isSetupWizardOpen && (
        <PrinterDriverSetupModal
          isOpen={isSetupWizardOpen}
          onClose={() => setIsSetupWizardOpen(false)}
          config={config}
          printers={printers}
          isScanning={isScanning}
          onRescanPrinters={async () => {
            onRescan();
            return printers;
          }}
          onRegisterPrinter={async (name, registered) => {
            await onSetPrinterRegistered(name, registered);
          }}
          onSelectPrimaryPrinter={(name) => {
            onSelectPrinter(name);
          }}
        />
      )}
    </div>
  );
};
