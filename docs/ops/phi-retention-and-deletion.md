# PHI Retention and Deletion Policy

Assessment date: 2026-04-15

Related docs:
- [production-readiness-framework.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/production-readiness-framework.md)
- [feature-production-readiness-report.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/feature-production-readiness-report.md)
- [backup-and-restore.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/backup-and-restore.md)

## Purpose

This document defines the baseline retention and deletion policy for PHI-bearing and privacy-sensitive data in the clinic platform.

It is intended to give the engineering and operations teams a concrete default policy for:
- how long data should remain in the active product
- when it should move to archive storage
- when it may be purged
- which parts of the current codebase already support that behavior

This is an operational baseline, not legal advice. A stricter local law, payer contract, BAA, or customer agreement overrides this document.

## Scope

This policy applies to:
- patient demographics and clinical records
- appointments, lab orders, prescriptions, and patient documents
- billing and insurance records
- patient portal account data
- notifications and reminder history when they may contain patient-identifying information
- audit, incident, and operational logs when they touch user or patient context

## Policy Principles

1. Retain the minimum data required to operate safely, support care, meet audit needs, and satisfy legal obligations.
2. Prefer archive over immediate physical deletion for clinical and financial records.
3. Use tenant-scoped exports and archives only. Archive artifacts must preserve tenant isolation.
4. Treat soft delete as an operational hide/archive step, not as final destruction.
5. Do not store unnecessary PHI in notifications, reminders, client errors, or system logs.
6. If a legal hold, dispute, incident review, payer review, or security investigation exists, deletion pauses until the hold is released.
7. Backup copies age out on the backup retention cycle. Deleted records are not individually removed from already-created backups.

## Retention Matrix

| Data area | Primary tables / assets | Baseline retention target | Archive and deletion rule | Current repo state |
| --- | --- | --- | --- | --- |
| Patient chart and demographics | `patients` | `10 years` after last clinical encounter | Soft archive first. Purge only after archive export, legal hold review, and approved destruction. | Soft delete implemented with `deleted_at` / `deleted_by`. |
| Pediatric patient chart | `patients`, related chart data | Later of `10 years` after last encounter or until patient turns `21` | Same as patient chart. | Policy only. Age-based destruction is not automated. |
| Medical records / clinical notes | `medical_records` | Same as patient chart | Archive before purge. No immediate destruction for routine support requests. | Current repository uses direct delete, not soft delete. This must be treated as a hardening gap. |
| Encounter-linked appointments | `appointments` with completed or in-progress clinical relevance | Same as patient chart | Soft archive first, then purge after retention window and approved archive validation. | Soft delete implemented. |
| Non-encounter appointment scheduling artifacts | `appointments` with cancelled / never-completed scheduling value only | `3 years` after scheduled date unless tied to billing, dispute, or investigation | Soft archive first. Purge after retention window if not required elsewhere. | Soft delete implemented, but status-based purge automation is not. |
| Lab orders and results | `lab_orders` | Same as patient chart | Soft archive first, then purge after archive validation and hold review. | Soft delete implemented. |
| Prescriptions | `prescriptions` | Same as patient chart | Soft archive first, then purge after retention window if no active legal or clinical hold exists. | Soft delete implemented. |
| Patient documents | `patient_documents`, private storage objects | Same as patient chart | Archive metadata and storage manifest before destroying storage objects. Delete metadata and file together only after approved purge. | Metadata soft delete exists. Storage removal exists, but retention-driven purge workflow is not automated. |
| Billing and invoices | `invoices` | `7 years` after invoice date or final settlement, whichever is later | Soft archive first, then export and purge after finance retention window. | Soft delete implemented. |
| Insurance claims | `insurance_claims` | `7 years` after final reimbursement, denial, or closure, whichever is later | Soft archive first, then purge only after archive verification and hold review. | Soft delete implemented. |
| Patient portal account linkage | `patient_accounts`, `patients.user_id` linkage | `2 years` after disable or last login, unless longer retention is required by active patient chart or security review | Disable first. Do not purge active mappings. Purge only after linked chart review and audit export. | Status lifecycle exists (`invited`, `active`, `disabled`). No retention automation yet. |
| Patient contact preferences | `patient_contact_preferences` | While patient relationship is active, plus `2 years` after last outbound use | Remove only after confirming no active reminder workflow or portal dependency. | CRUD exists. No purge automation yet. |
| Reminder queue and delivery history | `reminder_queue`, `appointment_reminder_log` | `2 years` after send or final failure | Keep only minimum necessary metadata. Purge failed and sent reminder records after retention window unless under investigation. | Queue and log exist. No retention automation yet. |
| In-app notifications | `notifications` | `2 years` after creation | Notifications should avoid detailed PHI. Purge after retention window unless tied to an incident or audit case. | Read state exists. No soft delete or retention job. |
| Audit trail | `audit_logs` | `12 months` hot in primary storage, `6 years` total in archive | Quarterly export to cold storage. Purge primary rows after hot window once archive verification completes. | Audit logging exists. Archive/purge is policy-driven and partially documented in ops docs. |
| Client error logs | `client_error_logs` | `30 days` hot in primary storage, `180 days` max in archive if needed for investigation | Error payloads must not include unnecessary PHI. Purge aggressively after support/investigation need ends. | Logging exists. No automated purge job yet. |
| System logs | `system_logs` | `30 days` hot in primary storage, `180 days` max in archive if needed for incident review | Operational logs must avoid PHI. Export only if needed for incident handling, then purge on schedule. | Logging exists. No automated purge job yet. |
| Domain events | `domain_events` | `2 years` in primary, longer only if required for audit reconstruction | Keep payloads free of unnecessary PHI. Export before purge if events are needed for analytics or audit replay. | Persistence exists. No retention automation yet. |
| Background job records | `jobs` | `180 days` after completion, `1 year` for failed or dead-letter jobs tied to incident review | Completed jobs can be purged sooner; failed jobs stay longer for operations review. | Queue exists. No purge automation yet. |

