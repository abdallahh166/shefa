# Clinic Management System (Multi-tenant SaaS)

Production-grade clinic management system built with React, Vite, Supabase (Auth, Postgres, Storage), React Query, and Zustand. The codebase is organized into domain, services, repositories, and feature modules with tenant isolation enforced at the database and service layers.

## Overview

Core capabilities:
- Multi-tenant clinics
- Patients, doctors, appointments, prescriptions, labs, billing, insurance
- Reporting with SQL-side aggregation
- Audit logging for critical actions
- Supabase RPCs for sensitive operations

## Feature modules

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

## System characteristics

- React + Vite frontend with Supabase backend
- Domain/service/repository layering
- SQL-side reporting aggregation
- Tenant-scoped queries
- Schema validation with Zod
- Audit logging

## Tech stack

- React 18 + Vite
- TypeScript + Zod
- React Query + Zustand
- Supabase (Auth, Postgres, Storage, Edge Functions)
- Tailwind CSS + shadcn/ui

## Local development quick start

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

## Remote development

1. Ensure `.env` points to the remote project.
2. Use remote environment:
```
npm run env:remote
```

## Environment switching

We use `.env` for remote and `.env.local` for local.

Commands:
```
npm run env:local
npm run env:remote
npm run env:status
```

Templates:
- `.env.example` (remote template)
- `.env.local.example` (local template)

## Supabase workflows

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

## Scripts

- `npm run dev` - start Vite
- `npm run build` - build for production
- `npm run lint` - lint
- `npm run test` - unit tests
- `npm run test:db` - Supabase db tests
- `npm run env:local` - switch to local env
- `npm run env:remote` - switch to remote env
- `npm run env:status` - check which env is active

## Project structure

```
src/
  app/         App wiring and routes
  core/        Cross-cutting concerns (auth, config)
  domain/      Zod schemas + types
  services/    Service layer + repositories
  features/    Feature modules (UI + hooks)
  shared/      Shared UI + utilities
```

## Security notes

- Client uses the publishable key only.
- Service role key must never be used on the frontend.
- RLS is enabled across all multi-tenant tables.
- Storage buckets are tenant-scoped and sensitive assets use signed URLs.

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
- run smoke tests

## Contributing

1. Create a branch
2. Add migrations for schema changes (never edit applied migrations)
3. Run `supabase test db`
4. Open a PR

