# Privileged Access Policy

Effective date: 2026-04-27

Related docs:
- [incident-response-and-access-review.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/ops/incident-response-and-access-review.md)
- [production-readiness-roadmap.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/production-readiness-roadmap.md)
- [feature-production-readiness-report.md](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/feature-production-readiness-report.md)

## Purpose

This document defines the production policy for privileged access in the clinic platform.

It covers:
- which roles are treated as privileged
- MFA and `aal2` requirements
- step-up requirements for sensitive actions
- impersonation controls
- review and recovery expectations

## Privileged Roles

Privileged roles in the current production model are:
- `super_admin`
- `clinic_admin`

Role tiers are not interchangeable:
- `super_admin` is platform-scoped and may perform global administrative operations
- `clinic_admin` is tenant-scoped and may never perform cross-tenant or global system mutations

## Security Model

Authorization remains server-owned:
- database role checks
- tenant scope validation
- RPC validation
- server-side step-up grant validation

Client-side privileged session state is UX-only. It may control route visibility and prompts, but it is not trusted by RPCs.

## MFA Policy

All privileged users must have TOTP MFA enrolled before they can use privileged surfaces.

Required rules:
- privileged routes are blocked until at least one verified TOTP factor exists
- privileged actions require the active session to be at `aal2`
- any downgrade from `aal2` immediately removes privileged access

## Step-Up Policy

Sensitive privileged actions require both:
- an `aal2` session
- a server-issued step-up grant

The current model uses single-use scoped grants.

Each grant is bound to:
- actor user ID
- privileged role tier
- action key
- tenant ID when applicable
- resource ID when applicable
- session ID
- short expiration window

A grant must never be reused across multiple privileged actions.

## Sensitive Actions

The following actions require a server-side step-up grant:
- super-admin impersonation start and end
- tenant lifecycle mutations
- subscription and pricing mutations
- job retry operations
- clinic-admin staff invite and comparable tenant-wide user management actions
- clinic-admin security-sensitive account changes

Any new privileged mutation should default to requiring step-up unless explicitly reviewed and documented otherwise.

## Impersonation Controls

Impersonation is restricted to `super_admin`.

Required controls:
- one active impersonation session per actor at a time
- server-side start and stop RPCs only
- start and end events must be audited
- target tenant must be explicit
- step-up is required for both start and stop

Operators must review impersonation activity during access review and after any access-related incident.

## Recovery and Reset

MFA reset or removal for a privileged user must follow a reviewed support or operator path.

Minimum expectations:
- confirm operator identity outside the affected session
- record the reset reason
- audit the reset event
- require the user to re-enroll TOTP before privileged access resumes

## Review Cadence

Review cadence is:
- monthly for `super_admin`
- quarterly for `clinic_admin`
- immediately after any unexplained privileged denial, impersonation anomaly, or access-related incident

Review evidence should include:
- current role assignment
- MFA status
- recent impersonation activity
- recent privileged denials
- confirmation that access is still justified
