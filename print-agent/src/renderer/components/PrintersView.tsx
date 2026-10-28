import React, { useState } from 'react';
import { AgentConfig, DiscoveredPrinter, TestPrintResult } from '../types/agent';
import { Printer, RefreshCw, CheckCircle2, Play, AlertCircle, HardDrive, Check, ShieldAlert, CheckCircle } from 'lucide-react';

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
  const [testResult, setTestResult] = useState<TestPrintResult | null>(null);
  const registeredNames = config.registeredPrinterNames || [];
  const printerLimit = config.printerLimit ?? 0;

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Controls Bar */}
      <div className="pf-card p-6 border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] rounded-2xl shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
              Installed Windows Printers ({printers.length})
            </h2>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F1F5F9] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 border border-[#E2E8F0] dark:border-slate-700">
              Registered for Shop: {registeredNames.length} / {printerLimit || '—'}
            </span>
          </div>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
            Real physical and network printers discovered via the Windows Print Spooler subsystem.
          </p>
        </div>

        <button
          type="button"
          onClick={onRescan}
          disabled={isScanning}
          className="primary-button text-xs font-semibold shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Discovering Devices...' : 'Refresh Printers'}</span>
        </button>
      </div>

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

          return (
            <div
              key={printer.name}
              className={`pf-card p-6 space-y-5 rounded-2xl border transition-all duration-200 ${
                isSelected
                  ? 'border-[#2563EB] ring-1 ring-[#2563EB]/25 shadow-md'
                  : 'border-[#E2E8F0] dark:border-slate-800 hover:border-[#CBD5E1]'
              } bg-white dark:bg-[#131D33]`}
            >
              {/* Card Header: Icon, Name, and Status Badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
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

              {/* Action Buttons: Test Print & Selection */}
              <div className="flex items-center justify-between gap-3 pt-1">
                {/* Test Print button */}
                <button
                  type="button"
                  onClick={() => handleTest(printer.name)}
                  disabled={testingPrinter === printer.name || !printer.isOnline}
                  className="secondary-button !min-h-[34px] !py-1 !px-3 text-xs font-semibold"
                  title="Spool a physical test raster page to this device"
                >
                  <Play className={`w-3.5 h-3.5 text-[#2563EB] ${testingPrinter === printer.name ? 'animate-spin' : ''}`} />
                  <span>{testingPrinter === printer.name ? 'Printing Test...' : 'Test Print'}</span>
                </button>

                {/* Target Selection / Registration */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectPrinter(printer.name)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                        : 'bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#2563EB]" />}
                    <span>{isSelected ? 'Primary Printer' : 'Set as Primary'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
