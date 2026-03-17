-- Expand insurance claims lifecycle

ALTER TABLE public.insurance_claims
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reimbursed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS payer_reference text NULL;

ALTER TABLE public.insurance_claims
  DROP CONSTRAINT IF EXISTS insurance_claims_status_check;

ALTER TABLE public.insurance_claims
  ADD CONSTRAINT insurance_claims_status_check
  CHECK (status IN ('draft', 'submitted', 'processing', 'approved', 'denied', 'reimbursed'));

ALTER TABLE public.insurance_claims
  ALTER COLUMN status SET DEFAULT 'draft';

-- Update insurance summary helper
DROP FUNCTION IF EXISTS public.get_insurance_summary();
CREATE OR REPLACE FUNCTION public.get_insurance_summary()
RETURNS TABLE (
  total_count bigint,
  draft_count bigint,
  submitted_count bigint,
  processing_count bigint,
  approved_count bigint,
  denied_count bigint,
  reimbursed_count bigint,
  providers_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total_count,
    COUNT(*) FILTER (WHERE status = 'draft')::bigint AS draft_count,
    COUNT(*) FILTER (WHERE status = 'submitted')::bigint AS submitted_count,
    COUNT(*) FILTER (WHERE status = 'processing')::bigint AS processing_count,
    COUNT(*) FILTER (WHERE status = 'approved')::bigint AS approved_count,
    COUNT(*) FILTER (WHERE status = 'denied')::bigint AS denied_count,
    COUNT(*) FILTER (WHERE status = 'reimbursed')::bigint AS reimbursed_count,
    COUNT(DISTINCT NULLIF(provider, ''))::bigint AS providers_count
  FROM public.insurance_claims
  WHERE tenant_id = public.get_user_tenant_id(auth.uid());
$$;
