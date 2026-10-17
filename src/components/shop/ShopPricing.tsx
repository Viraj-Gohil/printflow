import React, { useState, useMemo } from 'react';
import { useApp } from '../../lib/store';
import {
  Plus,
  Save,
  RotateCcw,
  Search,
  Copy,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  ExternalLink,
  Info,
  X,
  RefreshCw,
  Calculator,
  Pencil,
  Power
} from 'lucide-react';
import { PaperSize, PrintColor, PrintSides, PricingRule } from '../../types';
import {
  STANDARD_PAPER_SIZES,
  COLOR_MODES,
  PRINT_SIDES,
  resolveUnitPrice
} from '../../lib/utils/pricing';
import { validatePositivePrice } from '../../lib/validation';

export const ShopPricing: React.FC = () => {
  const {
    activeShop,
    pricingRules,
    savePricingRules,
    showToast,
    navigate
  } = useApp();

  // Shop-specific rules
  const shopRules = useMemo(() => {
    return pricingRules.filter((r) => r.shopId === activeShop.id);
  }, [pricingRules, activeShop.id]);

  // Local draft state for batch edits
  const [draftRules, setDraftRules] = useState<PricingRule[]>(shopRules);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Sync draft whenever shopRules change externally if not dirty
  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      setDraftRules(shopRules);
    }
  }, [shopRules, hasUnsavedChanges]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPaperSize, setFilterPaperSize] = useState<string>('ALL');
  const [filterColor, setFilterColor] = useState<string>('ALL');
  const [filterSides, setFilterSides] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // UI Modals & Actions
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // New Rule Form State
  const [newSizeSelection, setNewSizeSelection] = useState<string>('A4');
  const [customPaperName, setCustomPaperName] = useState('');
  const [customWidth, setCustomWidth] = useState<string>('4');
  const [customHeight, setCustomHeight] = useState<string>('6');
  const [customUnit, setCustomUnit] = useState<'mm' | 'inch'>('inch');
  const [newColorMode, setNewColorMode] = useState<PrintColor>('BW');
  const [newSides, setNewSides] = useState<PrintSides>('SINGLE');
  const [newPrice, setNewPrice] = useState<string>('2.50');
  const [newIsActive, setNewIsActive] = useState<boolean>(true);
  const [newModalError, setNewModalError] = useState<string | null>(null);

  // Edit Rule Form State
  const [editPaperSize, setEditPaperSize] = useState<string>('A4');
  const [editCustomName, setEditCustomName] = useState('');
  const [editCustomWidth, setEditCustomWidth] = useState<string>('4');
  const [editCustomHeight, setEditCustomHeight] = useState<string>('6');
  const [editCustomUnit, setEditCustomUnit] = useState<'mm' | 'inch'>('inch');
  const [editColorMode, setEditColorMode] = useState<PrintColor>('BW');
  const [editSides, setEditSides] = useState<PrintSides>('SINGLE');
  const [editPrice, setEditPrice] = useState<string>('2.50');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Customer Price Simulation Sandbox (Live preview)
  const [simPaperSize, setSimPaperSize] = useState<string>('A4');
  const [simColor, setSimColor] = useState<PrintColor>('BW');
  const [simSides, setSimSides] = useState<PrintSides>('SINGLE');
  const [simPages, setSimPages] = useState<number>(10);
  const [simCopies, setSimCopies] = useState<number>(1);

  // Quick inline edit handler
  const handlePriceChange = (ruleId: string, val: string) => {
    const num = parseFloat(val);
    const updated = draftRules.map((r) => {
      if (r.id === ruleId) {
        return {
          ...r,
          pricePerPage: isNaN(num) ? 0 : num
        };
      }
      return r;
    });
    setDraftRules(updated);
    setHasUnsavedChanges(true);
  };

  // Toggle rule status in draft (Active <-> Inactive)
  const handleToggleStatus = (ruleId: string) => {
    const updated = draftRules.map((r) => {
      if (r.id === ruleId) {
        const cur = r.isActive ?? true;
        return { ...r, isActive: !cur };
      }
      return r;
    });
    setDraftRules(updated);
    setHasUnsavedChanges(true);
    const target = updated.find((r) => r.id === ruleId);
    if (target) {
      showToast(
        target.isActive ? 'Rule Activated' : 'Rule Deactivated',
        `${target.paperSize} (${target.color === 'COLOR' ? 'Color' : 'B&W'}) is now ${
          target.isActive ? 'Active' : 'Inactive'
        }. Click Publish to apply.`,
        'info'
      );
    }
  };

  // Duplicate rule
  const handleDuplicateRule = (rule: PricingRule) => {
    const dup: PricingRule = {
      ...rule,
      id: `pr_${Date.now()}_dup`,
      paperSize: rule.paperSize,
      pricePerPage: rule.pricePerPage,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setDraftRules([dup, ...draftRules]);
    setHasUnsavedChanges(true);
    showToast('Rule Duplicated', `Created a copy of ${rule.paperSize} rule. Adjust and save.`, 'info');
  };

  // Open Edit Modal
  const handleOpenEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setEditModalError(null);

    const isCustom = !STANDARD_PAPER_SIZES.some((s) => s.id === rule.paperSize);
    if (isCustom) {
      setEditPaperSize('Custom Size');
      setEditCustomName(rule.paperSize);
      setEditCustomWidth(rule.customWidth ? String(rule.customWidth) : '4');
      setEditCustomHeight(rule.customHeight ? String(rule.customHeight) : '6');
      setEditCustomUnit(rule.unit || 'inch');
    } else {
      setEditPaperSize(rule.paperSize);
      setEditCustomName('');
      setEditCustomWidth('4');
      setEditCustomHeight('6');
      setEditCustomUnit('inch');
    }

    setEditColorMode((rule.color || rule.colorMode || 'BW') as PrintColor);
    setEditSides(rule.sides);
    setEditPrice(rule.pricePerPage.toFixed(2));
    setEditIsActive(rule.isActive ?? true);
  };

  // Save Edit Modal
  const handleSaveEditRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    setEditModalError(null);
    const isCustom = editPaperSize === 'Custom Size';
    const finalPaperSize = isCustom ? editCustomName.trim() : editPaperSize;

    if (!finalPaperSize || finalPaperSize.length < 2) {
      setEditModalError('Please enter a valid paper size name (minimum 2 characters).');
      return;
    }

    let parsedW: number | undefined;
    let parsedH: number | undefined;

    if (isCustom) {
      parsedW = parseFloat(editCustomWidth);
      parsedH = parseFloat(editCustomHeight);
      if (isNaN(parsedW) || parsedW <= 0 || isNaN(parsedH) || parsedH <= 0) {
        setEditModalError('Custom width and height must be positive numbers.');
        return;
      }
    }

    const priceCheck = validatePositivePrice(editPrice, 0.5, 500, 'Price per page');
    if (!priceCheck.isValid) {
      setEditModalError(priceCheck.error || 'Price per page must be between ₹0.50 and ₹500.');
      return;
    }

    // Check duplicate among other rules
    const duplicate = draftRules.some(
      (r) =>
        r.id !== editingRule.id &&
        r.paperSize.toLowerCase() === finalPaperSize.toLowerCase() &&
        (r.color || 'BW') === editColorMode &&
        r.sides === editSides
    );
    if (duplicate) {
      setEditModalError(`Another rule already exists for ${finalPaperSize} (${editColorMode}, ${editSides}).`);
      return;
    }

    const updated = draftRules.map((r) => {
      if (r.id === editingRule.id) {
        return {
          ...r,
          paperSize: finalPaperSize,
          customWidth: parsedW,
          customHeight: parsedH,
          unit: isCustom ? editCustomUnit : undefined,
          color: editColorMode,
          colorMode: editColorMode,
          sides: editSides,
          pricePerPage: parseFloat(editPrice),
          isActive: editIsActive,
          updatedAt: new Date().toISOString()
        };
      }
      return r;
    });

    setDraftRules(updated);
    setHasUnsavedChanges(true);
    setEditingRule(null);
    showToast('Rule Updated', `Updated ${finalPaperSize} rule in draft. Click Publish to persist.`, 'success');
  };

  // Save all changes
  const handleSaveAll = () => {
    setValidationError(null);

    // Validate all prices
    for (const r of draftRules) {
      const check = validatePositivePrice(r.pricePerPage, 0.5, 500, `${r.paperSize} rate`);
      if (!check.isValid) {
        setValidationError(check.error || `Please enter a valid rate (₹0.50 - ₹500) for ${r.paperSize}.`);
        return;
      }
    }

    // Merge updated rules for this shop back into global state
    const otherShopRules = pricingRules.filter((r) => r.shopId !== activeShop.id);
    const updatedShopRules = draftRules.map((r) => ({
      ...r,
      updatedAt: new Date().toISOString()
    }));
    const finalAllRules = [...otherShopRules, ...updatedShopRules];

    savePricingRules(finalAllRules);
    setHasUnsavedChanges(false);
    setSuccessBanner('Pricing rules published! All customer kiosk checkouts are now using these updated rates.');
    showToast('Rates Saved', 'Customer order price calculator updated with new rates.', 'success');
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  // Discard changes
  const handleDiscardChanges = () => {
    setDraftRules(shopRules);
    setHasUnsavedChanges(false);
    setValidationError(null);
    showToast('Changes Discarded', 'Reverted back to last published rates.', 'info');
  };

  // Reset to Recommended Xerox Defaults
  const handleApplyDefaults = () => {
    const recommended: PricingRule[] = [
      { id: `pr_${Date.now()}_1`, shopId: activeShop.id, paperSize: 'A4', color: 'BW', sides: 'SINGLE', pricePerPage: 2.0, isActive: true, currency: 'INR' },
      { id: `pr_${Date.now()}_2`, shopId: activeShop.id, paperSize: 'A4', color: 'BW', sides: 'DOUBLE', pricePerPage: 1.5, isActive: true, currency: 'INR' },
      { id: `pr_${Date.now()}_3`, shopId: activeShop.id, paperSize: 'A4', color: 'COLOR', sides: 'SINGLE', pricePerPage: 10.0, isActive: true, currency: 'INR' },
      { id: `pr_${Date.now()}_4`, shopId: activeShop.id, paperSize: 'A4', color: 'COLOR', sides: 'DOUBLE', pricePerPage: 8.0, isActive: true, currency: 'INR' },
      { id: `pr_${Date.now()}_5`, shopId: activeShop.id, paperSize: 'A3', color: 'BW', sides: 'SINGLE', pricePerPage: 6.0, isActive: true, currency: 'INR' },
      { id: `pr_${Date.now()}_6`, shopId: activeShop.id, paperSize: 'A3', color: 'COLOR', sides: 'SINGLE', pricePerPage: 20.0, isActive: true, currency: 'INR' },
      { id: `pr_${Date.now()}_7`, shopId: activeShop.id, paperSize: 'A5', color: 'BW', sides: 'SINGLE', pricePerPage: 1.5, isActive: true, currency: 'INR' },
      { id: `pr_${Date.now()}_8`, shopId: activeShop.id, paperSize: 'Legal', color: 'BW', sides: 'SINGLE', pricePerPage: 3.0, isActive: true, currency: 'INR' },
      { id: `pr_${Date.now()}_9`, shopId: activeShop.id, paperSize: 'Letter', color: 'BW', sides: 'SINGLE', pricePerPage: 2.0, isActive: true, currency: 'INR' }
    ];
    setDraftRules(recommended);
    setHasUnsavedChanges(true);
    showToast('Defaults Loaded', 'Loaded standard Indian counter xerox rates. Click Save to apply.', 'info');
  };

  // Add rule modal submission
  const handleAddNewRule = (e: React.FormEvent) => {
    e.preventDefault();
    setNewModalError(null);

    const isCustom = newSizeSelection === 'Custom Size';
    const finalPaperSize = isCustom ? customPaperName.trim() : newSizeSelection;

    if (!finalPaperSize || finalPaperSize.length < 2) {
      setNewModalError('Please enter a valid paper size name (minimum 2 characters).');
      return;
    }

    let parsedW: number | undefined;
    let parsedH: number | undefined;

    if (isCustom) {
      parsedW = parseFloat(customWidth);
      parsedH = parseFloat(customHeight);
      if (isNaN(parsedW) || parsedW <= 0 || isNaN(parsedH) || parsedH <= 0) {
        setNewModalError('Custom width and height must be positive numbers.');
        return;
      }
    }

    const priceCheck = validatePositivePrice(newPrice, 0.5, 500, 'Price per page');
    if (!priceCheck.isValid) {
      setNewModalError(priceCheck.error || 'Price per page must be between ₹0.50 and ₹500.');
      return;
    }

    // Check duplicate in draft
    const alreadyExists = draftRules.some(
      (r) =>
        r.paperSize.toLowerCase() === finalPaperSize.toLowerCase() &&
        (r.color || 'BW') === newColorMode &&
        r.sides === newSides
    );
    if (alreadyExists) {
      setNewModalError(`A rule already exists for ${finalPaperSize} (${newColorMode === 'COLOR' ? 'Color' : 'B&W'}, ${newSides === 'DOUBLE' ? 'Duplex' : 'Single'}). Edit its price in the table.`);
      return;
    }

    const newCreatedRule: PricingRule = {
      id: `pr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      shopId: activeShop.id,
      paperSize: finalPaperSize,
      customWidth: parsedW,
      customHeight: parsedH,
      unit: isCustom ? customUnit : undefined,
      color: newColorMode,
      colorMode: newColorMode,
      sides: newSides,
      pricePerPage: parseFloat(newPrice),
      currency: 'INR',
      isActive: newIsActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setDraftRules([newCreatedRule, ...draftRules]);
    setHasUnsavedChanges(true);
    setShowAddModal(false);

    // Reset form
    setNewSizeSelection('A4');
    setCustomPaperName('');
    setCustomWidth('4');
    setCustomHeight('6');
    setNewPrice('2.50');
    setNewIsActive(true);
    showToast('Rule Added', `Created ${finalPaperSize} rule at ₹${parseFloat(newPrice).toFixed(2)}/page. Remember to Save Changes.`, 'success');
  };

  // Delete rule
  const confirmDelete = (ruleId: string) => {
    setDraftRules(draftRules.filter((r) => r.id !== ruleId));
    setHasUnsavedChanges(true);
    setDeleteConfirmId(null);
    showToast('Rule Removed', 'Rule removed from draft. Click Save to persist.', 'info');
  };

  // Filtered rules for display
  const filteredRules = useMemo(() => {
    return draftRules.filter((rule) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = rule.paperSize.toLowerCase().includes(q);
        const matchesPrice = rule.pricePerPage.toString().includes(q);
        if (!matchesName && !matchesPrice) return false;
      }
      // Paper size filter
      if (filterPaperSize !== 'ALL') {
        if (rule.paperSize.toLowerCase() !== filterPaperSize.toLowerCase()) return false;
      }
      // Color filter
      if (filterColor !== 'ALL') {
        const ruleCol = rule.color || rule.colorMode || 'BW';
        if (ruleCol !== filterColor) return false;
      }
      // Sides filter
      if (filterSides !== 'ALL') {
        if (rule.sides !== filterSides) return false;
      }
      // Status filter
      if (filterStatus !== 'ALL') {
        const isActive = rule.isActive ?? true;
        if (filterStatus === 'ACTIVE' && !isActive) return false;
        if (filterStatus === 'INACTIVE' && isActive) return false;
      }
      return true;
    });
  }, [draftRules, searchQuery, filterPaperSize, filterColor, filterSides, filterStatus]);

  // Distinct available paper sizes in this shop
  const distinctShopSizes = useMemo(() => {
    const set = new Set<string>();
    draftRules.forEach((r) => set.add(r.paperSize));
    return Array.from(set);
  }, [draftRules]);

  // Live Simulated Price Calculation
  const simUnitPrice = useMemo(() => {
    return resolveUnitPrice(draftRules, activeShop.id, simPaperSize, simColor, simSides);
  }, [draftRules, activeShop.id, simPaperSize, simColor, simSides]);

  const simDocumentTotal = useMemo(() => {
    const pages = Math.max(1, simPages);
    const copies = Math.max(1, simCopies);
    return pages * copies * simUnitPrice;
  }, [simPages, simCopies, simUnitPrice]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-normal text-slate-800">
      {/* Top Banner / Actions Bar */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
                Dynamic Print Pricing Management
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Define custom rates across multiple paper sizes, duplex modes, and color options.
              </p>
            </div>
          </div>
        </div>

        {/* Global Save / Discard / Add buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Pricing Rule</span>
          </button>

          <button
            type="button"
            onClick={handleApplyDefaults}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            title="Load standard Indian xerox market prices"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Load Market Rates</span>
          </button>

          {hasUnsavedChanges && (
            <>
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAll}
                className="px-5 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Publish Rates ({draftRules.length})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Validation or Success alerts */}
      {validationError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-normal">{validationError}</span>
        </div>
      )}

      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-normal">{successBanner}</span>
        </div>
      )}

      {/* Two Column Section: Left = Pricing Rules Table (65%) | Right = Live Calculator & Quick Preview (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Pricing Rules Management (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by paper name or price (e.g. A4, 2.50)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer text-[11px] ${
                      filterStatus === st
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL' ? 'All Rules' : st === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Filters: Paper Size, Color, Sides */}
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Filter:</span>

              {/* Paper Size dropdown */}
              <select
                value={filterPaperSize}
                onChange={(e) => setFilterPaperSize(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-normal cursor-pointer"
              >
                <option value="ALL">All Paper Sizes ({distinctShopSizes.length})</option>
                {distinctShopSizes.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>

              {/* Color dropdown */}
              <select
                value={filterColor}
                onChange={(e) => setFilterColor(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-normal cursor-pointer"
              >
                <option value="ALL">All Color Modes</option>
                <option value="BW">Black & White</option>
                <option value="COLOR">Color</option>
              </select>

              {/* Sides dropdown */}
              <select
                value={filterSides}
                onChange={(e) => setFilterSides(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-normal cursor-pointer"
              >
                <option value="ALL">All Sides</option>
                <option value="SINGLE">Single Sided</option>
                <option value="DOUBLE">Duplex (Double Sided)</option>
              </select>

              {(filterPaperSize !== 'ALL' || filterColor !== 'ALL' || filterSides !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterPaperSize('ALL');
                    setFilterColor('ALL');
                    setFilterSides('ALL');
                    setSearchQuery('');
                  }}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800 ml-auto cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Pricing Rules Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Paper Size</th>
                    <th className="py-3 px-3">Color Mode</th>
                    <th className="py-3 px-3">Print Sides</th>
                    <th className="py-3 px-3 text-right">Price / Page</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-medium text-slate-600">No pricing rules found matching filters</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your search or add a new pricing rule.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((rule) => {
                      const isActive = rule.isActive ?? true;
                      const check = validatePositivePrice(rule.pricePerPage, 0.5, 500);
                      const isInvalid = !check.isValid;

                      return (
                        <tr
                          key={rule.id}
                          className={`transition-colors hover:bg-slate-50/70 ${
                            !isActive ? 'opacity-65 bg-slate-50/30' : ''
                          }`}
                        >
                          {/* Paper Size & Dimensions */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900 text-[13px] flex items-center gap-1.5">
                                {rule.paperSize}
                                {rule.customWidth && rule.customHeight && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded font-normal border border-purple-200">
                                    {rule.customWidth}×{rule.customHeight} {rule.unit || 'in'}
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {STANDARD_PAPER_SIZES.find((s) => s.id === rule.paperSize)?.dimensions ||
                                  (rule.customWidth ? `${rule.customWidth} × ${rule.customHeight} ${rule.unit}` : 'Custom Size')}
                              </span>
                            </div>
                          </td>

                          {/* Color Mode */}
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                rule.color === 'COLOR'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {rule.color === 'COLOR' ? 'Color' : 'Black & White'}
                            </span>
                          </td>

                          {/* Sides */}
                          <td className="py-3 px-3 text-slate-700 font-normal">
                            {rule.sides === 'DOUBLE' ? (
                              <span className="inline-flex items-center gap-1 text-slate-800">
                                <span>Double Sided</span>
                                <span className="text-[10px] text-blue-600 font-mono">(Duplex)</span>
                              </span>
                            ) : (
                              <span>Single Sided</span>
                            )}
                          </td>

                          {/* Price Per Page (Editable input) */}
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex flex-col items-end gap-0.5">
                              <div className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                                <span className="text-slate-400 text-xs">₹</span>
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0.5"
                                  max="500"
                                  value={rule.pricePerPage}
                                  onChange={(e) => handlePriceChange(rule.id, e.target.value)}
                                  className="w-16 text-right font-mono font-medium text-slate-900 bg-transparent focus:outline-none text-xs"
                                />
                              </div>
                              {isInvalid && (
                                <span className="text-[9px] text-red-600 font-normal">{check.error}</span>
                              )}
                            </div>
                          </td>

                          {/* Active / Inactive Button */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(rule.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80 shadow-2xs'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200/80'
                              }`}
                              title={isActive ? 'Click to make Inactive' : 'Click to make Active'}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-400'
                                }`}
                              />
                              <span>{isActive ? 'Active' : 'Inactive'}</span>
                            </button>
                          </td>

                          {/* Actions: Edit, Duplicate, Toggle, Delete */}
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(rule)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Rule"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateRule(rule)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Duplicate Rule"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(rule.id)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isActive
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                                title={isActive ? 'Make Inactive' : 'Make Active'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(rule.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer info */}
            <div className="p-3.5 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 font-normal">
              <span>
                Showing <span className="font-medium text-slate-700">{filteredRules.length}</span> of{' '}
                <span className="font-medium text-slate-700">{draftRules.length}</span> configured rules
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">
                  Minimum Shop Checkout:{' '}
                  <span className="font-medium text-slate-700">₹{activeShop.minimumOrder || 5}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Price Simulator & Counter Quick Guide (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Live Customer Price Preview Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Calculator className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Customer Price Simulator</h3>
              </div>
              <span className="text-[10px] uppercase font-medium tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                Live Engine
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Verify how your active rules calculate order prices when customers order at the counter.
            </p>

            {/* Simulator Inputs */}
            <div className="space-y-3 pt-1 text-xs">
              {/* Paper Size */}
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Paper Size</label>
                <select
                  value={simPaperSize}
                  onChange={(e) => setSimPaperSize(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-normal text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {distinctShopSizes.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color & Sides */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Color Mode</label>
                  <select
                    value={simColor}
                    onChange={(e) => setSimColor(e.target.value as PrintColor)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-normal text-slate-800 cursor-pointer"
                  >
                    <option value="BW">Black & White</option>
                    <option value="COLOR">Color</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Print Sides</label>
                  <select
                    value={simSides}
                    onChange={(e) => setSimSides(e.target.value as PrintSides)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-normal text-slate-800 cursor-pointer"
                  >
                    <option value="SINGLE">Single Sided</option>
                    <option value="DOUBLE">Duplex</option>
                  </select>
                </div>
              </div>

              {/* Pages & Copies */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Document Pages</label>
                  <input
                    type="number"
                    min="1"
                    value={simPages}
                    onChange={(e) => setSimPages(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">Copies</label>
                  <input
                    type="number"
                    min="1"
                    value={simCopies}
                    onChange={(e) => setSimCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-medium text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Calculated Result Breakdown */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Unit Rate Resolved:</span>
                <span className="font-mono font-medium text-slate-900">₹{simUnitPrice.toFixed(2)} / page</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Total Billable Sheets:</span>
                <span className="font-mono font-medium text-slate-900">{simPages * simCopies} pages</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Platform Convenience Fee:</span>
                <span className="font-mono font-medium text-slate-900">₹2.00</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-900">Customer Checkout Total:</span>
                <span className="text-base font-semibold font-mono text-emerald-700">
                  ₹{(simDocumentTotal + 2).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/s/${activeShop.slug}`)}
              className="w-full py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Test In Customer Portal</span>
            </button>
          </div>

          {/* Pricing Best Practices & Guidelines Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <h4 className="text-xs font-semibold text-slate-900">Counter Pricing Best Practices</h4>
            </div>
            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed font-normal">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500">✓</span>
                <span>
                  <span className="font-medium text-slate-800">Duplex Discount:</span> Double-sided is usually priced at ₹1.50/page vs ₹2.00 single to encourage paper saving.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500">✓</span>
                <span>
                  <span className="font-medium text-slate-800">Minimum Order:</span> Protect counter staff time with a ₹5–₹10 minimum fee configured in Shop Profile.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500">✓</span>
                <span>
                  <span className="font-medium text-slate-800">Architectural Drawings (A1/A0):</span> Usually charged at ₹40 to ₹80 per sheet for engineering shops.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* MODAL: Add New Pricing Rule */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Add Print Pricing Rule</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {newModalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{newModalError}</span>
              </div>
            )}

            <form onSubmit={handleAddNewRule} className="space-y-4 text-xs font-normal">
              {/* Paper Size selector */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Paper Size</label>
                <select
                  value={newSizeSelection}
                  onChange={(e) => setNewSizeSelection(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-normal focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <optgroup label="Standard Office & Documents">
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="A3">A3 (297 × 420 mm)</option>
                    <option value="A5">A5 (148 × 210 mm)</option>
                    <option value="A6">A6 (105 × 148 mm)</option>
                    <option value="Legal">Legal (8.5 × 14 in)</option>
                    <option value="Letter">Letter (8.5 × 11 in)</option>
                    <option value="Executive">Executive (7.25 × 10.5 in)</option>
                  </optgroup>
                  <optgroup label="Large Format & Engineering">
                    <option value="A2">A2 (420 × 594 mm)</option>
                    <option value="A1">A1 (594 × 841 mm)</option>
                    <option value="A0">A0 (841 × 1189 mm)</option>
                  </optgroup>
                  <optgroup label="Custom Counter Size">
                    <option value="Custom Size">Custom Size (Specify dimensions)...</option>
                  </optgroup>
                </select>
              </div>

              {/* Custom Dimensions Form when Custom Size selected */}
              {newSizeSelection === 'Custom Size' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">
                      Paper Name (e.g. Photo 4x6, Certificate, ID Card)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Glossy 4x6 Photo"
                      value={customPaperName}
                      onChange={(e) => setCustomPaperName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-normal text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-700 block mb-1">Width</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-normal"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-700 block mb-1">Height</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-normal"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-700 block mb-1">Unit</label>
                      <select
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value as 'mm' | 'inch')}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-normal"
                      >
                        <option value="inch">Inches (in)</option>
                        <option value="mm">Millimeters (mm)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Color Mode & Print Sides */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Color Mode</label>
                  <select
                    value={newColorMode}
                    onChange={(e) => setNewColorMode(e.target.value as PrintColor)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-normal text-slate-900 cursor-pointer"
                  >
                    <option value="BW">Black & White</option>
                    <option value="COLOR">Full Color</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Print Sides</label>
                  <select
                    value={newSides}
                    onChange={(e) => setNewSides(e.target.value as PrintSides)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-normal text-slate-900 cursor-pointer"
                  >
                    <option value="SINGLE">Single Sided</option>
                    <option value="DOUBLE">Double Sided (Duplex)</option>
                  </select>
                </div>
              </div>

              {/* Price per page */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Price Per Page (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    max="500"
                    placeholder="2.00"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-medium text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Acceptable range: ₹0.50 to ₹500.00 per sheet.</p>
              </div>

              {/* Status: Active / Inactive Button Group */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">Rule Status</label>
                <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewIsActive(true)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      newIsActive
                        ? 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${newIsActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span>Active</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewIsActive(false)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      !newIsActive
                        ? 'bg-white text-slate-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${!newIsActive ? 'bg-slate-500' : 'bg-slate-300'}`} />
                    <span>Inactive</span>
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Existing Pricing Rule */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Edit Pricing Rule</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editModalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{editModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditRule} className="space-y-4 text-xs font-normal">
              {/* Paper Size selector */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Paper Size</label>
                <select
                  value={editPaperSize}
                  onChange={(e) => setEditPaperSize(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-normal focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <optgroup label="Standard Office & Documents">
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="A3">A3 (297 × 420 mm)</option>
                    <option value="A5">A5 (148 × 210 mm)</option>
                    <option value="A6">A6 (105 × 148 mm)</option>
                    <option value="Legal">Legal (8.5 × 14 in)</option>
                    <option value="Letter">Letter (8.5 × 11 in)</option>
                    <option value="Executive">Executive (7.25 × 10.5 in)</option>
                  </optgroup>
                  <optgroup label="Large Format & Engineering">
                    <option value="A2">A2 (420 × 594 mm)</option>
                    <option value="A1">A1 (594 × 841 mm)</option>
                    <option value="A0">A0 (841 × 1189 mm)</option>
                  </optgroup>
                  <optgroup label="Custom Counter Size">
                    <option value="Custom Size">Custom Size (Specify dimensions)...</option>
                  </optgroup>
                </select>
              </div>

              {/* Custom Dimensions Form when Custom Size selected */}
              {editPaperSize === 'Custom Size' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">
                      Paper Name (e.g. Photo 4x6, Certificate, ID Card)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Glossy 4x6 Photo"
                      value={editCustomName}
                      onChange={(e) => setEditCustomName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-normal text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-700 block mb-1">Width</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={editCustomWidth}
                        onChange={(e) => setEditCustomWidth(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-normal"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-700 block mb-1">Height</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={editCustomHeight}
                        onChange={(e) => setEditCustomHeight(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-normal"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-700 block mb-1">Unit</label>
                      <select
                        value={editCustomUnit}
                        onChange={(e) => setEditCustomUnit(e.target.value as 'mm' | 'inch')}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-normal"
                      >
                        <option value="inch">Inches (in)</option>
                        <option value="mm">Millimeters (mm)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Color Mode & Print Sides */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Color Mode</label>
                  <select
                    value={editColorMode}
                    onChange={(e) => setEditColorMode(e.target.value as PrintColor)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-normal text-slate-900 cursor-pointer"
                  >
                    <option value="BW">Black & White</option>
                    <option value="COLOR">Full Color</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Print Sides</label>
                  <select
                    value={editSides}
                    onChange={(e) => setEditSides(e.target.value as PrintSides)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-normal text-slate-900 cursor-pointer"
                  >
                    <option value="SINGLE">Single Sided</option>
                    <option value="DOUBLE">Double Sided (Duplex)</option>
                  </select>
                </div>
              </div>

              {/* Price per page */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Price Per Page (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    max="500"
                    placeholder="2.00"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-medium text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Acceptable range: ₹0.50 to ₹500.00 per sheet.</p>
              </div>

              {/* Status: Active / Inactive Button Group */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">Rule Status</label>
                <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditIsActive(true)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      editIsActive
                        ? 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${editIsActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span>Active</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditIsActive(false)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      !editIsActive
                        ? 'bg-white text-slate-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${!editIsActive ? 'bg-slate-500' : 'bg-slate-300'}`} />
                    <span>Inactive</span>
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-semibold text-slate-900">Delete Pricing Rule?</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Future customer orders for this size and color mode will fall back to default A4 or standard scaling rates.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl bg-slate-100 cursor-pointer"
              >
                Keep Rule
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deleteConfirmId)}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-2xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
