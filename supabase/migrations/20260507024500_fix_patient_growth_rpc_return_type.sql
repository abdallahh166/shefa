CREATE OR REPLACE FUNCTION public.get_report_patient_growth(_months integer DEFAULT 6)
RETURNS TABLE (
  month_start date,
  total_patients bigint
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
    mv.month_start,
    COALESCE(mv.total_patients, 0)::bigint AS total_patients
  FROM public.mv_report_patient_growth AS mv
  WHERE mv.tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY mv.month_start DESC
  LIMIT COALESCE(_months, 6);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_report_patient_growth(_months integer, _tenant_id uuid)
RETURNS TABLE (
  month_start date,
  total_patients bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_tenant_id uuid;
  v_tenant_id uuid;
BEGIN
  PERFORM public.assert_can_view_reports();

  v_user_tenant_id := public.get_user_tenant_id(auth.uid());
  v_tenant_id := COALESCE(_tenant_id, v_user_tenant_id);
  IF v_tenant_id <> v_user_tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch for patient growth report' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    mv.month_start,
    COALESCE(mv.total_patients, 0)::bigint AS total_patients
  FROM public.mv_report_patient_growth AS mv
  WHERE mv.tenant_id = v_tenant_id
  ORDER BY mv.month_start DESC
  LIMIT COALESCE(_months, 6);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_report_patient_growth(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_patient_growth(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_report_patient_growth(integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_patient_growth(integer, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
