export type CapabilityStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';

export interface HardwarePaperSize {
  name: string;
  widthMm?: number;
  heightMm?: number;
  status: CapabilityStatus;
}

export interface HardwareCapabilities {
  basicInfo: {
    name: string;
    displayName: string;
    driverName: string;
    driverVersion?: string;
    portName: string;
    connectionType: 'USB' | 'WIFI' | 'LAN' | 'BLUETOOTH' | 'NETWORK_SHARE' | 'UNKNOWN';
    isDefault: boolean;
    status: 'READY' | 'PRINTING' | 'OFFLINE' | 'BUSY' | 'ERROR';
    manufacturer?: string;
    model?: string;
  };
  color: {
    monochrome: CapabilityStatus;
    color: CapabilityStatus;
    detectionSource: string;
    lastDetectedAt: string;
  };
  paperSizes: HardwarePaperSize[];
  sides: {
    singleSided: CapabilityStatus;
    automaticDuplex: CapabilityStatus;
    manualDuplex: CapabilityStatus;
    detectionSource: string;
    lastDetectedAt: string;
  };
  resolutions: number[];
  copies: {
    maxCopies: number;
    status: CapabilityStatus;
  };
  orientations: ('PORTRAIT' | 'LANDSCAPE')[];
  mediaTypes?: string[];
  detectionSource: string;
  lastDetectedAt: string;
}

export interface OwnerPrinterConfiguration {
  color: {
    enableMonochrome: boolean;
    enableColor: boolean;
    defaultMode: 'BW' | 'COLOR';
  };
  paperSizes: Record<string, boolean>;
  sides: {
    enableSingleSided: boolean;
    enableAutomaticDuplex: boolean;
    enableManualDuplex: boolean;
    defaultSides: 'SINGLE' | 'DOUBLE';
  };
  dpi: {
    defaultDpi: number;
    allowedDpis: number[];
  };
  copies: {
    defaultCopies: number;
    maxCopiesPerJob: number;
  };
  orientation: {
    defaultOrientation: 'PORTRAIT' | 'LANDSCAPE' | 'AUTO';
  };
  version: number;
  updatedAt: string;
}

export interface EffectivePrinterCapabilities {
  supportsColor: boolean;
  supportsMonochrome: boolean;
  paperSizes: any[];
  paperSizesList?: string[];
  paperSizeDetails: Record<string, { widthMm?: number; heightMm?: number }>;
  supportsAutomaticDuplex: boolean;
  supportsManualDuplex: boolean;
  supportsSingleSided: boolean;
  allowedResolutions: number[];
  defaultDpi: number;
  defaultColor: 'BW' | 'COLOR';
  defaultSides: 'SINGLE' | 'DOUBLE';
  defaultOrientation: 'PORTRAIT' | 'LANDSCAPE' | 'AUTO';
  maxCopies: number;
  calculatedAt: string;
  color: {
    supportsColor: boolean;
    supportsMonochrome: boolean;
    defaultMode: 'BW' | 'COLOR';
  };
  sides: {
    supportsSingle: boolean;
    supportsDuplex: boolean;
    supportsManualDuplex: boolean;
    defaultSides: 'SINGLE' | 'DOUBLE';
  };
}

export interface StoredPrinterConfig {
  printerName: string;
  hardware: HardwareCapabilities;
  owner: OwnerPrinterConfiguration;
  effective: EffectivePrinterCapabilities;
  status: 'READY' | 'PRINTING' | 'OFFLINE' | 'BUSY' | 'ERROR';
  version: number;
  lastSyncedAt?: string;
  invalidOwnerSettings?: string[];
}

