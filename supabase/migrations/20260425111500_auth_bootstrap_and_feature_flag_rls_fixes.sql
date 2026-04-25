-- Fix three production issues uncovered by live E2E runs:
-- 1. patient_accounts needs an explicit unique constraint on patient_id for handle_new_user().
-- 2. super_admin must be able to manage feature flags across tenant boundaries.
-- 3. suspended/deactivated staff still need enough auth bootstrap visibility to reach the blocked screen.

-- Keep only one patient_account row per patient before adding the unique constraint.
WITH ranked_accounts AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY patient_id
      ORDER BY
        (auth_user_id IS NOT NULL) DESC,
        (status = 'active') DESC,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS row_rank
  FROM public.patient_accounts
)
DELETE FROM public.patient_accounts pa
USING ranked_accounts ranked
WHERE pa.ctid = ranked.ctid
  AND ranked.row_rank > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'patient_accounts_patient_id_key'
      AND conrelid = 'public.patient_accounts'::regclass
  ) THEN
    ALTER TABLE public.patient_accounts
      ADD CONSTRAINT patient_accounts_patient_id_key UNIQUE (patient_id);
  END IF;
END
$$;

-- Allow auth bootstrap to resolve a suspended/deactivated user's own tenant and profile.
DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
CREATE POLICY "Users can view own tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id = public.get_user_tenant_id(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id = tenants.id
  )
);

DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
CREATE POLICY "Users can view profiles in their tenant"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR tenant_id = public.get_user_tenant_id(auth.uid())
);

-- Split tenant-scoped and platform-scoped feature-flag access cleanly.
DROP POLICY IF EXISTS "Tenant users can view feature flags" ON public.feature_flags;
CREATE POLICY "Tenant users can view feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Clinic admins can manage feature flags" ON public.feature_flags;
CREATE POLICY "Clinic admins can manage feature flags"
ON public.feature_flags
FOR ALL
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_role(auth.uid(), 'clinic_admin'::app_role)
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_role(auth.uid(), 'clinic_admin'::app_role)
);

DROP POLICY IF EXISTS "Super admins can view all feature flags" ON public.feature_flags;
CREATE POLICY "Super admins can view all feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can manage all feature flags" ON public.feature_flags;
CREATE POLICY "Super admins can manage all feature flags"
ON public.feature_flags
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
