# Production Readiness Backlog

Assessment date: 2026-04-15

Related docs:
- [production-readiness-framework.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/production-readiness-framework.md)
- [feature-production-readiness-report.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/feature-production-readiness-report.md)
- [production-readiness-roadmap.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/production-readiness-roadmap.md)

## Purpose

This document translates the production-readiness roadmap into a Jira-style backlog made of epics and tickets. It is organized so the team can copy the items directly into Jira, Linear, Azure Boards, or any equivalent tracker.

## Backlog Conventions

Ticket types:
- `Epic`
- `Story`
- `Task`
- `Spike`

Priority scale:
- `P0`: must complete before broad clinic rollout
- `P1`: should complete immediately after P0
- `P2`: important feature hardening
- `P3`: advanced operational expansion

Effort scale:
- `XS`: less than 2 days
- `S`: 2 to 5 days
- `M`: 1 to 2 weeks
- `L`: 2 to 4 weeks
- `XL`: 4+ weeks

Suggested labels:
- `production-readiness`
- `clinic-platform`
- `security`
- `compliance`
- `observability`
- `testing`
- `portal`
- `appointments`
- `billing`
- `insurance`
- `telemedicine`
- `procurement`
- `integrations`

## Epic Summary

| Epic ID | Epic | Priority | Outcome |
| --- | --- | --- | --- |
| `PR-EPIC-01` | Privileged Access Hardening | `P0` | Secure privileged and admin access paths. |
| `PR-EPIC-02` | Production Observability and Alerting | `P0` | Make critical failures visible and actionable. |
| `PR-EPIC-03` | Healthcare Operations Baseline | `P0` | Close core operational compliance gaps. |
| `PR-EPIC-04` | Critical End-to-End Test Coverage | `P1` | Protect core clinical and patient-facing flows with automation. |
| `PR-EPIC-05` | Reminder and Notification Hardening | `P1` | Make reminder delivery reliable and measurable. |
| `PR-EPIC-06` | Reporting Confidence and Freshness | `P1` | Ensure reports are trustworthy in production. |
| `PR-EPIC-07` | Patient Portal Maturity | `P2` | Strengthen portal reliability, security, and auditability. |
| `PR-EPIC-08` | Insurance Claims Maturity | `P2` | Hardening for status lifecycle and operational visibility. |
| `PR-EPIC-09` | Telemedicine Operational Hardening | `P2` | Improve safety, diagnostics, and compliance readiness. |
| `PR-EPIC-10` | Pharmacy and Procurement Completion | `P2` | Turn inventory foundations into operational workflows. |
| `PR-EPIC-11` | Waiting Room Queue Operations | `P3` | Build clinic queue workflow on top of realtime foundations. |
| `PR-EPIC-12` | External Lab and Partner Integrations | `P3` | Operationalize external integrations safely. |

## PR-EPIC-01: Privileged Access Hardening

Epic goal:
- enforce stronger authentication and audit controls for high-risk users and actions

### `PR-101` Enforce MFA for privileged roles
- Type: `Story`
- Priority: `P0`
- Effort: `L`
- Dependencies: auth flows, role resolution
- Description: Require MFA for `super_admin`, `clinic_admin`, and any other role with sensitive access.
- Acceptance criteria:
- MFA enrollment is required before privileged users can continue.
- Login flow blocks privileged access without MFA completion.
- Support documentation exists for MFA enrollment and recovery.

### `PR-102` Add sensitive-action re-authentication
- Type: `Story`
- Priority: `P0`
- Effort: `M`
- Dependencies: `PR-101`
- Description: Require recent authentication for high-risk actions such as impersonation, subscription changes, and possibly PHI export actions.
- Acceptance criteria:
- Sensitive actions check fresh auth state.
- Expired auth requires re-verification before continuing.

### `PR-103` Audit admin impersonation end-to-end
- Type: `Task`
- Priority: `P0`
- Effort: `S`
- Dependencies: admin console
- Description: Ensure tenant impersonation generates explicit audit records with actor, target tenant, timestamp, and session context.
- Acceptance criteria:
- Start and end of impersonation are both logged.
- Audit entries are queryable in the admin and audit views.

### `PR-104` Document privileged access policy
- Type: `Task`
- Priority: `P0`
- Effort: `XS`
- Dependencies: none
- Description: Add an operations doc for privileged access rules, MFA expectations, and admin review cadence.
- Acceptance criteria:
- Documentation exists in `docs/`.
- Policy includes review frequency and emergency-access expectations.

## PR-EPIC-02: Production Observability and Alerting

Epic goal:
- make platform failures visible before they become clinic-impacting incidents