export function computeEffectiveCapabilities(
  hardware: HardwareCapabilities,
  owner?: Partial<OwnerPrinterConfiguration>
): EffectivePrinterCapabilities {
  const calculatedAt = new Date().toISOString();

  const hwSupportsColor = hardware.color?.color === 'SUPPORTED';
  const hwSupportsMono = hardware.color?.monochrome === 'SUPPORTED' || hardware.color?.monochrome !== 'UNSUPPORTED';

  const ownerEnableColor = owner?.color?.enableColor ?? hwSupportsColor;
  const ownerEnableMono = owner?.color?.enableMonochrome ?? true;

  const supportsColor = hwSupportsColor && Boolean(ownerEnableColor);
  const supportsMonochrome = hwSupportsMono && Boolean(ownerEnableMono);

  let defaultColor: 'BW' | 'COLOR' = 'BW';
  if (owner?.color?.defaultMode === 'COLOR' && supportsColor) {
    defaultColor = 'COLOR';
  } else if (!supportsMonochrome && supportsColor) {
    defaultColor = 'COLOR';
  } else {
    defaultColor = 'BW';
  }

  const hwPaperSizes = Array.isArray(hardware.paperSizes) ? hardware.paperSizes : [];
  const supportedHwSizes = hwPaperSizes.filter((p) => p.status === 'SUPPORTED');
  
  const paperSizeDetails: Record<string, { widthMm?: number; heightMm?: number }> = {};
  for (const s of supportedHwSizes) {
    paperSizeDetails[s.name] = { widthMm: s.widthMm, heightMm: s.heightMm };
  }

  const effectivePaperSizes: string[] = [];
  for (const s of supportedHwSizes) {
    const isOwnerEnabled = owner?.paperSizes ? owner.paperSizes[s.name] !== false : true;
    if (isOwnerEnabled) {
      effectivePaperSizes.push(s.name);
    }
  }

  if (effectivePaperSizes.length === 0 && supportedHwSizes.length > 0) {
    const fallback = supportedHwSizes.find((s) => s.name.toUpperCase() === 'A4') || supportedHwSizes[0];
    effectivePaperSizes.push(fallback.name);
  }

  const hwSupportsAutoDuplex = hardware.sides?.automaticDuplex === 'SUPPORTED';
  const hwSupportsManualDuplex = hardware.sides?.manualDuplex === 'SUPPORTED';
  const hwSupportsSingle = hardware.sides?.singleSided !== 'UNSUPPORTED';

  const supportsSingleSided = hwSupportsSingle && (owner?.sides ? owner.sides.enableSingleSided !== false : true);
  const supportsAutomaticDuplex = hwSupportsAutoDuplex && Boolean(owner?.sides?.enableAutomaticDuplex);
  const supportsManualDuplex = hwSupportsManualDuplex && Boolean(owner?.sides?.enableManualDuplex);

  const defaultSides: 'SINGLE' | 'DOUBLE' =
    owner?.sides?.defaultSides === 'DOUBLE' && supportsAutomaticDuplex ? 'DOUBLE' : 'SINGLE';

  const hwResolutions = Array.isArray(hardware.resolutions) && hardware.resolutions.length > 0
    ? hardware.resolutions
    : [600];

  const allowedResolutions = owner?.dpi?.allowedDpis && owner.dpi.allowedDpis.length > 0
    ? owner.dpi.allowedDpis.filter((d) => hwResolutions.includes(d))
    : hwResolutions;

  const finalResolutions = allowedResolutions.length > 0 ? allowedResolutions : hwResolutions;
  const defaultDpi = owner?.dpi?.defaultDpi && finalResolutions.includes(owner.dpi.defaultDpi)
    ? owner.dpi.defaultDpi
    : finalResolutions[0];

  const hwMaxCopies = hardware.copies?.maxCopies || 999;
  const ownerMax = owner?.copies?.maxCopiesPerJob || 50;
  const maxCopies = Math.max(1, Math.min(hwMaxCopies, ownerMax));

  const defaultOrientation = owner?.orientation?.defaultOrientation || 'PORTRAIT';

  return {
    supportsColor,
    supportsMonochrome,
    paperSizes: effectivePaperSizes,
    paperSizesList: effectivePaperSizes,
    paperSizeDetails,
    supportsAutomaticDuplex,
    supportsManualDuplex,
    supportsSingleSided,
    allowedResolutions: finalResolutions,
    defaultDpi,
    defaultColor,
    defaultSides,
    defaultOrientation,
    maxCopies,
    calculatedAt,
    color: {
      supportsColor,
      supportsMonochrome,
      defaultMode: defaultColor
    },
    sides: {
      supportsSingle: supportsSingleSided,
      supportsDuplex: supportsAutomaticDuplex,
      supportsManualDuplex,
      defaultSides
    }
  };
}

