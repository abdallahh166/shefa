-- Realtime waiting room queue + lab mappings

CREATE TABLE IF NOT EXISTS public.appointment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  check_in_at timestamptz NOT NULL DEFAULT now(),
  position integer NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_service', 'done', 'no_show')),
  called_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can manage appointment queue" ON public.appointment_queue;
CREATE POLICY "Tenant users can manage appointment queue"
ON public.appointment_queue
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_appointment_queue_tenant_status
ON public.appointment_queue (tenant_id, status, check_in_at);

CREATE TABLE IF NOT EXISTS public.lab_test_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  external_test_code text NOT NULL,
  internal_test_id uuid NULL,
  unit text NULL,
  reference_range text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_test_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can manage lab test mappings" ON public.lab_test_mappings;
CREATE POLICY "Tenant users can manage lab test mappings"
ON public.lab_test_mappings
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_test_mappings_tenant_external
ON public.lab_test_mappings (tenant_id, external_test_code);
