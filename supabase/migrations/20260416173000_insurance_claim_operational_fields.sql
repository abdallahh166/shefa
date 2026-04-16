ALTER TABLE public.insurance_claims
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS denial_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_insurance_claims_processing_started_at
  ON public.insurance_claims (tenant_id, processing_started_at);
