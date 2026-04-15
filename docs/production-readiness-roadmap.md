# Production Readiness Remediation Roadmap

Assessment date: 2026-04-15

Related docs:
- [production-readiness-framework.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/production-readiness-framework.md)
- [feature-production-readiness-report.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/feature-production-readiness-report.md)
- [production-readiness-backlog.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/production-readiness-backlog.md)

## Purpose

This roadmap converts the feature readiness assessment into a practical implementation plan for taking the clinic platform to stronger production readiness.

It is organized by:
- priority
- workstream
- estimated effort
- dependencies
- exit criteria

## Planning Assumptions

These estimates assume:
- remote Supabase only
- an active codebase owner available for schema and deployment work
- 1 full-stack engineer as the baseline delivery unit
- estimates are engineering effort, not guaranteed calendar duration
- compliance work here covers technical enablement, not legal certification

Effort scale:
- `XS`: less than 2 days
- `S`: 2 to 5 days
- `M`: 1 to 2 weeks
- `L`: 2 to 4 weeks
- `XL`: 4+ weeks

## Priority Model

- `P0`: must complete before broad clinic production rollout
- `P1`: should complete immediately after P0 for safe scale-up
- `P2`: feature-completion work for operational maturity
- `P3`: expansion work for advanced workflows and integrations

## Phase 0: Release Blockers

Target outcome:
- close the most important security, reliability, and compliance gaps before broad rollout

### Workstream A: Privileged Access Hardening

Priority: `P0`

Tasks:
- add MFA for `super_admin`, `clinic_admin`, and other privileged roles
- tighten session timeout and re-authentication rules for sensitive actions
- add admin impersonation audit trail and review logging
- document privileged-access policy in the repo docs

Estimate:
- `L`

Dependencies:
- auth flows
- settings/security UI
- Supabase auth strategy

Exit criteria:
- privileged users must complete MFA
- impersonation events are auditable
- session-sensitive actions require fresh auth when appropriate

### Workstream B: Production Alerting and Operational Visibility

Priority: `P0`

Tasks:
- add alerting for failed edge functions
- add alerting for job backlog and retry saturation
- add alerting for materialized view refresh failures
- add dashboards or queryable views for `jobs`, `system_logs`, and `client_error_logs`
- define basic production SLOs for auth, appointments, and reports

Estimate:
- `M`

Dependencies:
- existing `jobs`, `system_logs`, `domain_events`, and client logging

Exit criteria:
- failed jobs and edge functions are visible within minutes
- stale reports are detectable
- operational owners can identify backlog, failure rate, and last successful refresh

### Workstream C: Healthcare Operations Baseline

Priority: `P0`

Tasks:
- define retention and deletion rules for PHI-bearing data
- document backup verification and restore drill cadence
- add incident-response and access-review checklist docs
- identify external vendors requiring healthcare review or BAA coverage
- mark PHI-sensitive modules explicitly in the readiness docs

Estimate:
- `M`

Dependencies:
- current docs set
- platform owners and legal/operations input

Exit criteria:
- documented retention policy exists
- documented backup/restore validation process exists
- incident-response and access-review processes are written and reviewable

## Phase 1: Reliability and Test Hardening

Target outcome:
- make the platform safer to scale by strengthening high-risk workflows and test coverage

### Workstream D: End-to-End Critical Flow Coverage

Priority: `P1`

Tasks:
- add end-to-end tests for appointment booking and update flow
- add end-to-end tests for portal login and read-only access
- add end-to-end tests for reminder scheduling and delivery path
- add end-to-end tests for telemedicine join flow
- add end-to-end tests for invoice lifecycle and core reports access

Estimate:
- `XL`

Dependencies:
- stable remote test environment
- test data seeding strategy

Exit criteria:
- core patient, appointment, portal, and billing flows are exercised automatically
- failures block promotion to production

### Workstream E: Reminder and Notification Hardening

Priority: `P1`

Tasks:
- verify reminder queue execution against real remote configuration
- add integration tests around retry logic and vendor failures
- implement reminder delivery metrics by channel
- formalize patient consent and message-content rules
- add admin-level controls for reminder config validation

Estimate:
- `L`

Dependencies:
- `appointment-reminders`
- `reminder_queue`
- vendor credentials and template strategy

Exit criteria:
- reminder success/failure can be measured per channel
- retries behave predictably
- reminder payloads follow content policy

### Workstream F: Report Freshness and Data Confidence

Priority: `P1`

Tasks:
- expose last refresh timestamp for report materialized views
- add stale-data warnings in reports UI when refresh falls behind
- add refresh job observability to operations docs
- add smoke tests for core report RPCs against remote schema

Estimate:
- `M`

Dependencies:
- report materialized views
- `refresh-materialized-views`
- report UI

Exit criteria:
- report consumers can see whether data is fresh
- refresh failures are actionable

## Phase 2: High-Value Feature Hardening

Target outcome:
- raise the most important partial modules from “usable” to “production-capable”

### Workstream G: Patient Portal Maturity

Priority: `P2`

Tasks:
- add portal-specific tests for auth, access scope, and data isolation
- add download auditing for portal documents and invoices
- improve portal error, loading, and recovery states
- add account lifecycle controls for invited, active, disabled states
- optionally add limited self-service actions if product scope requires them

