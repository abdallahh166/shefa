-- Patient data integrity constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_blood_type_check'
  ) THEN
    ALTER TABLE public.patients
    ADD CONSTRAINT patients_blood_type_check
    CHECK (
      blood_type IS NULL OR
      blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_phone_format'
  ) THEN
    ALTER TABLE public.patients
    ADD CONSTRAINT patients_phone_format
    CHECK (
      phone IS NULL OR
      phone ~ E'^[0-9+().\\-\\s]{6,20}$'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_email_format'
  ) THEN
    ALTER TABLE public.patients
    ADD CONSTRAINT patients_email_format
    CHECK (
      email IS NULL OR
      email ~* E'^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patients_realistic_dob'
  ) THEN
    ALTER TABLE public.patients
    ADD CONSTRAINT patients_realistic_dob
    CHECK (
      date_of_birth IS NULL OR
      (date_of_birth >= DATE '1900-01-01' AND date_of_birth <= CURRENT_DATE)
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS patients_phone_unique
  ON public.patients (tenant_id, phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS patients_email_unique
  ON public.patients (tenant_id, email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;
