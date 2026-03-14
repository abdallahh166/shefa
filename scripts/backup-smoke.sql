-- Backup restore smoke checks (fail if missing core tables)
DO $$
BEGIN
  IF to_regclass('public.patients') IS NULL
     OR to_regclass('public.appointments') IS NULL
     OR to_regclass('public.invoices') IS NULL
     OR to_regclass('public.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Core tables missing after restore';
  END IF;

  IF (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') = 0 THEN
    RAISE EXCEPTION 'No public tables found after restore';
  END IF;
END $$;
