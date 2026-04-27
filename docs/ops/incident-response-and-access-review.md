# Incident Response and Access Review Runbook

Assessment date: 2026-04-15

Related docs:
- [production-readiness-framework.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/production-readiness-framework.md)
- [feature-production-readiness-report.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/feature-production-readiness-report.md)
- [backup-and-restore.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/backup-and-restore.md)
- [backup-restore-validation-checklist.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/backup-restore-validation-checklist.md)
- [phi-retention-and-deletion.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/phi-retention-and-deletion.md)
- [privileged-access-policy.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/privileged-access-policy.md)

## Purpose

This runbook defines:
- how production incidents are classified, escalated, investigated, and closed
- which operational signals should be checked first in this clinic platform
- how privileged-access reviews are performed and documented

It is intended to be the minimum operational baseline for a multi-tenant clinic platform handling PHI, billing data, patient communications, and operational automation.

This document is an engineering and operations baseline. It is not legal advice, and it does not replace customer contracts, local healthcare law, breach-notification requirements, or counsel guidance.

## Scope

This runbook applies to:
- production application outages or degraded clinic workflows
- PHI exposure risk, tenant-isolation failures, or suspicious access
- failed background jobs, reminder failures, report refresh failures, and edge-function incidents
- privileged-user review for `super_admin`, `clinic_admin`, service-role, deployment, and vendor-connected operational access

## Incident Categories

### 1. Security and Privacy

Examples:
- cross-tenant data exposure
- PHI visible to the wrong user or role
- leaked API key, service-role secret, or vendor credential
- suspicious admin impersonation or unexpected privileged activity

Default severity guidance:
- treat confirmed or suspected PHI exposure as `SEV-1` until downgraded

### 2. Clinical Workflow Availability

Examples:
- patients, appointments, lab orders, prescriptions, or portal workflows unavailable
- booking conflicts bypassing expected protections
- document access or upload unavailable for clinicians

### 3. Financial and Reporting Integrity

Examples:
- invoice creation or payment status failures
- insurance claim workflow outage
- stale or failed report refresh creating untrustworthy analytics

### 4. Vendor and Integration Failures

Examples:
- reminder delivery vendor failures
- telemedicine token or session failures
- external lab webhook or mapping failures
- outbound email failure

### 5. Backup, Restore, and Data Recovery

Examples:
- restore drill failure
- backup verification failure
- corruption discovered in production data or restored copies

## Severity Levels

| Severity | Meaning | Initial target response | Example clinic impact |
| --- | --- | --- | --- |
| `SEV-1` | Critical production incident or confirmed/suspected PHI breach | `15 minutes` | cross-tenant leak, production outage for core clinical flow, failed restore during active disruption |
| `SEV-2` | Major degradation with meaningful clinic impact | `30 minutes` | appointment booking failing for one or more tenants, reminders failing broadly, reporting system materially stale |
| `SEV-3` | Limited or recoverable issue | `4 business hours` | isolated vendor failure, retry backlog growing, one workflow degraded with workaround |
| `SEV-4` | Minor issue or low-risk operational follow-up | `2 business days` | cosmetic telemetry issue, non-urgent dashboard inconsistency, isolated warning requiring review |

## Detection Sources

Primary sources in this repository:
- Admin operations dashboard for jobs, system errors, and client-error trends
- `system_logs`
- `client_error_logs`
- `jobs`
- report refresh status and stale/failing report indicators
- audit logs, including impersonation start/end
- privileged step-up issuance and denial events
- user-reported incidents from clinic staff or patients

Expected first checks by incident type:
- platform reliability: jobs + system logs + client errors
- reminders and background automation: jobs + system logs + outbound vendor status
- report issues: report refresh status + materialized-view refresh jobs
- suspicious access: audit logs + impersonation trail + affected tenant/user records
- restore/data-recovery issues: latest backup artifact + restore checklist + smoke script output

## Roles During an Incident

Minimum role assignment for `SEV-1` and `SEV-2`:
- Incident commander: owns timeline, severity, and decision log
- Engineering lead: owns technical investigation and mitigation
- Security/compliance lead: owns breach/privacy assessment where PHI may be involved
- Product or clinic operations lead: validates clinic impact and workaround viability
- Communications owner: tracks external and internal updates

For small teams, one person may hold more than one role, but the responsibilities must still be covered explicitly.

## Immediate Triage Checklist

Start this checklist as soon as an incident is acknowledged:

1. Record incident start time, reporter, affected environment, and tentative severity.
2. Identify affected tenant or whether the issue is cross-tenant.
3. Identify affected modules:
   - patients
   - appointments
   - lab
   - prescriptions
   - billing
   - insurance
   - reports
   - portal
   - reminders
   - telemedicine
4. Check whether PHI or financial data may be exposed, corrupted, or missing.
5. Capture first evidence:
   - screenshot or user report
   - relevant audit-log records
   - relevant `system_logs`
   - relevant `jobs` state
   - relevant edge-function failure message
6. Decide whether the safest immediate action is:
   - isolate a tenant
   - disable a feature flag or vendor workflow
   - pause a worker
   - rotate a secret
   - revoke access
   - move to backup/restore workflow
7. Assign incident commander and engineering lead.

## Escalation Path

### `SEV-1`

Escalate immediately to:
- engineering lead
- security/compliance owner
- platform owner or executive owner
- clinic operations/customer contact if a live tenant is impacted

Required actions:
- open incident channel and ticket immediately
- freeze non-essential deploys until containment plan is clear
- start breach-assessment path if PHI exposure is possible
- preserve logs and evidence before cleanup

### `SEV-2`

Escalate to:
- engineering lead
- product or clinic operations owner
- security/compliance owner if PHI or access risk exists

