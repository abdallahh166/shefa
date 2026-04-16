ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('paid', 'pending', 'overdue', 'partially_paid', 'void'));

UPDATE public.invoices
SET
  amount_paid = CASE
    WHEN status = 'paid' THEN amount
    ELSE 0
  END,
  balance_due = CASE
    WHEN status = 'paid' THEN 0
    ELSE amount
  END,
  paid_at = CASE
    WHEN status = 'paid' AND paid_at IS NULL THEN updated_at
    ELSE paid_at
  END
WHERE amount_paid IS NULL
   OR balance_due IS NULL
   OR (status = 'paid' AND paid_at IS NULL);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'mobile_wallet', 'insurance', 'other')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Billing staff can view invoice payments" ON public.invoice_payments;
CREATE POLICY "Billing staff can view invoice payments"
  ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Billing users can create invoice payments" ON public.invoice_payments;
CREATE POLICY "Billing users can create invoice payments"
  ON public.invoice_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'clinic_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'accountant'::public.app_role)
    )
  );

CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_invoice
  ON public.invoice_payments (tenant_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_paid_at
  ON public.invoice_payments (tenant_id, paid_at DESC);

CREATE OR REPLACE FUNCTION public.get_invoice_summary()
RETURNS TABLE (
  total_count bigint,
  paid_count bigint,
  paid_amount numeric,
  pending_amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE status <> 'void')::bigint AS total_count,
    COUNT(*) FILTER (WHERE status = 'paid')::bigint AS paid_count,
    COALESCE(SUM(amount_paid) FILTER (WHERE status <> 'void'), 0) AS paid_amount,
    COALESCE(SUM(balance_due) FILTER (WHERE status IN ('pending', 'overdue', 'partially_paid')), 0) AS pending_amount
  FROM public.invoices
  WHERE tenant_id = public.get_user_tenant_id(auth.uid())
    AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_report_overview()
RETURNS TABLE (
  total_revenue numeric,
  total_patients bigint,
  total_appointments bigint,
  avg_doctor_rating numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT SUM(ip.amount)
      FROM public.invoice_payments ip
      WHERE ip.tenant_id = public.get_user_tenant_id(auth.uid())
    ), 0) AS total_revenue,
    COALESCE((
      SELECT COUNT(*)
      FROM public.patients p
      WHERE p.tenant_id = public.get_user_tenant_id(auth.uid())
    ), 0)::bigint AS total_patients,
    COALESCE((
      SELECT COUNT(*)
      FROM public.appointments a
      WHERE a.tenant_id = public.get_user_tenant_id(auth.uid())
    ), 0)::bigint AS total_appointments,
    COALESCE((
      SELECT AVG(COALESCE(d.rating, 0))
      FROM public.doctors d
      WHERE d.tenant_id = public.get_user_tenant_id(auth.uid())
    ), 0) AS avg_doctor_rating;
$$;

CREATE OR REPLACE FUNCTION public.get_report_revenue_by_month(_months integer DEFAULT 6)
RETURNS TABLE (
  month_start date,
  revenue numeric,
  expenses numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH revenue AS (
    SELECT
      date_trunc('month', ip.paid_at)::date AS month_start,
      COALESCE(SUM(ip.amount), 0) AS revenue
    FROM public.invoice_payments ip
    WHERE ip.tenant_id = public.get_user_tenant_id(auth.uid())
    GROUP BY 1
  ),
  outstanding AS (
    SELECT
      date_trunc('month', i.invoice_date)::date AS month_start,
      COALESCE(SUM(i.balance_due), 0) AS expenses
    FROM public.invoices i
    WHERE i.tenant_id = public.get_user_tenant_id(auth.uid())
      AND i.status IN ('pending', 'overdue', 'partially_paid')
      AND i.deleted_at IS NULL
    GROUP BY 1
  ),
  combined AS (
    SELECT
      COALESCE(revenue.month_start, outstanding.month_start) AS month_start,
      COALESCE(revenue.revenue, 0) AS revenue,
      COALESCE(outstanding.expenses, 0) AS expenses
    FROM revenue
    FULL OUTER JOIN outstanding USING (month_start)
  )
  SELECT month_start, revenue, expenses
  FROM combined
  ORDER BY month_start DESC
  LIMIT COALESCE(_months, 6);
$$;

CREATE OR REPLACE FUNCTION public.get_report_revenue_by_service(_limit integer DEFAULT 6)
RETURNS TABLE (
  service text,
  revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(i.service, ''), 'Other') AS service,
    COALESCE(SUM(ip.amount), 0) AS revenue
  FROM public.invoice_payments ip
  INNER JOIN public.invoices i
    ON i.id = ip.invoice_id
  WHERE ip.tenant_id = public.get_user_tenant_id(auth.uid())
    AND i.deleted_at IS NULL
  GROUP BY 1
  ORDER BY revenue DESC
  LIMIT COALESCE(_limit, 6);
$$;
