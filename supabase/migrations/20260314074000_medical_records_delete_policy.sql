-- Allow clinic admins and doctors to delete medical records within their tenant
DROP POLICY IF EXISTS "Doctors can delete records" ON public.medical_records;

CREATE POLICY "Doctors can delete records"
  ON public.medical_records
  FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
    )
  );
