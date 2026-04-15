-- Backup restore smoke checks (fail if schema or security shape is missing)
DO $$
BEGIN
  IF to_regclass('public.patients') IS NULL
     OR to_regclass('public.appointments') IS NULL
     OR to_regclass('public.invoices') IS NULL
     OR to_regclass('public.audit_logs') IS NULL
     OR to_regclass('public.jobs') IS NULL
     OR to_regclass('public.system_logs') IS NULL THEN
    RAISE EXCEPTION 'Core tables missing after restore';
  END IF;

  IF (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') = 0 THEN
    RAISE EXCEPTION 'No public tables found after restore';
  END IF;

  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
      AND table_name IN (
        'patients',
        'appointments',
        'lab_orders',
        'prescriptions',
        'invoices',
        'patient_documents',
        'notifications',
        'insurance_claims',
        'jobs',
        'system_logs'
      )
  ) <> 10 THEN
    RAISE EXCEPTION 'Expected tenant_id on core tenant-scoped tables';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'patients',
        'appointments',
        'lab_orders',
        'prescriptions',
        'invoices',
        'patient_documents',
        'notifications',
        'insurance_claims',
        'audit_logs',
        'jobs',
        'system_logs',
        'client_error_logs'
      )
      AND c.relrowsecurity
  ) <> 12 THEN
    RAISE EXCEPTION 'RLS is not enabled on all expected operational tables';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'patients',
        'appointments',
        'lab_orders',
        'prescriptions',
        'invoices',
        'patient_documents',
        'notifications',
        'insurance_claims'
      )
      AND (
        coalesce(qual, '') ILIKE '%get_user_tenant_id%'
        OR coalesce(with_check, '') ILIKE '%get_user_tenant_id%'
      )
  ) < 8 THEN
    RAISE EXCEPTION 'Tenant isolation policies are missing on one or more core tables';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'Exclude deleted records'
      AND tablename IN (
        'patients',
        'appointments',
        'lab_orders',
        'prescriptions',
        'invoices',
        'insurance_claims',
        'patient_documents'
      )
  ) <> 7 THEN
    RAISE EXCEPTION 'Soft-delete restrictive policies are missing after restore';
  END IF;
END $$;
