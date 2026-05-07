CREATE TABLE IF NOT EXISTS public.command_idempotency (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'committed', 'failed_retryable', 'failed_terminal')),
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_command_idempotency_tenant_op_key
  ON public.command_idempotency (tenant_id, operation_type, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_command_idempotency_expires_at
  ON public.command_idempotency (expires_at);

ALTER TABLE public.command_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view command idempotency" ON public.command_idempotency;
CREATE POLICY "Tenant users can view command idempotency"
  ON public.command_idempotency
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Tenant users can manage command idempotency" ON public.command_idempotency;
CREATE POLICY "Tenant users can manage command idempotency"
  ON public.command_idempotency
  FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    )
  );

-- Drop legacy name if a prior failed push created it (Supabase CLI misparses identifiers ending in `_atomic`).
DO $$
BEGIN
  DROP FUNCTION IF EXISTS public.post_invoice_payment_atomic(
    uuid, uuid, numeric, text, timestamptz, text, text, text, text, uuid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.post_invoice_payment(
  p_invoice_id uuid,
  p_tenant_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_paid_at timestamptz DEFAULT now(),
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_request_hash text DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  result_code text,
  retryable boolean,
  idempotency_replay boolean,
  message text,
  invoice jsonb,
  payment jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_payment public.invoice_payments%ROWTYPE;
  v_idempotency public.command_idempotency%ROWTYPE;
  v_amount_paid numeric(10,2);
  v_balance_due numeric(10,2);
  v_status text;
  v_paid_at timestamptz;
BEGIN
  IF p_tenant_id IS NULL OR p_tenant_id <> public.get_user_tenant_id(auth.uid()) THEN
    RAISE EXCEPTION 'Tenant mismatch for payment operation' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.command_idempotency (
      tenant_id,
      operation_type,
      idempotency_key,
      request_hash,
      status,
      expires_at
    )
    VALUES (
      p_tenant_id,
      'invoice_payment_post',
      p_idempotency_key,
      COALESCE(p_request_hash, ''),
      'started',
      now() + interval '7 days'
    )
    ON CONFLICT (tenant_id, operation_type, idempotency_key) DO NOTHING;

    SELECT *
    INTO v_idempotency
    FROM public.command_idempotency
    WHERE tenant_id = p_tenant_id
      AND operation_type = 'invoice_payment_post'
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF v_idempotency.request_hash <> COALESCE(p_request_hash, '') THEN
      result_code := 'IDEMPOTENCY_MISMATCH';
      retryable := false;
      idempotency_replay := false;
      message := 'Idempotency key already used with different payload';
      invoice := NULL;
      payment := NULL;
      RETURN NEXT;
      RETURN;
    END IF;

    IF v_idempotency.status = 'committed' THEN
      result_code := 'OK';
      retryable := false;
      idempotency_replay := true;
      message := 'Replay of previously committed command';
      invoice := COALESCE(v_idempotency.response_payload->'invoice', NULL);
      payment := COALESCE(v_idempotency.response_payload->'payment', NULL);
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.status = 'void' THEN
    RAISE EXCEPTION 'Voided invoices cannot accept payments';
  END IF;

  IF v_invoice.status = 'paid' OR COALESCE(v_invoice.balance_due, 0) <= 0 THEN
    RAISE EXCEPTION 'Paid invoices cannot accept additional payments';
  END IF;

  IF ROUND(p_amount::numeric, 2) > COALESCE(v_invoice.balance_due, 0) THEN
    RAISE EXCEPTION 'Payment amount cannot exceed outstanding balance';
  END IF;

  INSERT INTO public.invoice_payments (
    tenant_id,
    invoice_id,
    patient_id,
    amount,
    payment_method,
    paid_at,
    reference,
    notes,
    created_by
  )
  VALUES (
    p_tenant_id,
    v_invoice.id,
    v_invoice.patient_id,
    ROUND(p_amount::numeric, 2),
    p_payment_method,
    COALESCE(p_paid_at, now()),
    p_reference,
    p_notes,
    p_user_id
  )
  RETURNING * INTO v_payment;

  v_amount_paid := ROUND(COALESCE(v_invoice.amount_paid, 0) + v_payment.amount, 2);
  v_balance_due := ROUND(GREATEST(COALESCE(v_invoice.amount, 0) - v_amount_paid, 0), 2);
  v_paid_at := CASE
    WHEN v_amount_paid >= COALESCE(v_invoice.amount, 0) THEN COALESCE(v_payment.paid_at, now())
    ELSE v_invoice.paid_at
  END;

  v_status := CASE
    WHEN v_amount_paid >= COALESCE(v_invoice.amount, 0) THEN 'paid'
    WHEN v_amount_paid > 0 THEN 'partially_paid'
    WHEN v_invoice.due_date IS NOT NULL AND v_invoice.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'pending'
  END;

  UPDATE public.invoices
  SET
    amount_paid = v_amount_paid,
    balance_due = v_balance_due,
    status = v_status,
    paid_at = v_paid_at
  WHERE id = v_invoice.id
    AND tenant_id = p_tenant_id
  RETURNING * INTO v_invoice;

  result_code := 'OK';
  retryable := false;
  idempotency_replay := false;
  message := 'Payment posted';
  invoice := to_jsonb(v_invoice);
  payment := to_jsonb(v_payment);

  IF p_idempotency_key IS NOT NULL THEN
    UPDATE public.command_idempotency
    SET
      status = 'committed',
      response_payload = jsonb_build_object(
        'invoice', invoice,
        'payment', payment
      ),
      updated_at = now()
    WHERE id = v_idempotency.id;
  END IF;

  RETURN NEXT;
END;
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_patients_id_tenant ON public.patients (id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_doctors_id_tenant ON public.doctors (id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_id_tenant ON public.invoices (id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_user_id_tenant ON public.profiles (user_id, tenant_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_patient_tenant_fk') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_patient_tenant_fk
      FOREIGN KEY (patient_id, tenant_id)
      REFERENCES public.patients (id, tenant_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_doctor_tenant_fk') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_doctor_tenant_fk
      FOREIGN KEY (doctor_id, tenant_id)
      REFERENCES public.doctors (id, tenant_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_patient_tenant_fk') THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_patient_tenant_fk
      FOREIGN KEY (patient_id, tenant_id)
      REFERENCES public.patients (id, tenant_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payments_invoice_tenant_fk') THEN
    ALTER TABLE public.invoice_payments
      ADD CONSTRAINT invoice_payments_invoice_tenant_fk
      FOREIGN KEY (invoice_id, tenant_id)
      REFERENCES public.invoices (id, tenant_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payments_patient_tenant_fk') THEN
    ALTER TABLE public.invoice_payments
      ADD CONSTRAINT invoice_payments_patient_tenant_fk
      FOREIGN KEY (patient_id, tenant_id)
      REFERENCES public.patients (id, tenant_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insurance_claims_patient_tenant_fk') THEN
    ALTER TABLE public.insurance_claims
      ADD CONSTRAINT insurance_claims_patient_tenant_fk
      FOREIGN KEY (patient_id, tenant_id)
      REFERENCES public.patients (id, tenant_id)
      NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_insurance_assignee_tenant_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_assignee_tenant uuid;
BEGIN
  IF NEW.assigned_to_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id INTO v_assignee_tenant
  FROM public.profiles
  WHERE user_id = NEW.assigned_to_user_id;

  IF v_assignee_tenant IS NULL THEN
    RAISE EXCEPTION 'Assigned user profile not found';
  END IF;

  IF v_assignee_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Assigned user must belong to the same tenant';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_insurance_assignee_tenant_match ON public.insurance_claims;
CREATE TRIGGER trg_insurance_assignee_tenant_match
  BEFORE INSERT OR UPDATE OF assigned_to_user_id, tenant_id
  ON public.insurance_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_insurance_assignee_tenant_match();

DROP INDEX IF EXISTS ux_appointment_queue_appointment_id;
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointment_queue_appointment_id_active
  ON public.appointment_queue (appointment_id)
  WHERE status IN ('waiting', 'called', 'in_service');

DROP FUNCTION IF EXISTS public.get_invoice_summary();
CREATE OR REPLACE FUNCTION public.get_invoice_summary(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  total_count bigint,
  paid_count bigint,
  paid_amount numeric,
  pending_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := COALESCE(_tenant_id, public.get_user_tenant_id(auth.uid()));
  IF v_tenant_id <> public.get_user_tenant_id(auth.uid()) THEN
    RAISE EXCEPTION 'Tenant mismatch for invoice summary' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status <> 'void')::bigint AS total_count,
    COUNT(*) FILTER (WHERE status = 'paid')::bigint AS paid_count,
    COALESCE(SUM(amount_paid) FILTER (WHERE status <> 'void'), 0) AS paid_amount,
    COALESCE(SUM(balance_due) FILTER (WHERE status IN ('pending', 'overdue', 'partially_paid')), 0) AS pending_amount
  FROM public.invoices
  WHERE tenant_id = v_tenant_id
    AND deleted_at IS NULL;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_report_overview();
CREATE OR REPLACE FUNCTION public.get_report_overview(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  total_revenue numeric,
  total_patients bigint,
  total_appointments bigint,
  avg_doctor_rating numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := COALESCE(_tenant_id, public.get_user_tenant_id(auth.uid()));
  IF v_tenant_id <> public.get_user_tenant_id(auth.uid()) THEN
    RAISE EXCEPTION 'Tenant mismatch for report overview' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(ip.amount)
      FROM public.invoice_payments ip
      WHERE ip.tenant_id = v_tenant_id
    ), 0) AS total_revenue,
    COALESCE((
      SELECT COUNT(*)
      FROM public.patients p
      WHERE p.tenant_id = v_tenant_id
    ), 0)::bigint AS total_patients,
    COALESCE((
      SELECT COUNT(*)
      FROM public.appointments a
      WHERE a.tenant_id = v_tenant_id
    ), 0)::bigint AS total_appointments,
    COALESCE((
      SELECT AVG(COALESCE(d.rating, 0))
      FROM public.doctors d
      WHERE d.tenant_id = v_tenant_id
    ), 0) AS avg_doctor_rating;
END;
$function$;

DROP FUNCTION IF EXISTS public.search_global(text, integer);
CREATE OR REPLACE FUNCTION public.search_global(_term text, _limit integer DEFAULT 8, _tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  title text,
  subtitle text,
  status text,
  event_date timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_tenant_id uuid;
  v_tenant_id uuid;
BEGIN
  IF _term IS NULL OR btrim(_term) = '' THEN
    RETURN;
  END IF;

  v_user_tenant_id := public.get_user_tenant_id(auth.uid());
  v_tenant_id := COALESCE(_tenant_id, v_user_tenant_id);
  IF v_tenant_id <> v_user_tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch for global search' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH q AS (
    SELECT '%' || btrim(_term) || '%' AS pattern,
           GREATEST(1, LEAST(COALESCE(_limit, 8), 50)) AS lim
  ),
  patients_matches AS (
    SELECT
      'patient'::text AS entity_type,
      p.id AS entity_id,
      p.full_name::text AS title,
      COALESCE(p.patient_code, p.phone, p.email, '')::text AS subtitle,
      COALESCE(p.status, '')::text AS status,
      p.created_at AS event_date
    FROM public.patients p
    CROSS JOIN q
    WHERE p.tenant_id = v_tenant_id
      AND p.deleted_at IS NULL
      AND (
        p.full_name ILIKE q.pattern
        OR COALESCE(p.patient_code, '') ILIKE q.pattern
        OR COALESCE(p.phone, '') ILIKE q.pattern
      )
    ORDER BY p.updated_at DESC
    LIMIT (SELECT lim FROM q)
  ),
  appointments_matches AS (
    SELECT
      'appointment'::text AS entity_type,
      a.id AS entity_id,
      COALESCE(pt.full_name, 'Appointment')::text AS title,
      COALESCE(d.full_name, '')::text AS subtitle,
      COALESCE(a.status, '')::text AS status,
      a.appointment_date AS event_date
    FROM public.appointments a
    LEFT JOIN public.patients pt ON pt.id = a.patient_id
    LEFT JOIN public.doctors d ON d.id = a.doctor_id
    CROSS JOIN q
    WHERE a.tenant_id = v_tenant_id
      AND a.deleted_at IS NULL
      AND (
        COALESCE(pt.full_name, '') ILIKE q.pattern
        OR COALESCE(d.full_name, '') ILIKE q.pattern
        OR COALESCE(a.type, '') ILIKE q.pattern
      )
    ORDER BY a.updated_at DESC
    LIMIT (SELECT lim FROM q)
  ),
  invoices_matches AS (
    SELECT
      'invoice'::text AS entity_type,
      i.id AS entity_id,
      COALESCE(i.invoice_code, 'Invoice')::text AS title,
      COALESCE(pt.full_name, i.service, '')::text AS subtitle,
      COALESCE(i.status, '')::text AS status,
      i.updated_at AS event_date
    FROM public.invoices i
    LEFT JOIN public.patients pt ON pt.id = i.patient_id
    CROSS JOIN q
    WHERE i.tenant_id = v_tenant_id
      AND i.deleted_at IS NULL
      AND (
        COALESCE(i.invoice_code, '') ILIKE q.pattern
        OR COALESCE(i.service, '') ILIKE q.pattern
        OR COALESCE(pt.full_name, '') ILIKE q.pattern
      )
    ORDER BY i.updated_at DESC
    LIMIT (SELECT lim FROM q)
  )
  SELECT *
  FROM (
    SELECT * FROM patients_matches
    UNION ALL
    SELECT * FROM appointments_matches
    UNION ALL
    SELECT * FROM invoices_matches
  ) all_matches
  ORDER BY event_date DESC NULLS LAST
  LIMIT (SELECT lim FROM q);
END;
$function$;