export function createDefaultOwnerConfig(hardware: HardwareCapabilities): OwnerPrinterConfiguration {
  const paperSizes: Record<string, boolean> = {};
  if (Array.isArray(hardware.paperSizes)) {
    for (const p of hardware.paperSizes) {
      if (p.status === 'SUPPORTED') {
        paperSizes[p.name] = true;
      }
    }
  }

  const hwSupportsColor = hardware.color?.color === 'SUPPORTED';
  const hwSupportsAutoDuplex = hardware.sides?.automaticDuplex === 'SUPPORTED';

  const hwDpis = Array.isArray(hardware.resolutions) && hardware.resolutions.length > 0
    ? hardware.resolutions
    : [600];

  return {
    color: {
      enableMonochrome: true,
      enableColor: hwSupportsColor,
      defaultMode: 'BW'
    },
    paperSizes,
    sides: {
      enableSingleSided: true,
      enableAutomaticDuplex: hwSupportsAutoDuplex,
      enableManualDuplex: false,
      defaultSides: 'SINGLE'
    },
    dpi: {
      defaultDpi: hwDpis[0] || 600,
      allowedDpis: [...hwDpis]
    },
    copies: {
      defaultCopies: 1,
      maxCopiesPerJob: 50
    },
    orientation: {
      defaultOrientation: 'PORTRAIT'
    },
    version: 1,
    updatedAt: new Date().toISOString()
  };
}

export function validateOwnerConfigAgainstHardware(
  hardware: HardwareCapabilities,
  owner: OwnerPrinterConfiguration
): { valid: boolean; warnings: string[]; sanitizedConfig: OwnerPrinterConfiguration } {
  const warnings: string[] = [];
  const sanitized: OwnerPrinterConfiguration = {
    ...owner,
    color: { ...owner.color },
    paperSizes: { ...owner.paperSizes },
    sides: { ...owner.sides },
    dpi: { ...owner.dpi },
    copies: { ...owner.copies },
    orientation: { ...owner.orientation }
  };

  if (owner.color.enableColor && hardware.color?.color !== 'SUPPORTED') {
    warnings.push('Color printing was enabled, but physical printer driver reports Color is unsupported.');
    sanitized.color.enableColor = false;
    sanitized.color.defaultMode = 'BW';
  }

  const supportedSizeNames = (hardware.paperSizes || [])
    .filter((p) => p.status === 'SUPPORTED')
    .map((p) => p.name.toUpperCase());

  for (const [sizeName, enabled] of Object.entries(owner.paperSizes)) {
    if (enabled && !supportedSizeNames.includes(sizeName.toUpperCase())) {
      warnings.push(`Paper size "${sizeName}" was enabled, but is not supported by printer driver.`);
      sanitized.paperSizes[sizeName] = false;
    }
  }

  if (owner.sides.enableAutomaticDuplex && hardware.sides?.automaticDuplex !== 'SUPPORTED') {
    warnings.push('Automatic duplex was enabled, but printer has no hardware automatic duplex unit.');
    sanitized.sides.enableAutomaticDuplex = false;
    sanitized.sides.defaultSides = 'SINGLE';
  }

  if (owner.sides.enableManualDuplex && hardware.sides?.manualDuplex === 'UNSUPPORTED') {
    warnings.push('Manual duplex is unsupported by printer driver.');
    sanitized.sides.enableManualDuplex = false;
  }

  return {
    valid: warnings.length === 0,
    warnings,
    sanitizedConfig: sanitized
  };
}
