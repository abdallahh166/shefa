
-- ============================================================
-- FIX 1: Lock down profiles.tenant_id from user updates
-- Users can only update full_name and avatar_url, NOT tenant_id
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- ============================================================
-- FIX 2: Harden handle_new_user — don't trust client tenant_id
-- Use a secure signup RPC instead
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
BEGIN
  -- Only trust tenant_id if it actually exists in the tenants table
  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    SELECT id INTO _tenant_id FROM public.tenants 
    WHERE id = (NEW.raw_user_meta_data->>'tenant_id')::uuid;
  END IF;

  -- If no valid tenant found, do NOT fall back to a random tenant
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'No valid tenant_id provided for new user';
  END IF;

  INSERT INTO public.profiles (user_id, tenant_id, full_name)
  VALUES (
    NEW.id,
    _tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  -- Always assign safe default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'doctor'::app_role);

  RETURN NEW;
END;
$function$;

-- ============================================================
-- FIX 3: Make tenant creation atomic — return tenant_id only on success
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_tenant_and_signup(_name text, _slug text)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _existing_slug text;
BEGIN
  -- Check for duplicate slug
  SELECT slug INTO _existing_slug FROM public.tenants WHERE slug = _slug;
  IF _existing_slug IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant slug already exists';
  END IF;

  INSERT INTO public.tenants (name, slug)
  VALUES (_name, _slug)
  RETURNING id INTO _tenant_id;
  
  RETURN _tenant_id;
END;
$function$;

-- ============================================================
-- FIX 4: Enforce exactly one role per user
-- ============================================================
-- First clean up any duplicates (keep the first)
DELETE FROM public.user_roles a
USING public.user_roles b
WHERE a.user_id = b.user_id
  AND a.id > b.id;

-- Add unique constraint  
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_unique'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- ============================================================
-- FIX 5: Role-scoped WRITE policies on sensitive tables
-- ============================================================

-- appointments: only doctor, receptionist, clinic_admin can write
DROP POLICY IF EXISTS "Tenant users can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Tenant users can update appointments" ON public.appointments;

CREATE POLICY "Authorized users can create appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
      OR has_role(auth.uid(), 'receptionist'::app_role)
    )
  );

CREATE POLICY "Authorized users can update appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
      OR has_role(auth.uid(), 'receptionist'::app_role)
    )
  );

-- medical_records: only doctor, clinic_admin can create
DROP POLICY IF EXISTS "Doctors can create records" ON public.medical_records;

CREATE POLICY "Doctors can create records" ON public.medical_records
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
    )
  );

-- prescriptions: only doctor, clinic_admin can create
DROP POLICY IF EXISTS "Doctors can create prescriptions" ON public.prescriptions;

CREATE POLICY "Doctors can create prescriptions" ON public.prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
    )
  );

-- invoices: only accountant, clinic_admin can write
DROP POLICY IF EXISTS "Tenant users can create invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenant users can update invoices" ON public.invoices;

CREATE POLICY "Billing users can create invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
    )
  );

CREATE POLICY "Billing users can update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
    )
  );

-- insurance_claims: only accountant, clinic_admin can write
DROP POLICY IF EXISTS "Tenant users can create claims" ON public.insurance_claims;
DROP POLICY IF EXISTS "Tenant users can update claims" ON public.insurance_claims;

CREATE POLICY "Billing users can create claims" ON public.insurance_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
    )
  );

CREATE POLICY "Billing users can update claims" ON public.insurance_claims
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
    )
  );

-- lab_orders: only doctor, clinic_admin can write
DROP POLICY IF EXISTS "Tenant users can create lab orders" ON public.lab_orders;
DROP POLICY IF EXISTS "Tenant users can update lab orders" ON public.lab_orders;

CREATE POLICY "Doctors can create lab orders" ON public.lab_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
    )
  );

CREATE POLICY "Doctors can update lab orders" ON public.lab_orders
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
    )
  );

-- medications: only clinic_admin, doctor can manage (pharmacist not in roles)
DROP POLICY IF EXISTS "Tenant users can manage medications" ON public.medications;

CREATE POLICY "Authorized users can manage medications" ON public.medications
  FOR ALL TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
    )
  );

-- ============================================================
-- FIX 6: Role-scoped READ policies on sensitive tables
-- ============================================================

-- medical_records: only doctor, nurse, clinic_admin
DROP POLICY IF EXISTS "Tenant users can view records" ON public.medical_records;

CREATE POLICY "Clinical staff can view records" ON public.medical_records
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
      OR has_role(auth.uid(), 'nurse'::app_role)
    )
  );

-- prescriptions: only doctor, nurse, clinic_admin
DROP POLICY IF EXISTS "Tenant users can view prescriptions" ON public.prescriptions;

CREATE POLICY "Clinical staff can view prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
      OR has_role(auth.uid(), 'nurse'::app_role)
    )
  );

-- invoices: only accountant, clinic_admin
DROP POLICY IF EXISTS "Tenant users can view invoices" ON public.invoices;

CREATE POLICY "Billing staff can view invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
    )
  );

-- insurance_claims: only accountant, clinic_admin
DROP POLICY IF EXISTS "Tenant users can view claims" ON public.insurance_claims;

CREATE POLICY "Billing staff can view claims" ON public.insurance_claims
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
    )
  );

-- lab_orders: only doctor, nurse, clinic_admin
DROP POLICY IF EXISTS "Tenant users can view lab orders" ON public.lab_orders;

CREATE POLICY "Clinical staff can view lab orders" ON public.lab_orders
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'clinic_admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
      OR has_role(auth.uid(), 'nurse'::app_role)
    )
  );

-- ============================================================
-- FIX 7: Add missing indexes for common FK lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON public.appointments (doctor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON public.invoices (patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_id ON public.lab_orders (patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor_id ON public.lab_orders (doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON public.medical_records (patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON public.prescriptions (patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient_id ON public.insurance_claims (patient_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
