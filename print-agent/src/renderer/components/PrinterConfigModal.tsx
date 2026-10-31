import React, { useState, useEffect } from 'react';
import {
  DiscoveredPrinter,
  HardwareCapabilities,
  OwnerPrinterConfiguration,
  EffectivePrinterCapabilities,
  computeEffectiveCapabilities,
  createDefaultOwnerConfig,
  validateOwnerConfigAgainstHardware
} from '../types/agent';
import {
  Sliders,
  CheckCircle2,
  X,
  RefreshCw,
  RotateCcw,
  Info,
  ShieldCheck,
  AlertTriangle,
  Printer,
  Eye,
  Save,
  Check,
  Power
} from 'lucide-react';

interface PrinterConfigModalProps {
  printer: DiscoveredPrinter;
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (printerName: string, config: OwnerPrinterConfiguration) => Promise<void>;
  onResetToDefaults: (printerName: string) => Promise<void>;
  onRefreshCapabilities: (printerName: string) => Promise<void>;
}

export const PrinterConfigModal: React.FC<PrinterConfigModalProps> = ({
  printer,
  isOpen,
  onClose,
  onSaveConfig,
  onResetToDefaults,
  onRefreshCapabilities
}) => {
  const hardware: HardwareCapabilities = printer.hardwareCapabilities || {
    basicInfo: {
      name: printer.name,
      displayName: printer.displayName || printer.name,
      driverName: printer.driverName || 'Windows Driver',
      portName: printer.portName || '',
      connectionType: 'UNKNOWN',
      isDefault: printer.isDefault,
      status: printer.status
    },
    color: {
      monochrome: 'SUPPORTED',
      color: printer.capabilities.supportsColor ? 'SUPPORTED' : 'UNSUPPORTED',
      detectionSource: 'WIN32_DRIVER',
      lastDetectedAt: new Date().toISOString()
    },
    paperSizes: (printer.capabilities.paperSizes || ['A4']).map((p) => ({
      name: String(p),
      status: 'SUPPORTED'
    })),
    sides: {
      singleSided: 'SUPPORTED',
      automaticDuplex: printer.capabilities.supportsDuplex ? 'SUPPORTED' : 'UNSUPPORTED',
      manualDuplex: 'SUPPORTED',
      detectionSource: 'WIN32_DRIVER',
      lastDetectedAt: new Date().toISOString()
    },
    resolutions: [600],
    copies: { maxCopies: 999, status: 'SUPPORTED' },
    orientations: ['PORTRAIT', 'LANDSCAPE'],
    detectionSource: 'WIN32_DRIVER',
    lastDetectedAt: new Date().toISOString()
  };

  const initialOwnerConfig = printer.ownerConfiguration || createDefaultOwnerConfig(hardware);
  const [ownerConfig, setOwnerConfig] = useState<OwnerPrinterConfiguration>(initialOwnerConfig);
  const [effective, setEffective] = useState<EffectivePrinterCapabilities>(
    computeEffectiveCapabilities(hardware, initialOwnerConfig)
  );
  const [showDetectionDetails, setShowDetectionDetails] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const config = printer.ownerConfiguration || createDefaultOwnerConfig(hardware);
    setOwnerConfig(config);
    setEffective(computeEffectiveCapabilities(hardware, config));
  }, [printer]);

  // Recalculate effective capabilities whenever owner configuration changes
  const handleOwnerConfigChange = (updated: OwnerPrinterConfiguration) => {
    // Validate that owner cannot exceed hardware
    const validation = validateOwnerConfigAgainstHardware(hardware, updated);
    setOwnerConfig(validation.sanitizedConfig);
    setEffective(computeEffectiveCapabilities(hardware, validation.sanitizedConfig));
    setSaveSuccess(false);
  };

  if (!isOpen) return null;

  const hwSupportsColor = hardware.color?.color === 'SUPPORTED';
  const hwSupportsMono = hardware.color?.monochrome === 'SUPPORTED';
  const hwSupportsAutoDuplex = hardware.sides?.automaticDuplex === 'SUPPORTED';
  const hwSupportsManualDuplex = hardware.sides?.manualDuplex === 'SUPPORTED';

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSaveConfig(printer.name, ownerConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onResetToDefaults(printer.name);
      const def = createDefaultOwnerConfig(hardware);
      setOwnerConfig(def);
      setEffective(computeEffectiveCapabilities(hardware, def));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reset configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onRefreshCapabilities(printer.name);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to refresh hardware capabilities.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#131D33] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{printer.name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  printer.isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {printer.isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Driver: <span className="font-medium text-slate-700 dark:text-slate-300">{printer.driverName || 'Standard Windows Spooler Driver'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">

          {/* Alert messages */}
          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Printer configuration saved permanently and synchronized with PrintFlow cloud!</span>
            </div>
          )}

          {/* Section 1: Detected Hardware Capabilities (Read-Only) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" />
                Detected Hardware Capabilities (Read-Only)
              </span>
              <button
                type="button"
                onClick={() => setShowDetectionDetails(!showDetectionDetails)}
                className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer text-[11px]"
              >
                <Eye className="w-3 h-3" />
                {showDetectionDetails ? 'Hide Detection Details' : 'View Detection Details'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 block">Colour Printing</span>
                <span className={`font-bold ${hwSupportsColor ? 'text-emerald-600' : 'text-slate-600'}`}>
                  {hwSupportsColor ? 'Supported' : 'Unsupported'}
                </span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 block">B&W / Monochrome</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {hwSupportsMono ? 'Supported' : 'Unknown'}
                </span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 block">Auto Duplex</span>
                <span className={`font-bold ${hwSupportsAutoDuplex ? 'text-emerald-600' : 'text-slate-600'}`}>
                  {hwSupportsAutoDuplex ? 'Supported' : 'Unsupported'}
                </span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 block">Manual Duplex</span>
                <span className={`font-bold ${hwSupportsManualDuplex ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}>
                  {hwSupportsManualDuplex ? 'Supported' : 'Unsupported'}
                </span>
              </div>
            </div>

            {showDetectionDetails && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-lg font-mono text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <div>Detection Source: <strong>{hardware.detectionSource}</strong></div>
                <div>Last Detected: <strong>{new Date(hardware.lastDetectedAt).toLocaleString()}</strong></div>
                <div>Connection Type: <strong>{hardware.basicInfo.connectionType}</strong></div>
                <div>Driver Port: <strong>{hardware.basicInfo.portName || 'N/A'}</strong></div>
                <div>Reported Resolutions: <strong>{(hardware.resolutions || []).join(', ')} DPI</strong></div>
              </div>
            )}
          </div>

          {/* Section 2: Owner Configuration (Editable) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                Shop Owner Configuration
              </h4>
              <span className="text-[11px] text-slate-500">
                Restrict customer options without exceeding hardware capabilities
              </span>
            </div>

            {/* A. Colour Configuration */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-white">Colour Mode Configuration</h5>
                  <p className="text-[11px] text-slate-500">Enable or disable individual colour modes offered to customers</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Default Mode:</span>
                  <select
                    value={ownerConfig.color.defaultMode}
                    onChange={(e) =>
                      handleOwnerConfigChange({
                        ...ownerConfig,
                        color: {
                          ...ownerConfig.color,
                          defaultMode: e.target.value as 'BW' | 'COLOR'
                        }
                      })
                    }
                    className="h-8 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                  >
                    <option value="BW">Black & White</option>
                    {hwSupportsColor && ownerConfig.color.enableColor && (
                      <option value="COLOR">Colour</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* B&W toggle */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:border-slate-300">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Black & White (B&W)</span>
                    <span className="text-[10px] text-slate-500">Monochrome grayscale printing</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={ownerConfig.color.enableMonochrome}
                    onChange={(e) =>
                      handleOwnerConfigChange({
                        ...ownerConfig,
                        color: {
                          ...ownerConfig.color,
                          enableMonochrome: e.target.checked
                        }
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                {/* Colour toggle */}
                <label className={`flex items-center justify-between p-3 rounded-lg border ${
                  hwSupportsColor
                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:border-slate-300'
                    : 'border-slate-200/50 bg-slate-100/50 dark:bg-slate-900/30 opacity-60 cursor-not-allowed'
                }`}>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Colour Printing</span>
                    <span className="text-[10px] text-slate-500">
                      {hwSupportsColor ? 'Full CMYK color printing' : 'Unavailable on monochrome hardware'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!hwSupportsColor}
                    checked={hwSupportsColor && ownerConfig.color.enableColor}
                    onChange={(e) =>
                      handleOwnerConfigChange({
                        ...ownerConfig,
                        color: {
                          ...ownerConfig.color,
                          enableColor: e.target.checked
                        }
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* B. Paper Size Configuration */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <h5 className="font-bold text-slate-900 dark:text-white">Paper Size Toggles</h5>
                <p className="text-[11px] text-slate-500">Enable or disable individual driver-reported paper sizes</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {(hardware.paperSizes || []).map((paper) => {
                  const isEnabled = ownerConfig.paperSizes[paper.name] !== false;
                  return (
                    <label
                      key={paper.name}
                      className={`flex items-center justify-between p-2.5 rounded-lg border ${
                        isEnabled
                          ? 'border-blue-200 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 opacity-70'
                      } cursor-pointer transition-all`}
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{paper.name}</span>
                        {paper.widthMm && paper.heightMm && (
                          <span className="text-[10px] text-slate-500">
                            {paper.widthMm} × {paper.heightMm} mm
                          </span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) =>
                          handleOwnerConfigChange({
                            ...ownerConfig,
                            paperSizes: {
                              ...ownerConfig.paperSizes,
                              [paper.name]: e.target.checked
                            }
                          })
                        }
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* C. Print Sides (Duplex) Configuration */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <h5 className="font-bold text-slate-900 dark:text-white">Print Side Configuration</h5>
                <p className="text-[11px] text-slate-500">Control single-sided, automatic duplex, and manual duplex availability</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Single Sided */}
                <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Single-Sided</span>
                    <span className="text-[10px] text-slate-500">Standard 1-sided printing</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={ownerConfig.sides.enableSingleSided}
                    onChange={(e) =>
                      handleOwnerConfigChange({
                        ...ownerConfig,
                        sides: { ...ownerConfig.sides, enableSingleSided: e.target.checked }
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                {/* Automatic Duplex */}
                <label className={`flex items-center justify-between p-3 rounded-lg border ${
                  hwSupportsAutoDuplex
                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer'
                    : 'border-slate-200/50 bg-slate-100/50 dark:bg-slate-900/30 opacity-60 cursor-not-allowed'
                }`}>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Automatic Duplex</span>
                    <span className="text-[10px] text-slate-500">
                      {hwSupportsAutoDuplex ? 'Hardware 2-sided unit' : 'Unsupported by hardware'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!hwSupportsAutoDuplex}
                    checked={hwSupportsAutoDuplex && ownerConfig.sides.enableAutomaticDuplex}
                    onChange={(e) =>
                      handleOwnerConfigChange({
                        ...ownerConfig,
                        sides: { ...ownerConfig.sides, enableAutomaticDuplex: e.target.checked }
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>

                {/* Manual Duplex */}
                <label className={`flex items-center justify-between p-3 rounded-lg border ${
                  hwSupportsManualDuplex
                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer'
                    : 'border-slate-200/50 bg-slate-100/50 dark:bg-slate-900/30 opacity-60 cursor-not-allowed'
                }`}>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Manual Duplex</span>
                    <span className="text-[10px] text-slate-500">Manual paper flip</span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!hwSupportsManualDuplex}
                    checked={hwSupportsManualDuplex && ownerConfig.sides.enableManualDuplex}
                    onChange={(e) =>
                      handleOwnerConfigChange({
                        ...ownerConfig,
                        sides: { ...ownerConfig.sides, enableManualDuplex: e.target.checked }
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* D. Other Settings: DPI & Copies */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Default Print Resolution (DPI)
                </label>
                <select
                  value={ownerConfig.dpi.defaultDpi}
                  onChange={(e) =>
                    handleOwnerConfigChange({
                      ...ownerConfig,
                      dpi: { ...ownerConfig.dpi, defaultDpi: Number(e.target.value) }
                    })
                  }
                  className="w-full h-9 px-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                >
                  {(hardware.resolutions || [600]).map((dpi) => (
                    <option key={dpi} value={dpi}>{dpi} DPI</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Max Copies Per Job
                </label>
                <input
                  type="number"
                  min="1"
                  max={hardware.copies?.maxCopies || 999}
                  value={ownerConfig.copies.maxCopiesPerJob}
                  onChange={(e) =>
                    handleOwnerConfigChange({
                      ...ownerConfig,
                      copies: { ...ownerConfig.copies, maxCopiesPerJob: Math.max(1, Number(e.target.value)) }
                    })
                  }
                  className="w-full h-9 px-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold font-mono"
                />
              </div>
            </div>

            {/* Live Effective Capabilities Badge */}
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 dark:text-blue-300 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Live Effective Capabilities (Offered to Customers)
                </span>
                <span className="text-[10px] text-blue-700 dark:text-blue-400 font-mono">
                  Computed via Hardware ∩ Owner Config
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 font-semibold text-slate-700 dark:text-slate-200">
                  Color: {effective.supportsColor ? 'Yes' : 'No (B&W only)'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 font-semibold text-slate-700 dark:text-slate-200">
                  Duplex: {effective.supportsAutomaticDuplex ? 'Automatic' : (effective.supportsManualDuplex ? 'Manual only' : 'Single-side only')}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 font-semibold text-slate-700 dark:text-slate-200">
                  Paper Sizes: {effective.paperSizes.join(', ')}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 font-semibold text-slate-700 dark:text-slate-200">
                  Max Copies: {effective.maxCopies}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#E2E8F0] dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isSaving}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>Refresh Capabilities</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Configuration</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
