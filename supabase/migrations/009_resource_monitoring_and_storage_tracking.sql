-- PrintFlow Migration 009: Agent Resource Monitoring & Subscription Storage Tracking
-- Implements tables for desktop print agent resource metrics, system alerts, health state, and shop cloud storage quotas.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Agent Resource Snapshots Table (Stores periodic 15s-60s metric snapshots)
CREATE TABLE IF NOT EXISTS public.agent_resource_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  system_cpu_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  agent_cpu_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_ram_bytes BIGINT NOT NULL DEFAULT 0,
  available_ram_bytes BIGINT NOT NULL DEFAULT 0,
  agent_ram_bytes BIGINT NOT NULL DEFAULT 0,
  total_disk_bytes BIGINT NOT NULL DEFAULT 0,
  free_disk_bytes BIGINT NOT NULL DEFAULT 0,
  agent_storage_bytes BIGINT NOT NULL DEFAULT 0,
  temp_storage_bytes BIGINT NOT NULL DEFAULT 0,
  cache_storage_bytes BIGINT NOT NULL DEFAULT 0,
  local_database_bytes BIGINT NOT NULL DEFAULT 0,
  logs_storage_bytes BIGINT NOT NULL DEFAULT 0,
  spool_storage_bytes BIGINT NOT NULL DEFAULT 0,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_agent_snapshots_shop_collected ON public.agent_resource_snapshots(shop_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_snapshots_agent_collected ON public.agent_resource_snapshots(agent_id, collected_at DESC);

-- 2. Agent Health Table (Stores latest authoritative status per agent)
CREATE TABLE IF NOT EXISTS public.agent_health (
  agent_id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ONLINE',
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  agent_version TEXT,
  os_version TEXT,
  cpu_model TEXT,
  cpu_cores INT DEFAULT 1,
  system_cpu_percent NUMERIC(5,2) DEFAULT 0,
  agent_cpu_percent NUMERIC(5,2) DEFAULT 0,
  total_ram_bytes BIGINT DEFAULT 0,
  available_ram_bytes BIGINT DEFAULT 0,
  agent_ram_bytes BIGINT DEFAULT 0,
  total_disk_bytes BIGINT DEFAULT 0,
  free_disk_bytes BIGINT DEFAULT 0,
  agent_storage_bytes BIGINT DEFAULT 0,
  spooler_status TEXT NOT NULL DEFAULT 'RUNNING',
  pending_jobs INT DEFAULT 0,
  active_jobs INT DEFAULT 0,
  failed_jobs INT DEFAULT 0,
  stuck_jobs INT DEFAULT 0,
  online_printers INT DEFAULT 0,
  offline_printers INT DEFAULT 0,
  network_latency_ms INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_agent_health_shop ON public.agent_health(shop_id);
CREATE INDEX IF NOT EXISTS idx_agent_health_heartbeat ON public.agent_health(last_heartbeat_at DESC);

-- 3. Shop Storage Usage Table (Stores cloud document storage quotas and usage)
CREATE TABLE IF NOT EXISTS public.shop_storage_usage (
  shop_id TEXT PRIMARY KEY,
  quota_bytes BIGINT NOT NULL DEFAULT 1048576000, -- 1GB default (1000 MB)
  used_bytes BIGINT NOT NULL DEFAULT 0,
  reserved_bytes BIGINT NOT NULL DEFAULT 0,
  available_bytes BIGINT NOT NULL DEFAULT 1048576000,
  active_document_count INT NOT NULL DEFAULT 0,
  pending_deletion_count INT NOT NULL DEFAULT 0,
  last_reconciled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Agent Alerts Table (Stores threshold violation alerts)
CREATE TABLE IF NOT EXISTS public.agent_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'WARNING',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_alerts_shop_status ON public.agent_alerts(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_agent_status ON public.agent_alerts(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_created ON public.agent_alerts(created_at DESC);
