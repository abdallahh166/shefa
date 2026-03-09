
-- 1. Add pending_owner_email to tenants for secure signup flow
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pending_owner_email text;

-- 2. Rewrite create_tenant_and_signup to accept owner email and store it
CREATE OR REPLACE FUNCTION public.create_tenant_and_signup(_name text, _slug text, _owner_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _existing_slug text;
BEGIN
  SELECT slug INTO _existing_slug FROM public.tenants WHERE slug = _slug;
  IF _existing_slug IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant slug already exists';
  END IF;

  INSERT INTO public.tenants (name, slug, pending_owner_email)
  VALUES (_name, _slug, _owner_email)
  RETURNING id INTO _tenant_id;

  RETURN _tenant_id;
END;
$$;

-- 3. Rewrite handle_new_user to enforce tenant trust and assign clinic_admin for owners
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _pending_email text;
  _role app_role;
BEGIN
  -- Only trust tenant_id if it actually exists in the tenants table
  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    SELECT id, pending_owner_email INTO _tenant_id, _pending_email
    FROM public.tenants 
    WHERE id = (NEW.raw_user_meta_data->>'tenant_id')::uuid;
  END IF;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'No valid tenant_id provided for new user';
  END IF;

  -- Determine if this is the founding owner or an invited staff member
  IF _pending_email IS NOT NULL AND lower(_pending_email) = lower(NEW.email) THEN
    -- This is the owner who created the tenant
    _role := 'clinic_admin'::app_role;
    -- Clear the pending flag so no one else can claim ownership
    UPDATE public.tenants SET pending_owner_email = NULL WHERE id = _tenant_id;
  ELSIF NEW.raw_user_meta_data->>'invited_by_admin' = 'true' THEN
    -- Staff invited via edge function (service role sets this flag)
    _role := 'doctor'::app_role;
  ELSE
    -- Uninvited signup attempting to join an existing tenant - reject
    RAISE EXCEPTION 'Not authorized to join this tenant';
  END IF;

  INSERT INTO public.profiles (user_id, tenant_id, full_name)
  VALUES (
    NEW.id,
    _tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  RETURN NEW;
END;
$$;

-- 4. Recreate trigger (in case it was dropped)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Cross-tenant reference validation function
CREATE OR REPLACE FUNCTION public.validate_tenant_references()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Check patient belongs to same tenant
  IF TG_ARGV[0] = 'has_patient' OR TG_ARGV[0] = 'has_both' THEN
    IF NOT EXISTS (SELECT 1 FROM public.patients WHERE id = NEW.patient_id AND tenant_id = NEW.tenant_id) THEN
      RAISE EXCEPTION 'Patient does not belong to this tenant';
    END IF;
  END IF;

  -- Check doctor belongs to same tenant
  IF TG_ARGV[0] = 'has_doctor' OR TG_ARGV[0] = 'has_both' THEN
    IF NOT EXISTS (SELECT 1 FROM public.doctors WHERE id = NEW.doctor_id AND tenant_id = NEW.tenant_id) THEN
      RAISE EXCEPTION 'Doctor does not belong to this tenant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Add cross-tenant validation triggers
CREATE TRIGGER validate_appointments_refs
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('has_both');

CREATE TRIGGER validate_medical_records_refs
  BEFORE INSERT OR UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('has_both');

CREATE TRIGGER validate_prescriptions_refs
  BEFORE INSERT OR UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('has_both');

CREATE TRIGGER validate_lab_orders_refs
  BEFORE INSERT OR UPDATE ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('has_both');

CREATE TRIGGER validate_invoices_refs
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('has_patient');

CREATE TRIGGER validate_insurance_claims_refs
  BEFORE INSERT OR UPDATE ON public.insurance_claims
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('has_patient');
