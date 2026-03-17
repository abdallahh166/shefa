-- Reminder queue + patient portal foundations

-- Expand reminder log to support WhatsApp
ALTER TABLE public.appointment_reminder_log
  ADD COLUMN IF NOT EXISTS patient_phone text;

ALTER TABLE public.appointment_reminder_log
  DROP CONSTRAINT IF EXISTS appointment_reminder_log_channel_check;

ALTER TABLE public.appointment_reminder_log
  ADD CONSTRAINT appointment_reminder_log_channel_check
  CHECK (channel IN ('in_app', 'email', 'whatsapp'));

ALTER TABLE public.appointment_reminder_log
  DROP CONSTRAINT IF EXISTS appointment_reminder_log_target_ck;

ALTER TABLE public.appointment_reminder_log
  ADD CONSTRAINT appointment_reminder_log_target_ck
  CHECK (notified_user_id IS NOT NULL OR patient_email IS NOT NULL OR patient_phone IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS ux_appointment_reminder_log_whatsapp
ON public.appointment_reminder_log (appointment_id, patient_phone, channel)
WHERE channel = 'whatsapp' AND patient_phone IS NOT NULL;

-- Reminder configuration per tenant
CREATE TABLE IF NOT EXISTS public.appointment_reminder_config (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  offsets integer[] NOT NULL DEFAULT '{1440,120}',
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_reminder_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic admins can manage reminder config" ON public.appointment_reminder_config;
CREATE POLICY "Clinic admins can manage reminder config"
ON public.appointment_reminder_config
FOR ALL TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_role(auth.uid(), 'clinic_admin'::app_role)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_role(auth.uid(), 'clinic_admin'::app_role)
);

DROP TRIGGER IF EXISTS update_appointment_reminder_config_updated_at ON public.appointment_reminder_config;
CREATE TRIGGER update_appointment_reminder_config_updated_at
BEFORE UPDATE ON public.appointment_reminder_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults for existing tenants
INSERT INTO public.appointment_reminder_config (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Ensure new tenants always get a reminder config
CREATE OR REPLACE FUNCTION public.bootstrap_reminder_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.appointment_reminder_config (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_reminder_config ON public.tenants;
CREATE TRIGGER bootstrap_reminder_config
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.bootstrap_reminder_config();

-- Link portal user to patient record (optional)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS user_id uuid NULL;

-- Patient contact preferences
CREATE TABLE IF NOT EXISTS public.patient_contact_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  email text NULL,
  phone_e164 text NULL,
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id)
);

ALTER TABLE public.patient_contact_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can manage patient contact preferences" ON public.patient_contact_preferences;
CREATE POLICY "Tenant users can manage patient contact preferences"
ON public.patient_contact_preferences
FOR ALL TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Portal users can manage own contact preferences" ON public.patient_contact_preferences;
CREATE POLICY "Portal users can manage own contact preferences"
ON public.patient_contact_preferences
FOR ALL TO authenticated
USING (
  patient_id IN (
    SELECT p.id FROM public.patients p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id = public.get_user_tenant_id(auth.uid())
  )
)
WITH CHECK (
  patient_id IN (
    SELECT p.id FROM public.patients p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

DROP TRIGGER IF EXISTS update_patient_contact_preferences_updated_at ON public.patient_contact_preferences;
CREATE TRIGGER update_patient_contact_preferences_updated_at
BEFORE UPDATE ON public.patient_contact_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reminder queue
CREATE TABLE IF NOT EXISTS public.reminder_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'in_app')),
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, channel, send_at)
);

ALTER TABLE public.reminder_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to reminder queue" ON public.reminder_queue;
CREATE POLICY "No direct access to reminder queue"
ON public.reminder_queue
FOR ALL TO authenticated
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_reminder_queue_due
ON public.reminder_queue (status, send_at, next_attempt_at);

DROP TRIGGER IF EXISTS update_reminder_queue_updated_at ON public.reminder_queue;
CREATE TRIGGER update_reminder_queue_updated_at
BEFORE UPDATE ON public.reminder_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Patient portal accounts
CREATE TABLE IF NOT EXISTS public.patient_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  auth_user_id uuid UNIQUE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  invited_at timestamptz NULL,
  activated_at timestamptz NULL,
  last_login_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic admins can manage patient accounts" ON public.patient_accounts;
CREATE POLICY "Clinic admins can manage patient accounts"
ON public.patient_accounts
FOR ALL TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_role(auth.uid(), 'clinic_admin'::app_role)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_role(auth.uid(), 'clinic_admin'::app_role)
);

DROP POLICY IF EXISTS "Patients can view own portal account" ON public.patient_accounts;
CREATE POLICY "Patients can view own portal account"
ON public.patient_accounts
FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Patients can update own portal account" ON public.patient_accounts;
CREATE POLICY "Patients can update own portal account"
ON public.patient_accounts
FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_patient_accounts_tenant_patient
ON public.patient_accounts (tenant_id, patient_id);

DROP TRIGGER IF EXISTS update_patient_accounts_updated_at ON public.patient_accounts;
CREATE TRIGGER update_patient_accounts_updated_at
BEFORE UPDATE ON public.patient_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_patient_portal_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL AND NEW.status = 'active' THEN
    UPDATE public.patients
    SET user_id = NEW.auth_user_id
    WHERE id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_patient_portal_user ON public.patient_accounts;
CREATE TRIGGER sync_patient_portal_user
AFTER INSERT OR UPDATE OF auth_user_id, status ON public.patient_accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_patient_portal_user();

-- Update tenant resolution to also support patient portal accounts
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = _user_id
  UNION ALL
  SELECT tenant_id FROM public.patient_accounts WHERE auth_user_id = _user_id AND status = 'active'
  LIMIT 1
$$;

-- Portal RLS policies (read-only)
DROP POLICY IF EXISTS "Portal users can view own patient record" ON public.patients;
CREATE POLICY "Portal users can view own patient record"
ON public.patients
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id = public.get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Portal users can view own appointments" ON public.appointments;
CREATE POLICY "Portal users can view own appointments"
ON public.appointments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = appointments.patient_id
      AND p.user_id = auth.uid()
      AND p.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Portal users can view own prescriptions" ON public.prescriptions;
CREATE POLICY "Portal users can view own prescriptions"
ON public.prescriptions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = prescriptions.patient_id
      AND p.user_id = auth.uid()
      AND p.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Portal users can view own lab orders" ON public.lab_orders;
CREATE POLICY "Portal users can view own lab orders"
ON public.lab_orders
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = lab_orders.patient_id
      AND p.user_id = auth.uid()
      AND p.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Portal users can view own invoices" ON public.invoices;
CREATE POLICY "Portal users can view own invoices"
ON public.invoices
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = invoices.patient_id
      AND p.user_id = auth.uid()
      AND p.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Portal users can view own documents" ON public.patient_documents;
CREATE POLICY "Portal users can view own documents"
ON public.patient_documents
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_documents.patient_id
      AND p.user_id = auth.uid()
      AND p.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);
