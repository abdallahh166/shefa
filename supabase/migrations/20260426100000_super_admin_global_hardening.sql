-- Production hardening for global super-admin access
-- 1. Separate global roles from tenant-scoped user_roles
-- 2. Make super-admin profiles tenant-neutral
-- 3. Harden audit logging for global actions
-- 4. Provide MFA-aware, audited admin RPCs for sensitive operations
-- 5. Add tenant usage and safe job retry primitives for the admin panel

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'global_app_role'
  ) THEN
    CREATE TYPE public.global_app_role AS ENUM ('super_admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_global_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.global_app_role NOT NULL,
  granted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  is_break_glass boolean NOT NULL DEFAULT false,
  break_glass_reason text NULL,
  review_due_at timestamptz NULL,
  requires_mfa boolean NOT NULL DEFAULT true,
  CONSTRAINT user_global_roles_unique UNIQUE (user_id, role),
  CONSTRAINT user_global_roles_break_glass_reason_ck
    CHECK (NOT is_break_glass OR nullif(trim(coalesce(break_glass_reason, '')), '') IS NOT NULL)
);

ALTER TABLE public.user_global_roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ALTER COLUMN tenant_id DROP NOT NULL;

INSERT INTO public.user_global_roles (
  user_id,
  role,
  granted_at,
  review_due_at,
  requires_mfa
)
SELECT
  ur.user_id,
  'super_admin'::public.global_app_role,
  now(),
  now() + interval '90 days',
  true
FROM public.user_roles ur
WHERE ur.role = 'super_admin'::public.app_role
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles p
SET tenant_id = NULL
WHERE EXISTS (
  SELECT 1
  FROM public.user_global_roles ugr
  WHERE ugr.user_id = p.user_id
    AND ugr.role = 'super_admin'::public.global_app_role
    AND ugr.revoked_at IS NULL
);

