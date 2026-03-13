-- Super admin access policies for cross-tenant operations

-- Core data tables
DO $$
BEGIN
  -- Patients
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all patients" ON public.patients';
  EXECUTE 'CREATE POLICY "Super admins can manage all patients" ON public.patients FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Doctors
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all doctors" ON public.doctors';
  EXECUTE 'CREATE POLICY "Super admins can manage all doctors" ON public.doctors FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Doctor schedules
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all doctor schedules" ON public.doctor_schedules';
  EXECUTE 'CREATE POLICY "Super admins can manage all doctor schedules" ON public.doctor_schedules FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Appointments
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all appointments" ON public.appointments';
  EXECUTE 'CREATE POLICY "Super admins can manage all appointments" ON public.appointments FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Medical records
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all medical records" ON public.medical_records';
  EXECUTE 'CREATE POLICY "Super admins can manage all medical records" ON public.medical_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Prescriptions
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all prescriptions" ON public.prescriptions';
  EXECUTE 'CREATE POLICY "Super admins can manage all prescriptions" ON public.prescriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Lab orders
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all lab orders" ON public.lab_orders';
  EXECUTE 'CREATE POLICY "Super admins can manage all lab orders" ON public.lab_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Invoices
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all invoices" ON public.invoices';
  EXECUTE 'CREATE POLICY "Super admins can manage all invoices" ON public.invoices FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Insurance claims
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all insurance claims" ON public.insurance_claims';
  EXECUTE 'CREATE POLICY "Super admins can manage all insurance claims" ON public.insurance_claims FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Patient documents (table)
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all patient documents" ON public.patient_documents';
  EXECUTE 'CREATE POLICY "Super admins can manage all patient documents" ON public.patient_documents FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Medications
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all medications" ON public.medications';
  EXECUTE 'CREATE POLICY "Super admins can manage all medications" ON public.medications FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Notifications
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all notifications" ON public.notifications';
  EXECUTE 'CREATE POLICY "Super admins can manage all notifications" ON public.notifications FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';

  -- Notification preferences
  EXECUTE 'DROP POLICY IF EXISTS "Super admins can manage all notification preferences" ON public.notification_preferences';
  EXECUTE 'CREATE POLICY "Super admins can manage all notification preferences" ON public.notification_preferences FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''super_admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''super_admin''::app_role))';
END $$;

-- Storage objects (limit to known buckets)
DROP POLICY IF EXISTS "Super admins can manage storage objects" ON storage.objects;
CREATE POLICY "Super admins can manage storage objects"
ON storage.objects
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  AND bucket_id IN ('patient-documents', 'avatars')
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  AND bucket_id IN ('patient-documents', 'avatars')
);