### `PR-201` Add job backlog alerting
- Type: `Story`
- Priority: `P0`
- Effort: `M`
- Dependencies: `jobs`, `system_logs`
- Description: Alert when queued or retrying jobs exceed thresholds.
- Acceptance criteria:
- Queue backlog thresholds are defined.
- Alert triggers on backlog, repeated failure, and retry saturation.

### `PR-202` Add edge-function failure alerting
- Type: `Story`
- Priority: `P0`
- Effort: `M`
- Dependencies: edge function logging
- Description: Alert on repeated failure in reminders, insurance processing, integration endpoints, and report refresh functions.
- Acceptance criteria:
- Failed edge functions surface to operational owners quickly.
- Alert routing is documented.

### `PR-203` Add report refresh health visibility
- Type: `Task`
- Priority: `P0`
- Effort: `S`
- Dependencies: report refresh jobs
- Description: Track last successful materialized-view refresh and expose stale state.
- Acceptance criteria:
- Last successful refresh timestamp is stored or queryable.
- Operators can identify stale reporting state without manual SQL.

### `PR-204` Build operations dashboard for logs and jobs
- Type: `Story`
- Priority: `P0`
- Effort: `M`
- Dependencies: `system_logs`, `client_error_logs`, `jobs`
- Description: Create a usable operational dashboard or admin view for core platform telemetry.
- Acceptance criteria:
- Operators can view job failures, recent system errors, and client error trends.

## PR-EPIC-03: Healthcare Operations Baseline

Epic goal:
- establish the technical and documentation baseline required for healthcare production operation

### `PR-301` Define PHI retention and deletion policy
- Type: `Task`
- Priority: `P0`
- Effort: `S`
- Dependencies: feature report
- Description: Document retention rules for patient, billing, lab, prescription, portal, and audit data.
- Acceptance criteria:
- Policy covers each PHI-bearing feature.
- Archive and delete behavior is documented.

### `PR-302` Create backup and restore validation checklist
- Type: `Task`
- Priority: `P0`
- Effort: `S`
- Dependencies: remote Supabase operations
- Description: Formalize backup verification and restore drills.
- Acceptance criteria:
- Restore drill cadence is defined.
- Validation steps include tenant isolation and RLS verification post-restore.

### `PR-303` Create incident response and access review runbook
- Type: `Task`
- Priority: `P0`
- Effort: `S`
- Dependencies: none
- Description: Add a runbook for production incidents and a recurring access review process.
- Acceptance criteria:
- Incident categories, escalation path, and access review checklist are documented.

### `PR-304` Complete vendor compliance inventory
- Type: `Task`
- Priority: `P0`
- Effort: `M`
- Dependencies: reminder vendors, Agora, email vendors, external integrations
- Description: List third-party services that need healthcare/privacy review or BAA handling.
- Acceptance criteria:
- Vendor inventory exists.
- Each PHI-touching vendor has an assigned review status.

## PR-EPIC-04: Critical End-to-End Test Coverage

Epic goal:
- automate the highest-risk business journeys

### `PR-401` Add appointment lifecycle end-to-end test
- Type: `Story`
- Priority: `P1`
- Effort: `M`
- Dependencies: stable remote test data
- Description: Cover create, update, conflict, and completion paths for appointments.
- Acceptance criteria:
- Booking and update flows run automatically.
- Conflict behavior is asserted.

### `PR-402` Add portal login and scoped-access end-to-end test
- Type: `Story`
- Priority: `P1`
- Effort: `M`
- Dependencies: portal auth flow
- Description: Verify invite-only login and patient-scoped access.
- Acceptance criteria:
- Portal user can log in through the intended path.
- Portal user cannot reach data outside their own scope.

### `PR-403` Add reminder scheduling and delivery integration test
- Type: `Story`
- Priority: `P1`
- Effort: `L`
- Dependencies: reminder queue, vendor stubs or sandbox
- Description: Validate reminder scheduling, retries, and final status transitions.
- Acceptance criteria:
- Reminder queue state changes are tested.
- Retry and failure behavior is asserted.

### `PR-404` Add telemedicine join flow test
- Type: `Story`
- Priority: `P1`
- Effort: `M`
- Dependencies: token edge function, call page
- Description: Cover token creation and session join flow for an appointment-linked video session.
- Acceptance criteria:
- Call session can be started from an appointment path.
- Token issuance and error fallback are tested.

### `PR-405` Add billing and report access smoke suite
- Type: `Story`
- Priority: `P1`
- Effort: `M`
- Dependencies: billing pages, report guards
- Description: Cover invoice workflow plus report access and export basics.
- Acceptance criteria:
- Billing and reports smoke suite runs in CI or scheduled validation.

## PR-EPIC-05: Reminder and Notification Hardening

