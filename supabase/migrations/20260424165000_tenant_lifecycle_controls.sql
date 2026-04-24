ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text NULL,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_status_check'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_status_check
      CHECK (status IN ('active', 'suspended', 'deactivated'));
  END IF;
END
$$;

UPDATE public.tenants
SET
  status = COALESCE(NULLIF(status, ''), 'active'),
  status_reason = status_reason,
  status_changed_at = COALESCE(status_changed_at, updated_at, created_at, timezone('utc', now()));

CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants (status);

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.tenant_id
  FROM public.profiles p
  INNER JOIN public.tenants t ON t.id = p.tenant_id
  WHERE p.user_id = _user_id
    AND t.status = 'active'
  LIMIT 1
$$;
