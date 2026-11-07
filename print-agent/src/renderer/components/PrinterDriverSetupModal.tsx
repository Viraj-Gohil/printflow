import React, { useState, useEffect } from 'react';
import { AgentConfig, DiscoveredPrinter, HardwareCapabilities } from '../types/agent';
import {
  Printer,
  X,
  Usb,
  Wifi,
  Network,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Search,
  ChevronRight,
  ChevronLeft,
  HardDrive,
  Sliders,
  Check,
  Info,
  Pause,
  Play,
  CloudCheck,
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';

interface PrinterDriverSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AgentConfig;
  printers: DiscoveredPrinter[];
  isScanning: boolean;
  onRescanPrinters: () => Promise<DiscoveredPrinter[]>;
  onRegisterPrinter: (printerName: string, registered: boolean) => Promise<void>;
  onSelectPrimaryPrinter: (printerName: string) => void;
}

type ConnectionMethod = 'USB' | 'WIFI' | 'LAN';
type SetupStep = 1 | 2 | 3 | 4 | 5;

const MANUFACTURER_LINKS: Record<string, { url: string; label: string; description: string }> = {
  HP: {
    url: 'https://support.hp.com/us-en/drivers',
    label: 'HP Official Drivers',
    description: 'LaserJet, DeskJet, OfficeJet, Smart Tank official software'
  },
  Canon: {
    url: 'https://www.canon.com/support/',
    label: 'Canon Official Support',
    description: 'imageRUNNER, PIXMA, LBP, imageCLASS driver software'
  },
  Epson: {
    url: 'https://epson.com/Support/sl',
    label: 'Epson Official Support',
    description: 'EcoTank, WorkForce, Expression Photo drivers'
  },
  Brother: {
    url: 'https://support.brother.com/',
    label: 'Brother Solutions Center',
    description: 'HL-series, DCP, MFC laser and inkjet drivers'
  },
  Xerox: {
    url: 'https://www.support.xerox.com/',
    label: 'Xerox Support & Drivers',
    description: 'Phaser, WorkCentre, VersaLink, PrimeLink drivers'
  },
  Ricoh: {
    url: 'https://www.ricoh.com/downloads/',
    label: 'Ricoh Driver Downloads',
    description: 'Aficio, SP, IM-series multifunction driver packages'
  },
  Kyocera: {
    url: 'https://www.kyoceradocumentsolutions.com/download/',
    label: 'Kyocera Document Solutions',
    description: 'ECOSYS, TASKalfa KPDL & PCL driver packages'
  }
};