## Archive and Deletion Workflow

Deletion of PHI-bearing data must follow this sequence:

1. Confirm the request or scheduled retention event is valid.
2. Check for legal hold, payer dispute, security incident, or active support case.
3. Export the record set to the approved archive location using tenant-scoped artifacts.
4. Verify archive integrity:
   - expected tenant only
   - expected table/record counts
   - expected storage object manifest for document files
5. Record the archive and deletion decision in the audit trail or operations ticket.
6. Remove the data from active tables or storage.
7. Confirm downstream cleanup:
   - storage objects removed when required
   - search indexes or materialized views refreshed if needed
   - portal access or reminder references removed if still linked

## Soft Delete vs Hard Delete Rules

### Soft delete required

The following records should use soft delete as the first step:
- patients
- appointments
- lab orders
- prescriptions
- invoices
- insurance claims
- patient document metadata

These records already have `deleted_at` / `deleted_by` support and restrictive RLS policies excluding deleted rows from normal reads.

### Hard delete restricted

Hard delete should be reserved for:
- data that has completed the archive and approval workflow
- non-clinical operational records with short retention windows
- support cleanup in lower environments with non-production data

### Current hardening gap

`medical_records` currently uses direct delete in the repository layer. Until that is changed, the operational rule is:
- treat medical-record deletion as exceptional
- require explicit approval before use in production
- prioritize a follow-up change to support archive-first behavior

## Backup and Restore Interaction

Retention decisions do not remove data from already-created backups immediately.

The expected model is:
- active tables follow the retention matrix above
- backup copies age out according to the backup retention schedule
- restore drills must verify tenant isolation and RLS before any recovered environment is used

See [backup-and-restore.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/backup-and-restore.md) for the backup verification and restore procedure.

## Feature-Specific Notes

### Patient documents

- Storage objects are part of the retention decision, not an independent delete path.
- Metadata purge and blob purge must be tied together.
- Signed URLs are transient access only and do not change retention status.

### Reminders and notifications

- Reminder content must stay minimum-necessary.
- Do not place diagnosis, lab results, or detailed treatment information into reminder text.
- Retention of reminder metadata should support troubleshooting, but not become a shadow patient chart.

### Portal access

- Disabling a portal account is the default offboarding action.
- Purging portal account links should happen only after support, audit, and linked patient-record review.

### Audit and operational logs

- Logs are not a valid place to store clinical detail.
- If PHI is discovered in logs, treat it as an incident and shorten retention to the minimum needed for response.

## Ownership and Review Cadence

- Engineering owner: implement archive and purge automation safely.
- Operations owner: run retention reviews and approve purge jobs.
- Security/compliance owner: review hold exceptions, audit exports, and policy changes.

Review cadence:
- quarterly review of retention jobs and archive completeness
- annual review of this policy
- immediate review after major schema or vendor changes affecting PHI

## Open Implementation Gaps

The following gaps remain after documenting this policy:
- medical record deletion is still hard delete
- no scheduled purge/export jobs yet exist for most PHI-bearing tables
- notification, reminder, system log, and client log retention is not automated
- storage purge and metadata purge are not yet orchestrated by a retention workflow
- legal-hold workflow is not yet represented in product controls

## Definition of Done for `PR-301`

This policy satisfies the documentation baseline for `PR-301` when:
- each PHI-bearing module has a documented retention target
- archive-first versus direct-deletion behavior is explicit
- current implementation mismatches are called out clearly
