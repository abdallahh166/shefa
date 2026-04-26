-- Production hardening follow-up for super-admin mutations
-- 1. DB-backed idempotency for all admin mutations
-- 2. Centralized audited admin mutation helper
-- 3. Audit log consistency, global markers, and RLS/index hardening
-- 4. Job ownership, retry safety, and failure classification

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'admin_action_type'
  ) THEN
    CREATE TYPE public.admin_action_type AS ENUM (
      'tenant_create',
      'tenant_update',
      'tenant_status_update',
      'subscription_update',
      'tenant_feature_flag_update',
      'pricing_plan_create',
      'pricing_plan_update',
      'pricing_plan_delete',
      'job_retry',
      'job_retry_bulk'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_idempotency (
  key uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type public.admin_action_type NOT NULL,
  request_id uuid NULL,
  tenant_id uuid NULL REFERENCES public.tenants(id) ON DELETE SET NULL,
  resource_type text NOT NULL,
  resource_id uuid NULL,
  response_payload jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

ALTER TABLE public.admin_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to admin idempotency" ON public.admin_idempotency;
CREATE POLICY "No direct access to admin idempotency"
ON public.admin_idempotency
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- The previous migration makes audit logs immutable via trigger.
-- Temporarily remove that trigger so we can safely backfill new columns,
-- then restore it immediately after the backfill finishes.
DROP TRIGGER IF EXISTS prevent_audit_log_update ON public.audit_logs;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

UPDATE public.audit_logs
SET
  action_type = COALESCE(
    NULLIF(trim(action_type), ''),
    regexp_replace(lower(action), '[^a-z0-9]+', '_', 'g')
  ),
  is_global = tenant_id IS NULL
WHERE action_type IS NULL
   OR nullif(trim(action_type), '') IS NULL
   OR is_global IS DISTINCT FROM (tenant_id IS NULL);

ALTER TABLE public.audit_logs
  ALTER COLUMN action_type SET NOT NULL,
  ALTER COLUMN is_global SET DEFAULT false,
  ALTER COLUMN is_global SET NOT NULL;

CREATE TRIGGER prevent_audit_log_update
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_mutation();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_logs_action_type_format_ck'
      AND conrelid = 'public.audit_logs'::regclass
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_action_type_format_ck
      CHECK (action_type ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ugr_user_active
  ON public.user_global_roles (user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time
  ON public.audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_actor_time
  ON public.audit_logs (actor_id, created_at DESC);

DROP POLICY IF EXISTS "Tenant users can view tenant audit logs" ON public.audit_logs;
CREATE POLICY "Tenant users can view tenant audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND tenant_id = public.get_user_tenant_id(auth.uid())
);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS initiated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS initiated_as text NULL,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS error_code text NULL,
  ADD COLUMN IF NOT EXISTS error_class text NULL;

UPDATE public.jobs
SET initiated_as = COALESCE(NULLIF(trim(initiated_as), ''), 'system')
WHERE initiated_as IS NULL
   OR nullif(trim(initiated_as), '') IS NULL;

ALTER TABLE public.jobs
  ALTER COLUMN initiated_as SET DEFAULT 'tenant_user',
  ALTER COLUMN initiated_as SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_initiated_as_ck'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_initiated_as_ck
      CHECK (initiated_as IN ('super_admin', 'tenant_user', 'system'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_error_class_ck'
      AND conrelid = 'public.jobs'::regclass
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_error_class_ck
      CHECK (error_class IS NULL OR error_class IN ('transient', 'permanent'));
  END IF;
END $$;

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
DECLARE
  v_action_type text := COALESCE(
    NULLIF(trim(_action_type), ''),
    regexp_replace(lower(_action), '[^a-z0-9]+', '_', 'g')
  );
  v_payload jsonb := COALESCE(_details, '{}'::jsonb);
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
    metadata,
    is_global
  )
  VALUES (
    _tenant_id,
    _user_id,
    COALESCE(_user_id, auth.uid()),
    _action,
    v_action_type,
    _request_id,
    _entity_type,
    COALESCE(_resource_type, _entity_type),
    _entity_id,
    _entity_id,
    v_payload,
    v_payload,
    _tenant_id IS NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.begin_admin_idempotent_action(
  _key uuid,
  _action_type public.admin_action_type,
  _resource_type text,
  _tenant_id uuid DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
  already_processed boolean,
  response_payload jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_existing public.admin_idempotency%ROWTYPE;
  v_resource_type text := trim(_resource_type);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF _key IS NULL THEN
    RAISE EXCEPTION 'Idempotency key is required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_idempotency (
    key,
    actor_id,
    action_type,
    request_id,
    tenant_id,
    resource_type,
    resource_id
  )
  VALUES (
    _key,
    auth.uid(),
    _action_type,
    _request_id,
    _tenant_id,
    v_resource_type,
    _resource_id
  )
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    RETURN QUERY SELECT false, NULL::jsonb;
    RETURN;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.admin_idempotency ai
  WHERE ai.key = _key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin idempotency key not found after conflict' USING ERRCODE = 'P0001';
  END IF;

  IF v_existing.actor_id <> auth.uid() THEN
    RAISE EXCEPTION 'Idempotency key is bound to another actor' USING ERRCODE = '42501';
  END IF;

  IF v_existing.action_type <> _action_type
     OR v_existing.resource_type <> v_resource_type
     OR COALESCE(v_existing.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        <> COALESCE(_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  THEN
    RAISE EXCEPTION 'Idempotency key was already used for a different admin action' USING ERRCODE = 'P0001';
  END IF;

  IF v_existing.completed_at IS NULL OR v_existing.response_payload IS NULL THEN
    RAISE EXCEPTION 'Admin action for this idempotency key is still in progress' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY SELECT true, v_existing.response_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_admin_idempotent_action(
  _key uuid,
  _response_payload jsonb,
  _tenant_id uuid DEFAULT NULL,
  _resource_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.admin_idempotency
  SET
    tenant_id = COALESCE(_tenant_id, tenant_id),
    resource_id = COALESCE(_resource_id, resource_id),
    response_payload = _response_payload,
    completed_at = now()
  WHERE key = _key
    AND actor_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin idempotency key not found for actor' USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_admin_audit_event(
  _action_type public.admin_action_type,
  _action text,
  _resource_type text,
  _resource_id uuid,
  _tenant_id uuid DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

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
    metadata,
    is_global
  )
  VALUES (
    _tenant_id,
    auth.uid(),
    auth.uid(),
    _action,
    _action_type::text,
    _request_id,
    _resource_type,
    _resource_type,
    _resource_id,
    _resource_id,
    COALESCE(_metadata, '{}'::jsonb),
    COALESCE(_metadata, '{}'::jsonb),
    _tenant_id IS NULL
  );
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
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL
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
  _idempotency_key uuid DEFAULT NULL
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

CREATE OR REPLACE FUNCTION public.admin_update_tenant_status(
  _tenant_id uuid,
  _status text,
  _status_reason text DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL
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

CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  _subscription_id uuid,
  _plan text DEFAULT NULL,
  _status text DEFAULT NULL,
  _billing_cycle text DEFAULT NULL,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL
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

CREATE OR REPLACE FUNCTION public.admin_upsert_tenant_feature_flag(
  _tenant_id uuid,
  _feature_key text,
  _enabled boolean,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL
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
  _idempotency_key uuid DEFAULT NULL
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
  _idempotency_key uuid DEFAULT NULL
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

CREATE OR REPLACE FUNCTION public.admin_delete_pricing_plan(
  _plan_id uuid,
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL
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

CREATE OR REPLACE FUNCTION public.admin_retry_jobs(
  _job_ids uuid[],
  _request_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL
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

DROP FUNCTION IF EXISTS public.admin_recent_job_activity(integer, uuid);
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
  updated_at timestamptz,
  initiated_by uuid,
  initiated_as text,
  last_attempt_at timestamptz,
  error_code text,
  error_class text
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
    j.updated_at,
    j.initiated_by,
    j.initiated_as,
    j.last_attempt_at,
    j.error_code,
    j.error_class
  FROM public.jobs j
  LEFT JOIN public.tenants t ON t.id = j.tenant_id
  WHERE (
      j.status IN ('failed', 'dead_letter')
      OR j.last_error IS NOT NULL
      OR (j.attempts > 0 AND j.status IN ('pending', 'processing'))
    )
    AND (_tenant_id IS NULL OR j.tenant_id = _tenant_id)
  ORDER BY
    CASE WHEN j.status = 'dead_letter' THEN 2 WHEN j.status = 'failed' THEN 1 ELSE 0 END DESC,
    j.updated_at DESC
  LIMIT GREATEST(COALESCE(_limit, 10), 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_recent_activity(
  _limit integer DEFAULT 20,
  _tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  tenant_name text,
  actor_id uuid,
  actor_name text,
  action text,
  action_type text,
  resource_type text,
  resource_id uuid,
  request_id uuid,
  is_global boolean,
  metadata jsonb,
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
    al.id,
    al.tenant_id,
    t.name AS tenant_name,
    al.actor_id,
    p.full_name AS actor_name,
    al.action,
    al.action_type,
    COALESCE(al.resource_type, al.entity_type) AS resource_type,
    COALESCE(al.resource_id, al.entity_id) AS resource_id,
    al.request_id,
    al.is_global,
    al.metadata,
    al.created_at
  FROM public.audit_logs al
  LEFT JOIN public.tenants t ON t.id = al.tenant_id
  LEFT JOIN public.profiles p ON p.user_id = al.actor_id
  WHERE al.action_type IN (
      SELECT unnest(enum_range(NULL::public.admin_action_type))::text
    )
    AND (_tenant_id IS NULL OR al.tenant_id = _tenant_id)
  ORDER BY al.created_at DESC
  LIMIT GREATEST(COALESCE(_limit, 20), 1);
END;
$function$;