Estimate:
- `L`

Dependencies:
- portal auth
- portal RLS
- patient accounts lifecycle

Exit criteria:
- portal behavior is tested and auditable
- access violations are blocked by design and covered by automation

### Workstream H: Insurance Claims Maturity

Priority: `P2`

Tasks:
- add service tests for claim transition enforcement
- add operational views for submitted, processing, approved, denied, reimbursed claims
- add exception handling for invalid payer responses or incomplete claim data
- expand audit logging for claim changes

Estimate:
- `M`

Dependencies:
- insurance lifecycle schema
- insurance page and service layer

Exit criteria:
- claim transitions are fully tested
- claims can be monitored operationally by status
- sensitive claim changes are auditable

### Workstream I: Pharmacy and Procurement Completion

Priority: `P2`

Tasks:
- surface procurement UI for suppliers, purchase orders, and stock receipts
- surface inventory movement audit UI
- add batch and expiry-aware inventory views
- add reconciliation checks between receipts, batches, and stock balances
- add pharmacy workflow tests beyond summary and smoke coverage

Estimate:
- `XL`

Dependencies:
- procurement schema
- pharmacy UI
- inventory movement tables

Exit criteria:
- procurement workflows are usable end-to-end
- stock movements are reviewable and reconcilable

### Workstream J: Telemedicine Operational Hardening

Priority: `P2`

Tasks:
- add connection-state and fallback UX on the call page
- define recording, consent, and retention policy
- capture session quality/failure telemetry
- add integration tests around token issuance and session creation

Estimate:
- `L`

Dependencies:
- Agora token function
- video session schema

Exit criteria:
- session creation and join paths are testable
- call failures are diagnosable
- vendor usage is policy-aligned

## Phase 3: Advanced Operations Modules

Target outcome:
- complete the backend foundations that are present but not yet full product workflows

### Workstream K: Waiting Room and Queue Operations

Priority: `P3`

Tasks:
- build queue management UI
- add check-in, call-next, in-service, done, no-show operations
- scope realtime subscriptions narrowly by tenant and queue state
- add queue metrics and privacy review for display surfaces

Estimate:
- `L`

Dependencies:
- `appointment_queue`
- realtime subscription layer

Exit criteria:
- queue workflow is operational in the clinic UI
- realtime behavior is predictable and privacy-reviewed

### Workstream L: External Lab Integrations

Priority: `P3`

Tasks:
- build admin tooling for connections and mapping management
- add replay, retry, and dead-letter handling for inbound events
- add integration validation tests
- add health and throughput observability for external lab events

Estimate:
- `XL`

Dependencies:
- external lab schema
- webhook function
- integration ops ownership

Exit criteria:
- external lab connections are manageable
- inbound failures can be replayed and diagnosed

### Workstream M: Partner API Operations

Priority: `P3`

Tasks:
- add API key management UI
- add key rotation workflow and audit visibility
- add usage logging and scope validation reporting
- add partner API documentation and onboarding flow

Estimate:
- `L`

Dependencies:
- `integration_api_keys`
- integration API edge function

Exit criteria:
- external API consumers can be onboarded, rotated, and monitored safely

## Recommended Execution Order

Recommended sequence:

1. `P0` Privileged access hardening
2. `P0` Production alerting and operational visibility
3. `P0` Healthcare operations baseline
4. `P1` End-to-end critical flow coverage
5. `P1` Reminder and notification hardening
6. `P1` Report freshness and data confidence
7. `P2` Patient portal maturity
8. `P2` Insurance claims maturity
9. `P2` Telemedicine operational hardening
10. `P2` Pharmacy and procurement completion
11. `P3` Waiting room and queue operations
12. `P3` External lab integrations
13. `P3` Partner API operations

## Suggested Milestone View

### Milestone 1: Safe Clinic Rollout

Includes:
- all `P0` workstreams
- report freshness controls
- reminder hardening
- initial end-to-end tests for appointments and portal login

Target result:
- enough security, observability, and operational control for a controlled clinic rollout

### Milestone 2: Reliable Multi-Clinic Operation

Includes:
- full `P1`
- portal maturity
- insurance maturity
- telemedicine hardening

Target result:
- platform is safer for broader usage across more tenants and more patient-facing workflows

### Milestone 3: Advanced Operational Platform

Includes:
- procurement completion
- queue workflow
- external lab integrations
- partner API management

Target result:
- platform moves from solid clinic core into advanced operational product territory

## Highest-Value Next 30 Days

If only one month of focused work is available, prioritize:

1. MFA and privileged access hardening
2. production alerting for jobs, edge functions, and reports
3. appointment and portal end-to-end tests
4. reminder pipeline verification and metrics
5. backup, restore, and incident-response documentation

## Highest-Risk Deferred Items

If deferred, these create the most production risk:
- no MFA for privileged users
- no alerting on background job failures
- no tested portal access isolation flow
- no formal PHI retention and incident-response policy
- no reminder delivery visibility

## Delivery Notes

This roadmap is optimized for a clinic platform where correctness, privacy, and operational support matter as much as feature breadth.

The recommended rule is:
- do not expand advanced modules faster than you improve security, observability, and operational controls

The platform already has strong architectural foundations. The next step is disciplined hardening, especially around privileged access, production telemetry, patient-facing access, and healthcare operations policy.
