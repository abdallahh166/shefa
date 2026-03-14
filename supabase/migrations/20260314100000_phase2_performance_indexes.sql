-- Phase 2 performance indexes for common tenant-scoped filters
CREATE INDEX IF NOT EXISTS idx_patients_tenant_created_active
  ON public.patients (tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status_date
  ON public.appointments (tenant_id, status, appointment_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_doctor_status_date
  ON public.appointments (tenant_id, doctor_id, status, appointment_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status_date
  ON public.invoices (tenant_id, status, invoice_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lab_orders_tenant_status_date
  ON public.lab_orders (tenant_id, status, order_date)
  WHERE deleted_at IS NULL;
