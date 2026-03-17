-- External lab integrations

CREATE TABLE IF NOT EXISTS public.external_lab_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  method text NOT NULL CHECK (method IN ('webhook', 'sftp')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.external_lab_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.external_lab_connections(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  error_message text NULL
);

ALTER TABLE public.external_lab_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_lab_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can manage external lab connections" ON public.external_lab_connections;
CREATE POLICY "Tenant users can manage external lab connections"
ON public.external_lab_connections
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant users can manage external lab events" ON public.external_lab_events;
CREATE POLICY "Tenant users can manage external lab events"
ON public.external_lab_events
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_external_lab_connections_tenant
ON public.external_lab_connections (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_external_lab_events_tenant
ON public.external_lab_events (tenant_id, status, received_at DESC);

DROP TRIGGER IF EXISTS update_external_lab_connections_updated_at ON public.external_lab_connections;
CREATE TRIGGER update_external_lab_connections_updated_at
BEFORE UPDATE ON public.external_lab_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
