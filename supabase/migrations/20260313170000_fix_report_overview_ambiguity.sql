-- Fix ambiguous column references in report overview RPC
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
    mv.total_revenue,
    mv.total_patients,
    mv.total_appointments,
    mv.avg_doctor_rating
  FROM public.mv_report_overview AS mv
  WHERE mv.tenant_id = public.get_user_tenant_id(auth.uid());
END;
$$;
