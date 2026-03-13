-- Harden global search RPC access
CREATE OR REPLACE FUNCTION public.assert_can_search()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_can_search() TO authenticated;

CREATE OR REPLACE FUNCTION public.search_global(_term text, _limit integer DEFAULT 8)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  label text,
  sublabel text,
  extra text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_can_search();
  RETURN QUERY
  WITH params AS (
    SELECT NULLIF(trim(_term), '') AS q,
           GREATEST(1, LEAST(COALESCE(_limit, 8), 20)) AS lim
  ),
  tenant AS (
    SELECT public.get_user_tenant_id(auth.uid()) AS tenant_id
  ),
  patients AS (
    SELECT
      'patient'::text AS entity_type,
      p.id AS entity_id,
      p.full_name AS label,
      p.patient_code AS sublabel,
      COALESCE(p.phone, p.email) AS extra
    FROM public.patients AS p
    JOIN tenant AS t ON t.tenant_id = p.tenant_id
    JOIN params ON true
    WHERE params.q IS NOT NULL
      AND (
        p.full_name ILIKE '%' || params.q || '%'
        OR p.patient_code ILIKE '%' || params.q || '%'
        OR p.phone ILIKE '%' || params.q || '%'
        OR p.email ILIKE '%' || params.q || '%'
      )
    ORDER BY p.full_name
    LIMIT (SELECT lim FROM params)
  ),
  doctors AS (
    SELECT
      'doctor'::text AS entity_type,
      d.id AS entity_id,
      d.full_name AS label,
      d.specialty AS sublabel,
      NULL::text AS extra
    FROM public.doctors AS d
    JOIN tenant AS t ON t.tenant_id = d.tenant_id
    JOIN params ON true
    WHERE params.q IS NOT NULL
      AND (
        d.full_name ILIKE '%' || params.q || '%'
        OR d.specialty ILIKE '%' || params.q || '%'
      )
    ORDER BY d.full_name
    LIMIT (SELECT lim FROM params)
  ),
  invoices AS (
    SELECT
      'invoice'::text AS entity_type,
      i.id AS entity_id,
      i.invoice_code AS label,
      i.service AS sublabel,
      NULL::text AS extra
    FROM public.invoices AS i
    JOIN tenant AS t ON t.tenant_id = i.tenant_id
    JOIN params ON true
    WHERE params.q IS NOT NULL
      AND (
        i.invoice_code ILIKE '%' || params.q || '%'
        OR i.service ILIKE '%' || params.q || '%'
      )
    ORDER BY i.invoice_date DESC
    LIMIT (SELECT lim FROM params)
  )
  SELECT * FROM patients
  UNION ALL
  SELECT * FROM doctors
  UNION ALL
  SELECT * FROM invoices;
END;
$$;

REVOKE ALL ON FUNCTION public.search_global(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_global(text, integer) TO authenticated;
