-- Migration 007: Printer Hardware Capability Detection & Owner Configuration Management
-- Extends public.printers to store verified hardware capabilities, shop owner overrides, and computed effective capabilities.

ALTER TABLE public.printers
  ADD COLUMN IF NOT EXISTS hardware_capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS effective_capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS config_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_detected_at TIMESTAMPTZ;

-- Fast lookup index for active online printers per shop
CREATE INDEX IF NOT EXISTS idx_printers_shop_status_enabled
  ON public.printers (shop_id, status, is_enabled);

-- GIN index for querying capability-specific printers
CREATE INDEX IF NOT EXISTS idx_printers_effective_capabilities_gin
  ON public.printers USING gin (effective_capabilities);

-- Backfill legacy records to avoid null or empty effective_capabilities
UPDATE public.printers
SET
  hardware_capabilities = jsonb_build_object(
    'basicInfo', jsonb_build_object('name', name, 'displayName', name, 'status', status),
    'color', jsonb_build_object(
      'color', CASE WHEN (capabilities->>'color')::boolean = true THEN 'SUPPORTED' ELSE 'UNSUPPORTED' END,
      'monochrome', 'SUPPORTED',
      'detectionSource', 'LEGACY_MIGRATION'
    ),
    'paperSizes', jsonb_build_array(
      jsonb_build_object('name', 'A4', 'widthMm', 210, 'heightMm', 297, 'status', 'SUPPORTED'),
      jsonb_build_object('name', 'Letter', 'widthMm', 215.9, 'heightMm', 279.4, 'status', 'SUPPORTED')
    ),
    'sides', jsonb_build_object(
      'singleSided', 'SUPPORTED',
      'automaticDuplex', CASE WHEN (capabilities->>'duplex')::boolean = true THEN 'SUPPORTED' ELSE 'UNSUPPORTED' END,
      'manualDuplex', 'UNSUPPORTED',
      'detectionSource', 'LEGACY_MIGRATION'
    ),
    'resolutions', jsonb_build_array(600),
    'copies', jsonb_build_object('maxCopies', 99, 'status', 'SUPPORTED'),
    'detectionSource', 'LEGACY_MIGRATION',
    'lastDetectedAt', timezone('utc'::text, now())
  ),
  owner_configuration = jsonb_build_object(
    'color', jsonb_build_object(
      'enableMonochrome', true,
      'enableColor', COALESCE((capabilities->>'color')::boolean, false),
      'defaultMode', 'BW'
    ),
    'paperSizes', jsonb_build_object('A4', true, 'Letter', true),
    'sides', jsonb_build_object(
      'enableSingleSided', true,
      'enableAutomaticDuplex', COALESCE((capabilities->>'duplex')::boolean, true),
      'enableManualDuplex', false,
      'defaultSides', 'SINGLE'
    ),
    'dpi', jsonb_build_object('defaultDpi', 600, 'allowedDpis', jsonb_build_array(600)),
    'copies', jsonb_build_object('defaultCopies', 1, 'maxCopiesPerJob', 50),
    'orientation', jsonb_build_object('defaultOrientation', 'PORTRAIT'),
    'version', 1,
    'updatedAt', timezone('utc'::text, now())
  ),
  effective_capabilities = jsonb_build_object(
    'color', jsonb_build_object(
      'supportsColor', COALESCE((capabilities->>'color')::boolean, false),
      'supportsMonochrome', true,
      'defaultMode', 'BW'
    ),
    'paperSizes', jsonb_build_array(
      jsonb_build_object('name', 'A4', 'widthMm', 210, 'heightMm', 297),
      jsonb_build_object('name', 'Letter', 'widthMm', 215.9, 'heightMm', 279.4)
    ),
    'sides', jsonb_build_object(
      'supportsSingle', true,
      'supportsDuplex', COALESCE((capabilities->>'duplex')::boolean, true),
      'supportsManualDuplex', false,
      'defaultSides', 'SINGLE'
    ),
    'maxCopies', 50,
    'allowedDpis', jsonb_build_array(600),
    'defaultDpi', 600
  ),
  last_detected_at = timezone('utc'::text, now())
WHERE effective_capabilities = '{}'::jsonb OR effective_capabilities IS NULL;