Epic goal:
- move reminders from foundation to dependable production workflow

### `PR-501` Instrument reminder delivery metrics
- Type: `Task`
- Priority: `P1`
- Effort: `S`
- Dependencies: reminder queue, reminder logs
- Description: Record success, failure, latency, and retry counts per reminder channel.
- Acceptance criteria:
- Delivery metrics are queryable by channel and tenant.

### `PR-502` Add vendor-failure and retry visibility
- Type: `Story`
- Priority: `P1`
- Effort: `M`
- Dependencies: `PR-501`
- Description: Surface external vendor failures and retry saturation clearly to operations.
- Acceptance criteria:
- Failed sends include actionable error context.
- Operators can distinguish temporary and terminal failure.

### `PR-503` Add reminder content and consent governance
- Type: `Task`
- Priority: `P1`
- Effort: `S`
- Dependencies: patient contact preferences
- Description: Define allowed reminder content and enforce consent-aware behavior.
- Acceptance criteria:
- Message templates avoid unsafe PHI exposure.
- Delivery respects patient contact preferences and opt-in rules.

### `PR-504` Add admin reminder configuration validation
- Type: `Story`
- Priority: `P1`
- Effort: `S`
- Dependencies: reminder config UI or admin controls
- Description: Prevent invalid or unsafe reminder configuration at tenant level.
- Acceptance criteria:
- Invalid offsets or empty channel configurations are blocked.

## PR-EPIC-06: Reporting Confidence and Freshness

Epic goal:
- ensure clinic reports are trusted operationally

### `PR-601` Expose report freshness in UI
- Type: `Story`
- Priority: `P1`
- Effort: `S`
- Dependencies: refresh metadata
- Description: Show users when report data was last refreshed.
- Acceptance criteria:
- Reports page displays freshness information.

### `PR-602` Add stale-data warnings
- Type: `Task`
- Priority: `P1`
- Effort: `S`
- Dependencies: `PR-601`
- Description: Display warnings when report data is older than an accepted threshold.
- Acceptance criteria:
- Stale reports are visibly marked.

### `PR-603` Add remote report validation suite
- Type: `Story`
- Priority: `P1`
- Effort: `M`
- Dependencies: remote DB test runner
- Description: Validate core reporting RPCs and materialized-view assumptions against the online environment.
- Acceptance criteria:
- Report validation can be run consistently against remote infrastructure.

## PR-EPIC-07: Patient Portal Maturity

Epic goal:
- strengthen the read-only portal into a safer production patient surface

### `PR-701` Add portal audit trail for document and invoice access
- Type: `Story`
- Priority: `P2`
- Effort: `M`
- Dependencies: portal services, audit infrastructure
- Description: Log sensitive patient-portal access events.
- Acceptance criteria:
- Document and invoice access from the portal are auditable.

### `PR-702` Improve portal states and recovery UX
- Type: `Story`
- Priority: `P2`
- Effort: `S`
- Dependencies: portal pages
- Description: Improve empty, error, loading, and expired-session behavior.
- Acceptance criteria:
- Portal pages handle degraded states cleanly.

### `PR-703` Add portal account lifecycle controls
- Type: `Story`
- Priority: `P2`
- Effort: `M`
- Dependencies: `patient_accounts`
- Description: Strengthen invited, active, disabled account transitions and operational controls.
- Acceptance criteria:
- Portal account state changes are manageable and enforced.

## PR-EPIC-08: Insurance Claims Maturity

Epic goal:
- make insurance workflows more operationally reliable

### `PR-801` Add claim transition service tests
- Type: `Task`
- Priority: `P2`
- Effort: `S`
- Dependencies: insurance service
- Description: Expand automated coverage for valid and invalid status transitions.
- Acceptance criteria:
- Transition matrix is explicitly covered by tests.

### `PR-802` Add insurance operations dashboard
- Type: `Story`
- Priority: `P2`
- Effort: `M`
- Dependencies: claim summary data
- Description: Surface claim pipeline visibility by status and aging.
- Acceptance criteria:
- Teams can view submitted, processing, approved, denied, and reimbursed trends.

### `PR-803` Expand claim audit coverage
- Type: `Task`
- Priority: `P2`
- Effort: `S`
- Dependencies: audit infrastructure
- Description: Ensure claim changes generate enough traceability for support and compliance.
- Acceptance criteria:
- Sensitive claim lifecycle changes are audit logged.

## PR-EPIC-09: Telemedicine Operational Hardening

Epic goal:
- make telemedicine safer, diagnosable, and easier to support

### `PR-901` Add call connection state UX
- Type: `Story`
- Priority: `P2`
- Effort: `M`
- Dependencies: telemedicine page
- Description: Surface connecting, connected, reconnecting, and failed call states clearly.
- Acceptance criteria:
- Users get meaningful feedback throughout the call lifecycle.

