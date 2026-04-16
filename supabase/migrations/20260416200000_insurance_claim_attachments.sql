CREATE TABLE IF NOT EXISTS public.insurance_claim_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  file_type text NOT NULL DEFAULT 'application/octet-stream',
  attachment_type text NOT NULL CHECK (attachment_type IN ('eob', 'corrected_claim', 'prior_authorization', 'eligibility', 'referral', 'payer_letter', 'other')),
  uploaded_by uuid NOT NULL,
  notes text NULL,
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claim_attachments_claim_id
  ON public.insurance_claim_attachments (claim_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_insurance_claim_attachments_tenant_id
  ON public.insurance_claim_attachments (tenant_id, created_at DESC);

ALTER TABLE public.insurance_claim_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Billing staff can view claim attachments" ON public.insurance_claim_attachments;
CREATE POLICY "Billing staff can view claim attachments"
ON public.insurance_claim_attachments
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  )
);

DROP POLICY IF EXISTS "Billing users can insert claim attachments" ON public.insurance_claim_attachments;
CREATE POLICY "Billing users can insert claim attachments"
ON public.insurance_claim_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  )
);

DROP POLICY IF EXISTS "Billing users can update claim attachments" ON public.insurance_claim_attachments;
CREATE POLICY "Billing users can update claim attachments"
ON public.insurance_claim_attachments
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  )
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('insurance-attachments', 'insurance-attachments', false)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

DROP POLICY IF EXISTS "Billing staff can read tenant insurance attachments" ON storage.objects;
CREATE POLICY "Billing staff can read tenant insurance attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'insurance-attachments'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  )
);

DROP POLICY IF EXISTS "Billing staff can upload tenant insurance attachments" ON storage.objects;
CREATE POLICY "Billing staff can upload tenant insurance attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'insurance-attachments'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  )
);

DROP POLICY IF EXISTS "Billing staff can delete tenant insurance attachments" ON storage.objects;
CREATE POLICY "Billing staff can delete tenant insurance attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'insurance-attachments'
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
  AND (
    public.has_role(auth.uid(), 'clinic_admin'::app_role)
    OR public.has_role(auth.uid(), 'accountant'::app_role)
  )
);
