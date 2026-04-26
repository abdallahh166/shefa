CREATE TABLE IF NOT EXISTS public.invoice_email_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider TEXT NULL,
  provider_message_id TEXT NULL,
  requested_by_user_id UUID NULL,
  last_attempt_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  error_message TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_email_delivery_log_invoice_email
  ON public.invoice_email_delivery_log (invoice_id, recipient_email);

CREATE INDEX IF NOT EXISTS idx_invoice_email_delivery_log_tenant_status
  ON public.invoice_email_delivery_log (tenant_id, status, updated_at DESC);

DROP TRIGGER IF EXISTS update_invoice_email_delivery_log_updated_at ON public.invoice_email_delivery_log;
CREATE TRIGGER update_invoice_email_delivery_log_updated_at
BEFORE UPDATE ON public.invoice_email_delivery_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.invoice_email_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to invoice email delivery log" ON public.invoice_email_delivery_log;
CREATE POLICY "No direct access to invoice email delivery log"
ON public.invoice_email_delivery_log
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
