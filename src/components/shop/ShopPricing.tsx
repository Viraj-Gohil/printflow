import React, { useState, useMemo, useEffect } from 'react';
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
  ExternalLink,
  X,
  RefreshCw,
  Calculator,
  Pencil,
  Power
} from 'lucide-react';
import { PrintColor, PrintSides, PricingRule } from '../../types';
import {
  STANDARD_PAPER_SIZES,
  resolveUnitPrice
} from '../../lib/utils/pricing';
import { validatePositivePrice } from '../../lib/validation';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';

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
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync draft whenever shopRules change externally if not dirty
  useEffect(() => {
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

  // UI Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSimulatorDrawer, setShowSimulatorDrawer] = useState(false);
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

  // Customer Price Simulation Sandbox (Live preview in Drawer)
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
        }. Publish changes to apply.`,
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
    showToast('Rule Updated', `Updated ${finalPaperSize} rule in draft. Click Publish to apply.`, 'success');
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

    setIsLoading(true);
    // Merge updated rules for this shop back into global state
    const otherShopRules = pricingRules.filter((r) => r.shopId !== activeShop.id);
    const updatedShopRules = draftRules.map((r) => ({
      ...r,
      updatedAt: new Date().toISOString()
    }));
    const finalAllRules = [...otherShopRules, ...updatedShopRules];

    savePricingRules(finalAllRules);
    setHasUnsavedChanges(false);
    setIsLoading(false);
    setSuccessBanner('Pricing rules published. Mobile checkout is now using these updated rates.');
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
    showToast('Rule Added', `Created ${finalPaperSize} rule at ₹${parseFloat(newPrice).toFixed(2)}/page. Remember to publish changes.`, 'success');
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
    <div className="space-y-4 max-w-7xl mx-auto pb-10 text-slate-800">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Pricing Rules
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            Manage per-page rates for paper sizes, color modes, and duplex printing.
          </p>
        </div>

        {/* Primary and Secondary Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {hasUnsavedChanges && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscardChanges}
                disabled={isLoading}
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Discard</span>
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={handleSaveAll}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Publish Rates ({draftRules.length})</span>
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSimulatorDrawer(true)}
            title="Open customer order pricing preview"
          >
            <Calculator className="w-3.5 h-3.5 text-blue-600" />
            <span>Preview Customer Pricing</span>
          </Button>

          <Button
            variant="solid"
            size="sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Pricing Rule</span>
          </Button>
        </div>
      </div>

      {/* 2. ALERTS / FEEDBACK BANNERS */}
      {validationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{validationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-red-400 hover:text-red-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-400 hover:text-emerald-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. TOOLBAR: SEARCH & FILTERS */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search paper size or price (e.g. A4, 2.50)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                aria-label="Clear search query"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Status Segmented Control */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs shrink-0">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filterStatus === st
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Rules' : st === 'ACTIVE' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] font-mono">
            Filter:
          </span>

          {/* Paper Size filter */}
          <select
            value={filterPaperSize}
            onChange={(e) => setFilterPaperSize(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-normal cursor-pointer focus:bg-white focus:outline-none"
          >
            <option value="ALL">All Paper Sizes ({distinctShopSizes.length})</option>
            {distinctShopSizes.map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>

          {/* Color filter */}
          <select
            value={filterColor}
            onChange={(e) => setFilterColor(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-normal cursor-pointer focus:bg-white focus:outline-none"
          >
            <option value="ALL">All Color Modes</option>
            <option value="BW">Black & White</option>
            <option value="COLOR">Color</option>
          </select>

          {/* Sides filter */}
          <select
            value={filterSides}
            onChange={(e) => setFilterSides(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-normal cursor-pointer focus:bg-white focus:outline-none"
          >
            <option value="ALL">All Sides</option>
            <option value="SINGLE">Single Sided</option>
            <option value="DOUBLE">Duplex (Double Sided)</option>
          </select>

          {/* Reset Filters */}
          {(filterPaperSize !== 'ALL' || filterColor !== 'ALL' || filterSides !== 'ALL' || searchQuery || filterStatus !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setFilterPaperSize('ALL');
                setFilterColor('ALL');
                setFilterSides('ALL');
                setFilterStatus('ALL');
                setSearchQuery('');
              }}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-800 ml-auto cursor-pointer"
            >
              Reset Filters
            </button>
          )}

          <div className="ml-auto hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleApplyDefaults}
              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
              title="Reset rates to standard Xerox market defaults"
            >
              <RefreshCw className="w-3 h-3 text-slate-400" />
              <span>Load Market Rates</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. PRICING RULES TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paper Size</TableHead>
              <TableHead>Color Mode</TableHead>
              <TableHead>Print Sides</TableHead>
              <TableHead className="text-right">Price / Page</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-700 text-sm">No pricing rules found</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchQuery || filterPaperSize !== 'ALL' || filterColor !== 'ALL' || filterSides !== 'ALL' || filterStatus !== 'ALL'
                      ? 'No rules match your active filters. Try clearing your search parameters.'
                      : 'Configure your first per-page rate to start accepting customer print jobs.'}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {(searchQuery || filterPaperSize !== 'ALL' || filterColor !== 'ALL' || filterSides !== 'ALL' || filterStatus !== 'ALL') ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFilterPaperSize('ALL');
                          setFilterColor('ALL');
                          setFilterSides('ALL');
                          setFilterStatus('ALL');
                          setSearchQuery('');
                        }}
                      >
                        Clear Filters
                      </Button>
                    ) : (
                      <Button
                        variant="solid"
                        size="sm"
                        onClick={() => setShowAddModal(true)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Pricing Rule</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRules.map((rule) => {
                const isActive = rule.isActive ?? true;
                const check = validatePositivePrice(rule.pricePerPage, 0.5, 500);
                const isInvalid = !check.isValid;

                return (
                  <TableRow
                    key={rule.id}
                    className={!isActive ? 'opacity-65 bg-slate-50/40' : undefined}
                  >
                    {/* Paper Size */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                          {rule.paperSize}
                          {rule.customWidth && rule.customHeight && (
                            <Chip variant="special" size="sm">
                              {rule.customWidth}×{rule.customHeight} {rule.unit || 'in'}
                            </Chip>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {STANDARD_PAPER_SIZES.find((s) => s.id === rule.paperSize)?.dimensions ||
                            (rule.customWidth ? `${rule.customWidth} × ${rule.customHeight} ${rule.unit || 'in'}` : 'Custom Dimensions')}
                        </span>
                      </div>
                    </TableCell>

                    {/* Color Mode */}
                    <TableCell>
                      <Chip
                        variant={rule.color === 'COLOR' ? 'warning' : 'default'}
                        size="sm"
                      >
                        {rule.color === 'COLOR' ? 'Color' : 'Black & White'}
                      </Chip>
                    </TableCell>

                    {/* Print Sides */}
                    <TableCell>
                      <Chip
                        variant={rule.sides === 'DOUBLE' ? 'special' : 'default'}
                        size="sm"
                      >
                        {rule.sides === 'DOUBLE' ? 'Duplex (2-Sided)' : 'Single Sided'}
                      </Chip>
                    </TableCell>

                    {/* Price / Page */}
                    <TableCell className="text-right">
                      <div className="inline-flex flex-col items-end gap-0.5">
                        <div className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                          <span className="text-slate-400 text-xs font-mono">₹</span>
                          <input
                            type="number"
                            step="0.25"
                            min="0.5"
                            max="500"
                            value={rule.pricePerPage}
                            onChange={(e) => handlePriceChange(rule.id, e.target.value)}
                            className="w-16 text-right font-mono font-semibold text-slate-900 bg-transparent focus:outline-none text-xs tabular-nums"
                            aria-label={`Price per page for ${rule.paperSize}`}
                          />
                        </div>
                        {isInvalid && (
                          <span className="text-[9px] text-red-600 font-normal">{check.error}</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Status Toggle */}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(rule.id)}
                        className="cursor-pointer transition-transform active:scale-95 inline-flex"
                        title={isActive ? 'Click to deactivate rule' : 'Click to activate rule'}
                        aria-label={`Toggle active status for ${rule.paperSize}`}
                      >
                        <Chip
                          variant={isActive ? 'success' : 'muted'}
                          size="sm"
                          dot
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </Chip>
                      </button>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(rule)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Rule Parameters"
                          aria-label={`Edit ${rule.paperSize} rule`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateRule(rule)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Duplicate Rule"
                          aria-label={`Duplicate ${rule.paperSize} rule`}
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
                          title={isActive ? 'Deactivate rule' : 'Activate rule'}
                          aria-label={`Power toggle for ${rule.paperSize}`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Rule"
                          aria-label={`Delete ${rule.paperSize} rule`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Table Footer */}
        <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 font-mono">
          <span>
            Showing <strong className="text-slate-700 font-semibold">{filteredRules.length}</strong> of{' '}
            <strong className="text-slate-700 font-semibold">{draftRules.length}</strong> configured rules
          </span>
          <div className="flex items-center gap-3">
            <span>
              Minimum Order:{' '}
              <strong className="text-slate-700 font-semibold">₹{activeShop.minimumOrder || 5}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>All amounts in INR (₹)</span>
          </div>
        </div>
      </div>

      {/* 5. CUSTOMER PRICING SIMULATOR DRAWER */}
      <Drawer
        isOpen={showSimulatorDrawer}
        onClose={() => setShowSimulatorDrawer(false)}
        title="Customer Pricing Simulator"
        description="Simulate how your active pricing rules calculate the order total for customers."
        width="max-w-md"
      >
        <div className="space-y-4 text-xs">
          {/* Controls */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            {/* Paper Size */}
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1 font-mono uppercase tracking-[0.06em]">
                Paper Size
              </label>
              <select
                value={simPaperSize}
                onChange={(e) => setSimPaperSize(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {distinctShopSizes.map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>

            {/* Color & Sides */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1 font-mono uppercase tracking-[0.06em]">
                  Color Mode
                </label>
                <select
                  value={simColor}
                  onChange={(e) => setSimColor(e.target.value as PrintColor)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
                >
                  <option value="BW">Black & White</option>
                  <option value="COLOR">Color</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1 font-mono uppercase tracking-[0.06em]">
                  Print Sides
                </label>
                <select
                  value={simSides}
                  onChange={(e) => setSimSides(e.target.value as PrintSides)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium cursor-pointer"
                >
                  <option value="SINGLE">Single Sided</option>
                  <option value="DOUBLE">Duplex (2-Sided)</option>
                </select>
              </div>
            </div>

            {/* Pages & Copies */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1 font-mono uppercase tracking-[0.06em]">
                  Document Pages
                </label>
                <input
                  type="number"
                  min="1"
                  value={simPages}
                  onChange={(e) => setSimPages(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-semibold text-slate-800 tabular-nums"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1 font-mono uppercase tracking-[0.06em]">
                  Copies
                </label>
                <input
                  type="number"
                  min="1"
                  value={simCopies}
                  onChange={(e) => setSimCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-semibold text-slate-800 tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Breakdown Card */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
            <h4 className="text-xs font-semibold text-slate-900 font-mono uppercase tracking-[0.08em]">
              Checkout Breakdown
            </h4>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600">Resolved Unit Rate:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  ₹{simUnitPrice.toFixed(2)} / page
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-600">Total Billable Sheets:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {simPages * simCopies} pages
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  ₹{simDocumentTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-600">Platform Convenience Fee:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  ₹2.00
                </span>
              </div>
              <div className="pt-3 border-t-2 border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">Customer Checkout Total:</span>
                <span className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
                  ₹{(simDocumentTotal + 2).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick link to test in customer view */}
          <Button
            variant="soft"
            size="md"
            onClick={() => {
              setShowSimulatorDrawer(false);
              navigate(`/s/${activeShop.slug}`);
            }}
            className="w-full"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Customer Upload Page</span>
          </Button>
        </div>
      </Drawer>

      {/* 6. ADD PRICING RULE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Add Pricing Rule</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Close add rule modal"
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

            <form onSubmit={handleAddNewRule} className="space-y-4 text-xs">
              {/* Paper Size selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Paper Size</label>
                <select
                  value={newSizeSelection}
                  onChange={(e) => setNewSizeSelection(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
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
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Paper Name (e.g. Photo 4x6, Certificate, ID Card)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Glossy 4x6 Photo"
                      value={customPaperName}
                      onChange={(e) => setCustomPaperName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Width</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Height</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Unit</label>
                      <select
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value as 'mm' | 'inch')}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono cursor-pointer"
                      >
                        <option value="inch">Inches (in)</option>
                        <option value="mm">Millimeters (mm)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Color Mode & Sides */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Color Mode</label>
                  <select
                    value={newColorMode}
                    onChange={(e) => setNewColorMode(e.target.value as PrintColor)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 cursor-pointer"
                  >
                    <option value="BW">Black & White</option>
                    <option value="COLOR">Full Color</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Print Sides</label>
                  <select
                    value={newSides}
                    onChange={(e) => setNewSides(e.target.value as PrintSides)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 cursor-pointer"
                  >
                    <option value="SINGLE">Single Sided</option>
                    <option value="DOUBLE">Double Sided (Duplex)</option>
                  </select>
                </div>
              </div>

              {/* Price Per Page */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Price Per Page (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₹</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    max="500"
                    placeholder="2.50"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-semibold text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Acceptable range: ₹0.50 to ₹500.00 per page.</p>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="solid"
                  size="sm"
                >
                  Add Rule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. EDIT PRICING RULE MODAL */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Edit Pricing Rule</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Close edit modal"
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

            <form onSubmit={handleSaveEditRule} className="space-y-4 text-xs">
              {/* Paper Size selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Paper Size</label>
                <select
                  value={editPaperSize}
                  onChange={(e) => setEditPaperSize(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
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

              {/* Custom Dimensions Form */}
              {editPaperSize === 'Custom Size' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Paper Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Glossy 4x6 Photo"
                      value={editCustomName}
                      onChange={(e) => setEditCustomName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Width</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={editCustomWidth}
                        onChange={(e) => setEditCustomWidth(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Height</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={editCustomHeight}
                        onChange={(e) => setEditCustomHeight(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Unit</label>
                      <select
                        value={editCustomUnit}
                        onChange={(e) => setEditCustomUnit(e.target.value as 'mm' | 'inch')}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono cursor-pointer"
                      >
                        <option value="inch">Inches (in)</option>
                        <option value="mm">Millimeters (mm)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Color Mode & Sides */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Color Mode</label>
                  <select
                    value={editColorMode}
                    onChange={(e) => setEditColorMode(e.target.value as PrintColor)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 cursor-pointer"
                  >
                    <option value="BW">Black & White</option>
                    <option value="COLOR">Full Color</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Print Sides</label>
                  <select
                    value={editSides}
                    onChange={(e) => setEditSides(e.target.value as PrintSides)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 cursor-pointer"
                  >
                    <option value="SINGLE">Single Sided</option>
                    <option value="DOUBLE">Double Sided (Duplex)</option>
                  </select>
                </div>
              </div>

              {/* Price per page */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Price Per Page (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">₹</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    max="500"
                    placeholder="2.00"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-semibold text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Acceptable range: ₹0.50 to ₹500.00 per sheet.</p>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Rule Status</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditIsActive(true)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      editIsActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${editIsActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span>Active</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditIsActive(false)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      !editIsActive
                        ? 'bg-slate-200 text-slate-800 border border-slate-300 font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${!editIsActive ? 'bg-slate-500' : 'bg-slate-300'}`} />
                    <span>Inactive</span>
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingRule(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="solid"
                  size="sm"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-slate-900">Delete Pricing Rule?</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Future customer orders for this size and color mode will fall back to default A4 or standard scaling rates.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmId(null)}
              >
                Keep Rule
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => confirmDelete(deleteConfirmId)}
              >
                Delete Rule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
