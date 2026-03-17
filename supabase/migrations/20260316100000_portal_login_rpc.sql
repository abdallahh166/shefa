-- Portal login metadata lookup (invite-only)
CREATE OR REPLACE FUNCTION public.get_portal_login_metadata(
  _slug text,
  _email text
)
RETURNS TABLE (
  tenant_id uuid,
  patient_id uuid,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id AS tenant_id,
    p.id AS patient_id,
    pa.status AS status
  FROM public.tenants t
  JOIN public.patients p ON p.tenant_id = t.id
  JOIN public.patient_accounts pa ON pa.patient_id = p.id
  WHERE t.slug = _slug
    AND lower(p.email) = lower(_email)
    AND p.deleted_at IS NULL
    AND pa.status IN ('invited', 'active')
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_login_metadata(text, text) TO anon, authenticated;
