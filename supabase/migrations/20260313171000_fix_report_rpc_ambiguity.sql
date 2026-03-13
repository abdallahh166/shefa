-- Fix ambiguous column references in report RPCs (PL/pgSQL output vars vs columns)
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
  SELECT
    mv.month_start,
    mv.revenue,
    mv.expenses
  FROM public.mv_report_revenue_by_month AS mv
  WHERE mv.tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY mv.month_start DESC
  LIMIT COALESCE(_months, 6);
END;
$$;

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

CREATE OR REPLACE FUNCTION public.get_report_appointment_types()
RETURNS TABLE (
  type text,
  count bigint
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
    mv.type,
    mv.count
  FROM public.mv_report_appointment_types AS mv
  WHERE mv.tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY mv.count DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_report_appointment_statuses()
RETURNS TABLE (
  status text,
  count bigint
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
    mv.status,
    mv.count
  FROM public.mv_report_appointment_statuses AS mv
  WHERE mv.tenant_id = public.get_user_tenant_id(auth.uid());
END;
$$;

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
    mv.service,
    mv.revenue
  FROM public.mv_report_revenue_by_service AS mv
  WHERE mv.tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY mv.revenue DESC
  LIMIT COALESCE(_limit, 6);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_report_doctor_performance()
RETURNS TABLE (
  doctor_id uuid,
  doctor_name text,
  appointments bigint,
  completed bigint,
  rating numeric
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
    mv.doctor_id,
    mv.doctor_name,
    mv.appointments,
    mv.completed,
    mv.rating
  FROM public.mv_report_doctor_performance AS mv
  WHERE mv.tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY mv.appointments DESC;
END;
$$;
