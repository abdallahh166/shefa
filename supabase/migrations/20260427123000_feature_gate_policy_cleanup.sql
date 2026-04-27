-- Clean up legacy policy overlap that bypasses subscription entitlement gating.
-- 1. Remove the pre-entitlement medications read policy.
-- 2. Add the doctor/date appointment index expected by architecture validation.

DROP POLICY IF EXISTS "Tenant users can view medications" ON public.medications;

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
  ON public.appointments (doctor_id, appointment_date);
