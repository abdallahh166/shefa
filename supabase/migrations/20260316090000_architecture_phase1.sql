-- Phase 1 architecture hardening: domain events, jobs, system logs, and RLS coverage

-- ------------------------------------------------------------
-- Domain events (persisted with versioning)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);

ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can insert domain events" ON public.domain_events;
CREATE POLICY "Tenant users can insert domain events"
ON public.domain_events
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Clinic admins can view domain events" ON public.domain_events;
CREATE POLICY "Clinic admins can view domain events"
ON public.domain_events
FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE INDEX IF NOT EXISTS idx_domain_events_tenant_created_at
ON public.domain_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_domain_events_type_created_at
ON public.domain_events (event_type, created_at DESC);

-- ------------------------------------------------------------
-- Jobs queue (DB-backed with locking)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text NULL,
  locked_at timestamptz NULL,
  locked_by text NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can enqueue jobs" ON public.jobs;
CREATE POLICY "Tenant users can enqueue jobs"
ON public.jobs
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "No direct access to jobs" ON public.jobs;
CREATE POLICY "No direct access to jobs"
ON public.jobs
FOR ALL TO authenticated
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status
ON public.jobs (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_jobs_run_at
ON public.jobs (run_at);

CREATE INDEX IF NOT EXISTS idx_jobs_locked_at
ON public.jobs (locked_at);

DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- System logs (centralized operational visibility)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  service text NOT NULL,
  message text NOT NULL,
  tenant_id uuid NULL,
  user_id uuid NULL,
  request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view system logs" ON public.system_logs;
CREATE POLICY "Super admins can view system logs"
ON public.system_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "No direct access to system logs" ON public.system_logs;
CREATE POLICY "No direct access to system logs"
ON public.system_logs
FOR ALL TO authenticated
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at
ON public.system_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_tenant_created_at
ON public.system_logs (tenant_id, created_at DESC);

-- ------------------------------------------------------------
-- Ensure policy coverage for rate limits (no direct access)
-- ------------------------------------------------------------
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to rate_limits" ON public.rate_limits;
CREATE POLICY "No direct access to rate_limits"
ON public.rate_limits
FOR ALL TO authenticated
USING (false)
WITH CHECK (false);
