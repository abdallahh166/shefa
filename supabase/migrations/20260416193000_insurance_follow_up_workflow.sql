ALTER TABLE public.insurance_claims
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS internal_notes text NULL,
  ADD COLUMN IF NOT EXISTS payer_notes text NULL,
  ADD COLUMN IF NOT EXISTS last_follow_up_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS resubmission_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'insurance_claims_assigned_to_user_id_fkey'
  ) THEN
    ALTER TABLE public.insurance_claims
      ADD CONSTRAINT insurance_claims_assigned_to_user_id_fkey
      FOREIGN KEY (assigned_to_user_id)
      REFERENCES public.profiles (user_id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.insurance_claims
  DROP CONSTRAINT IF EXISTS insurance_claims_resubmission_count_check;

ALTER TABLE public.insurance_claims
  ADD CONSTRAINT insurance_claims_resubmission_count_check
  CHECK (resubmission_count >= 0);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_assigned_to_user_id
  ON public.insurance_claims (tenant_id, assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_next_follow_up_at
  ON public.insurance_claims (tenant_id, next_follow_up_at);

DROP FUNCTION IF EXISTS public.get_insurance_operations_summary();

CREATE FUNCTION public.get_insurance_operations_summary()
RETURNS TABLE (
  open_claims_count bigint,
  aged_0_7_count bigint,
  aged_8_14_count bigint,
  aged_15_plus_count bigint,
  oldest_open_claim_days integer,
  denied_follow_up_count bigint,
  follow_up_due_count bigint,
  unassigned_open_count bigint,
  stalled_processing_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped_claims AS (
    SELECT
      status,
      assigned_to_user_id,
      next_follow_up_at,
      processing_started_at,
      GREATEST(
        0,
        CURRENT_DATE - COALESCE(submitted_at::date, claim_date)
      )::int AS age_days
    FROM public.insurance_claims
    WHERE tenant_id = public.get_user_tenant_id(auth.uid())
      AND deleted_at IS NULL
  ),
  open_claims AS (
    SELECT *
    FROM scoped_claims
    WHERE status IN ('submitted', 'processing', 'approved')
  )
  SELECT
    COUNT(*)::bigint AS open_claims_count,
    COUNT(*) FILTER (WHERE age_days BETWEEN 0 AND 7)::bigint AS aged_0_7_count,
    COUNT(*) FILTER (WHERE age_days BETWEEN 8 AND 14)::bigint AS aged_8_14_count,
    COUNT(*) FILTER (WHERE age_days >= 15)::bigint AS aged_15_plus_count,
    COALESCE(MAX(age_days), 0)::int AS oldest_open_claim_days,
    (SELECT COUNT(*)::bigint FROM scoped_claims WHERE status = 'denied') AS denied_follow_up_count,
    (SELECT COUNT(*)::bigint FROM scoped_claims WHERE status <> 'reimbursed' AND next_follow_up_at IS NOT NULL AND next_follow_up_at <= NOW()) AS follow_up_due_count,
    COUNT(*) FILTER (WHERE assigned_to_user_id IS NULL)::bigint AS unassigned_open_count,
    COUNT(*) FILTER (WHERE status = 'processing' AND processing_started_at IS NOT NULL AND processing_started_at <= NOW() - INTERVAL '7 days')::bigint AS stalled_processing_count
  FROM open_claims;
$$;