DELETE FROM public.user_roles
WHERE role = 'super_admin'::public.app_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_no_super_admin_ck'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_no_super_admin_ck
      CHECK (role <> 'super_admin'::public.app_role);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_global_role(_user_id uuid, _role public.global_app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_global_roles
    WHERE user_id = _user_id
      AND role = _role
      AND revoked_at IS NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.has_global_role(_user_id, 'super_admin'::public.global_app_role);
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN _role = 'super_admin'::public.app_role THEN public.is_super_admin(_user_id)
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
  END;
$function$;

DROP POLICY IF EXISTS "Super admins can view global roles" ON public.user_global_roles;
CREATE POLICY "Super admins can view global roles"
ON public.user_global_roles
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "No direct writes to global roles" ON public.user_global_roles;
CREATE POLICY "No direct writes to global roles"
ON public.user_global_roles
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Super admins can view all audit logs" ON public.audit_logs;

ALTER TABLE public.audit_logs
  ALTER COLUMN tenant_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS actor_id uuid NULL,
  ADD COLUMN IF NOT EXISTS resource_id uuid NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NULL;

UPDATE public.audit_logs
SET
  actor_id = COALESCE(actor_id, user_id),
  resource_id = COALESCE(resource_id, entity_id),
  metadata = COALESCE(metadata, details, '{}'::jsonb);

ALTER TABLE public.audit_logs
  ALTER COLUMN actor_id SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time
  ON public.audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id
  ON public.audit_logs (request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON public.audit_logs (resource_type, resource_id);

CREATE POLICY "Super admins can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable' USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS prevent_audit_log_update ON public.audit_logs;
CREATE TRIGGER prevent_audit_log_update
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _tenant_id uuid,
  _user_id uuid,
  _action text,
  _entity_type text,
  _entity_id uuid,
  _details jsonb DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _action_type text DEFAULT NULL,
  _resource_type text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    actor_id,
    action,
    action_type,
    request_id,
    entity_type,
    resource_type,
    entity_id,
    resource_id,
    details,
    metadata
  )
  VALUES (
    _tenant_id,
    _user_id,
    _user_id,
    _action,
    _action_type,
    _request_id,
    _entity_type,
    COALESCE(_resource_type, _entity_type),
    _entity_id,
    _entity_id,
    COALESCE(_details, '{}'::jsonb),
    COALESCE(_details, '{}'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_authenticator_assurance_level()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(auth.jwt() ->> 'aal', 'aal1');
$function$;

CREATE OR REPLACE FUNCTION public.assert_super_admin_context(
  _require_mfa boolean DEFAULT true,
  _require_break_glass_reason boolean DEFAULT false
)
RETURNS public.user_global_roles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role public.user_global_roles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_role
  FROM public.user_global_roles
  WHERE user_id = auth.uid()
    AND role = 'super_admin'::public.global_app_role
    AND revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only super admins can access admin operations' USING ERRCODE = '42501';
  END IF;

  IF _require_mfa AND v_role.requires_mfa AND public.current_authenticator_assurance_level() <> 'aal2' THEN
    RAISE EXCEPTION 'Super admin MFA is required for this action' USING ERRCODE = '42501';
  END IF;

  IF _require_break_glass_reason AND v_role.is_break_glass AND nullif(trim(coalesce(v_role.break_glass_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Break-glass access requires a recorded reason' USING ERRCODE = '42501';
  END IF;

  RETURN v_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_super_admin_rate_limit(
  _action text,
  _max_hits integer,
  _window_seconds integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_allowed boolean;
BEGIN
  v_allowed := public.check_rate_limit(
    format('super_admin:%s:%s', auth.uid(), lower(coalesce(_action, 'action'))),
    GREATEST(COALESCE(_max_hits, 1), 1),
    GREATEST(COALESCE(_window_seconds, 1), 1)
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Too many admin actions. Please wait before retrying.' USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  _name text,
  _slug text,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _pending_owner_email text DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor public.user_global_roles%ROWTYPE;
  v_tenant_id uuid;
BEGIN
  v_actor := public.assert_super_admin_context(true, false);
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

  PERFORM public.log_audit_event(
    v_tenant_id,
    auth.uid(),
    'admin_tenant_created',
    'tenant',
    v_tenant_id,
    jsonb_build_object(
      'name', trim(_name),
      'slug', trim(_slug),
      'reason', nullif(trim(coalesce(_reason, '')), ''),
      'break_glass', v_actor.is_break_glass
    ),
    _request_id,
    'tenant_create',
    'tenant'
  );

  RETURN v_tenant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_tenant(
  _tenant_id uuid,
  _name text DEFAULT NULL,
  _slug text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _pending_owner_email text DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor public.user_global_roles%ROWTYPE;
BEGIN
  v_actor := public.assert_super_admin_context(true, false);
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

  PERFORM public.log_audit_event(
    _tenant_id,
    auth.uid(),
    'admin_tenant_updated',
    'tenant',
    _tenant_id,
    jsonb_build_object(
      'changes', jsonb_strip_nulls(jsonb_build_object(
        'name', _name,
        'slug', _slug,
        'email', _email,
        'phone', _phone,
        'address', _address,
        'pending_owner_email', _pending_owner_email
      )),
      'reason', nullif(trim(coalesce(_reason, '')), ''),
      'break_glass', v_actor.is_break_glass
    ),
    _request_id,
    'tenant_update',
    'tenant'
  );

  RETURN _tenant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_tenant_status(
  _tenant_id uuid,
  _status text,
  _status_reason text DEFAULT NULL,
  _request_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor public.user_global_roles%ROWTYPE;
  v_previous_status text;
BEGIN
  v_actor := public.assert_super_admin_context(true, false);
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

  PERFORM public.log_audit_event(
    _tenant_id,
    auth.uid(),
    'admin_tenant_status_updated',
    'tenant',
    _tenant_id,
    jsonb_build_object(
      'previous_status', v_previous_status,
      'next_status', _status,
      'status_reason', nullif(trim(coalesce(_status_reason, '')), ''),
      'impact', CASE
        WHEN _status = 'suspended' THEN 'This will suspend all users in this tenant.'
        WHEN _status = 'deactivated' THEN 'This will deactivate all users in this tenant.'
        ELSE 'This will restore tenant access.'
      END,
      'break_glass', v_actor.is_break_glass
    ),
    _request_id,
    'tenant_status_update',
    'tenant'
  );

  RETURN _tenant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  _subscription_id uuid,
  _plan text DEFAULT NULL,
  _status text DEFAULT NULL,
  _billing_cycle text DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor public.user_global_roles%ROWTYPE;
  v_row public.subscriptions%ROWTYPE;
BEGIN
  v_actor := public.assert_super_admin_context(true, false);
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

  PERFORM public.log_audit_event(
    v_row.tenant_id,
    auth.uid(),
    'admin_subscription_updated',
    'subscription',
    _subscription_id,
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
      'reason', nullif(trim(coalesce(_reason, '')), ''),
      'break_glass', v_actor.is_break_glass
    ),
    _request_id,
    'subscription_update',
    'subscription'
  );

  RETURN _subscription_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_upsert_tenant_feature_flag(
  _tenant_id uuid,
  _feature_key text,
  _enabled boolean,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor public.user_global_roles%ROWTYPE;
  v_flag_id uuid;
BEGIN
  v_actor := public.assert_super_admin_context(true, false);
  PERFORM public.assert_super_admin_rate_limit('tenant_feature_flag_update', 30, 3600);

  INSERT INTO public.feature_flags (tenant_id, feature_key, enabled)
  VALUES (_tenant_id, _feature_key, _enabled)
  ON CONFLICT (tenant_id, feature_key) DO UPDATE
  SET enabled = EXCLUDED.enabled
  RETURNING id INTO v_flag_id;

  PERFORM public.log_audit_event(
    _tenant_id,
    auth.uid(),
    'admin_tenant_feature_flag_updated',
    'feature_flag',
    v_flag_id,
    jsonb_build_object(
      'feature_key', _feature_key,
      'enabled', _enabled,
      'reason', nullif(trim(coalesce(_reason, '')), ''),
      'break_glass', v_actor.is_break_glass
    ),
    _request_id,
    'tenant_feature_flag_update',
    'feature_flag'
  );

  RETURN v_flag_id;
END;
$function$;

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
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor public.user_global_roles%ROWTYPE;
  v_plan_id uuid;
BEGIN
  v_actor := public.assert_super_admin_context(true, false);
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

  PERFORM public.log_audit_event(
    NULL,
    auth.uid(),
    'admin_pricing_plan_created',
    'pricing_plan',
    v_plan_id,
    jsonb_build_object(
      'plan_code', _plan_code,
      'reason', nullif(trim(coalesce(_reason, '')), ''),
      'break_glass', v_actor.is_break_glass
    ),
    _request_id,
    'pricing_plan_create',
    'pricing_plan'
  );

  RETURN v_plan_id;
END;
$function$;

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
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor public.user_global_roles%ROWTYPE;
BEGIN
  v_actor := public.assert_super_admin_context(true, false);
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

  PERFORM public.log_audit_event(
    NULL,
    auth.uid(),
    'admin_pricing_plan_updated',
    'pricing_plan',
    _plan_id,
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
      'reason', nullif(trim(coalesce(_reason, '')), ''),
      'break_glass', v_actor.is_break_glass
    ),
    _request_id,
    'pricing_plan_update',
    'pricing_plan'
  );

  RETURN _plan_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_pricing_plan(
  _plan_id uuid,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor public.user_global_roles%ROWTYPE;
BEGIN
  v_actor := public.assert_super_admin_context(true, false);
  PERFORM public.assert_super_admin_rate_limit('pricing_plan_delete', 10, 3600);

  UPDATE public.pricing_plans
  SET deleted_at = now()
  WHERE id = _plan_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing plan not found' USING ERRCODE = 'PGRST116';
  END IF;

  PERFORM public.log_audit_event(
    NULL,
    auth.uid(),
    'admin_pricing_plan_deleted',
    'pricing_plan',
    _plan_id,
    jsonb_build_object(
      'reason', nullif(trim(coalesce(_reason, '')), ''),
      'break_glass', v_actor.is_break_glass
    ),
    _request_id,
    'pricing_plan_delete',
    'pricing_plan'
  );

  RETURN _plan_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_retry_jobs(
  _job_ids uuid[],
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  status text,
  attempts integer,
  run_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor public.user_global_roles%ROWTYPE;
  v_now timestamptz := now();
  v_job_ids uuid[] := COALESCE(_job_ids, ARRAY[]::uuid[]);
BEGIN
  v_actor := public.assert_super_admin_context(true, false);

  IF array_length(v_job_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one job is required' USING ERRCODE = 'P0001';
  END IF;

  IF array_length(v_job_ids, 1) > 25 THEN
    RAISE EXCEPTION 'Bulk retry is limited to 25 jobs per request' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_super_admin_rate_limit(
    CASE WHEN array_length(v_job_ids, 1) > 1 THEN 'job_retry_bulk' ELSE 'job_retry' END,
    CASE WHEN array_length(v_job_ids, 1) > 1 THEN 5 ELSE 20 END,
    300
  );

  RETURN QUERY
  WITH updated_jobs AS (
    UPDATE public.jobs j
    SET
      status = 'pending',
      locked_at = NULL,
      locked_by = NULL,
      last_error = NULL,
      run_at = v_now,
      next_attempt_at = NULL,
      updated_at = v_now
    WHERE j.id = ANY(v_job_ids)
      AND j.status IN ('failed', 'dead_letter')
    RETURNING j.id, j.tenant_id, j.status, j.attempts, j.run_at, j.updated_at
  )
  SELECT *
  FROM updated_jobs;

  PERFORM public.log_audit_event(
    NULL,
    auth.uid(),
    CASE WHEN array_length(v_job_ids, 1) > 1 THEN 'admin_jobs_bulk_retried' ELSE 'admin_job_retried' END,
    'job',
    COALESCE(v_job_ids[1], NULL),
    jsonb_build_object(
      'job_ids', v_job_ids,
      'job_count', array_length(v_job_ids, 1),
      'reason', nullif(trim(coalesce(_reason, '')), ''),
      'break_glass', v_actor.is_break_glass
    ),
    _request_id,
    CASE WHEN array_length(v_job_ids, 1) > 1 THEN 'job_retry_bulk' ELSE 'job_retry' END,
    'job'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_tenant_usage_summary(_tenant_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  patients_count bigint,
  staff_count bigint,
  storage_bytes bigint,
  api_requests_30d bigint,
  jobs_pending_count bigint,
  jobs_failed_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.assert_super_admin_context(true, false);

  RETURN QUERY
  SELECT
    _tenant_id,
    (SELECT COUNT(*)::bigint FROM public.patients p WHERE p.tenant_id = _tenant_id),
    (SELECT COUNT(*)::bigint FROM public.profiles pr WHERE pr.tenant_id = _tenant_id),
    (
      COALESCE((SELECT SUM(file_size)::bigint FROM public.patient_documents pd WHERE pd.tenant_id = _tenant_id), 0)
      + COALESCE((SELECT SUM(file_size)::bigint FROM public.insurance_claim_attachments ia WHERE ia.tenant_id = _tenant_id), 0)
    )::bigint,
    (
      SELECT COUNT(*)::bigint
      FROM public.system_logs sl
      WHERE sl.tenant_id = _tenant_id
        AND sl.service = 'integration-api'
        AND sl.message = 'integration_api_access'
        AND sl.created_at >= now() - interval '30 days'
    ),
    (SELECT COUNT(*)::bigint FROM public.jobs j WHERE j.tenant_id = _tenant_id AND j.status = 'pending'),
    (SELECT COUNT(*)::bigint FROM public.jobs j WHERE j.tenant_id = _tenant_id AND j.status IN ('failed', 'dead_letter'));
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_recent_job_activity(integer);
CREATE OR REPLACE FUNCTION public.admin_recent_job_activity(
  _limit integer DEFAULT 10,
  _tenant_id uuid DEFAULT NULL
)
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
  PERFORM public.assert_super_admin_context(true, false);

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
  WHERE (
      j.status IN ('failed', 'dead_letter')
      OR j.last_error IS NOT NULL
      OR (j.attempts > 0 AND j.status IN ('pending', 'processing'))
    )
    AND (_tenant_id IS NULL OR j.tenant_id = _tenant_id)
  ORDER BY j.updated_at DESC
  LIMIT GREATEST(COALESCE(_limit, 10), 1);
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_recent_system_errors(integer);
CREATE OR REPLACE FUNCTION public.admin_recent_system_errors(
  _limit integer DEFAULT 10,
  _tenant_id uuid DEFAULT NULL
)
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
  PERFORM public.assert_super_admin_context(true, false);

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
    AND (_tenant_id IS NULL OR l.tenant_id = _tenant_id)
  ORDER BY l.created_at DESC
  LIMIT GREATEST(COALESCE(_limit, 10), 1);
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_operations_alert_summary();
CREATE OR REPLACE FUNCTION public.admin_operations_alert_summary(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  pending_jobs_count bigint,
  processing_jobs_count bigint,
  retrying_jobs_count bigint,
  dead_letter_jobs_count bigint,
  stale_processing_jobs_count bigint,
  recent_job_failures_count bigint,
  recent_edge_failures_count bigint,
  recent_client_errors_count bigint,
  last_job_failure_at timestamptz,
  last_edge_failure_at timestamptz,
  last_client_error_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.assert_super_admin_context(true, false);

  RETURN QUERY
  WITH job_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending_jobs_count,
      COUNT(*) FILTER (WHERE status = 'processing')::bigint AS processing_jobs_count,
      COUNT(*) FILTER (WHERE attempts > 0 AND status IN ('pending', 'processing'))::bigint AS retrying_jobs_count,
      COUNT(*) FILTER (WHERE status = 'dead_letter')::bigint AS dead_letter_jobs_count,
      COUNT(*) FILTER (
        WHERE status = 'processing'
          AND (locked_at IS NULL OR locked_at < now() - interval '15 minutes')
      )::bigint AS stale_processing_jobs_count
    FROM public.jobs
    WHERE _tenant_id IS NULL OR tenant_id = _tenant_id
  ),
  job_failures AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= now() - interval '15 minutes')::bigint AS recent_job_failures_count,
      MAX(created_at) AS last_job_failure_at
    FROM public.system_logs
    WHERE level = 'error'
      AND service = 'job-worker'
      AND (_tenant_id IS NULL OR tenant_id = _tenant_id)
  ),
  edge_failures AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= now() - interval '15 minutes')::bigint AS recent_edge_failures_count,
      MAX(created_at) AS last_edge_failure_at
    FROM public.system_logs
    WHERE level = 'error'
      AND service <> 'job-worker'
      AND (_tenant_id IS NULL OR tenant_id = _tenant_id)
  ),
  client_failures AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= now() - interval '15 minutes')::bigint AS recent_client_errors_count,
      MAX(created_at) AS last_client_error_at
    FROM public.client_error_logs
    WHERE _tenant_id IS NULL OR tenant_id = _tenant_id
  )
  SELECT
    job_counts.pending_jobs_count,
    job_counts.processing_jobs_count,
    job_counts.retrying_jobs_count,
    job_counts.dead_letter_jobs_count,
    job_counts.stale_processing_jobs_count,
    job_failures.recent_job_failures_count,
    edge_failures.recent_edge_failures_count,
    client_failures.recent_client_errors_count,
    job_failures.last_job_failure_at,
    edge_failures.last_edge_failure_at,
    client_failures.last_client_error_at
  FROM job_counts, job_failures, edge_failures, client_failures;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_client_error_trend(integer, integer);
CREATE OR REPLACE FUNCTION public.admin_client_error_trend(
  _bucket_minutes integer DEFAULT 15,
  _bucket_count integer DEFAULT 6,
  _tenant_id uuid DEFAULT NULL
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
  PERFORM public.assert_super_admin_context(true, false);

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
   AND (_tenant_id IS NULL OR c.tenant_id = _tenant_id)
  GROUP BY b.bucket_start
  ORDER BY b.bucket_start ASC;
END;
$function$;
