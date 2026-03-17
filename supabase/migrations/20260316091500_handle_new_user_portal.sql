-- Allow patient portal signups in handle_new_user
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
  _invite_role app_role;
  _invite_code uuid;
  _patient_id uuid;
BEGIN
  -- Patient portal flow
  IF NEW.raw_user_meta_data->>'portal' = 'true' THEN
    BEGIN
      _tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::uuid;
      _patient_id := (NEW.raw_user_meta_data->>'patient_id')::uuid;
    EXCEPTION WHEN others THEN
      _tenant_id := NULL;
      _patient_id := NULL;
    END;

    IF _tenant_id IS NULL OR _patient_id IS NULL THEN
      RAISE EXCEPTION 'Invalid portal signup metadata';
    END IF;

    INSERT INTO public.patient_accounts (tenant_id, patient_id, auth_user_id, status, invited_at, activated_at)
    VALUES (_tenant_id, _patient_id, NEW.id, 'active', now(), now())
    ON CONFLICT (patient_id) DO UPDATE
      SET auth_user_id = EXCLUDED.auth_user_id,
          status = 'active',
          invited_at = COALESCE(public.patient_accounts.invited_at, now()),
          activated_at = now(),
          updated_at = now();

    UPDATE public.patients
    SET user_id = NEW.id
    WHERE id = _patient_id;

    RETURN NEW;
  END IF;

  IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL THEN
    SELECT id, pending_owner_email INTO _tenant_id, _pending_email
    FROM public.tenants
    WHERE id = (NEW.raw_user_meta_data->>'tenant_id')::uuid;
  END IF;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'No valid tenant_id provided for new user';
  END IF;

  -- Founding owner claim
  IF _pending_email IS NOT NULL AND lower(_pending_email) = lower(NEW.email) THEN
    _role := 'clinic_admin'::app_role;
    UPDATE public.tenants SET pending_owner_email = NULL WHERE id = _tenant_id;
  ELSE
    -- Staff invite claim: require server-created invite_code
    BEGIN
      _invite_code := (NEW.raw_user_meta_data->>'invite_code')::uuid;
    EXCEPTION WHEN others THEN
      _invite_code := NULL;
    END;

    IF _invite_code IS NULL THEN
      RAISE EXCEPTION 'Not authorized to join this tenant';
    END IF;

    SELECT role INTO _invite_role
    FROM public.user_invites
    WHERE tenant_id = _tenant_id
      AND lower(email) = lower(NEW.email)
      AND invite_code = _invite_code
      AND consumed_at IS NULL
    LIMIT 1;

    IF _invite_role IS NULL THEN
      RAISE EXCEPTION 'Invalid or expired invite';
    END IF;

    _role := _invite_role;

    UPDATE public.user_invites
    SET consumed_at = now()
    WHERE tenant_id = _tenant_id
      AND lower(email) = lower(NEW.email)
      AND invite_code = _invite_code
      AND consumed_at IS NULL;
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

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
