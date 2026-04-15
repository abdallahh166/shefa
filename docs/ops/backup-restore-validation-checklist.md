# Backup and Restore Validation Checklist

Assessment date: 2026-04-15

Related docs:
- [backup-and-restore.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/backup-and-restore.md)
- [phi-retention-and-deletion.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/phi-retention-and-deletion.md)
- [architecture-validation.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/architecture-validation.md)

## Purpose

This checklist formalizes the restore drill and post-restore validation process for the remote Supabase deployment.

It exists to satisfy the `PR-302` requirement that backup verification be repeatable and that restore validation explicitly includes:
- tenant isolation
- RLS verification
- core application smoke checks

## Restore Drill Cadence

Use the following default cadence unless a stricter customer or contractual requirement exists:

- Weekly: automated backup verification workflow restores the latest dump into an ephemeral database and runs `scripts/backup-smoke.sql`
- Monthly: manual restore drill into a staging-style target, including application login and feature smoke checks
- Quarterly: expanded restore drill with documented sign-off from engineering and operations
- Immediately after major schema/security changes:
  - RLS policy changes
  - tenant isolation changes
  - authentication changes
  - storage/document retention changes

## Preconditions

Before starting a restore validation:

- confirm the target environment is isolated from production traffic
- confirm the backup source timestamp and intended restore point
- confirm access to:
  - remote database connection string
  - restore target database
  - application environment variables for the target
- confirm who is acting as:
  - restore operator
  - validation reviewer
  - incident owner if this is part of a live recovery event

## Stage 1: Backup Artifact Validation

Checklist:
- confirm the backup completed successfully
- record the backup timestamp
- record the source project / environment
- confirm the backup file is readable by `pg_restore` or `psql`
- confirm the expected schema objects are present after restore command completes

Evidence to capture:
- backup artifact name or identifier
- backup completion timestamp
- restore target name

## Stage 2: Database Restore Validation

Run:

```bash
psql -v ON_ERROR_STOP=1 -f scripts/backup-smoke.sql
```

Expected checks from `scripts/backup-smoke.sql`:
- core tables exist
- `tenant_id` exists on expected tenant-scoped tables
- RLS is enabled on core operational tables
- tenant isolation policies exist on core PHI-bearing tables
- soft-delete restrictive policies exist on core archive-capable tables

Checklist:
- restore completes without SQL errors
- smoke SQL completes without SQL errors
- no core tables are missing
- no RLS enablement failures are reported
- no tenant-policy failures are reported

## Stage 3: Tenant Isolation and RLS Validation

This stage confirms that restored data did not lose tenant boundaries.

### Required checks

- verify RLS is enabled on:
  - `patients`
  - `appointments`
  - `lab_orders`
  - `prescriptions`
  - `invoices`
  - `patient_documents`
  - `notifications`
  - `insurance_claims`
  - `audit_logs`
  - `jobs`
  - `system_logs`
  - `client_error_logs`

- verify core tenant policies still reference tenant resolution logic such as `get_user_tenant_id(...)`
- verify restrictive soft-delete policies still exist where expected
- verify the restored environment does not accidentally expose cross-tenant reads in application queries

### Minimum manual verification

Using two users from different tenants in the restored environment:
- Tenant A user can log in and see only Tenant A patients
- Tenant B user can log in and see only Tenant B patients
- Tenant A cannot access Tenant B patient detail by URL or normal navigation
- Tenant A report access remains limited to Tenant A data
- portal or patient-scoped flows, if enabled in the target, remain scoped to the linked patient only

## Stage 4: Application Smoke Validation

Perform these checks in the restored application target:

- log in with a clinic admin account
- load dashboard successfully
- load patients list successfully
- open one patient detail page
- load appointments page successfully
- load reports page successfully
- confirm no obvious RPC or RLS errors appear in the browser console

Non-destructive write checks:
- create a test patient or equivalent low-risk record
- create a test appointment for that patient
- confirm the new record appears only inside the current tenant

If the environment includes admin access:
- verify super-admin dashboard loads
- verify Operations / logs view loads

## Stage 5: Security and Compliance Validation

Checklist:
- confirm no production secrets were exposed into logs during the drill
- confirm document storage access still requires signed or authorized access only
- confirm audit logging still works for a simple test mutation
- confirm retention and deletion policy docs still match the restored schema shape

If any PHI-bearing feature fails isolation or access checks:
- stop the drill
- mark the restore as failed
- do not use the target for business recovery

## Stage 6: Sign-Off and Recording

Record:
- drill date and time
- restore source timestamp
- operator
- reviewer
- target environment
- whether the drill passed or failed
- list of any issues found
- corrective actions and owner

Recommended storage:
- engineering operations ticket
- incident record if relevant
- quarterly production readiness review notes

## Failure Conditions

The restore validation fails if any of the following occur:

- restore SQL fails
- `scripts/backup-smoke.sql` fails
- any required table is missing
- RLS is disabled on required tables
- tenant isolation policies are missing
- cross-tenant access is observed
- core app smoke checks fail
- document access becomes public or bypasses expected authorization

## Follow-Up Actions After a Failed Drill

Required steps:
- open a remediation ticket immediately
- classify the failure:
  - backup artifact failure
  - restore procedure failure
  - schema mismatch
  - RLS / tenant isolation failure
  - app-level smoke failure
- rerun the drill only after the fix is reviewed
- attach the failed output and corrected output to the remediation ticket

## Definition of Done for `PR-302`

This checklist satisfies the baseline documentation requirement when:
- restore drill cadence is explicit
- validation steps include tenant isolation
- validation steps include RLS verification
- the checklist references an executable smoke script
