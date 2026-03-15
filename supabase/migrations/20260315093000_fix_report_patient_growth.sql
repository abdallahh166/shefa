-- Ensure patient growth report materialized view and RPC are consistent
-- Safe to rebuild as it's derived data.

DROP MATERIALIZED VIEW IF EXISTS public.mv_report_patient_growth;

CREATE MATERIALIZED VIEW public.mv_report_patient_growth AS
WITH monthly AS (
  SELECT
    tenant_id,
    date_trunc('month', created_at)::date AS month_start,
    COUNT(*)::bigint AS new_patients
  FROM public.patients
  GROUP BY tenant_id, month_start
)
SELECT
  tenant_id,
  month_start,
  SUM(new_patients) OVER (PARTITION BY tenant_id ORDER BY month_start) AS total_patients
FROM monthly
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_mv_report_patient_growth_tenant_month
  ON public.mv_report_patient_growth (tenant_id, month_start);

CREATE OR REPLACE FUNCTION public.get_report_patient_growth(_months integer DEFAULT 6)
RETURNS TABLE (
  month_start date,
  total_patients bigint
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
    mv.month_start,
    mv.total_patients
  FROM public.mv_report_patient_growth AS mv
  WHERE mv.tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY mv.month_start DESC
  LIMIT COALESCE(_months, 6);
END;
$$;
