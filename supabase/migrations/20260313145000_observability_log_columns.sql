-- Extend audit logs with request and action metadata
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS request_id uuid NULL,
  ADD COLUMN IF NOT EXISTS action_type text NULL,
  ADD COLUMN IF NOT EXISTS resource_type text NULL;

-- Extend client error logs with request and action metadata
ALTER TABLE public.client_error_logs
  ADD COLUMN IF NOT EXISTS request_id uuid NULL,
  ADD COLUMN IF NOT EXISTS action_type text NULL,
  ADD COLUMN IF NOT EXISTS resource_type text NULL;

-- Update audit log function to accept optional metadata
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
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    action,
    action_type,
    request_id,
    entity_type,
    resource_type,
    entity_id,
    details
  )
  VALUES (
    _tenant_id,
    _user_id,
    _action,
    _action_type,
    _request_id,
    _entity_type,
    _resource_type,
    _entity_id,
    _details
  );
END;
$$;
