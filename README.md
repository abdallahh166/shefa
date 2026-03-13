# Clinic Management System (Multi-tenant SaaS)

Production-grade clinic management system built with React, Vite, Supabase (Auth, Postgres, Storage), React Query, and Zustand. The codebase is organized into domain, services, repositories, and feature modules with tenant isolation enforced at the database and service layers.

## TL;DR

- Multi-tenant healthcare SaaS with strict tenant isolation at RLS + repository layers.
- Domain models validated via Zod, service layer enforces business rules.
- Supabase RPCs handle sensitive or aggregate operations.
- Materialized views power reports; scheduled refresh is always configured.
- Storage is tenant-scoped with private buckets and signed URL access.

## Overview

Core capabilities:
- Multi-tenant clinics
- Patients, doctors, appointments, prescriptions, labs, billing, insurance
- Reporting with SQL-side aggregation
- Audit logging for critical actions
- Supabase RPCs for sensitive operations

## Feature Modules

### 1. Authentication & Security
Features:
- User authentication (login/logout/session handling)
- Password reset / account recovery
- Role-based access control (RBAC)
- Multi-tenant workspace isolation
- Audit logging for critical actions
Security controls:
- Tenant isolation
- Permission-based UI access
- Activity tracking via audit logs

### 2. Dashboard & System Overview
Features:
- Key performance indicators (KPIs)
- Recent activity feed
- Daily appointment overview
- Billing summary
- Lab and prescription alerts
Typical metrics:
- Today's appointments
- Active patients
- Pending lab results
- Outstanding invoices

### 3. Patient Management
Features:
- Patient profiles
- Medical history
- Status tracking
- Search and filtering
- Patient document management
Patient documents:
- Upload documents
- List stored files
- Delete documents
- Secure storage access

### 4. Doctor Management
Features:
- Doctor profiles
- Doctor status (active/inactive)
- Specialty tracking
- Doctor availability schedules
Scheduling:
- Weekly schedules
- Time slot management
- Schedule validation rules

### 5. Appointment Management
Features:
- List view
- Calendar view
- Create appointment
- Reschedule appointments
- Cancel appointments
- Status tracking
Workflow states:
- Scheduled
- Confirmed
- Completed
- Cancelled
- No-show

### 6. Prescription Management
Features:
- Create prescriptions
- View patient prescriptions
- Medication details
- Prescription history

### 7. Billing & Invoicing
Features:
- Invoice creation
- Billing summaries
- Payment tracking
- Invoice status management
Invoice states:
- Draft
- Pending
- Paid
- Cancelled

### 8. Pharmacy Inventory
Features:
- Medication catalog
- Stock tracking
- Inventory updates
- Pharmacy summary reports

### 9. Laboratory Management
Features:
- Create lab orders
- Track lab status
- Upload or record lab results
- Patient lab history
Lab states:
- Ordered
- In progress
- Completed
- Reviewed

### 10. Insurance Management
Features:
- Insurance claim records
- Claim status tracking
- Patient insurance linking
- Claim summary reports

### 11. Reports & Analytics
Features:
- Appointment analytics
- Revenue reports
- Patient growth metrics
- Status breakdowns
- Monthly and daily summaries
Exports:
- CSV export
- PDF reports where available

### 12. Notifications
Features:
- System notifications
- Status updates
- Important reminders
Examples:
- Appointment changes
- Lab result availability
- Invoice status updates

### 13. Settings & Administration
Features:
- Clinic profile settings
- User management
- Role and permission management
- Notification preferences
- Audit log viewer
- Tenant configuration

## Architecture

### Layering
- `domain`: Zod schemas + types. Pure validation and invariants.
- `services`: Business logic, validation, tenant resolution, error handling.
- `repositories`: All direct Supabase access (no Supabase in UI).
- `features`: UI modules + hooks.
- `core`: Auth, env validation, shared app infrastructure.

### Dependency Flow
```
features -> services -> repositories -> Supabase
features -> domain (types/schemas)
services -> domain (validation)
repositories -> Supabase client
```

### Tenant Context
- Tenant is derived from authenticated user context in services (`getTenantContext`).
- Repositories enforce tenant scoping in queries.
- RLS policies enforce tenant isolation in the database.

## Data Flow (High Level)

