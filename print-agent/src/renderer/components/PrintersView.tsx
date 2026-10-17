import React, { useState } from 'react';
import { AgentConfig, DiscoveredPrinter, TestPrintResult } from '../types/agent';
import { Printer, RefreshCw, CheckCircle2, Play, AlertCircle } from 'lucide-react';

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
        message: error instanceof Error ? error.message : 'Test print could not be started.'
      });
    } finally {
      setTestingPrinter(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Discovered Windows Printers ({printers.length})</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-detected from Windows. Offline and virtual printers cannot receive physical print jobs.
          </p>
        </div>

        <button
          onClick={onRescan}
          disabled={isScanning}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>Rescan Windows Hardware</span>
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Shop plan: {registeredNames.length} / {printerLimit || '—'} printers registered. Registered printers sync to the web dashboard.
      </p>

      {/* Test Print Feedback Banner */}
      {testResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            testResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
            <span>{testResult.message}</span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-[11px] font-bold underline cursor-pointer"
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
          const isSelected = isEnabled && isRegistered && (config.selectedPrinterName
            ? config.selectedPrinterName === printer.name
            : printer.isDefault);

          return (
            <div
              key={printer.name}
              className={`p-5 rounded-2xl border transition-all ${
                isSelected
                  ? 'bg-slate-800/90 border-blue-500/60 shadow-lg shadow-blue-500/5'
                  : 'bg-slate-800/40 border-slate-700/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-700/60 text-slate-300'
                    }`}
                  >
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{printer.displayName}</h3>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      Driver: {printer.driverName || 'Not reported by Windows'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${printer.isOnline ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                    {printer.status}
                  </span>
                  {printer.isDefault && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      OS DEFAULT
                    </span>
                  )}
                  {isSelected && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      ACTIVE SPOOLER
                    </span>
                  )}
                  {!isEnabled && (
                    <span className="rounded-full border border-slate-600 bg-slate-700/50 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      AGENT DISABLED
                    </span>
                  )}
                </div>
              </div>

              {/* Capabilities */}
              <div className="mt-4 pt-3 border-t border-slate-700/40 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Color Support:</span>
                  <span className="font-semibold">
                    {printer.capabilities.supportsColor === null ? 'Unknown' : printer.capabilities.supportsColor ? 'Color capable' : 'Monochrome only'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Duplex Unit:</span>
                  <span className="font-semibold">
                    {printer.capabilities.supportsDuplex === null ? 'Unknown' : printer.capabilities.supportsDuplex ? 'Duplex capable' : 'Simplex only'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Supported Trays:</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {printer.capabilities.paperSizes.length === 0 && <span className="text-[10px] text-slate-500">Unknown</span>}
                    {printer.capabilities.paperSizes.map((sz) => (
                      <span key={sz} className="px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-200 font-mono text-[10px]">
                        {sz}
                      </span>
                    ))}
                  </div>

                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/40 pt-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectPrinter(printer.name)}
                    disabled={!isEnabled || !isRegistered}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      isSelected
                        ? 'border border-blue-500/40 bg-blue-600/30 text-blue-300'
                        : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {isSelected ? 'Active target' : 'Use as target'}
                  </button>
                  <button type="button" onClick={() => onSetPrinterEnabled(printer.name, !isEnabled)} className="secondary-button px-3 py-1.5">
                    {isEnabled ? 'Disable for agent' : 'Enable for agent'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSetPrinterRegistered(printer.name, !isRegistered)}
                    disabled={!printer.isOnline || (!isRegistered && registeredNames.length >= printerLimit)}
                    className="secondary-button px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRegistered ? 'Remove from shop' : 'Add to shop'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleTest(printer.name)}
                  disabled={testingPrinter === printer.name || !isEnabled || !isRegistered}
                  className="secondary-button disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play className={`h-3 w-3 ${testingPrinter === printer.name ? 'animate-spin' : ''}`} />
                  <span>{testingPrinter === printer.name ? 'Printing…' : 'Test Print'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {printers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center">
          <Printer className="mx-auto h-8 w-8 text-slate-500" />
          <p className="mt-3 text-sm font-semibold text-slate-300">No installed printers found</p>
          <p className="mt-1 text-xs text-slate-500">Connect or install a printer in Windows, then rescan hardware.</p>
        </div>
      )}
    </div>
  );
};
