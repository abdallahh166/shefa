CREATE OR REPLACE FUNCTION public.get_insurance_operations_summary()
RETURNS TABLE (
  open_claims_count bigint,
  aged_0_7_count bigint,
  aged_8_14_count bigint,
  aged_15_plus_count bigint,
  oldest_open_claim_days integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH open_claims AS (
    SELECT
      GREATEST(
        0,
        CURRENT_DATE - COALESCE(submitted_at::date, claim_date)
      )::int AS age_days
    FROM public.insurance_claims
    WHERE tenant_id = public.get_user_tenant_id(auth.uid())
      AND deleted_at IS NULL
      AND status IN ('submitted', 'processing', 'approved')
  )
  SELECT
    COUNT(*)::bigint AS open_claims_count,
    COUNT(*) FILTER (WHERE age_days BETWEEN 0 AND 7)::bigint AS aged_0_7_count,
    COUNT(*) FILTER (WHERE age_days BETWEEN 8 AND 14)::bigint AS aged_8_14_count,
    COUNT(*) FILTER (WHERE age_days >= 15)::bigint AS aged_15_plus_count,
    COALESCE(MAX(age_days), 0)::int AS oldest_open_claim_days
  FROM open_claims;
$$;
