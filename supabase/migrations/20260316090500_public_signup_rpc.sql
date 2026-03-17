-- Public signup helpers without service role usage

CREATE OR REPLACE FUNCTION public.is_tenant_slug_available(_slug text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.tenants WHERE slug = _slug
  );
$$;

CREATE OR REPLACE FUNCTION public.filter_available_tenant_slugs(_slugs text[])
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(s), '{}')
  FROM unnest(_slugs) s
  WHERE NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.slug = s);
$$;

CREATE OR REPLACE FUNCTION public.create_tenant_for_signup(
  _name text,
  _slug text,
  _owner_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
BEGIN
  INSERT INTO public.tenants (name, slug, pending_owner_email)
  VALUES (_name, _slug, _owner_email)
  RETURNING id INTO _tenant_id;

  INSERT INTO public.subscriptions (tenant_id, plan, status, amount)
  VALUES (_tenant_id, 'free', 'active', 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN _tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_tenant_signup(
  _tenant_id uuid,
  _owner_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tenants
  WHERE id = _tenant_id
    AND pending_owner_email = _owner_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_slug_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.filter_available_tenant_slugs(text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_for_signup(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_tenant_signup(uuid, text) TO anon, authenticated;
