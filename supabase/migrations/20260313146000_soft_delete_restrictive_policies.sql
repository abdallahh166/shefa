-- Enforce soft-delete visibility via restrictive SELECT policies
DO $$
BEGIN
  -- Patients
  EXECUTE 'DROP POLICY IF EXISTS "Exclude deleted records" ON public.patients';
  EXECUTE 'CREATE POLICY "Exclude deleted records" ON public.patients AS RESTRICTIVE FOR SELECT USING (deleted_at IS NULL)';

  -- Doctors
  EXECUTE 'DROP POLICY IF EXISTS "Exclude deleted records" ON public.doctors';
  EXECUTE 'CREATE POLICY "Exclude deleted records" ON public.doctors AS RESTRICTIVE FOR SELECT USING (deleted_at IS NULL)';

  -- Appointments
  EXECUTE 'DROP POLICY IF EXISTS "Exclude deleted records" ON public.appointments';
  EXECUTE 'CREATE POLICY "Exclude deleted records" ON public.appointments AS RESTRICTIVE FOR SELECT USING (deleted_at IS NULL)';

  -- Prescriptions
  EXECUTE 'DROP POLICY IF EXISTS "Exclude deleted records" ON public.prescriptions';
  EXECUTE 'CREATE POLICY "Exclude deleted records" ON public.prescriptions AS RESTRICTIVE FOR SELECT USING (deleted_at IS NULL)';

  -- Lab orders
  EXECUTE 'DROP POLICY IF EXISTS "Exclude deleted records" ON public.lab_orders';
  EXECUTE 'CREATE POLICY "Exclude deleted records" ON public.lab_orders AS RESTRICTIVE FOR SELECT USING (deleted_at IS NULL)';

  -- Invoices
  EXECUTE 'DROP POLICY IF EXISTS "Exclude deleted records" ON public.invoices';
  EXECUTE 'CREATE POLICY "Exclude deleted records" ON public.invoices AS RESTRICTIVE FOR SELECT USING (deleted_at IS NULL)';

  -- Insurance claims
  EXECUTE 'DROP POLICY IF EXISTS "Exclude deleted records" ON public.insurance_claims';
  EXECUTE 'CREATE POLICY "Exclude deleted records" ON public.insurance_claims AS RESTRICTIVE FOR SELECT USING (deleted_at IS NULL)';

  -- Patient documents
  EXECUTE 'DROP POLICY IF EXISTS "Exclude deleted records" ON public.patient_documents';
  EXECUTE 'CREATE POLICY "Exclude deleted records" ON public.patient_documents AS RESTRICTIVE FOR SELECT USING (deleted_at IS NULL)';
END $$;