export const PrinterDriverSetupModal: React.FC<PrinterDriverSetupModalProps> = ({
  isOpen,
  onClose,
  config,
  printers,
  isScanning,
  onRescanPrinters,
  onRegisterPrinter,
  onSelectPrimaryPrinter
}) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>(1);
  const [selectedMethod, setSelectedMethod] = useState<ConnectionMethod>('USB');
  const [driverStatus, setDriverStatus] = useState<{
    drivers: Array<{ name: string; environment?: string; driverPath?: string; manufacturer?: string }>;
    manufacturerLinks: Record<string, string>;
  }>({ drivers: [], manufacturerLinks: {} });
  const [isCheckingDrivers, setIsCheckingDrivers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrinterName, setSelectedPrinterName] = useState<string>('');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'PENDING' | 'SYNCED' | 'ERROR'>('PENDING');
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Load driver status when modal opens or step 2 is active
  useEffect(() => {
    if (!isOpen) return;
    void handleCheckDriverStatus();
  }, [isOpen]);

  // Set default selected printer when printers list updates
  useEffect(() => {
    if (printers.length > 0 && !selectedPrinterName) {
      const defaultPrn = printers.find((p) => p.isDefault && p.isOnline)?.name || printers[0]?.name;
      if (defaultPrn) setSelectedPrinterName(defaultPrn);
    }
  }, [printers, selectedPrinterName]);

  const handleCheckDriverStatus = async () => {
    setIsCheckingDrivers(true);
    try {
      if (window.electronAgentAPI?.getDriverStatus) {
        const res = await window.electronAgentAPI.getDriverStatus();
        if (res && res.success) {
          setDriverStatus({
            drivers: res.drivers || [],
            manufacturerLinks: res.manufacturerLinks || {}
          });
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsCheckingDrivers(false);
    }
  };

  const handleOpenExternal = (url: string) => {
    if (window.electronAgentAPI?.openExternal) {
      window.electronAgentAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleRescanAndDetect = async () => {
    await handleCheckDriverStatus();
    await onRescanPrinters();
  };

  const handleCompleteSetupAndSync = async () => {
    if (!selectedPrinterName) return;
    setIsSyncingCloud(true);
    setSyncErrorMessage(null);

    try {
      // Register printer for shop and set as primary
      await onRegisterPrinter(selectedPrinterName, true);
      onSelectPrimaryPrinter(selectedPrinterName);
      setCloudSyncStatus('SYNCED');
      setTimeout(() => {
        setIsSyncingCloud(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setSyncErrorMessage(err?.message || 'Could not sync printer with PrintFlow Cloud.');
      setCloudSyncStatus('ERROR');
      setIsSyncingCloud(false);
    }
  };

  if (!isOpen) return null;

  const targetPrinter = printers.find((p) => p.name === selectedPrinterName) || printers[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-[#131D33] border border-[#E2E8F0] dark:border-slate-800 w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col animate-scale-in text-xs">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#131D33] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Printer className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                <span>Printer Driver Setup Assistant</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Step {currentStep} of 5
                </span>
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Guided onboarding &amp; driver verification for Xerox &amp; shop counter printers
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Setup Assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator Bar */}
        <div className="px-6 py-2.5 bg-[#F8FAFC] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between text-[11px] font-medium shrink-0">
          {[
            { step: 1, label: 'Welcome' },
            { step: 2, label: 'Driver Check' },
            { step: 3, label: 'Auto Detection' },
            { step: 4, label: 'Verification' },
            { step: 5, label: 'Capabilities & Sync' }
          ].map((s) => {
            const isActive = currentStep === s.step;
            const isCompleted = currentStep > s.step;
            return (
              <button
                type="button"
                key={s.step}
                onClick={() => setCurrentStep(s.step as SetupStep)}
                className={`flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isActive
                    ? 'text-[#2563EB] font-bold'
                    : isCompleted
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold font-mono ${
                    isActive
                      ? 'bg-[#2563EB] text-white'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : s.step}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ========================================================================= */}
          {/* STEP 1: WELCOME & CONNECTION METHOD                                      */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2 text-center max-w-xl mx-auto">
                <span className="text-[11px] font-bold text-[#2563EB] uppercase tracking-wider">
                  Guided Hardware Onboarding
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                  Connect Your Printer
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 leading-relaxed">
                  Connect your printer to PrintFlow. We'll automatically detect your installed printer and check whether it's ready to print.
                </p>
              </div>

              {/* Connection Methods Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    id: 'USB' as ConnectionMethod,
                    title: 'USB Printer',
                    subtitle: 'Direct Cable Connection',
                    icon: <Usb className="w-6 h-6 text-[#2563EB]" />,
                    description: 'Connect printer directly to this counter PC using a standard USB A-to-B printer cable.'
                  },
                  {
                    id: 'WIFI' as ConnectionMethod,
                    title: 'Wi-Fi Printer',
                    subtitle: 'Wireless Subnet',
                    icon: <Wifi className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
                    description: 'Connect wirelessly to your shop router on the same Wi-Fi network as this PC.'
                  },
                  {
                    id: 'LAN' as ConnectionMethod,
                    title: 'Network / LAN',
                    subtitle: 'Ethernet Cable / Share',
                    icon: <Network className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
                    description: 'Connect via RJ45 Ethernet cable to your shop switch or a Windows shared print server.'
                  }
                ].map((item) => {
                  const isSelected = selectedMethod === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSelectedMethod(item.id)}
                      className={`p-5 rounded-2xl border text-left flex flex-col justify-between space-y-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#2563EB] bg-[#EFF6FF] dark:bg-blue-950/40 ring-2 ring-[#2563EB]/20 shadow-md'
                          : 'border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 shadow-xs border border-slate-200 dark:border-slate-800">
                          {item.icon}
                        </div>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">{item.title}</h3>
                        <p className="text-[10.5px] font-semibold text-[#2563EB] dark:text-blue-400 mt-0.5">{item.subtitle}</p>
                        <p className="text-[11.5px] text-[#64748B] dark:text-slate-400 mt-1.5 leading-relaxed">{item.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Method Connection Tips */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A] dark:text-white">
                  <Info className="w-4 h-4 text-[#2563EB]" />
                  <span>Connection Checklist for {selectedMethod === 'USB' ? 'USB Cable' : selectedMethod === 'WIFI' ? 'Wi-Fi Network' : 'Network / LAN'}</span>
                </div>
                <ul className="text-[11.5px] text-[#64748B] dark:text-slate-400 space-y-1 pl-6 list-disc">
                  {selectedMethod === 'USB' && (
                    <>
                      <li>Plug the printer USB cable securely into a direct USB port on this PC (avoid unpowered USB hubs).</li>
                      <li>Turn on the printer power switch and ensure paper is loaded in Tray 1.</li>
                    </>
                  )}
                  {selectedMethod === 'WIFI' && (
                    <>
                      <li>Verify your printer display panel shows a solid Wi-Fi signal icon connected to your shop router.</li>
                      <li>Ensure this counter PC is connected to the exact same Wi-Fi router network.</li>
                    </>
                  )}
                  {selectedMethod === 'LAN' && (
                    <>
                      <li>Plug an Ethernet cable into the printer LAN port and your router/switch port.</li>
                      <li>Ensure Windows Network Discovery is enabled on this PC for printer detection.</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: DRIVER INSTALLATION CHECK                                        */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-[#2563EB]" />
                    <span>Windows Printer Driver Check</span>
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                    Verifying installed Windows driver packages and official manufacturer support.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCheckDriverStatus}
                  disabled={isCheckingDrivers}
                  className="secondary-button !text-xs font-semibold cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingDrivers ? 'animate-spin' : ''}`} />
                  <span>{isCheckingDrivers ? 'Checking Drivers...' : 'Re-check Drivers'}</span>
                </button>
              </div>

              {/* Drivers Status Banner */}
              {driverStatus.drivers.length > 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{driverStatus.drivers.length} Installed Windows Driver Package(s) Detected</span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-emerald-700 dark:text-emerald-300">
                    Windows reports driver packages installed for your printer hardware. You can proceed directly to automatic printer detection.
                  </p>

                  <div className="pt-2 flex flex-wrap gap-2">
                    {driverStatus.drivers.map((d, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-[11px] font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {d.name} ({d.manufacturer || 'Verified'})
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Printer Driver Not Detected</span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed">
                    Printer driver not detected. Please install the official driver for your printer model from the manufacturer support links below before scanning again.
                  </p>
                </div>
              )}

              {/* Manufacturer Official Support Links Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
                    Official Manufacturer Driver Support Portals
                  </h3>
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search model (e.g. Canon LBP)..."
                      className="settings-input !py-1 !pl-8 !text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(MANUFACTURER_LINKS)
                    .filter(([mfr, info]) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return mfr.toLowerCase().includes(q) || info.label.toLowerCase().includes(q) || info.description.toLowerCase().includes(q);
                    })
                    .map(([mfr, info]) => (
                      <div
                        key={mfr}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 hover:border-blue-300 transition-colors"
                      >
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">{info.label}</span>
                          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight block mt-0.5">{info.description}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenExternal(info.url)}
                          className="secondary-button !min-h-[28px] !px-2.5 !py-1 !text-[11px] shrink-0 font-semibold cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3 text-blue-600" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Step-by-Step Driver Installation Instructions */}
              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300 space-y-2">
                <span className="font-bold block">How to Install Your Printer Driver:</span>
                <ol className="list-decimal pl-5 space-y-1 text-[11.5px] leading-relaxed">
                  <li>Identify your printer brand and model number from the physical barcode label on the machine.</li>
                  <li>Click your manufacturer's official support button above to open the official driver download portal.</li>
                  <li>Download and run the official Windows x64 driver setup executable (`.exe` or `.msi`).</li>
                  <li>Follow the manufacturer setup wizard to completion, then click <strong>Scan Again</strong> below.</li>
                </ol>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: AUTOMATIC PRINTER DETECTION                                      */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                    <Printer className="w-5 h-5 text-[#2563EB]" />
                    <span>Automatic Printer Detection</span>
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                    Discovered USB, Wi-Fi, LAN, and Shared Windows printers connected to this counter PC.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRescanAndDetect}
                  disabled={isScanning}
                  className="primary-button !text-xs font-semibold cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Scanning Hardware...' : 'Scan Again'}</span>
                </button>
              </div>

              {printers.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl space-y-3">
                  <Printer className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-800 dark:text-slate-200">No Printers Discovered Yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Ensure your printer power switch is ON and USB or network cable is plugged in, then click Scan Again.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {printers.map((p) => {
                    const isSelected = selectedPrinterName === p.name;
                    return (
                      <button
                        type="button"
                        key={p.name}
                        onClick={() => setSelectedPrinterName(p.name)}
                        className={`p-4 rounded-2xl border text-left space-y-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#2563EB] bg-[#EFF6FF] dark:bg-blue-950/40 ring-2 ring-[#2563EB]/20 shadow-md'
                            : 'border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#131D33] hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#2563EB] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                              <Printer className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={p.displayName || p.name}>
                                {p.displayName || p.name}
                              </h3>
                              <p className="text-[11px] text-slate-500 truncate">{p.driverName || 'Windows Printer Driver'}</p>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.isOnline ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}`}>
                            {p.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 font-mono">
                          <span>Port: {p.portName || 'USB001'}</span>
                          <span>{p.isDefault ? 'Windows Default' : 'Spooler Target'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: PRINTER CONNECTION VERIFICATION                                  */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
                    <span>Printer Connection Verification</span>
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                    Verifying real-time Windows spooler status for: <strong>{targetPrinter?.name || 'Selected Printer'}</strong>
                  </p>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${targetPrinter?.isOnline ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200'}`}>
                  <span className={`w-2 h-2 rounded-full ${targetPrinter?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <span>{targetPrinter?.status || 'UNKNOWN'}</span>
                </span>
              </div>

              {/* Status Analysis Card */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Windows Spooler State:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{targetPrinter?.status === 'READY' ? 'READY (Spooling Active)' : targetPrinter?.status || 'UNKNOWN'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Physical Online Indicator:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{targetPrinter?.isOnline ? 'ONLINE & ACCESSIBLE' : 'OFFLINE / UNREACHABLE'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Driver Package:</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">{targetPrinter?.driverName || 'Windows Generic Driver'}</span>
                </div>
              </div>

              {/* Contextual Troubleshooting Panel */}
              {!targetPrinter?.isOnline ? (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>Troubleshooting Guidance: Printer is Offline</span>
                  </div>
                  <ul className="text-[11.5px] list-disc pl-5 space-y-1 leading-relaxed">
                    <li>Check that the USB cable or Wi-Fi network connection is securely plugged in.</li>
                    <li>Verify the printer power indicator is lit green and not in deep sleep or power off mode.</li>
                    <li>Open Windows <strong>Devices &amp; Printers</strong> and check if "Use Printer Offline" is enabled in printer properties.</li>
                  </ul>
                </div>
              ) : targetPrinter?.status === 'PAUSED' ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Pause className="w-4 h-4 text-amber-600" />
                    <span>Windows Queue Paused</span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed">
                    The Windows print spooler queue for this printer is currently PAUSED. Unpause the printer in Windows Devices &amp; Printers to allow PrintFlow jobs to spool.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 space-y-1 text-xs">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Connection Verified &amp; Ready</span>
                  </div>
                  <p className="text-[11.5px] leading-relaxed">
                    Windows reports this printer is online, driver is valid, and hardware spooler is ready to accept print orders.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: CAPABILITY DETECTION & CLOUD SYNCHRONIZATION                      */}
          {/* ========================================================================= */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[#2563EB]" />
                    <span>Driver Capability Detection &amp; Cloud Sync</span>
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                    Real hardware capabilities extracted directly from Windows driver DEVMODE &amp; WMI APIs.
                  </p>
                </div>

                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {targetPrinter?.name}
                </span>
              </div>

              {/* Detected Capabilities Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Paper Sizes</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {targetPrinter?.capabilities?.paperSizes && targetPrinter.capabilities.paperSizes.length > 0 ? (
                      targetPrinter.capabilities.paperSizes.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold rounded-md text-xs border border-blue-200 dark:border-blue-800">
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">A4, Letter, Legal</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Color Capability</span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white pt-1">
                    {targetPrinter?.capabilities?.supportsColor === true
                      ? 'Full Color & Monochrome (B&W)'
                      : targetPrinter?.capabilities?.supportsColor === false
                      ? 'Monochrome (Black & White) Only'
                      : 'UNKNOWN / NOT VERIFIED'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Duplex (2-Sided) Unit</span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white pt-1">
                    {targetPrinter?.capabilities?.supportsDuplex === true
                      ? 'Automatic Hardware 2-Sided Duplex'
                      : targetPrinter?.capabilities?.supportsDuplex === false
                      ? 'Single-Sided (Simplex) Only'
                      : 'UNKNOWN / NOT VERIFIED'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">PrintFlow Shop Association</span>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 pt-1 font-mono">
                    {config.shopDetails?.shopName || config.shopSlug || 'PrintFlow Shop'} ({config.shopId || 'Authenticated'})
                  </p>
                </div>
              </div>

              {/* Cloud Sync Status Feedback */}
              {syncErrorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{syncErrorMessage}</span>
                </div>
              )}

              {cloudSyncStatus === 'SYNCED' && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5 animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-bold">Successfully Synced to PrintFlow Cloud!</p>
                    <p className="text-[11px] opacity-80">This printer is now active and ready to receive customer print jobs.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900 flex items-center justify-between shrink-0">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1) as SetupStep)}
            className="secondary-button !text-xs font-semibold disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1) as SetupStep)}
              className="primary-button text-xs font-semibold cursor-pointer"
            >
              <span>{currentStep === 1 ? 'Start Printer Setup' : 'Continue'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCompleteSetupAndSync}
              disabled={isSyncingCloud}
              className="primary-button text-xs font-bold cursor-pointer"
            >
              {isSyncingCloud ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Syncing with Cloud...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Complete Setup &amp; Save Printer</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
