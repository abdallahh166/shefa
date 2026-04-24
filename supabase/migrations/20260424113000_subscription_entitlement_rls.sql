CREATE OR REPLACE FUNCTION public.get_effective_subscription_plan(
  _tenant_id uuid DEFAULT public.get_user_tenant_id(auth.uid())
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text := 'free';
  _status text := 'active';
  _expires_at timestamptz;
BEGIN
  IF public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN 'enterprise';
  END IF;

  IF _tenant_id IS NULL THEN
    RETURN 'free';
  END IF;

  SELECT
    lower(COALESCE(plan, 'free')),
    lower(COALESCE(status, 'active')),
    expires_at
  INTO _plan, _status, _expires_at
  FROM public.subscriptions
  WHERE tenant_id = _tenant_id;

  IF NOT FOUND THEN
    RETURN 'free';
  END IF;

  IF _status NOT IN ('active', 'trialing') THEN
    RETURN 'free';
  END IF;

  IF _expires_at IS NOT NULL AND _expires_at < now() THEN
    RETURN 'free';
  END IF;

  IF _plan NOT IN ('free', 'starter', 'pro', 'enterprise') THEN
    RETURN 'free';
  END IF;

  RETURN _plan;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_feature_flag_enabled(
  _tenant_id uuid,
  _feature_key text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _enabled boolean;
BEGIN
  IF public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF _feature_key IS NULL OR btrim(_feature_key) = '' THEN
    RETURN true;
  END IF;

  IF _tenant_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT ff.enabled
  INTO _enabled
  FROM public.feature_flags ff
  WHERE ff.tenant_id = _tenant_id
    AND ff.feature_key = _feature_key
  LIMIT 1;

  RETURN COALESCE(_enabled, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_feature_access(
  _feature text,
  _tenant_id uuid DEFAULT public.get_user_tenant_id(auth.uid())
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _effective_plan text;
  _normalized_feature text := lower(COALESCE(_feature, ''));
BEGIN
  IF public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF _tenant_id IS NULL THEN
    RETURN false;
  END IF;

  _effective_plan := public.get_effective_subscription_plan(_tenant_id);

  CASE _normalized_feature
    WHEN 'appointments' THEN
      RETURN _effective_plan IN ('free', 'starter', 'pro', 'enterprise');
    WHEN 'billing' THEN
      RETURN _effective_plan IN ('starter', 'pro', 'enterprise');
    WHEN 'reports' THEN
      RETURN _effective_plan IN ('starter', 'pro', 'enterprise')
        AND public.is_tenant_feature_flag_enabled(_tenant_id, 'advanced_reports');
    WHEN 'laboratory' THEN
      RETURN _effective_plan IN ('pro', 'enterprise')
        AND public.is_tenant_feature_flag_enabled(_tenant_id, 'lab_module');
    WHEN 'pharmacy' THEN
      RETURN _effective_plan IN ('pro', 'enterprise')
        AND public.is_tenant_feature_flag_enabled(_tenant_id, 'pharmacy_module');
    WHEN 'insurance' THEN
      RETURN _effective_plan = 'enterprise'
        AND public.is_tenant_feature_flag_enabled(_tenant_id, 'insurance_module');
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_tenant_feature_access(
  _feature text,
  _tenant_id uuid DEFAULT public.get_user_tenant_id(auth.uid())
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_tenant_feature_access(_feature, _tenant_id) THEN
    RAISE EXCEPTION 'Feature % is not enabled for this tenant', _feature USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_can_access_billing()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_tenant_feature_access('billing');
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_can_access_pharmacy()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_tenant_feature_access('pharmacy');
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_can_access_insurance()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_tenant_feature_access('insurance');
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_subscription_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_subscription_plan(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_tenant_feature_flag_enabled(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_feature_flag_enabled(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.has_tenant_feature_access(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_tenant_feature_access(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.assert_tenant_feature_access(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_tenant_feature_access(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.assert_can_access_billing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_can_access_billing() TO authenticated;

REVOKE ALL ON FUNCTION public.assert_can_access_pharmacy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_can_access_pharmacy() TO authenticated;

REVOKE ALL ON FUNCTION public.assert_can_access_insurance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_can_access_insurance() TO authenticated;

DROP POLICY IF EXISTS "Billing staff can view invoices" ON public.invoices;
CREATE POLICY "Billing staff can view invoices"
ON public.invoices
FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('billing', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing users can create invoices" ON public.invoices;
CREATE POLICY "Billing users can create invoices"
ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('billing', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing users can update invoices" ON public.invoices;
CREATE POLICY "Billing users can update invoices"
ON public.invoices
FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('billing', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('billing', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing staff can view invoice payments" ON public.invoice_payments;
CREATE POLICY "Billing staff can view invoice payments"
ON public.invoice_payments
FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('billing', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing users can create invoice payments" ON public.invoice_payments;
CREATE POLICY "Billing users can create invoice payments"
ON public.invoice_payments
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('billing', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing staff can view claims" ON public.insurance_claims;
CREATE POLICY "Billing staff can view claims"
ON public.insurance_claims
FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('insurance', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing users can create claims" ON public.insurance_claims;
CREATE POLICY "Billing users can create claims"
ON public.insurance_claims
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('insurance', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing users can update claims" ON public.insurance_claims;
CREATE POLICY "Billing users can update claims"
ON public.insurance_claims
FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('insurance', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('insurance', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing staff can view claim attachments" ON public.insurance_claim_attachments;
CREATE POLICY "Billing staff can view claim attachments"
ON public.insurance_claim_attachments
FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('insurance', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing users can insert claim attachments" ON public.insurance_claim_attachments;
CREATE POLICY "Billing users can insert claim attachments"
ON public.insurance_claim_attachments
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('insurance', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing users can update claim attachments" ON public.insurance_claim_attachments;
CREATE POLICY "Billing users can update claim attachments"
ON public.insurance_claim_attachments
FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('insurance', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('insurance', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Clinical staff can view lab orders" ON public.lab_orders;
CREATE POLICY "Clinical staff can view lab orders"
ON public.lab_orders
FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('laboratory', tenant_id)
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'doctor'::public.app_role)
    OR public.has_role(auth.uid(), 'nurse'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Clinic admins can create lab orders" ON public.lab_orders;
CREATE POLICY "Clinic admins can create lab orders"
ON public.lab_orders
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('laboratory', tenant_id)
  AND public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Clinic admins can update lab orders" ON public.lab_orders;
CREATE POLICY "Clinic admins can update lab orders"
ON public.lab_orders
FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('laboratory', tenant_id)
  AND public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('laboratory', tenant_id)
  AND public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Clinic admins can manage medications" ON public.medications;
CREATE POLICY "Clinic admins can manage medications"
ON public.medications
FOR ALL TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('pharmacy', tenant_id)
  AND public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_tenant_feature_access('pharmacy', tenant_id)
  AND public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
);

DROP POLICY IF EXISTS "Portal users can view own lab orders" ON public.lab_orders;
CREATE POLICY "Portal users can view own lab orders"
ON public.lab_orders
FOR SELECT TO authenticated
USING (
  public.has_tenant_feature_access('laboratory', tenant_id)
  AND EXISTS (
    SELECT 1
    FROM public.patients p
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
  public.has_tenant_feature_access('billing', tenant_id)
  AND EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = invoices.patient_id
      AND p.user_id = auth.uid()
      AND p.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Billing staff can read tenant insurance attachments" ON storage.objects;
CREATE POLICY "Billing staff can read tenant insurance attachments"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'insurance-attachments'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  AND public.has_tenant_feature_access('insurance', public.get_user_tenant_id(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing staff can upload tenant insurance attachments" ON storage.objects;
CREATE POLICY "Billing staff can upload tenant insurance attachments"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'insurance-attachments'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  AND public.has_tenant_feature_access('insurance', public.get_user_tenant_id(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Billing staff can delete tenant insurance attachments" ON storage.objects;
CREATE POLICY "Billing staff can delete tenant insurance attachments"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'insurance-attachments'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  AND public.has_tenant_feature_access('insurance', public.get_user_tenant_id(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Super admins can manage all invoice payments" ON public.invoice_payments;
CREATE POLICY "Super admins can manage all invoice payments"
ON public.invoice_payments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins can manage all insurance claim attachments" ON public.insurance_claim_attachments;
CREATE POLICY "Super admins can manage all insurance claim attachments"
ON public.insurance_claim_attachments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins can manage storage objects" ON storage.objects;
CREATE POLICY "Super admins can manage storage objects"
ON storage.objects
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  AND bucket_id IN ('patient-documents', 'avatars', 'insurance-attachments')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role)
  AND bucket_id IN ('patient-documents', 'avatars', 'insurance-attachments')
);

CREATE OR REPLACE FUNCTION public.assert_can_view_reports()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_tenant_feature_access('reports');
END;
$$;

REVOKE ALL ON FUNCTION public.assert_can_view_reports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_can_view_reports() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invoice_summary()
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
AS $$
BEGIN
  PERFORM public.assert_can_access_billing();

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status <> 'void')::bigint AS total_count,
    COUNT(*) FILTER (WHERE status = 'paid')::bigint AS paid_count,
    COALESCE(SUM(amount_paid) FILTER (WHERE status <> 'void'), 0) AS paid_amount,
    COALESCE(SUM(balance_due) FILTER (WHERE status IN ('pending', 'overdue', 'partially_paid')), 0) AS pending_amount
  FROM public.invoices
  WHERE tenant_id = public.get_user_tenant_id(auth.uid())
    AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_invoice_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invoice_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_medication_summary()
RETURNS TABLE (
  total_count bigint,
  low_stock_count bigint,
  inventory_value numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_can_access_pharmacy();

  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_count,
    COUNT(*) FILTER (WHERE status = 'low_stock')::bigint AS low_stock_count,
    COALESCE(SUM(price * stock), 0) AS inventory_value
  FROM public.medications
  WHERE tenant_id = public.get_user_tenant_id(auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.get_medication_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_medication_summary() TO authenticated;

DROP FUNCTION IF EXISTS public.get_insurance_summary();

CREATE FUNCTION public.get_insurance_summary()
RETURNS TABLE (
  total_count bigint,
  draft_count bigint,
  submitted_count bigint,
  processing_count bigint,
  approved_count bigint,
  denied_count bigint,
  reimbursed_count bigint,
  providers_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_can_access_insurance();

  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_count,
    COUNT(*) FILTER (WHERE status = 'draft')::bigint AS draft_count,
    COUNT(*) FILTER (WHERE status = 'submitted')::bigint AS submitted_count,
    COUNT(*) FILTER (WHERE status = 'processing')::bigint AS processing_count,
    COUNT(*) FILTER (WHERE status = 'approved')::bigint AS approved_count,
    COUNT(*) FILTER (WHERE status = 'denied')::bigint AS denied_count,
    COUNT(*) FILTER (WHERE status = 'reimbursed')::bigint AS reimbursed_count,
    COUNT(DISTINCT NULLIF(provider, ''))::bigint AS providers_count
  FROM public.insurance_claims
  WHERE tenant_id = public.get_user_tenant_id(auth.uid())
    AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_insurance_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_insurance_summary() TO authenticated;

DROP FUNCTION IF EXISTS public.get_insurance_operations_summary();

CREATE FUNCTION public.get_insurance_operations_summary()
RETURNS TABLE (
  open_claims_count bigint,
  aged_0_7_count bigint,
  aged_8_14_count bigint,
  aged_15_plus_count bigint,
  oldest_open_claim_days integer,
  denied_follow_up_count bigint,
  follow_up_due_count bigint,
  unassigned_open_count bigint,
  stalled_processing_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_can_access_insurance();

  RETURN QUERY
  WITH scoped_claims AS (
    SELECT
      status,
      assigned_to_user_id,
      next_follow_up_at,
      processing_started_at,
      GREATEST(
        0,
        CURRENT_DATE - COALESCE(submitted_at::date, claim_date)
      )::int AS age_days
    FROM public.insurance_claims
    WHERE tenant_id = public.get_user_tenant_id(auth.uid())
      AND deleted_at IS NULL
  ),
  open_claims AS (
    SELECT *
    FROM scoped_claims
    WHERE status IN ('submitted', 'processing', 'approved')
  )
  SELECT
    COUNT(*)::bigint AS open_claims_count,
    COUNT(*) FILTER (WHERE age_days BETWEEN 0 AND 7)::bigint AS aged_0_7_count,
    COUNT(*) FILTER (WHERE age_days BETWEEN 8 AND 14)::bigint AS aged_8_14_count,
    COUNT(*) FILTER (WHERE age_days >= 15)::bigint AS aged_15_plus_count,
    COALESCE(MAX(age_days), 0)::int AS oldest_open_claim_days,
    (SELECT COUNT(*)::bigint FROM scoped_claims WHERE status = 'denied') AS denied_follow_up_count,
    (SELECT COUNT(*)::bigint FROM scoped_claims WHERE status <> 'reimbursed' AND next_follow_up_at IS NOT NULL AND next_follow_up_at <= now()) AS follow_up_due_count,
    COUNT(*) FILTER (WHERE assigned_to_user_id IS NULL)::bigint AS unassigned_open_count,
    COUNT(*) FILTER (WHERE status = 'processing' AND processing_started_at IS NOT NULL AND processing_started_at <= now() - interval '7 days')::bigint AS stalled_processing_count
  FROM open_claims;
END;
$$;

REVOKE ALL ON FUNCTION public.get_insurance_operations_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_insurance_operations_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_report_overview()
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
AS $$
BEGIN
  PERFORM public.assert_can_view_reports();

  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(ip.amount)
      FROM public.invoice_payments ip
      WHERE ip.tenant_id = public.get_user_tenant_id(auth.uid())
    ), 0) AS total_revenue,
    COALESCE((
      SELECT COUNT(*)
      FROM public.patients p
      WHERE p.tenant_id = public.get_user_tenant_id(auth.uid())
    ), 0)::bigint AS total_patients,
    COALESCE((
      SELECT COUNT(*)
      FROM public.appointments a
      WHERE a.tenant_id = public.get_user_tenant_id(auth.uid())
    ), 0)::bigint AS total_appointments,
    COALESCE((
      SELECT AVG(COALESCE(d.rating, 0))
      FROM public.doctors d
      WHERE d.tenant_id = public.get_user_tenant_id(auth.uid())
    ), 0) AS avg_doctor_rating;
END;
$$;

REVOKE ALL ON FUNCTION public.get_report_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_overview() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_report_revenue_by_month(_months integer DEFAULT 6)
RETURNS TABLE (
  month_start date,
  revenue numeric,
  expenses numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_can_view_reports();

  RETURN QUERY
  WITH revenue AS (
    SELECT
      date_trunc('month', ip.paid_at)::date AS month_start,
      COALESCE(SUM(ip.amount), 0) AS revenue
    FROM public.invoice_payments ip
    WHERE ip.tenant_id = public.get_user_tenant_id(auth.uid())
    GROUP BY 1
  ),
  outstanding AS (
    SELECT
      date_trunc('month', i.invoice_date)::date AS month_start,
      COALESCE(SUM(i.balance_due), 0) AS expenses
    FROM public.invoices i
    WHERE i.tenant_id = public.get_user_tenant_id(auth.uid())
      AND i.status IN ('pending', 'overdue', 'partially_paid')
      AND i.deleted_at IS NULL
    GROUP BY 1
  ),
  combined AS (
    SELECT
      COALESCE(revenue.month_start, outstanding.month_start) AS month_start,
      COALESCE(revenue.revenue, 0) AS revenue,
      COALESCE(outstanding.expenses, 0) AS expenses
    FROM revenue
    FULL OUTER JOIN outstanding USING (month_start)
  )
  SELECT month_start, revenue, expenses
  FROM combined
  ORDER BY month_start DESC
  LIMIT COALESCE(_months, 6);
END;
$$;

REVOKE ALL ON FUNCTION public.get_report_revenue_by_month(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_revenue_by_month(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_report_revenue_by_service(_limit integer DEFAULT 6)
RETURNS TABLE (
  service text,
  revenue numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_can_view_reports();

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(i.service, ''), 'Other') AS service,
    COALESCE(SUM(ip.amount), 0) AS revenue
  FROM public.invoice_payments ip
  INNER JOIN public.invoices i
    ON i.id = ip.invoice_id
  WHERE ip.tenant_id = public.get_user_tenant_id(auth.uid())
    AND i.deleted_at IS NULL
  GROUP BY 1
  ORDER BY revenue DESC
  LIMIT COALESCE(_limit, 6);
END;
$$;

REVOKE ALL ON FUNCTION public.get_report_revenue_by_service(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_revenue_by_service(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_report_refresh_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_refresh_status() TO authenticated;

REVOKE ALL ON FUNCTION public.get_report_patient_growth(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_patient_growth(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_report_appointment_types() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_appointment_types() TO authenticated;

REVOKE ALL ON FUNCTION public.get_report_appointment_statuses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_appointment_statuses() TO authenticated;

REVOKE ALL ON FUNCTION public.get_report_doctor_performance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_doctor_performance() TO authenticated;