Required actions:
- open incident ticket
- define workaround or mitigation target
- give periodic status updates until stable

### `SEV-3` and `SEV-4`

Escalate through standard support and engineering triage, but upgrade severity immediately if tenant isolation, PHI, or broad clinical impact becomes likely.

## Response Workflow

### Stage 1: Containment

Contain first, then optimize.

Examples:
- disable vendor-triggered reminder sending if retries are amplifying a failure
- revoke or rotate an exposed credential
- stop impersonation or privileged sessions if unexpected access is observed
- restrict a feature behind an existing feature flag or admin control
- move analytics to a stale-warning state instead of showing silently bad data

### Stage 2: Investigation

Use the smallest scope that can explain the issue:
- which tenant or tenants are affected
- which user role can reproduce it
- which job, edge function, or RPC failed first
- whether the issue is data, permission, vendor, or deployment related

Evidence sources to capture:
- timestamps in UTC and local clinic time if relevant
- affected user IDs and tenant IDs
- audit records
- error payloads from `system_logs` and `client_error_logs`
- job attempts, lock state, and dead-letter evidence
- report refresh timestamps if analytics are involved

### Stage 3: Mitigation and Recovery

Mitigation options must be documented in the incident ticket:
- workaround provided to clinic staff
- permanent fix or rollback applied
- restore action executed, if any
- data correction or replay action taken

If restore or replay is used:
- follow [backup-restore-validation-checklist.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/backup-restore-validation-checklist.md)
- verify tenant isolation and RLS after recovery
- verify no partial replay duplicated jobs, reminders, or claims

### Stage 4: Closure

Do not close an incident until:
- the immediate issue is resolved or safely mitigated
- affected tenants are confirmed stable
- evidence has been preserved
- any required follow-up ticket is opened
- severity was reviewed one final time

## PHI or Privacy Incident Addendum

Use this path whenever PHI exposure is confirmed or cannot yet be ruled out.

1. Treat as `SEV-1` until triage proves otherwise.
2. Stop additional exposure first:
   - revoke access
   - disable affected route or workflow
   - rotate keys if relevant
3. Preserve logs and audit evidence.
4. Record:
   - who may have been exposed
   - which tenant or tenants are affected
   - what data types were involved
   - start and stop time of exposure
5. Notify the security/compliance owner immediately.
6. Do not delete logs or rotate data without recording evidence first.
7. Follow legal and contractual breach-notification requirements outside this document.

## Incident Communications

Minimum communication expectations:
- `SEV-1`: acknowledge immediately, then update at least every `30 minutes`
- `SEV-2`: acknowledge immediately, then update at least every `60 minutes`
- `SEV-3`: update on meaningful change or agreed cadence

Each update should answer:
- what is broken
- who is affected
- whether PHI or financial data is implicated
- current mitigation
- next expected update time

## Post-Incident Review

Required for all `SEV-1` and `SEV-2`, and for any recurring `SEV-3`.

Post-incident review template:
- summary
- timeline
- root cause
- contributing factors
- what detection worked
- what detection was missing
- what containment worked
- corrective actions
- owner and due date for each follow-up item

Review timing:
- within `2 business days` for `SEV-1`
- within `5 business days` for `SEV-2`

## Access Review Scope

The recurring access review must cover:
- all `super_admin` users
- all `clinic_admin` users
- any user with billing, insurance, report-export, or broad patient access beyond their normal role
- deployment and secret-management access
- vendor dashboards and consoles that can expose PHI or send patient communications
- service-role and integration credentials, including who can rotate or deploy them

## Access Review Cadence

- Monthly:
  - `super_admin`
  - production deployment access
  - service-role and vendor credential custodians
- Quarterly:
  - all `clinic_admin`
  - all user-role assignments for active tenants
  - emergency or break-glass accounts
- Immediate review:
  - after a security incident
  - after employee or contractor departure
  - after unexplained privileged action
  - after customer complaint involving unauthorized access

## Access Review Checklist

For each reviewed account or access path, confirm:

1. The person is still active and authorized.
2. Their role matches their current job function.
3. Their tenant scope is correct.
4. They do not hold stronger access than required.
5. MFA status is known and tracked, even if enforcement is still in progress.
6. Privileged users remain enrolled in TOTP MFA and can reach `aal2`.
7. Recent impersonation, step-up denial, or other privileged actions are explainable.
8. No shared accounts are in use for privileged workflows.
9. Vendor-console access is limited to the minimum required maintainers.
10. Secret rotation ownership is assigned and current.
11. Access removal or downgrade actions are completed immediately when no longer justified.

## Access Review Evidence

Store review evidence in the operations tracker or compliance folder:
- review date
- reviewer
- list of accounts/access paths reviewed
- list of revoked, downgraded, or confirmed accounts
- open follow-up items

Evidence sources inside the product:
- user and role configuration
- audit logs
- impersonation audit records
- deployment or vendor access inventory tracked outside the app

## Emergency Access Rules

Emergency access is allowed only when needed to:
- restore patient care operations
- stop active data exposure
- recover a failed deployment or integration

Rules:
- time-box the access
- record the reason before or immediately after use
- review the action in the next access-review cycle
- rotate credentials or revoke temporary grants after use

## Current Gaps

This runbook closes the documentation baseline for incident response and access review, but these product gaps still remain:
- access review is documented but not automated in-product
- vendor-console review still depends on manual inventory and external systems
- breach-notification workflow outside engineering must still be finalized with legal/compliance owners

## Definition of Done for `PR-303`

This runbook satisfies `PR-303` when:
- incident categories are explicit
- severity and escalation expectations are documented
- response and evidence-capture steps are documented
- recurring access review scope and cadence are documented
- emergency-access handling is documented
