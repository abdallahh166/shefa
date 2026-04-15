-- Operations dashboard drill-down views for super admins

DROP FUNCTION IF EXISTS public.admin_recent_job_activity(integer);

CREATE OR REPLACE FUNCTION public.admin_recent_job_activity(_limit integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  type text,
  status text,
  attempts integer,
  max_attempts integer,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  run_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admins can view operations job activity';
  END IF;

  RETURN QUERY
  SELECT
    j.id,
    j.tenant_id,
    t.name AS tenant_name,
    j.type,
    j.status,
    j.attempts,
    j.max_attempts,
    j.last_error,
    j.locked_at,
    j.locked_by,
    j.run_at,
    j.updated_at
  FROM public.jobs j
  LEFT JOIN public.tenants t ON t.id = j.tenant_id
  WHERE j.status IN ('failed', 'dead_letter')
     OR j.last_error IS NOT NULL
     OR (j.attempts > 0 AND j.status IN ('pending', 'processing'))
  ORDER BY j.updated_at DESC
  LIMIT GREATEST(COALESCE(_limit, 10), 1);
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_recent_system_errors(integer);

CREATE OR REPLACE FUNCTION public.admin_recent_system_errors(_limit integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  level text,
  service text,
  message text,
  tenant_id uuid,
  tenant_name text,
  request_id text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admins can view system errors';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.level,
    l.service,
    l.message,
    l.tenant_id,
    t.name AS tenant_name,
    l.request_id,
    l.created_at
  FROM public.system_logs l
  LEFT JOIN public.tenants t ON t.id = l.tenant_id
  WHERE l.level IN ('warn', 'error')
  ORDER BY l.created_at DESC
  LIMIT GREATEST(COALESCE(_limit, 10), 1);
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_client_error_trend(integer, integer);

CREATE OR REPLACE FUNCTION public.admin_client_error_trend(
  _bucket_minutes integer DEFAULT 15,
  _bucket_count integer DEFAULT 6
)
RETURNS TABLE (
  bucket_start timestamptz,
  error_count bigint,
  affected_tenants_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  bucket_minutes integer := GREATEST(COALESCE(_bucket_minutes, 15), 5);
  bucket_count integer := GREATEST(COALESCE(_bucket_count, 6), 1);
  first_bucket timestamptz := date_trunc('minute', now()) - make_interval(mins => bucket_minutes * (bucket_count - 1));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admins can view client error trends';
  END IF;

  RETURN QUERY
  WITH buckets AS (
    SELECT generate_series(
      first_bucket,
      date_trunc('minute', now()),
      make_interval(mins => bucket_minutes)
    ) AS bucket_start
  )
  SELECT
    b.bucket_start,
    COUNT(c.id)::bigint AS error_count,
    COUNT(DISTINCT c.tenant_id)::bigint AS affected_tenants_count
  FROM buckets b
  LEFT JOIN public.client_error_logs c
    ON c.created_at >= b.bucket_start
   AND c.created_at < b.bucket_start + make_interval(mins => bucket_minutes)
  GROUP BY b.bucket_start
  ORDER BY b.bucket_start ASC;
END;
$function$;
