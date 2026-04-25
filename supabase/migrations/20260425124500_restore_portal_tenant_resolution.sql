CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM (
    SELECT p.tenant_id, 1 AS priority
    FROM public.profiles p
    INNER JOIN public.tenants t ON t.id = p.tenant_id
    WHERE p.user_id = _user_id
      AND t.status = 'active'

    UNION ALL

    SELECT pa.tenant_id, 2 AS priority
    FROM public.patient_accounts pa
    INNER JOIN public.tenants t ON t.id = pa.tenant_id
    WHERE pa.auth_user_id = _user_id
      AND pa.status = 'active'
      AND t.status = 'active'
  ) resolved
  ORDER BY priority
  LIMIT 1
$$;
