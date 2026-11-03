-- Migration 008: Expand print job states for Spooler submission and manual reconciliation

DO $$
BEGIN
  -- 1. Expand CHECK constraint on public.print_jobs
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'print_jobs'
  ) THEN
    ALTER TABLE public.print_jobs DROP CONSTRAINT IF EXISTS print_jobs_print_status_check;
    ALTER TABLE public.print_jobs ADD CONSTRAINT print_jobs_print_status_check CHECK (print_status IN (
      'CREATED', 'RECEIVED', 'VALIDATING', 'DOWNLOADING', 'READY', 'QUEUED', 'ASSIGNED', 'PRINTING',
      'SUBMITTED_TO_SPOOLER', 'COMPLETED', 'FAILED', 'PAUSED', 'PRINT_INTERRUPTED', 'REQUIRES_ATTENTION',
      'CANCELLED', 'AWAITING_RECONCILIATION'
    ));

    ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS spooler_job_id INT;
    ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS spool_submitted_at TIMESTAMPTZ;
    ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
    ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS reconciliation_action VARCHAR(32);
    ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;
  END IF;

  -- 2. Expand print_agent_jobs column size to safely support all new states
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'print_agent_jobs'
  ) THEN
    ALTER TABLE public.print_agent_jobs ALTER COLUMN print_status TYPE VARCHAR(40);
  END IF;
END $$;
