# Vendor Compliance Inventory

Assessment date: 2026-04-15

Related docs:
- [production-readiness-framework.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/production-readiness-framework.md)
- [feature-production-readiness-report.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/feature-production-readiness-report.md)
- [incident-response-and-access-review.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/incident-response-and-access-review.md)
- [phi-retention-and-deletion.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/phi-retention-and-deletion.md)

## Purpose

This document is the operational inventory of third-party vendors, platforms, and external services used or planned by the clinic platform that require privacy, security, or healthcare-compliance review.

It is intended to answer:
- which vendors are in the runtime path of the product
- whether they can receive PHI, patient identifiers, or privileged operational data
- whether a BAA, DPA, or equivalent review is required
- whether the vendor is approved, conditionally approved, pending, or blocked for production use

This is not legal advice. Final approval requires legal, privacy, security, and customer-contract review where applicable.

## Review Status Values

- `approved`: reviewed and acceptable for the documented use case
- `conditional`: allowed only with the stated restrictions
- `pending`: review required before broad production use
- `blocked`: do not use for PHI-bearing production workflows until gaps are closed
- `not_applicable`: operationally present but not expected to process PHI under the approved model

## Review Criteria

Each vendor should be reviewed for:
- PHI or patient-identifier exposure risk
- data residency and storage behavior
- log retention and support-access behavior
- subcontractors and downstream processors
- security controls and incident-notification commitments
- BAA, DPA, or contractual support for healthcare use
- ability to restrict message content to minimum necessary data

## Current Inventory

| Vendor / service | Product role | Evidence in repo | Likely data exposure | Healthcare/compliance concern | Current review status | Required action before broad production use |
| --- | --- | --- | --- | --- | --- | --- |
| `Supabase` | Core backend: Auth, Postgres, Storage, Functions, Realtime | `README.md`, `src/services/supabase/**`, `supabase/functions/**`, `.env.example` | PHI, patient identifiers, documents, credentials, audit data, logs | Core data processor for nearly all clinic data | `pending` | Complete vendor risk review, confirm healthcare/privacy contractual posture, and formally approve as PHI-bearing platform infrastructure |
| `Cloudflare Pages` | Frontend hosting and static asset delivery | `README.md` deployment section | Request metadata, possible user identifiers, cached assets; PHI should not be intentionally logged | Production app delivery path may still carry PHI-adjacent metadata | `pending` | Review hosting/logging posture, confirm whether current plan and configuration are acceptable for healthcare deployment |
| `Sentry` | Client and edge-function error monitoring | `src/core/observability/sentry.ts`, `supabase/functions/_shared/sentry.ts`, `.env.example` | Error payloads, user identifiers, request metadata; PHI must be excluded | Observability vendor can accidentally receive sensitive payloads | `conditional` | Keep PHI out of telemetry payloads, complete privacy/vendor review, and approve only if sanitized logging is enforced |
| `hCaptcha` | Public anti-bot verification for signup and clinic registration | `src/shared/components/HCaptcha.tsx`, `supabase/functions/_shared/captcha.ts`, `.env.example` | IP/device/browser metadata, signup interaction data | Privacy review needed even if PHI should not be sent | `conditional` | Limit use to public onboarding paths, confirm privacy review, and avoid sending clinical context |
| `Resend` | Email delivery for reminders and invoice emails | `supabase/functions/appointment-reminders/index.ts`, `docs/ops/outbound-health.md` | Patient email, appointment reminder content, invoice email metadata | Patient communications vendor; content and routing must be minimum necessary | `pending` | Complete vendor review, confirm contractual posture, replace placeholder sender configuration, and approve email content policy before rollout |
| `Meta WhatsApp Cloud API` | WhatsApp appointment reminders | `supabase/functions/appointment-reminders/index.ts`, `supabase/migrations/20260316091000_reminders_portal.sql` | Patient phone number, message metadata, reminder text | High patient-communications sensitivity with consent and message-content constraints | `pending` | Complete vendor/privacy review, confirm consent model, define approved templates, and do not enable broadly until approved |
| `Agora` | Telemedicine token issuance and video sessions | `supabase/functions/agora-token/index.ts`, `src/features/telemedicine/TelemedicineCallPage.tsx`, `package.json` | Appointment-linked session metadata, live audio/video traffic, participant identifiers | Highly sensitive telemedicine vendor with strong healthcare and consent implications | `blocked` | Do not use for PHI-bearing production telemedicine until legal/privacy review, consent policy, and vendor approval are complete |
| `External lab partners` | Inbound lab webhooks and mapped test integrations | `supabase/functions/lab-webhook-inbound/index.ts`, `supabase/migrations/20260316096000_external_lab_integrations.sql` | Lab orders, result payloads, patient identifiers, external references | Each partner may process PHI and clinical results | `pending` | Review and approve each lab partner separately before activation; no blanket approval |
| `Partner integration API consumers` | Tenant-specific API access via integration keys | `supabase/functions/integration-api/index.ts`, `supabase/migrations/20260316101000_integration_api_keys.sql` | Depends on enabled scopes; may include PHI-bearing operational data | Every consumer is effectively a separate vendor review | `pending` | Require per-integration review, scoped key approval, and contract/privacy approval before issuing production keys |
| `GitHub Actions / GitHub` | Source control, CI, and deployment automation | `README.md`, `.github/workflows/**` | Secrets, build artifacts, logs; PHI should not be present | Operational vendor, but not intended for PHI-bearing workflows | `conditional` | Keep PHI out of CI artifacts and logs, review secret handling, and restrict production secrets to necessary workflows only |

