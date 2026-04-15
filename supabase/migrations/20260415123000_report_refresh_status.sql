-- Track materialized-view refresh health for operational visibility

CREATE TABLE IF NOT EXISTS public.report_refresh_status (
  scope text PRIMARY KEY DEFAULT 'global',
  last_started_at timestamptz NULL,
  last_succeeded_at timestamptz NULL,
  last_failed_at timestamptz NULL,
  last_error text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (scope = 'global')
);

ALTER TABLE public.report_refresh_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to report refresh status" ON public.report_refresh_status;
CREATE POLICY "No direct access to report refresh status"
ON public.report_refresh_status
FOR ALL TO authenticated
USING (false)
WITH CHECK (false);

INSERT INTO public.report_refresh_status (scope)
VALUES ('global')
ON CONFLICT (scope) DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_report_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.report_refresh_status (scope, last_started_at, updated_at)
  VALUES ('global', now(), now())
  ON CONFLICT (scope) DO UPDATE
  SET last_started_at = EXCLUDED.last_started_at,
      updated_at = now();

  REFRESH MATERIALIZED VIEW public.mv_report_overview;
  REFRESH MATERIALIZED VIEW public.mv_report_revenue_by_month;
  REFRESH MATERIALIZED VIEW public.mv_report_patient_growth;
  REFRESH MATERIALIZED VIEW public.mv_report_appointment_types;
  REFRESH MATERIALIZED VIEW public.mv_report_appointment_statuses;
  REFRESH MATERIALIZED VIEW public.mv_report_revenue_by_service;
  REFRESH MATERIALIZED VIEW public.mv_report_doctor_performance;

  UPDATE public.report_refresh_status
  SET last_succeeded_at = now(),
      last_error = NULL,
      updated_at = now()
  WHERE scope = 'global';
EXCEPTION
  WHEN OTHERS THEN
    UPDATE public.report_refresh_status
    SET last_failed_at = now(),
        last_error = SQLERRM,
        updated_at = now()
    WHERE scope = 'global';
    RAISE;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_report_refresh_status();

CREATE OR REPLACE FUNCTION public.get_report_refresh_status()
RETURNS TABLE (
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  last_error text,
  is_stale boolean,
  stale_after_minutes integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.assert_can_view_reports();

  RETURN QUERY
  SELECT
    rs.last_started_at,
    rs.last_succeeded_at,
    rs.last_failed_at,
    rs.last_error,
    (
      rs.last_succeeded_at IS NULL
      OR rs.last_succeeded_at < now() - interval '2 hours'
      OR (rs.last_failed_at IS NOT NULL AND rs.last_failed_at > COALESCE(rs.last_succeeded_at, '-infinity'::timestamptz))
    ) AS is_stale,
    120 AS stale_after_minutes
  FROM public.report_refresh_status rs
  WHERE rs.scope = 'global';
END;
$function$;
