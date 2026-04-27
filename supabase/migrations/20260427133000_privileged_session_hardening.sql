-- Privileged session hardening
-- 1. Single-use step-up grants for sensitive privileged actions
-- 2. Clinic-admin MFA/session enforcement helpers
-- 3. Server-side impersonation session binding
-- 4. Sensitive admin RPCs now require scoped step-up grants

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'privileged_role_tier'
  ) THEN
    CREATE TYPE public.privileged_role_tier AS ENUM ('super_admin', 'clinic_admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.privileged_step_up_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_tier public.privileged_role_tier NOT NULL,
  action_key text NOT NULL,
  tenant_id uuid NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
  resource_id uuid NULL,
  session_id text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  request_id uuid NULL,
  CONSTRAINT privileged_step_up_grants_action_key_ck
    CHECK (action_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$')
);

ALTER TABLE public.privileged_step_up_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to privileged step-up grants" ON public.privileged_step_up_grants;
CREATE POLICY "No direct access to privileged step-up grants"
ON public.privileged_step_up_grants
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_privileged_step_up_grants_actor_active
  ON public.privileged_step_up_grants (actor_id, action_key, expires_at DESC)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.admin_impersonation_sessions (
  request_id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_tier public.privileged_role_tier NOT NULL DEFAULT 'super_admin',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL
);

ALTER TABLE public.admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to admin impersonation sessions" ON public.admin_impersonation_sessions;
CREATE POLICY "No direct access to admin impersonation sessions"
ON public.admin_impersonation_sessions
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_impersonation_one_active_per_actor
  ON public.admin_impersonation_sessions (actor_id)
  WHERE ended_at IS NULL;

CREATE OR REPLACE FUNCTION public.current_jwt_session_id()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT NULLIF(trim(COALESCE(auth.jwt() ->> 'session_id', '')), '');
$function$;

CREATE OR REPLACE FUNCTION public.current_password_auth_time()
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_amr jsonb := COALESCE(auth.jwt() -> 'amr', '[]'::jsonb);
  v_timestamp bigint;
BEGIN
  IF jsonb_typeof(v_amr) <> 'array' THEN
    RETURN NULL;
  END IF;

  SELECT MAX((entry ->> 'timestamp')::bigint)
  INTO v_timestamp
  FROM jsonb_array_elements(v_amr) AS entry
  WHERE jsonb_typeof(entry) = 'object'
    AND entry ? 'method'
    AND entry ? 'timestamp'
    AND entry ->> 'method' = 'password';

  IF v_timestamp IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN to_timestamp(v_timestamp);
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_recent_password_auth(_max_age_seconds integer DEFAULT 300)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_authenticated_at timestamptz := public.current_password_auth_time();
BEGIN
  IF v_authenticated_at IS NULL THEN
    RAISE EXCEPTION 'Recent password authentication is required for this action' USING ERRCODE = '42501';
  END IF;

  IF v_authenticated_at < now() - make_interval(secs => GREATEST(COALESCE(_max_age_seconds, 300), 60)) THEN
    RAISE EXCEPTION 'Recent password authentication is required for this action' USING ERRCODE = '42501';
  END IF;

  RETURN v_authenticated_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_clinic_admin_context(
  _tenant_id uuid DEFAULT NULL,
  _require_mfa boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'clinic_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only clinic admins can access this action' USING ERRCODE = '42501';
  END IF;

  v_tenant_id := public.get_user_tenant_id(auth.uid());
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Clinic admin tenant context is required' USING ERRCODE = '42501';
  END IF;

  IF _tenant_id IS NOT NULL AND v_tenant_id <> _tenant_id THEN
    RAISE EXCEPTION 'Clinic admin actions are tenant-scoped' USING ERRCODE = '42501';
  END IF;

  IF _require_mfa AND public.current_authenticator_assurance_level() <> 'aal2' THEN
    RAISE EXCEPTION 'Clinic admin MFA is required for this action' USING ERRCODE = '42501';
  END IF;

  RETURN v_tenant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.issue_privileged_step_up_grant(
  _role_tier public.privileged_role_tier,
  _action_key text,
  _tenant_id uuid DEFAULT NULL,
  _resource_id uuid DEFAULT NULL,
  _request_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_grant_id uuid;
  v_session_id text := public.current_jwt_session_id();
  v_password_auth_at timestamptz;
  v_effective_tenant_id uuid := _tenant_id;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(trim(COALESCE(_action_key, '')), '') IS NULL
     OR _action_key !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  THEN
    RAISE EXCEPTION 'A normalized action key is required' USING ERRCODE = 'P0001';
  END IF;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'A session-bound privileged grant cannot be issued without a session id' USING ERRCODE = '42501';
  END IF;

  CASE _role_tier
    WHEN 'super_admin' THEN
      PERFORM public.assert_super_admin_context(true, false);
    WHEN 'clinic_admin' THEN
      v_effective_tenant_id := public.assert_clinic_admin_context(_tenant_id, true);
    ELSE
      RAISE EXCEPTION 'Unsupported privileged role tier' USING ERRCODE = 'P0001';
  END CASE;

  v_password_auth_at := public.assert_recent_password_auth(300);

  INSERT INTO public.privileged_step_up_grants (
    actor_id,
    role_tier,
    action_key,
    tenant_id,
    resource_id,
    session_id,
    expires_at,
    request_id
  )
  VALUES (
    auth.uid(),
    _role_tier,
    trim(_action_key),
    v_effective_tenant_id,
    _resource_id,
    v_session_id,
    now() + interval '5 minutes',
    _request_id
  )
  RETURNING id INTO v_grant_id;

  PERFORM public.log_audit_event(
    v_effective_tenant_id,
    auth.uid(),
    'privileged_step_up_issued',
    'privileged_step_up_grant',
    v_grant_id,
    jsonb_build_object(
      'role_tier', _role_tier::text,
      'action_key', trim(_action_key),
      'tenant_id', v_effective_tenant_id,
      'resource_id', _resource_id,
      'password_authenticated_at', v_password_auth_at
    ),
    _request_id,
    'privileged_step_up_issued',
    'privileged_step_up_grant'
  );

  RETURN v_grant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_privileged_step_up_grant(
  _grant_id uuid,
  _role_tier public.privileged_role_tier,
  _action_key text,
  _tenant_id uuid DEFAULT NULL,
  _resource_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_grant_id uuid;
  v_session_id text := public.current_jwt_session_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF _grant_id IS NULL OR v_session_id IS NULL THEN
    RAISE EXCEPTION 'Valid privileged step-up grant required for this action' USING ERRCODE = '42501';
  END IF;

  UPDATE public.privileged_step_up_grants
  SET consumed_at = now()
  WHERE id = _grant_id
    AND actor_id = auth.uid()
    AND role_tier = _role_tier
    AND action_key = trim(_action_key)
    AND session_id = v_session_id
    AND consumed_at IS NULL
    AND expires_at > now()
    AND COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = COALESCE(_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = COALESCE(_resource_id, '00000000-0000-0000-0000-000000000000'::uuid)
  RETURNING id INTO v_grant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Valid privileged step-up grant required for this action' USING ERRCODE = '42501';
  END IF;

  RETURN v_grant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_privileged_step_up_grant_for_actor(
  _actor_id uuid,
  _session_id text,
  _grant_id uuid,
  _role_tier public.privileged_role_tier,
  _action_key text,
  _tenant_id uuid DEFAULT NULL,
  _resource_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_grant_id uuid;
BEGIN
  IF _actor_id IS NULL
     OR NULLIF(trim(COALESCE(_session_id, '')), '') IS NULL
     OR _grant_id IS NULL
  THEN
    RAISE EXCEPTION 'Valid privileged step-up grant required for this action' USING ERRCODE = '42501';
  END IF;

  UPDATE public.privileged_step_up_grants
  SET consumed_at = now()
  WHERE id = _grant_id
    AND actor_id = _actor_id
    AND role_tier = _role_tier
    AND action_key = trim(_action_key)
    AND session_id = trim(_session_id)
    AND consumed_at IS NULL
    AND expires_at > now()
    AND COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = COALESCE(_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = COALESCE(_resource_id, '00000000-0000-0000-0000-000000000000'::uuid)
  RETURNING id INTO v_grant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Valid privileged step-up grant required for this action' USING ERRCODE = '42501';
  END IF;

  RETURN v_grant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_start_tenant_impersonation(
  _target_tenant_id uuid,
  _request_id uuid DEFAULT NULL,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  request_id uuid,
  started_at timestamptz,
  target_tenant_id uuid,
  target_tenant_name text,
  target_tenant_slug text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request_id uuid := COALESCE(_request_id, gen_random_uuid());
  v_started_at timestamptz := now();
  v_target public.tenants%ROWTYPE;
BEGIN
  PERFORM public.assert_super_admin_context(true, false);
  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    'tenant_impersonation_start',
    _target_tenant_id,
    _target_tenant_id
  );

  SELECT *
  INTO v_target
  FROM public.tenants
  WHERE id = _target_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'PGRST116';
  END IF;

  BEGIN
    INSERT INTO public.admin_impersonation_sessions (
      request_id,
      actor_id,
      target_tenant_id,
      role_tier,
      started_at
    )
    VALUES (
      v_request_id,
      auth.uid(),
      _target_tenant_id,
      'super_admin'::public.privileged_role_tier,
      v_started_at
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Only one active impersonation session is allowed per actor' USING ERRCODE = 'P0001';
  END;

  PERFORM public.log_audit_event(
    _target_tenant_id,
    auth.uid(),
    'tenant_impersonation_started',
    'tenant',
    _target_tenant_id,
    jsonb_build_object(
      'actor_id', auth.uid(),
      'role_tier', 'super_admin',
      'target_tenant_id', _target_tenant_id,
      'target_tenant_slug', v_target.slug,
      'target_tenant_name', v_target.name,
      'started_at', v_started_at
    ),
    v_request_id,
    'tenant_impersonation_start',
    'tenant'
  );

  RETURN QUERY
  SELECT
    v_request_id,
    v_started_at,
    v_target.id,
    v_target.name,
    v_target.slug;
END;
$function$;

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
  FROM public.admin_impersonation_sessions
  WHERE request_id = _request_id
    AND actor_id = auth.uid()
    AND ended_at IS NULL
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

  UPDATE public.admin_impersonation_sessions
  SET ended_at = v_ended_at
  WHERE request_id = v_session.request_id
    AND actor_id = auth.uid()
    AND ended_at IS NULL;

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

DROP FUNCTION IF EXISTS public.admin_create_tenant(text, text, text, text, text, text, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  _name text,
  _slug text,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _pending_owner_email text DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_guard record;
  v_tenant_id uuid;
BEGIN
  PERFORM public.assert_super_admin_context(true, false);
  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    'tenant_create',
    NULL,
    NULL
  );

  SELECT *
  INTO v_guard
  FROM public.begin_admin_idempotent_action(
    _idempotency_key,
    'tenant_create'::public.admin_action_type,
    'tenant',
    NULL,
    _request_id
  );

  IF v_guard.already_processed THEN
    RETURN (v_guard.response_payload ->> 'tenant_id')::uuid;
  END IF;

  PERFORM public.assert_super_admin_rate_limit('tenant_create', 5, 3600);

  INSERT INTO public.tenants (
    name,
    slug,
    email,
    phone,
    address,
    pending_owner_email,
    status,
    status_reason,
    status_changed_at
  )
  VALUES (
    trim(_name),
    trim(_slug),
    nullif(trim(coalesce(_email, '')), ''),
    nullif(trim(coalesce(_phone, '')), ''),
    nullif(trim(coalesce(_address, '')), ''),
    nullif(trim(coalesce(_pending_owner_email, '')), ''),
    'active',
    null,
    now()
  )
  RETURNING id INTO v_tenant_id;

  PERFORM public.log_admin_audit_event(
    'tenant_create'::public.admin_action_type,
    'admin_tenant_created',
    'tenant',
    v_tenant_id,
    v_tenant_id,
    _request_id,
    jsonb_build_object(
      'name', trim(_name),
      'slug', trim(_slug),
      'reason', nullif(trim(coalesce(_reason, '')), '')
    )
  );

  PERFORM public.complete_admin_idempotent_action(
    _idempotency_key,
    jsonb_build_object('tenant_id', v_tenant_id),
    v_tenant_id,
    v_tenant_id
  );

  RETURN v_tenant_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_update_tenant(uuid, text, text, text, text, text, text, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.admin_update_tenant(
  _tenant_id uuid,
  _name text DEFAULT NULL,
  _slug text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _pending_owner_email text DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_guard record;
BEGIN
  PERFORM public.assert_super_admin_context(true, false);
  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    'tenant_update',
    _tenant_id,
    _tenant_id
  );

  SELECT *
  INTO v_guard
  FROM public.begin_admin_idempotent_action(
    _idempotency_key,
    'tenant_update'::public.admin_action_type,
    'tenant',
    _tenant_id,
    _request_id,
    _tenant_id
  );

  IF v_guard.already_processed THEN
    RETURN (v_guard.response_payload ->> 'tenant_id')::uuid;
  END IF;

  PERFORM public.assert_super_admin_rate_limit('tenant_update', 20, 3600);

  UPDATE public.tenants
  SET
    name = COALESCE(_name, name),
    slug = COALESCE(_slug, slug),
    email = COALESCE(_email, email),
    phone = COALESCE(_phone, phone),
    address = COALESCE(_address, address),
    pending_owner_email = COALESCE(_pending_owner_email, pending_owner_email)
  WHERE id = _tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'PGRST116';
  END IF;

  PERFORM public.log_admin_audit_event(
    'tenant_update'::public.admin_action_type,
    'admin_tenant_updated',
    'tenant',
    _tenant_id,
    _tenant_id,
    _request_id,
    jsonb_build_object(
      'changes', jsonb_strip_nulls(jsonb_build_object(
        'name', _name,
        'slug', _slug,
        'email', _email,
        'phone', _phone,
        'address', _address,
        'pending_owner_email', _pending_owner_email
      )),
      'reason', nullif(trim(coalesce(_reason, '')), '')
    )
  );

  PERFORM public.complete_admin_idempotent_action(
    _idempotency_key,
    jsonb_build_object('tenant_id', _tenant_id),
    _tenant_id,
    _tenant_id
  );

  RETURN _tenant_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_update_tenant_status(uuid, text, text, uuid, uuid);
CREATE OR REPLACE FUNCTION public.admin_update_tenant_status(
  _tenant_id uuid,
  _status text,
  _status_reason text DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_guard record;
  v_previous_status text;
BEGIN
  PERFORM public.assert_super_admin_context(true, false);
  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    'tenant_status_update',
    _tenant_id,
    _tenant_id
  );

  SELECT *
  INTO v_guard
  FROM public.begin_admin_idempotent_action(
    _idempotency_key,
    'tenant_status_update'::public.admin_action_type,
    'tenant',
    _tenant_id,
    _request_id,
    _tenant_id
  );

  IF v_guard.already_processed THEN
    RETURN (v_guard.response_payload ->> 'tenant_id')::uuid;
  END IF;

  PERFORM public.assert_super_admin_rate_limit('tenant_lifecycle', 15, 3600);

  SELECT status
  INTO v_previous_status
  FROM public.tenants
  WHERE id = _tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found' USING ERRCODE = 'PGRST116';
  END IF;

  UPDATE public.tenants
  SET
    status = _status,
    status_reason = nullif(trim(coalesce(_status_reason, '')), ''),
    status_changed_at = now()
  WHERE id = _tenant_id;

  PERFORM public.log_admin_audit_event(
    'tenant_status_update'::public.admin_action_type,
    'admin_tenant_status_updated',
    'tenant',
    _tenant_id,
    _tenant_id,
    _request_id,
    jsonb_build_object(
      'previous_status', v_previous_status,
      'next_status', _status,
      'status_reason', nullif(trim(coalesce(_status_reason, '')), ''),
      'impact', CASE
        WHEN _status = 'suspended' THEN 'This will suspend all users in this tenant.'
        WHEN _status = 'deactivated' THEN 'This will deactivate all users in this tenant.'
        ELSE 'This will restore tenant access.'
      END
    )
  );

  PERFORM public.complete_admin_idempotent_action(
    _idempotency_key,
    jsonb_build_object('tenant_id', _tenant_id),
    _tenant_id,
    _tenant_id
  );

  RETURN _tenant_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_update_subscription(uuid, text, text, text, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  _subscription_id uuid,
  _plan text DEFAULT NULL,
  _status text DEFAULT NULL,
  _billing_cycle text DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_guard record;
  v_row public.subscriptions%ROWTYPE;
BEGIN
  PERFORM public.assert_super_admin_context(true, false);
  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    'subscription_update',
    NULL,
    _subscription_id
  );

  SELECT *
  INTO v_guard
  FROM public.begin_admin_idempotent_action(
    _idempotency_key,
    'subscription_update'::public.admin_action_type,
    'subscription',
    NULL,
    _request_id,
    _subscription_id
  );

  IF v_guard.already_processed THEN
    RETURN (v_guard.response_payload ->> 'subscription_id')::uuid;
  END IF;

  PERFORM public.assert_super_admin_rate_limit('subscription_update', 20, 3600);

  SELECT *
  INTO v_row
  FROM public.subscriptions
  WHERE id = _subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found' USING ERRCODE = 'PGRST116';
  END IF;

  UPDATE public.subscriptions
  SET
    plan = COALESCE(_plan, plan),
    status = COALESCE(_status, status),
    billing_cycle = COALESCE(_billing_cycle, billing_cycle)
  WHERE id = _subscription_id;

  PERFORM public.log_admin_audit_event(
    'subscription_update'::public.admin_action_type,
    'admin_subscription_updated',
    'subscription',
    _subscription_id,
    v_row.tenant_id,
    _request_id,
    jsonb_build_object(
      'previous', jsonb_build_object(
        'plan', v_row.plan,
        'status', v_row.status,
        'billing_cycle', v_row.billing_cycle,
        'amount', v_row.amount,
        'currency', v_row.currency
      ),
      'changes', jsonb_strip_nulls(jsonb_build_object(
        'plan', _plan,
        'status', _status,
        'billing_cycle', _billing_cycle
      )),
      'reason', nullif(trim(coalesce(_reason, '')), '')
    )
  );

  PERFORM public.complete_admin_idempotent_action(
    _idempotency_key,
    jsonb_build_object('subscription_id', _subscription_id),
    v_row.tenant_id,
    _subscription_id
  );

  RETURN _subscription_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_upsert_tenant_feature_flag(uuid, text, boolean, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.admin_upsert_tenant_feature_flag(
  _tenant_id uuid,
  _feature_key text,
  _enabled boolean,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_guard record;
  v_flag_id uuid;
BEGIN
  PERFORM public.assert_super_admin_context(true, false);
  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    'tenant_feature_flag_update',
    _tenant_id,
    NULL
  );

  SELECT *
  INTO v_guard
  FROM public.begin_admin_idempotent_action(
    _idempotency_key,
    'tenant_feature_flag_update'::public.admin_action_type,
    'feature_flag',
    _tenant_id,
    _request_id
  );

  IF v_guard.already_processed THEN
    RETURN (v_guard.response_payload ->> 'feature_flag_id')::uuid;
  END IF;

  PERFORM public.assert_super_admin_rate_limit('tenant_feature_flag_update', 30, 3600);

  INSERT INTO public.feature_flags (tenant_id, feature_key, enabled)
  VALUES (_tenant_id, _feature_key, _enabled)
  ON CONFLICT (tenant_id, feature_key) DO UPDATE
  SET enabled = EXCLUDED.enabled
  RETURNING id INTO v_flag_id;

  PERFORM public.log_admin_audit_event(
    'tenant_feature_flag_update'::public.admin_action_type,
    'admin_tenant_feature_flag_updated',
    'feature_flag',
    v_flag_id,
    _tenant_id,
    _request_id,
    jsonb_build_object(
      'feature_key', _feature_key,
      'enabled', _enabled,
      'reason', nullif(trim(coalesce(_reason, '')), '')
    )
  );

  PERFORM public.complete_admin_idempotent_action(
    _idempotency_key,
    jsonb_build_object('feature_flag_id', v_flag_id),
    _tenant_id,
    v_flag_id
  );

  RETURN v_flag_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_create_pricing_plan(text, text, text, text, jsonb, numeric, numeric, text, text, boolean, boolean, boolean, integer, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.admin_create_pricing_plan(
  _plan_code text,
  _name text,
  _description text,
  _doctor_limit_label text,
  _features jsonb,
  _monthly_price numeric,
  _annual_price numeric,
  _currency text,
  _default_billing_cycle text,
  _is_popular boolean,
  _is_public boolean,
  _is_enterprise_contact boolean,
  _display_order integer,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_guard record;
  v_plan_id uuid;
BEGIN
  PERFORM public.assert_super_admin_context(true, false);
  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    'pricing_plan_create',
    NULL,
    NULL
  );

  SELECT *
  INTO v_guard
  FROM public.begin_admin_idempotent_action(
    _idempotency_key,
    'pricing_plan_create'::public.admin_action_type,
    'pricing_plan',
    NULL,
    _request_id
  );

  IF v_guard.already_processed THEN
    RETURN (v_guard.response_payload ->> 'plan_id')::uuid;
  END IF;

  PERFORM public.assert_super_admin_rate_limit('pricing_plan_create', 10, 3600);

  INSERT INTO public.pricing_plans (
    plan_code,
    name,
    description,
    doctor_limit_label,
    features,
    monthly_price,
    annual_price,
    currency,
    default_billing_cycle,
    is_popular,
    is_public,
    is_enterprise_contact,
    display_order
  )
  VALUES (
    _plan_code,
    _name,
    _description,
    _doctor_limit_label,
    COALESCE(_features, '[]'::jsonb),
    _monthly_price,
    _annual_price,
    _currency,
    _default_billing_cycle,
    COALESCE(_is_popular, false),
    COALESCE(_is_public, true),
    COALESCE(_is_enterprise_contact, false),
    COALESCE(_display_order, 0)
  )
  RETURNING id INTO v_plan_id;

  PERFORM public.log_admin_audit_event(
    'pricing_plan_create'::public.admin_action_type,
    'admin_pricing_plan_created',
    'pricing_plan',
    v_plan_id,
    NULL,
    _request_id,
    jsonb_build_object(
      'plan_code', _plan_code,
      'reason', nullif(trim(coalesce(_reason, '')), '')
    )
  );

  PERFORM public.complete_admin_idempotent_action(
    _idempotency_key,
    jsonb_build_object('plan_id', v_plan_id),
    NULL,
    v_plan_id
  );

  RETURN v_plan_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_update_pricing_plan(uuid, text, text, text, jsonb, numeric, numeric, text, text, boolean, boolean, boolean, integer, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.admin_update_pricing_plan(
  _plan_id uuid,
  _name text DEFAULT NULL,
  _description text DEFAULT NULL,
  _doctor_limit_label text DEFAULT NULL,
  _features jsonb DEFAULT NULL,
  _monthly_price numeric DEFAULT NULL,
  _annual_price numeric DEFAULT NULL,
  _currency text DEFAULT NULL,
  _default_billing_cycle text DEFAULT NULL,
  _is_popular boolean DEFAULT NULL,
  _is_public boolean DEFAULT NULL,
  _is_enterprise_contact boolean DEFAULT NULL,
  _display_order integer DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_guard record;
BEGIN
  PERFORM public.assert_super_admin_context(true, false);
  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    'pricing_plan_update',
    NULL,
    _plan_id
  );

  SELECT *
  INTO v_guard
  FROM public.begin_admin_idempotent_action(
    _idempotency_key,
    'pricing_plan_update'::public.admin_action_type,
    'pricing_plan',
    NULL,
    _request_id,
    _plan_id
  );

  IF v_guard.already_processed THEN
    RETURN (v_guard.response_payload ->> 'plan_id')::uuid;
  END IF;

  PERFORM public.assert_super_admin_rate_limit('pricing_plan_update', 20, 3600);

  UPDATE public.pricing_plans
  SET
    name = COALESCE(_name, name),
    description = COALESCE(_description, description),
    doctor_limit_label = COALESCE(_doctor_limit_label, doctor_limit_label),
    features = COALESCE(_features, features),
    monthly_price = COALESCE(_monthly_price, monthly_price),
    annual_price = COALESCE(_annual_price, annual_price),
    currency = COALESCE(_currency, currency),
    default_billing_cycle = COALESCE(_default_billing_cycle, default_billing_cycle),
    is_popular = COALESCE(_is_popular, is_popular),
    is_public = COALESCE(_is_public, is_public),
    is_enterprise_contact = COALESCE(_is_enterprise_contact, is_enterprise_contact),
    display_order = COALESCE(_display_order, display_order)
  WHERE id = _plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing plan not found' USING ERRCODE = 'PGRST116';
  END IF;

  PERFORM public.log_admin_audit_event(
    'pricing_plan_update'::public.admin_action_type,
    'admin_pricing_plan_updated',
    'pricing_plan',
    _plan_id,
    NULL,
    _request_id,
    jsonb_build_object(
      'changes', jsonb_strip_nulls(jsonb_build_object(
        'name', _name,
        'description', _description,
        'doctor_limit_label', _doctor_limit_label,
        'features', _features,
        'monthly_price', _monthly_price,
        'annual_price', _annual_price,
        'currency', _currency,
        'default_billing_cycle', _default_billing_cycle,
        'is_popular', _is_popular,
        'is_public', _is_public,
        'is_enterprise_contact', _is_enterprise_contact,
        'display_order', _display_order
      )),
      'reason', nullif(trim(coalesce(_reason, '')), '')
    )
  );

  PERFORM public.complete_admin_idempotent_action(
    _idempotency_key,
    jsonb_build_object('plan_id', _plan_id),
    NULL,
    _plan_id
  );

  RETURN _plan_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_delete_pricing_plan(uuid, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.admin_delete_pricing_plan(
  _plan_id uuid,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_guard record;
BEGIN
  PERFORM public.assert_super_admin_context(true, false);
  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    'pricing_plan_delete',
    NULL,
    _plan_id
  );

  SELECT *
  INTO v_guard
  FROM public.begin_admin_idempotent_action(
    _idempotency_key,
    'pricing_plan_delete'::public.admin_action_type,
    'pricing_plan',
    NULL,
    _request_id,
    _plan_id
  );

  IF v_guard.already_processed THEN
    RETURN (v_guard.response_payload ->> 'plan_id')::uuid;
  END IF;

  PERFORM public.assert_super_admin_rate_limit('pricing_plan_delete', 10, 3600);

  UPDATE public.pricing_plans
  SET deleted_at = now()
  WHERE id = _plan_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing plan not found' USING ERRCODE = 'PGRST116';
  END IF;

  PERFORM public.log_admin_audit_event(
    'pricing_plan_delete'::public.admin_action_type,
    'admin_pricing_plan_deleted',
    'pricing_plan',
    _plan_id,
    NULL,
    _request_id,
    jsonb_build_object(
      'reason', nullif(trim(coalesce(_reason, '')), '')
    )
  );

  PERFORM public.complete_admin_idempotent_action(
    _idempotency_key,
    jsonb_build_object('plan_id', _plan_id),
    NULL,
    _plan_id
  );

  RETURN _plan_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_retry_jobs(uuid[], uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.admin_retry_jobs(
  _job_ids uuid[],
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _step_up_grant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  status text,
  attempts integer,
  run_at timestamptz,
  updated_at timestamptz,
  initiated_by uuid,
  initiated_as text,
  last_attempt_at timestamptz,
  error_code text,
  error_class text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_guard record;
  v_now timestamptz := now();
  v_job_ids uuid[] := COALESCE(_job_ids, ARRAY[]::uuid[]);
  v_action_type public.admin_action_type;
  v_response jsonb;
BEGIN
  PERFORM public.assert_super_admin_context(true, false);

  IF array_length(v_job_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one job is required' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.consume_privileged_step_up_grant(
    _step_up_grant_id,
    'super_admin'::public.privileged_role_tier,
    CASE WHEN array_length(v_job_ids, 1) > 1 THEN 'job_retry_bulk' ELSE 'job_retry' END,
    NULL,
    COALESCE(v_job_ids[1], NULL)
  );

  IF array_length(v_job_ids, 1) > 25 THEN
    RAISE EXCEPTION 'Bulk retry is limited to 25 jobs per request' USING ERRCODE = 'P0001';
  END IF;

  v_action_type := CASE
    WHEN array_length(v_job_ids, 1) > 1 THEN 'job_retry_bulk'::public.admin_action_type
    ELSE 'job_retry'::public.admin_action_type
  END;

  SELECT *
  INTO v_guard
  FROM public.begin_admin_idempotent_action(
    _idempotency_key,
    v_action_type,
    'job',
    NULL,
    _request_id,
    COALESCE(v_job_ids[1], NULL)
  );

  IF v_guard.already_processed THEN
    RETURN QUERY
    SELECT *
    FROM jsonb_to_recordset(COALESCE(v_guard.response_payload, '[]'::jsonb)) AS replay(
      id uuid,
      tenant_id uuid,
      status text,
      attempts integer,
      run_at timestamptz,
      updated_at timestamptz,
      initiated_by uuid,
      initiated_as text,
      last_attempt_at timestamptz,
      error_code text,
      error_class text
    );
    RETURN;
  END IF;

  PERFORM public.assert_super_admin_rate_limit(
    CASE WHEN array_length(v_job_ids, 1) > 1 THEN 'job_retry_bulk' ELSE 'job_retry' END,
    CASE WHEN array_length(v_job_ids, 1) > 1 THEN 5 ELSE 20 END,
    300
  );

  WITH updated_jobs AS (
    UPDATE public.jobs j
    SET
      attempts = CASE
        WHEN COALESCE(j.max_attempts, 1) > 1 THEN LEAST(COALESCE(j.attempts, 0), j.max_attempts - 1)
        ELSE 0
      END,
      status = 'pending',
      locked_at = NULL,
      locked_by = NULL,
      last_error = NULL,
      run_at = v_now,
      next_attempt_at = NULL,
      updated_at = v_now,
      initiated_by = auth.uid(),
      initiated_as = 'super_admin',
      error_code = NULL,
      error_class = NULL
    WHERE j.id = ANY(v_job_ids)
      AND j.status IN ('failed', 'dead_letter')
    RETURNING
      j.id,
      j.tenant_id,
      j.status,
      j.attempts,
      j.run_at,
      j.updated_at,
      j.initiated_by,
      j.initiated_as,
      j.last_attempt_at,
      j.error_code,
      j.error_class
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(updated_jobs)), '[]'::jsonb)
  INTO v_response
  FROM updated_jobs;

  PERFORM public.log_admin_audit_event(
    v_action_type,
    CASE
      WHEN array_length(v_job_ids, 1) > 1 THEN 'admin_jobs_bulk_retried'
      ELSE 'admin_job_retried'
    END,
    'job',
    COALESCE(v_job_ids[1], NULL),
    NULL,
    _request_id,
    jsonb_build_object(
      'job_ids', v_job_ids,
      'job_count', array_length(v_job_ids, 1),
      'reason', nullif(trim(coalesce(_reason, '')), '')
    )
  );

  PERFORM public.complete_admin_idempotent_action(
    _idempotency_key,
    COALESCE(v_response, '[]'::jsonb),
    NULL,
    COALESCE(v_job_ids[1], NULL)
  );

  RETURN QUERY
  SELECT *
  FROM jsonb_to_recordset(COALESCE(v_response, '[]'::jsonb)) AS rows(
    id uuid,
    tenant_id uuid,
    status text,
    attempts integer,
    run_at timestamptz,
    updated_at timestamptz,
    initiated_by uuid,
    initiated_as text,
    last_attempt_at timestamptz,
    error_code text,
    error_class text
  );
END;
$function$;