### `PR-902` Add telemedicine session telemetry
- Type: `Story`
- Priority: `P2`
- Effort: `M`
- Dependencies: `video_sessions`, call integration
- Description: Capture failure rate, join latency, disconnects, and support diagnostics.
- Acceptance criteria:
- Session quality and failure metrics are queryable.

### `PR-903` Define recording and consent policy
- Type: `Task`
- Priority: `P2`
- Effort: `S`
- Dependencies: vendor review
- Description: Document whether recordings are allowed, how consent works, and what retention rules apply.
- Acceptance criteria:
- Policy exists and is reflected in product behavior.

## PR-EPIC-10: Pharmacy and Procurement Completion

Epic goal:
- complete the medication operations workflow beyond inventory basics

### `PR-1001` Build suppliers and purchase orders UI
- Type: `Story`
- Priority: `P2`
- Effort: `L`
- Dependencies: procurement schema
- Description: Surface suppliers and purchase orders in clinic operations UI.
- Acceptance criteria:
- Users can manage supplier records and purchase order lifecycle.

### `PR-1002` Build stock receipt and batch workflow
- Type: `Story`
- Priority: `P2`
- Effort: `L`
- Dependencies: stock receipts, medication batches
- Description: Support receiving stock into batches with expiry and lot data.
- Acceptance criteria:
- Receipts create or update stock batches correctly.

### `PR-1003` Surface inventory movements and reconciliation
- Type: `Story`
- Priority: `P2`
- Effort: `M`
- Dependencies: inventory movements
- Description: Show stock movement history and detect mismatches.
- Acceptance criteria:
- Movement history is visible.
- Reconciliation mismatches can be investigated.

## PR-EPIC-11: Waiting Room Queue Operations

Epic goal:
- turn queue schema into a usable real-time clinic workflow

### `PR-1101` Build waiting queue management page
- Type: `Story`
- Priority: `P3`
- Effort: `L`
- Dependencies: `appointment_queue`
- Description: Create the queue page and actions for check-in and status progression.
- Acceptance criteria:
- Queue workflow is usable from the clinic app.

### `PR-1102` Add realtime subscription hardening for queue updates
- Type: `Task`
- Priority: `P3`
- Effort: `S`
- Dependencies: realtime layer
- Description: Ensure queue subscriptions are narrowly scoped and operationally safe.
- Acceptance criteria:
- Queue realtime subscriptions are tenant-scoped and efficient.

### `PR-1103` Add queue privacy review
- Type: `Task`
- Priority: `P3`
- Effort: `XS`
- Dependencies: queue UI
- Description: Review displayed patient identifiers for privacy-safe clinic usage.
- Acceptance criteria:
- Queue UI uses approved patient-identification strategy.

## PR-EPIC-12: External Lab and Partner Integrations

Epic goal:
- operationalize integration foundations for partner-grade usage

### `PR-1201` Build external lab connection management UI
- Type: `Story`
- Priority: `P3`
- Effort: `L`
- Dependencies: external lab schema
- Description: Add clinic-admin tooling for external lab connections and mappings.
- Acceptance criteria:
- Connections and mappings can be created, updated, and reviewed.

### `PR-1202` Add replay and dead-letter handling for inbound events
- Type: `Story`
- Priority: `P3`
- Effort: `M`
- Dependencies: inbound webhook pipeline
- Description: Make failed inbound events diagnosable and replayable.
- Acceptance criteria:
- Failed events can be retried or replayed safely.

### `PR-1203` Add partner API key management workflow
- Type: `Story`
- Priority: `P3`
- Effort: `M`
- Dependencies: `integration_api_keys`
- Description: Add UI and operational flow for creating, rotating, and revoking API keys.
- Acceptance criteria:
- API keys can be rotated and audited safely.

### `PR-1204` Add integration health monitoring
- Type: `Task`
- Priority: `P3`
- Effort: `S`
- Dependencies: integration logs
- Description: Track throughput, error rate, and last successful event per integration.
- Acceptance criteria:
- Operators can assess integration health without manual investigation.

## Suggested Initial Sprint Extraction

If the team wants the first backlog slice only, start with:
- `PR-101`
- `PR-103`
- `PR-201`
- `PR-202`
- `PR-301`
- `PR-302`
- `PR-401`
- `PR-402`
- `PR-501`
- `PR-601`

## Definition of Done for This Backlog

A ticket should not be considered done unless:
- code is implemented
- tests are added or updated where applicable
- docs are updated if the workflow or control is operational
- production impact is observable where relevant
- security-sensitive changes are reviewed explicitly
