-- Enforce report access permissions at the database level
CREATE OR REPLACE FUNCTION public.assert_can_view_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_can_view_reports() TO authenticated;

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
  SELECT total_revenue, total_patients, total_appointments, avg_doctor_rating
  FROM public.mv_report_overview
  WHERE tenant_id = public.get_user_tenant_id(auth.uid());
END;
$$;

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
  SELECT month_start, revenue, expenses
  FROM public.mv_report_revenue_by_month
  WHERE tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY month_start DESC
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
  SELECT month_start, total_patients
  FROM public.mv_report_patient_growth
  WHERE tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY month_start DESC
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
  SELECT type, count
  FROM public.mv_report_appointment_types
  WHERE tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY count DESC;
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
  SELECT status, count
  FROM public.mv_report_appointment_statuses
  WHERE tenant_id = public.get_user_tenant_id(auth.uid());
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
  SELECT service, revenue
  FROM public.mv_report_revenue_by_service
  WHERE tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY revenue DESC
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
  SELECT doctor_id, doctor_name, appointments, completed, rating
  FROM public.mv_report_doctor_performance
  WHERE tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY appointments DESC;
END;
$$;
