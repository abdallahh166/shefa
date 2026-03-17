-- Integration API keys for external systems
CREATE TABLE IF NOT EXISTS public.integration_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL
);

ALTER TABLE public.integration_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic admins can manage integration api keys" ON public.integration_api_keys;
CREATE POLICY "Clinic admins can manage integration api keys"
ON public.integration_api_keys
FOR ALL TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_api_keys_tenant_name
ON public.integration_api_keys (tenant_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_api_keys_hash
ON public.integration_api_keys (tenant_id, key_hash);

CREATE OR REPLACE FUNCTION public.create_integration_api_key(
  _name text,
  _scopes text[] DEFAULT '{}'::text[]
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _key text;
BEGIN
  _tenant_id := public.get_user_tenant_id(auth.uid());
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant not found for API key creation';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized to create API keys';
  END IF;

  _key := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.integration_api_keys (tenant_id, name, key_hash, scopes)
  VALUES (
    _tenant_id,
    _name,
    encode(digest(_key, 'sha256'), 'hex'),
    COALESCE(_scopes, '{}'::text[])
  );

  RETURN _key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_integration_api_key(text, text[]) TO authenticated;
