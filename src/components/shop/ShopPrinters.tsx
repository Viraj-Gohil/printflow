import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import {
  Printer,
  Plus,
  CheckCircle2,
  AlertCircle,
  Power,
  RotateCw,
  Cpu,
  Layers,
  Sparkles,
  Info,
  Crown,
  ArrowRight,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { PaperSize, PrinterDevice } from '../../types';

export const ShopPrinters: React.FC = () => {
  const { activeShop, printers, plans, updatePrinter, addPrinter, deletePrinter, navigate } = useApp();

  const shopPrinters = printers.filter((p) => p.shopId === activeShop.id);
  const agentPrinters = shopPrinters.filter((printer) => printer.agentManaged);
  const registeredPrinterCount = agentPrinters.length > 0 ? agentPrinters.length : shopPrinters.length;
  const currentPlan = plans.find((p) => p.id === activeShop.planId) || plans[0];
  const printerLimit = currentPlan.printerLimit ?? 1;
  const isLimitReached = registeredPrinterCount >= printerLimit;
  const remainingSlots = Math.max(0, printerLimit - registeredPrinterCount);
  const usagePercent = Math.min(100, Math.round((registeredPrinterCount / printerLimit) * 100));

  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New Printer form state
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterModel, setNewPrinterModel] = useState('');
  const [supportsColor, setSupportsColor] = useState(false);
  const [supportsDuplex, setSupportsDuplex] = useState(true);
  const [selectedSizes, setSelectedSizes] = useState<PaperSize[]>(['A4']);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleOpenAddModal = () => {
    setModalError(null);
    setShowAddModal(true);
  };

  const handleAddPrinter = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (isLimitReached) {
      setModalError(
        `Printer quota reached (${registeredPrinterCount}/${printerLimit}). Your active "${currentPlan.name}" plan permits a maximum of ${printerLimit} connected printer${printerLimit > 1 ? 's' : ''}. Upgrade your SaaS plan to connect additional hardware.`
      );
      return;
    }

    const trimmedName = newPrinterName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setModalError('Printer nickname must be at least 2 characters long.');
      return;
    }

    if (selectedSizes.length === 0) {
      setModalError('Please select at least one supported paper size.');
      return;
    }

    const res = addPrinter({
      shopId: activeShop.id,
      deviceId: 'DEV-WIN-COUNTER-1',
      name: trimmedName,
      model: newPrinterModel.trim() || 'Network Laser Printer',
      status: 'ONLINE',
      capabilities: {
        paperSizes: selectedSizes,
        supportsColor,
        supportsDuplex
      },
      priority: shopPrinters.length + 1,
      isEnabled: true,
      lastSeen: 'Just now'
    });

    if (!res.success) {
      setModalError(res.message || 'Failed to add printer.');
      return;
    }

    setNewPrinterName('');
    setNewPrinterModel('');
    setModalError(null);
    setShowAddModal(false);
  };

  const toggleSize = (size: PaperSize) => {
    if (selectedSizes.includes(size)) {
      if (selectedSizes.length > 1) {
        setSelectedSizes(selectedSizes.filter((s) => s !== size));
      }
    } else {
      setSelectedSizes([...selectedSizes, size]);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 text-slate-800">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Printers & Hardware
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Manage local counter printing devices and monitor spooler connectivity.
          </p>
        </div>
      </div>

      {/* 2. SAAS PLAN HARDWARE QUOTA & VALIDATION BANNER */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                SaaS Hardware Quota
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Crown className="w-3 h-3 text-blue-600" />
                <span>{currentPlan.name} Plan</span>
              </span>
              {isLimitReached ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  Quota Full ({registeredPrinterCount}/{printerLimit})
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {remainingSlots} Slot{remainingSlots > 1 ? 's' : ''} Available
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-slate-900">
              Connected Printers ({registeredPrinterCount} of {printerLimit} Allowed)
            </h2>
            <p className="text-xs text-slate-500 max-w-xl">
              Printers registered to your shop counter. Hardware connections are strictly validated according to your active SaaS subscription tier.
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
                <span>{registeredPrinterCount} in use</span>
                <span>Max: {printerLimit} printer{printerLimit > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {isLimitReached ? (
              <button
                onClick={() => navigate('/shop/subscription')}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Crown className="w-4 h-4" />
                <span>Upgrade Plan to Add More</span>
              </button>
            ) : null}

            <button
              onClick={handleOpenAddModal}
              className={`px-4 py-2.5 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                isLimitReached
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Register New Printer</span>
            </button>
          </div>
        </div>

        {/* Warning banner when limit reached */}
        {isLimitReached && (
          <div className="mt-4 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Plan Limit Reached:</strong> Your <strong>{currentPlan.name}</strong> plan allows a maximum of <strong>{printerLimit} connected printer{printerLimit > 1 ? 's' : ''}</strong>. To connect more counter printers, upgrade your SaaS subscription.
              </span>
            </div>
            <button
              onClick={() => navigate('/shop/subscription')}
              className="text-xs font-bold text-blue-700 hover:text-blue-800 underline underline-offset-2 shrink-0 cursor-pointer text-left sm:text-right"
            >
              View Plan Options →
            </button>
          </div>
        )}
      </div>

      {/* 2. PRINTERS LIST */}
      {shopPrinters.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
            <Printer className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">No Counter Printers Registered Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Link your counter laser or inkjet printer to receive and auto-route customer print jobs. Your active {currentPlan.name} plan includes {printerLimit} printer connection slot{printerLimit > 1 ? 's' : ''}.
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Connect First Printer</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shopPrinters.map((printer) => (
            <div
              key={printer.id}
              className={`bg-white p-5 rounded-2xl border transition-all ${
                printer.isEnabled
                  ? 'border-slate-200 shadow-xs'
                  : 'border-slate-200 bg-slate-50/70 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      printer.status === 'ONLINE'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Printer className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{printer.name}</h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      {printer.model}{printer.agentManaged ? ` · Synced from ${printer.deviceId}` : ''}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    printer.status === 'ONLINE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {printer.status}
                </span>
              </div>

              <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Color Capability:</span>
                  <span className="font-semibold text-slate-900">
                    {printer.capabilities.supportsColor ? 'Full Color (CMYK)' : 'Monochrome (B&W Only)'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Duplex Unit:</span>
                  <span className="font-semibold text-slate-900">
                    {printer.capabilities.supportsDuplex ? 'Automatic Double-Sided' : 'Manual Flip Only'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Paper Sizes:</span>
                  <div className="flex gap-1 flex-wrap">
                    {printer.capabilities.paperSizes.map((s) => (
                      <span key={s} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded text-[10px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 font-mono">Heartbeat: {printer.lastSeen}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updatePrinter(printer.id, { isEnabled: !printer.isEnabled })}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      printer.isEnabled
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {printer.isEnabled ? 'Disable Tray' : 'Enable Tray'}
                  </button>

                  {deleteConfirmId === printer.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          deletePrinter(printer.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 bg-slate-100 text-slate-600 text-[11px] rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(printer.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove printer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. REGISTER NEW PRINTER MODAL WITH SAAS LIMIT VALIDATION */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Register Counter Printer</h3>
                <p className="text-xs text-slate-500">
                  Link hardware for automated order spooling.
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Slot {registeredPrinterCount + 1} of {printerLimit}
              </span>
            </div>

            {/* If user reached limit, display strict upgrade requirement */}
            {isLimitReached ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-bold">Hardware Limit Reached</span>
                  </div>
                  <p>
                    Your current <strong>{currentPlan.name}</strong> SaaS plan is capped at <strong>{printerLimit} printer{printerLimit > 1 ? 's' : ''}</strong>. You have already registered {registeredPrinterCount} printer{registeredPrinterCount > 1 ? 's' : ''}.
                  </p>
                  <p className="text-[11px] text-amber-800">
                    To connect additional printers and speed up counter throughput, please upgrade your subscription.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      navigate('/shop/subscription');
                    }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Upgrade SaaS Plan</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddPrinter} className="space-y-4">
                {modalError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">
                    Printer Nickname <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HP LaserJet 1020 - Counter 1"
                    value={newPrinterName}
                    onChange={(e) => {
                      setModalError(null);
                      setNewPrinterName(e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800">Model / Driver Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Canon imageRUNNER 2206"
                    value={newPrinterModel}
                    onChange={(e) => setNewPrinterModel(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">Paper Sizes Supported</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['A4', 'A3', 'A5', 'Letter', 'Legal'] as PaperSize[]).map((size) => (
                      <button
                        type="button"
                        key={size}
                        onClick={() => toggleSize(size)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          selectedSizes.includes(size)
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-1 flex-wrap">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={supportsColor}
                      onChange={(e) => setSupportsColor(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>Color Printing (CMYK)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={supportsDuplex}
                      onChange={(e) => setSupportsDuplex(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>Automatic Duplex (2-sided)</span>
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    Register Printer
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
