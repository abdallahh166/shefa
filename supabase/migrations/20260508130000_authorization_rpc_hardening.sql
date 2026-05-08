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
  v_user_tenant_id uuid;
  v_tenant_id uuid;
BEGIN
  v_user_tenant_id := public.get_user_tenant_id(auth.uid());
  v_tenant_id := COALESCE(_tenant_id, v_user_tenant_id);

  IF v_user_tenant_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Missing tenant context for invoice summary' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id <> v_user_tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch for invoice summary' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_can_access_billing();

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

REVOKE ALL ON FUNCTION public.get_invoice_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invoice_summary(uuid) TO authenticated;

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
  v_user_tenant_id uuid;
  v_tenant_id uuid;
BEGIN
  v_user_tenant_id := public.get_user_tenant_id(auth.uid());
  v_tenant_id := COALESCE(_tenant_id, v_user_tenant_id);

  IF v_user_tenant_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Missing tenant context for report overview' USING ERRCODE = '42501';
  END IF;

  IF v_tenant_id <> v_user_tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch for report overview' USING ERRCODE = '42501';
  END IF;

  PERFORM public.assert_can_view_reports();

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

REVOKE ALL ON FUNCTION public.get_report_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_overview(uuid) TO authenticated;

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

  IF v_user_tenant_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Missing tenant context for global search' USING ERRCODE = '42501';
  END IF;

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
    LEFT JOIN public.patients pt
      ON pt.id = a.patient_id
      AND pt.tenant_id = v_tenant_id
    LEFT JOIN public.doctors d
      ON d.id = a.doctor_id
      AND d.tenant_id = v_tenant_id
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
    LEFT JOIN public.patients pt
      ON pt.id = i.patient_id
      AND pt.tenant_id = v_tenant_id
    CROSS JOIN q
    WHERE i.tenant_id = v_tenant_id
      AND i.deleted_at IS NULL
      AND (
        COALESCE(i.invoice_code, '') ILIKE q.pattern
        OR COALESCE(i.service, '') ILIKE q.pattern
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

REVOKE ALL ON FUNCTION public.search_global(text, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_global(text, integer, uuid) TO authenticated;
