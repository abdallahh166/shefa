CREATE OR REPLACE FUNCTION public.admin_stop_tenant_impersonation(
  _request_id uuid,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  request_id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  target_tenant_id uuid,
  target_tenant_name text,
  target_tenant_slug text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_session public.admin_impersonation_sessions%ROWTYPE;
  v_target public.tenants%ROWTYPE;
  v_ended_at timestamptz := now();
BEGIN
  PERFORM public.assert_super_admin_context(true, false);

  SELECT *
  INTO v_session
  FROM public.admin_impersonation_sessions AS session_row
  WHERE session_row.request_id = _request_id
    AND session_row.actor_id = auth.uid()
    AND session_row.ended_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active impersonation session found for this actor' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    'tenant_impersonation_end',
    v_session.target_tenant_id,
    v_session.target_tenant_id
  );

  SELECT *
  INTO v_target
  FROM public.tenants
  WHERE id = v_session.target_tenant_id;

  UPDATE public.admin_impersonation_sessions AS session_row
  SET ended_at = v_ended_at
  WHERE session_row.request_id = v_session.request_id
    AND session_row.actor_id = auth.uid()
    AND session_row.ended_at IS NULL;

  PERFORM public.log_audit_event(
    v_session.target_tenant_id,
    auth.uid(),
    'tenant_impersonation_ended',
    'tenant',
    v_session.target_tenant_id,
    jsonb_build_object(
      'actor_id', auth.uid(),
      'role_tier', 'super_admin',
      'target_tenant_id', v_session.target_tenant_id,
      'target_tenant_slug', v_target.slug,
      'target_tenant_name', v_target.name,
      'started_at', v_session.started_at,
      'ended_at', v_ended_at,
      'duration_seconds', GREATEST(0, floor(extract(epoch from (v_ended_at - v_session.started_at)))::integer)
    ),
    v_session.request_id,
    'tenant_impersonation_end',
    'tenant'
  );

  RETURN QUERY
  SELECT
    v_session.request_id,
    v_session.started_at,
    v_ended_at,
    GREATEST(0, floor(extract(epoch from (v_ended_at - v_session.started_at)))::integer),
    v_target.id,
    v_target.name,
    v_target.slug;
END;
$function$;
