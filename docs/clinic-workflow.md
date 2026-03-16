# Clinic Workflow and Business Rules

This document describes the operational workflow for the clinic and the business rules enforced by the application. It reflects the current service and domain logic in the codebase.

## Scope
- Multi-tenant clinics (each record is scoped by `tenant_id`).
- Core modules: Patients, Appointments, Medical Records, Lab Orders, Prescriptions, Billing, Pharmacy, Documents, Notifications, and Audit.
- Role-based permissions as defined in `src/core/auth/authStore.ts`.

## Roles and Permissions (Summary)
Roles map to permission bundles; UI and service layers enforce these in critical flows.

- `super_admin`: full access, including cross-clinic admin.
- `clinic_admin`: full clinic access including users, billing, reports.
- `doctor`: view appointments and patients, manage medical records.
- `receptionist`: manage patients and appointments.
- `nurse`: view patients, medical records, and appointments.
- `accountant`: manage billing and view reports.

Permission keys used by the services:
- `manage_clinic`, `manage_users`, `view_dashboard`
- `manage_patients`, `view_patients`
- `manage_appointments`, `view_appointments`
- `manage_medical_records`, `view_medical_records`
- `manage_billing`, `view_billing`
- `manage_pharmacy`, `manage_laboratory`, `view_reports`

## Core Entities and Statuses

- Patients
  - Status: `active`, `inactive`
  - Gender: `male`, `female`
  - Blood type: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`

- Appointments
  - Type: `checkup`, `follow_up`, `consultation`, `emergency`
  - Status: `scheduled`, `in_progress`, `completed`, `cancelled`
  - Duration: 1–1440 minutes

- Medical Records
  - Type: `progress_note`, `lab_review`, `acute_visit`, `annual_physical`

- Lab Orders
  - Status: `pending`, `processing`, `completed`

- Prescriptions
  - Status: `active`, `completed`

- Medications (Pharmacy)
  - Status: `in_stock`, `low_stock`, `out_of_stock`

- Invoices (Billing)
  - Status: `paid`, `pending`, `overdue`

- Notifications
  - Read state: `read` boolean (true/false)

## End-to-End Clinic Workflow

1. Access and Tenant Context
   - User signs in and the tenant context is resolved from the user profile.
   - All service calls are scoped to the active `tenant_id`.

2. Patient Intake
   - Create patient with core demographics and contact data.
   - On creation, duplicate detection checks `full_name + date_of_birth`.
   - Patient records are listable, editable, and soft-archivable.

3. Appointment Scheduling
   - Appointments are created for a patient and doctor at a specific time.
   - The system enforces no overlapping appointments per doctor.
   - Status advances from `scheduled` to `in_progress` to `completed` (or `cancelled`).

4. Medical Records
   - Clinicians add medical records tied to patients.
   - Records are categorized by record type and date.

5. Lab Orders and Results
   - Orders are created for a patient and doctor with a test name.
   - Status flows `pending` -> `processing` -> `completed`.
   - Results can be attached and updates are audit logged.

6. Prescriptions
   - Prescriptions are issued for patients with medication and dosage.
   - Status is `active` until completed or archived.

7. Billing and Invoices
   - Invoices are created per patient/service with amount and status.
   - Status changes to `paid` triggers reporting/analytics events.

8. Pharmacy Inventory
   - Medications are created/updated with stock and price.
   - Inventory summaries aggregate counts and value.

9. Patient Documents
   - Documents are uploaded to storage, then metadata is written.
   - Download uses signed access in storage layer.
   - Removal attempts to clean up storage after metadata deletion.

10. Reporting, Notifications, Audit
    - Domain events emit notifications and analytics where applicable.
    - Critical mutations are written to audit logs (appointments, lab, prescriptions).

## Business Rules and Validations

### Patient Rules
- Duplicate detection: if `full_name + date_of_birth` already exists, creation is blocked.
- Deactivation or archive is blocked when the patient has active appointments.
- Optimistic concurrency on updates uses `expected_updated_at` to prevent overwrites.

### Appointment Rules
- Overlap detection: a doctor cannot have overlapping appointments.
- Duration must be 1–1440 minutes.
- Status values must be one of: `scheduled`, `in_progress`, `completed`, `cancelled`.

### Medical Records Rules
- Only users with `manage_medical_records` can create/update.
- Record types are constrained to enumerated values.

### Lab Orders Rules
- Creation and updates that include results are rate-limited.
- Status constrained to `pending`, `processing`, `completed`.

### Prescription Rules
- Only `manage_medical_records` can create/update.
- Status constrained to `active`, `completed`.

### Billing Rules
- Invoice creation is rate-limited.
- Status constrained to `paid`, `pending`, `overdue`.
- Status change to `paid` emits the `InvoicePaid` domain event.

### Pharmacy Rules
- Stock is an integer >= 0.
- Price is a number >= 0.
- Status constrained to `in_stock`, `low_stock`, `out_of_stock`.

### Patient Document Rules
- Max file size: 10 MB.
- Allowed content types:
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `image/webp`
  - `image/gif`
  - `text/plain`
  - `application/msword`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### Rate Limits
Applied per-tenant and per-user where supported:
- `login`: 5 requests / 300 seconds
- `password_reset`: 3 requests / 3600 seconds
- `lab_upload`: 20 requests / 600 seconds
- `document_upload`: 10 requests / 600 seconds
- `invoice_create`: 20 requests / 600 seconds

### Data Lifecycle
- Many entities use soft-delete fields (`deleted_at`, `deleted_by`) with archive/restore flows.
- Some entities support hard delete (e.g., medications inventory removal).

## Domain Events
Emitted for cross-cutting workflows (notifications, audit, analytics):
- `PatientRegistered`
- `AppointmentCreated`
- `LabResultUploaded`
- `PrescriptionIssued`
- `InvoicePaid`

## Related Code
- Schemas: `src/domain/**`
- Services: `src/services/**`
- Roles/permissions: `src/core/auth/authStore.ts`
- Events: `src/core/events/event-types.ts`