1. UI triggers service calls.
2. Services validate input with Zod, resolve tenant/user context.
3. Repositories execute tenant-scoped queries or RPCs.
4. Output is validated against domain schemas.
5. React Query caches data with tenant-scoped keys.

## Database & Schema Highlights

- Tenant isolation via `tenant_id` on all data tables.
- Exclusion constraints for preventing overlapping appointments and doctor schedules.
- Trigram indexes for fast ILIKE search.
- Report materialized views for aggregate KPIs.
- Audit logs for critical domain changes.

## Security Model

- RLS enabled across all multi-tenant tables.
- RBAC enforced at RLS + service layer.
- Storage buckets private; access via signed URLs.
- Edge functions hardened with CAPTCHA, rate limiting, and email verification.
- Service role keys used only in server-side functions.

## Performance & Scalability

- Server-side pagination for large lists.
- Typeahead search with limits and server-side filtering.
- Materialized views for reports (scheduled refresh).
- Tenant-scoped React Query keys to avoid cache bleeding.
- Realtime invalidation targets specific query keys.

## Observability

- Client error logs stored in `client_error_logs` (tenant-scoped).
- Audit logs for critical actions (patients, appointments, invoices, documents, lab orders, prescriptions, insurance).

## Environment & Configuration

Environment validation is enforced at startup in `src/core/env/env.ts`.

Required variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional variables:
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_CAPTCHA_SITE_KEY`

Templates:
- `.env.example` (remote)
- `.env.local.example` (local)

## Local Development Quick Start

1. Install dependencies:
```
npm install
```

2. Start Supabase locally:
```
supabase start
```

3. Use local environment:
```
npm run env:local
```

4. Start the app:
```
npm run dev
```

## Remote Development

1. Ensure `.env` points to the remote project.
2. Use remote environment:
```
npm run env:remote
```

## Environment Switching

We use `.env` for remote and `.env.local` for local.

Commands:
```
npm run env:local
npm run env:remote
npm run env:status
```

## Supabase Workflows

Apply migrations locally:
```
supabase migration up
```

Reset local DB:
```
supabase db reset
```

Push migrations to remote:
```
supabase db push
```

Run DB tests (pgTAP):
```
supabase test db
```

## Testing

- Unit tests: `npm run test`
- Database policy + RPC tests: `supabase test db`
- Build validation: `npm run build`

## Scripts

- `npm run dev` - start Vite
- `npm run build` - build for production
- `npm run lint` - lint
- `npm run test` - unit tests
- `npm run test:db` - Supabase db tests
- `npm run env:local` - switch to local env
- `npm run env:remote` - switch to remote env
- `npm run env:status` - check which env is active

## Project Structure

```
src/
  app/         App wiring and routes
  core/        Cross-cutting concerns (auth, env, config)
  domain/      Zod schemas + types
  services/    Service layer + repositories
  features/    Feature modules (UI + hooks)
  shared/      Shared UI + utilities
```

## Security Notes

- Client uses publishable key only.
- Service role key must never be used on the frontend.
- RLS is enabled across all multi-tenant tables.
- Storage buckets are private; sensitive assets use signed URLs.

## Documentation

- Local vs remote usage: `docs/local-and-remote-supabase.md`
- RLS review: `docs/rls-policy-review-2026-03-11.md`
- Production hardening: `docs/production-hardening.md`

## Deployment

This repo is framework-agnostic; deploy with your preferred platform.
Before production:
- `npm run build`
- `supabase db diff` against production
- `supabase db push` to production
- Run smoke tests

## Architecture and Risk Analysis

### Strengths
- Clear domain/service/repository separation.
- Tenant isolation enforced at multiple layers.
- Zod validation at service boundaries.
- RLS + audit logging for critical data.
- Report aggregates via materialized views.

### Remaining Considerations
- Materialized view refresh schedule should match business requirements for reporting freshness.
- Realtime invalidation is optimized but still domain-level; record-level invalidation could further reduce refetch.
- Large patient histories are now paginated; UI should expose pagination controls where needed.

### Security Posture Summary
- RLS coverage expanded and tested.
- Storage policies enforce tenant isolation.
- Edge functions hardened with CAPTCHA, rate limits, and email verification.

## Contributing

1. Create a branch
2. Add migrations for schema changes (never edit applied migrations)
3. Run `supabase test db`
4. Open a PR
