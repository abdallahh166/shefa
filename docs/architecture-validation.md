# Architecture Validation Report

This report documents the Phase 1 architecture validation checks and how to run them. The goal is to ensure tenant isolation, RLS coverage, critical indexes, and background infrastructure safety before enabling the enhancement phases.

## What This Validates

### Database Checks (pgTAP)
- Policy coverage: every public table has at least one RLS policy.
- Tenant isolation: required tables include `tenant_id` and core policies reference `get_user_tenant_id`.
- Foreign keys: patient-related tables reference `patients`.
- Indexes: tenant/date and lookup indexes exist for critical queries.
- Soft delete: restrictive policies exist on core tables.
- Concurrency: appointment overlap exclusion constraint exists.

Source: `supabase/tests/architecture_validation.sql`.

### Service Role Safety Audit (Vitest)
- Static scan of `supabase/functions/**/index.ts` for `SUPABASE_SERVICE_ROLE_KEY` usage.
- Enforces an allow-list of automation-only functions.

Source: `src/services/__tests__/serviceRoleAudit.test.ts`.

### Load Test Seed (Performance Sanity Check)
Script seeds appointments, reminder queue entries, and portal login timestamps.

Source: `scripts/load-test.mjs`.

## How To Run

### Database Validation
```bash
supabase test db
```

### Service Role Audit
```bash
npm test -- src/services/__tests__/serviceRoleAudit.test.ts
```

### Load Test Seed
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TENANT_ID=... PATIENT_ID=... DOCTOR_ID=... npm run test:load
```

## Expected Results
- All pgTAP tests in `architecture_validation.sql` pass.
- Service role audit finds zero offenders.

## Notes
- The policy coverage check is designed to fail fast if any public table is missing an active RLS policy.
- If new tables are added, ensure they include `tenant_id` (where tenant-scoped) and have at least one RLS policy.
- Service-role usage must remain limited to worker/automation functions only.
- Integration API keys can be issued via `create_integration_api_key()` and audited with the service-role scan.
