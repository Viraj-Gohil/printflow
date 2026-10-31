import React, { useState } from 'react';
import { AgentConfig, DiscoveredPrinter, TestPrintResult } from '../types/agent';
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
  Settings2
} from 'lucide-react';
import { PrinterConfigModal } from './PrinterConfigModal.js';

interface PrintersViewProps {
  printers: DiscoveredPrinter[];
  config: AgentConfig;
  isScanning: boolean;
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
  const registeredNames = config.registeredPrinterNames || [];
  const printerLimit = config.printerLimit ?? 1;
  const isLimitReached = registeredNames.length >= printerLimit;

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
    <div className="space-y-6 animate-fade-in">
      {/* Top Controls Bar */}
      <div className="pf-card p-6 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
              Installed Windows Printers ({printers.length})
            </h2>
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                registeredNames.length > 0
                  ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
              }`}
            >
              Registered for Shop: {registeredNames.length} / {printerLimit || 1} Allowed
            </span>
            {isLimitReached && (
              <span className="text-[10.5px] font-medium text-[#64748B] dark:text-slate-400">
                (Subscription plan capacity reached)
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
            Real physical and network printers discovered via Windows Print Spooler. Registered printers are synchronized with PrintFlow and receive incoming customer orders.
          </p>
        </div>

        <button
          type="button"
          onClick={onRescan}
          disabled={isScanning}
          className="primary-button text-xs font-semibold shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Discovering Devices...' : 'Refresh Hardware'}</span>
        </button>
      </div>

      {/* Discovery Loading Indicator */}
      {isScanning && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="font-medium">Discovering installed Windows printers and status...</span>
          </div>
          <span className="text-[11px] opacity-80 font-semibold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 rounded-full">Auto Discovery Active</span>
        </div>
      )}

      {/* Test Print Result Toast */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            testResult.success
              ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B] dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
            )}
            <div>
              <span className="font-semibold">{testResult.message}</span>
              <p className="text-[11px] opacity-80 mt-0.5">Target: {testResult.printerName}</p>
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

      {/* Empty State when no printers detected */}
      {printers.length === 0 && (
        <div className="pf-card p-12 text-center rounded-2xl border border-dashed border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-[#131D33] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] dark:bg-slate-800 text-[#94A3B8] flex items-center justify-center mx-auto">
            <Printer className="w-7 h-7 stroke-[1.75]" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-[#0F172A] dark:text-white">No Windows Printers Detected</h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
              Ensure your photocopy machine or printer is powered on and connected via USB or local network, with appropriate Windows drivers installed.
            </p>
          </div>
          <button
            type="button"
            onClick={onRescan}
            disabled={isScanning}
            className="primary-button text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Rescan Windows Hardware</span>
          </button>
        </div>
      )}

      {/* Printers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {printers.map((printer) => {
          const isEnabled = !(config.disabledPrinterNames || []).includes(printer.name);
          const isRegistered = registeredNames.includes(printer.name);
          const isSelected =
            isEnabled &&
            isRegistered &&
            (config.selectedPrinterName ? config.selectedPrinterName === printer.name : printer.isDefault);
          const canRegister = !isRegistered && (!isLimitReached || registeredNames.length < printerLimit);

          return (
            <div
              key={printer.name}
              className={`pf-card p-6 space-y-4 rounded-2xl border transition-all duration-200 ${
                isSelected
                  ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-md'
                  : isRegistered
                  ? 'border-[#BFDBFE] dark:border-blue-900 bg-white dark:bg-[#131D33]'
                  : 'border-[#E2E8F0] dark:border-slate-800 hover:border-[#CBD5E1] opacity-90'
              } bg-white dark:bg-[#131D33]`}
            >
              {/* Card Header: Icon, Name, and Status Badges */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                        : isRegistered
                        ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                        : 'bg-[#F8FAFC] dark:bg-slate-900 text-[#64748B] border border-[#E2E8F0] dark:border-slate-800'
                    }`}
                  >
                    <Printer className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-[#0F172A] dark:text-white truncate" title={printer.displayName}>
                        {printer.displayName}
                      </h3>
                      {printer.isDefault && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[#64748B] dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-[#94A3B8] shrink-0" />
                      <span className="truncate">{printer.name}</span>
                    </p>
                  </div>
                </div>

                {/* Online / Offline badge */}
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    printer.isOnline
                      ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                      : 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${printer.isOnline ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
                  <span>{printer.isOnline ? 'Online' : 'Offline'}</span>
                </span>
              </div>

              {/* Status Badges Row: Registration & Enablement */}
              <div className="flex items-center gap-2 flex-wrap">
                {isRegistered ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Registered for Shop</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-[#F1F5F9] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 border border-[#E2E8F0] dark:border-slate-700">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#94A3B8]" />
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
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                    <Check className="w-3 h-3 text-[#2563EB]" />
                    <span>Primary Spool Target</span>
                  </span>
                )}
              </div>

              {/* Hardware Capabilities & Specifications */}
              <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800">
                <div>
                  <span className="text-[10.5px] text-[#64748B] dark:text-slate-400 block font-medium">Color Mode</span>
                  <span className="font-semibold text-[#0F172A] dark:text-slate-200">
                    {printer.capabilities.supportsColor ? 'Color & Monochrome' : 'Monochrome (B&W)'}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#64748B] dark:text-slate-400 block font-medium">Duplex (Double-sided)</span>
                  <span className="font-semibold text-[#0F172A] dark:text-slate-200">
                    {printer.capabilities.supportsDuplex ? 'Supported' : 'Simplex only'}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-[#E2E8F0] dark:border-slate-800">
                  <span className="text-[10.5px] text-[#64748B] dark:text-slate-400 block font-medium">Paper Sizes</span>
                  <span className="text-[11.5px] text-[#475569] dark:text-slate-300">
                    {printer.capabilities.paperSizes && printer.capabilities.paperSizes.length > 0
                      ? printer.capabilities.paperSizes.slice(0, 4).join(', ')
                      : 'A4, Letter, Legal'}
                  </span>
                </div>
              </div>

              {/* Guidance Notice if printer needs to be registered */}
              {!isRegistered && (
                <div className="p-2.5 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/30 border border-[#BFDBFE] dark:border-blue-900 text-[11px] text-[#1E40AF] dark:text-blue-300 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#2563EB]" />
                  <span>
                    Click <strong>Register for Shop</strong> below to link this printer to your PrintFlow counter so it can process cloud print jobs.
                  </span>
                </div>
              )}

              {/* Action Buttons: Register/Unregister, Enable/Disable, Test Print, Primary */}
              <div className="flex flex-col gap-2 pt-1 border-t border-[#E2E8F0] dark:border-slate-800">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {/* Register / Unregister Toggle */}
                  {isRegistered ? (
                    <button
                      type="button"
                      onClick={() => handleToggleRegistration(printer.name, false)}
                      disabled={registeringPrinter === printer.name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E2E8F0] text-[#64748B] hover:text-[#B91C1C] hover:border-[#FECACA] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
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
                      disabled={registeringPrinter === printer.name || !printer.isOnline || (!canRegister && printerLimit > 0)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        !canRegister && printerLimit > 0
                          ? 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0] cursor-not-allowed'
                          : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-xs'
                      }`}
                      title={!canRegister && printerLimit > 0 ? `Plan limit reached (${printerLimit} allowed). Unregister another printer first.` : 'Register this printer to receive customer orders'}
                    >
                      {registeringPrinter === printer.name ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Register for Shop</span>
                    </button>
                  )}

                  {/* Enable / Disable Button */}
                  <button
                    type="button"
                    onClick={() => onSetPrinterEnabled(printer.name, !isEnabled)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#475569] dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700 hover:bg-[#F8FAFC] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Power className={`w-3 h-3 ${isEnabled ? 'text-[#10B981]' : 'text-[#94A3B8]'}`} />
                    <span>{isEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  {/* Configure Capabilities button */}
                  <button
                    type="button"
                    onClick={() => setConfigModalPrinter(printer)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    title="Customize allowed paper sizes, color modes, and duplex options for this printer"
                  >
                    <Sliders className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span>Configure Options</span>
                  </button>

                  {/* Test Print button */}
                  <button
                    type="button"
                    onClick={() => handleTest(printer.name)}
                    disabled={testingPrinter === printer.name || !printer.isOnline}
                    className="secondary-button !min-h-[32px] !py-1 !px-3 text-xs font-semibold cursor-pointer"
                    title={!isRegistered ? 'Printer must be registered to run print tests' : 'Spool a test page to this device'}
                  >
                    <Play className={`w-3 h-3 text-[#2563EB] ${testingPrinter === printer.name ? 'animate-spin' : ''}`} />
                    <span>{testingPrinter === printer.name ? 'Printing Test...' : 'Test Print'}</span>
                  </button>

                  {/* Primary Target Selection */}
                  <button
                    type="button"
                    onClick={() => onSelectPrinter(printer.name)}
                    disabled={!isRegistered || !isEnabled}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      !isRegistered || !isEnabled
                        ? 'opacity-40 cursor-not-allowed text-[#94A3B8] border border-[#E2E8F0]'
                        : isSelected
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] cursor-default'
                        : 'bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC] cursor-pointer'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#2563EB]" />}
                    <span>{isSelected ? 'Primary' : 'Set as Primary'}</span>
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
    </div>
  );
};
