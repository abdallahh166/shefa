-- Telemedicine video sessions
CREATE TABLE IF NOT EXISTS public.video_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel_name text NOT NULL,
  started_at timestamptz NULL,
  ended_at timestamptz NULL,
  recording_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can manage video sessions" ON public.video_sessions;
CREATE POLICY "Tenant users can manage video sessions"
ON public.video_sessions
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_video_sessions_tenant_appt
ON public.video_sessions (tenant_id, appointment_id);
