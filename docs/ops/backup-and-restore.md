# Backup, Restore, and RTO/RPO Runbook

## RTO/RPO Targets
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 15 minutes

Adjust these targets per clinic SLA before production.

## Backup Verification Workflow
We run a scheduled workflow (`.github/workflows/backup-verify.yml`) that:
1. Pulls a fresh `pg_dump` from the production database.
2. Restores the dump into an ephemeral Postgres container.
3. Runs `scripts/backup-smoke.sql` to validate schema and core tables.

The detailed drill cadence, sign-off expectations, and post-restore validation steps are defined in [backup-restore-validation-checklist.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/backup-restore-validation-checklist.md).

### Required Secrets
- `SUPABASE_DB_URL` (read-only preferred)
- `SUPABASE_DB_PASSWORD` (if your URL omits password)

## Restore Runbook (Manual)
1. **Create a new restore target** (staging or emergency-prod).
2. **Restore the latest backup**
   - `psql` or `pg_restore` depending on backup format.
3. **Run smoke checks**
   - `scripts/backup-smoke.sql`
4. **Validate application**
   - Login
   - Load dashboard
   - Create patient (non-destructive test)

Monthly and quarterly restore drills should follow the checklist in [backup-restore-validation-checklist.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/backup-restore-validation-checklist.md), including tenant isolation and RLS verification after restore.

## Incident Checklist
- Confirm incident scope and last known good time.
- Communicate outage to stakeholders.
- Restore to staging first if possible.
- Verify RLS and tenant isolation post-restore.
- Document timeline and outcomes.

## Audit Log Retention
- **Retention target:** 12 months in primary table, 6 years total once archived.
- **Archive strategy:** quarterly export to cold storage (CSV or parquet).
- **Deletion policy:** purge anything older than retention after archive completes.

See the authoritative retention matrix in [phi-retention-and-deletion.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/phi-retention-and-deletion.md).