## Vendor Notes by Feature Area

### Core platform infrastructure

- `Supabase` is the highest-risk vendor because it is the primary processor for patient, billing, laboratory, audit, and storage data.
- No broad healthcare production deployment should be considered complete until its privacy and contractual review is explicitly closed.

### Patient communications

- `Resend` and `Meta WhatsApp Cloud API` must be treated as patient-communications processors.
- Reminder and invoice content must remain minimum necessary.
- Reminder channels must not include diagnosis, lab results, medication names, or any avoidable clinical detail unless explicitly approved.

### Telemedicine

- `Agora` remains blocked pending explicit review because telemedicine carries the highest sensitivity outside the core database platform.
- Review must cover:
  - session metadata
  - media routing
  - recording rules
  - support access
  - retention behavior
  - patient consent language

### External integrations

- External lab and partner API integrations cannot be approved in bulk.
- Each tenant-integrated lab or partner must be reviewed as its own vendor entry with:
  - integration owner
  - approved scopes
  - data classes exposed
  - review date
  - contract/privacy status

## Required Minimum Artifacts Per Vendor

For every `pending`, `conditional`, or `blocked` vendor, maintain:
- vendor owner
- review date
- link to contract or procurement record
- whether PHI is permitted
- whether a BAA or equivalent healthcare addendum is required
- allowed product use cases
- prohibited product use cases
- next review date

## Approval Rules

1. A vendor that can receive PHI must not be treated as production-approved until review status is changed from `pending` or `blocked`.
2. A `conditional` vendor may be used only for the narrow use case documented here.
3. New reminder channels, telemedicine vendors, or external integrations require an explicit inventory update before enablement.
4. Any vendor involved in logs, error telemetry, or support tooling must be configured to avoid unnecessary PHI collection.

## Review Cadence

- Quarterly review of all `pending`, `conditional`, and `blocked` vendors
- Immediate review after:
  - enabling a new vendor-backed feature
  - changing message content or telemedicine behavior
  - onboarding a new external lab or API consumer
  - a privacy or security incident involving a vendor

## Current Gaps

This inventory closes the documentation baseline for `PR-304`, but these operational gaps still remain:
- no formal owner or review date is attached to each current vendor yet
- no separate per-lab-partner inventory records exist yet
- telemedicine vendor approval is still open
- patient-communications vendor review is still open
- hosting and core backend contractual review still need explicit sign-off

## Definition of Done for `PR-304`

This inventory satisfies `PR-304` when:
- the current runtime vendors are listed
- each PHI-touching or patient-communications vendor has a review status
- blocked or pending vendors are clearly identified
- the expected follow-up artifacts are explicit
