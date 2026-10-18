import React, { useState } from 'react';
import { AgentConfig, DiscoveredPrinter, TestPrintResult } from '../types/agent';
import { Printer, RefreshCw, CheckCircle2, Play, AlertCircle, HardDrive, Check, ShieldAlert } from 'lucide-react';

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
    <div className="space-y-4 animate-fade-in">
      {/* Top Controls Bar */}
      <div className="pf-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Installed Windows Printers ({printers.length})
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]">
              Shop Registration: {registeredNames.length} / {printerLimit || '—'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Auto-detected via Windows Win32 Print Spooler. Offline or virtual devices cannot process physical jobs.
          </p>
        </div>

        <button
          type="button"
          onClick={onRescan}
          disabled={isScanning}
          className="primary-button text-xs font-semibold shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning Hardware...' : 'Rescan Windows Hardware'}</span>
        </button>
      </div>

      {/* Test Print Result Banner */}
      {testResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            testResult.success
              ? 'bg-green-500/10 border-green-500/25 text-green-800 dark:text-green-300'
              : 'bg-red-500/10 border-red-500/25 text-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span className="font-medium">{testResult.message}</span>
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

      {/* Printers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              className={`pf-card p-5 space-y-4 transition-all duration-200 ${
                isSelected
                  ? 'border-teal-500/60 shadow-md shadow-teal-500/10 ring-1 ring-teal-500/30'
                  : ''
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]'
                    }`}
                  >
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate" title={printer.displayName}>
                      {printer.displayName}
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5 flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-[var(--text-faint)] shrink-0" />
                      <span className="truncate">{printer.driverName || 'Generic Windows Driver'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      printer.isOnline
                        ? 'border-green-500/25 bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {printer.status}
                  </span>

                  {printer.isDefault && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                      OS DEFAULT
                    </span>
                  )}

                  {isSelected && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-500/30">
                      ACTIVE TARGET
                    </span>
                  )}

                  {!isEnabled && (
                    <span className="rounded-full border border-slate-400/30 bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
                      DISABLED
                    </span>
                  )}
                </div>
              </div>

              {/* Capabilities Details */}
              <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] space-y-2 text-xs">
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)] font-medium">Color Output:</span>
                  <span className="font-semibold">
                    {printer.capabilities.supportsColor === null
                      ? 'Unknown'
                      : printer.capabilities.supportsColor
                      ? 'Color Capable'
                      : 'Monochrome Only'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)] font-medium">Duplex Unit:</span>
                  <span className="font-semibold">
                    {printer.capabilities.supportsDuplex === null
                      ? 'Unknown'
                      : printer.capabilities.supportsDuplex
                      ? 'Duplex Capable'
                      : 'Simplex Only'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] font-medium">Supported Trays:</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {printer.capabilities.paperSizes.length === 0 ? (
                      <span className="text-[10px] text-[var(--text-faint)]">Standard Only</span>
                    ) : (
                      printer.capabilities.paperSizes.map((sz) => (
                        <span
                          key={sz}
                          className="px-1.5 py-0.2 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)] font-mono text-[10px]"
                        >
                          {sz}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-default)]">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectPrinter(printer.name)}
                    disabled={!isEnabled || !isRegistered}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-teal-600 text-white'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border border-[var(--border-default)]'
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{isSelected ? 'Active Target' : 'Use as Target'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSetPrinterEnabled(printer.name, !isEnabled)}
                    className="secondary-button !min-h-[28px] !px-2.5 !py-1 !text-xs"
                  >
                    {isEnabled ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void onSetPrinterRegistered(printer.name, !isRegistered)}
                    disabled={!printer.isOnline || (!isRegistered && registeredNames.length >= printerLimit)}
                    className="secondary-button !min-h-[28px] !px-2.5 !py-1 !text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                      !printer.isOnline
                        ? 'Printer is offline'
                        : !isRegistered && registeredNames.length >= printerLimit
                        ? 'Shop printer limit reached'
                        : undefined
                    }
                  >
                    {isRegistered ? 'Remove from Shop' : 'Register to Shop'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleTest(printer.name)}
                  disabled={testingPrinter === printer.name || !isEnabled || !isRegistered}
                  className="secondary-button !min-h-[28px] !px-2.5 !py-1 !text-xs disabled:cursor-not-allowed disabled:opacity-40 font-semibold text-blue-600 dark:text-blue-400"
                  title="Print test calibration page"
                >
                  <Play className={`w-3 h-3 ${testingPrinter === printer.name ? 'animate-spin' : ''}`} />
                  <span>{testingPrinter === printer.name ? 'Printing...' : 'Test Print'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {printers.length === 0 && (
        <div className="pf-card p-12 text-center space-y-3 bg-[var(--bg-subtle)]">
          <Printer className="mx-auto h-10 w-10 text-[var(--text-faint)]" />
          <h3 className="text-sm font-bold text-[var(--text-secondary)]">No installed Windows printers detected</h3>
          <p className="mx-auto max-w-sm text-xs text-[var(--text-muted)]">
            Ensure your physical or virtual printer is connected and powered on, then trigger a hardware rescan.
          </p>
          <button
            type="button"
            onClick={onRescan}
            disabled={isScanning}
            className="primary-button mx-auto mt-2 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Scan Windows Hardware</span>
          </button>
        </div>
      )}
    </div>
  );
};
