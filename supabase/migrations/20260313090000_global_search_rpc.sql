-- Global search RPC and indexes

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_patients_full_name_trgm
  ON public.patients USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_patients_patient_code_trgm
  ON public.patients USING gin (patient_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_patients_email_trgm
  ON public.patients USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm
  ON public.patients USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_doctors_full_name_trgm
  ON public.doctors USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_doctors_specialty_trgm
  ON public.doctors USING gin (specialty gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_invoices_code_trgm
  ON public.invoices USING gin (invoice_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_invoices_service_trgm
  ON public.invoices USING gin (service gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_global(_term text, _limit integer DEFAULT 8)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  label text,
  sublabel text,
  extra text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    FROM public.patients p
    JOIN tenant t ON t.tenant_id = p.tenant_id
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
    FROM public.doctors d
    JOIN tenant t ON t.tenant_id = d.tenant_id
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
    FROM public.invoices i
    JOIN tenant t ON t.tenant_id = i.tenant_id
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
$$;

REVOKE ALL ON FUNCTION public.search_global(text, integer) FROM anon;
