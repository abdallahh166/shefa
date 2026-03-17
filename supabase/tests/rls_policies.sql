begin;

select plan(25);

-- Use a superuser role for setup to bypass RLS and foreign keys.
set local role postgres;
set local session_replication_role = replica;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.role', '', true);

TRUNCATE
  public.audit_logs,
  public.feature_flags,
  public.patient_documents,
  public.insurance_claims,
  public.lab_orders,
  public.invoices,
  public.prescriptions,
  public.appointments,
  public.doctors,
  public.patients,
  public.user_roles,
  public.profiles,
  public.tenants
RESTART IDENTITY CASCADE;

insert into public.tenants (id, name, slug)
values
  ('00000000-0000-0000-0000-000000000001', 'Tenant One', 'tenant-one'),
  ('00000000-0000-0000-0000-000000000002', 'Tenant Two', 'tenant-two');

insert into public.profiles (id, user_id, tenant_id, full_name)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'User One'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', 'User Two');

insert into public.user_roles (id, user_id, role)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000011', 'clinic_admin'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000012', 'clinic_admin');

set local session_replication_role = origin;

insert into public.patients (tenant_id, patient_code, full_name, status)
values
  ('00000000-0000-0000-0000-000000000001', 'PT-000001', 'Patient A', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'PT-000002', 'Patient B', 'active');

insert into public.doctors (id, tenant_id, full_name, specialty, status)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'Dr One', 'General', 'available'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000002', 'Dr Two', 'General', 'available');

insert into public.doctor_schedules (tenant_id, doctor_id, day_of_week, start_time, end_time, is_active)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000301', 1, '09:00', '17:00', true),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000302', 1, '09:00', '17:00', true);

insert into public.medications (tenant_id, name, category, stock, unit, price, status)
values
  ('00000000-0000-0000-0000-000000000001', 'Med One', 'General', 10, 'tabs', 5, 'in_stock'),
  ('00000000-0000-0000-0000-000000000002', 'Med Two', 'General', 20, 'tabs', 7, 'low_stock');

insert into public.appointments (tenant_id, patient_id, doctor_id, appointment_date, status, type)
values
  ('00000000-0000-0000-0000-000000000001', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000001' limit 1), '00000000-0000-0000-0000-000000000301', '2026-03-10T09:00:00Z', 'scheduled', 'checkup'),
  ('00000000-0000-0000-0000-000000000002', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000002' limit 1), '00000000-0000-0000-0000-000000000302', '2026-03-10T10:00:00Z', 'scheduled', 'checkup');

insert into public.appointment_reminder_log (appointment_id, tenant_id, notified_user_id, channel)
values
  (
    (select id from public.appointments where tenant_id = '00000000-0000-0000-0000-000000000001' limit 1),
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000011',
    'in_app'
  ),
  (
    (select id from public.appointments where tenant_id = '00000000-0000-0000-0000-000000000002' limit 1),
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000012',
    'in_app'
  );

insert into public.prescriptions (tenant_id, patient_id, doctor_id, medication, dosage, status)
values
  ('00000000-0000-0000-0000-000000000001', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000001' limit 1), '00000000-0000-0000-0000-000000000301', 'Rx One', '1/day', 'active'),
  ('00000000-0000-0000-0000-000000000002', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000002' limit 1), '00000000-0000-0000-0000-000000000302', 'Rx Two', '1/day', 'active');

insert into public.invoices (tenant_id, patient_id, invoice_code, service, amount, status)
values
  ('00000000-0000-0000-0000-000000000001', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000001' limit 1), 'INV-001', 'Consult', 100, 'paid'),
  ('00000000-0000-0000-0000-000000000002', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000002' limit 1), 'INV-002', 'Consult', 200, 'paid');

insert into public.lab_orders (tenant_id, patient_id, doctor_id, test_name, status)
values
  ('00000000-0000-0000-0000-000000000001', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000001' limit 1), '00000000-0000-0000-0000-000000000301', 'CBC', 'pending'),
  ('00000000-0000-0000-0000-000000000002', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000002' limit 1), '00000000-0000-0000-0000-000000000302', 'CBC', 'pending');

insert into public.insurance_claims (tenant_id, patient_id, provider, service, amount, status)
values
  ('00000000-0000-0000-0000-000000000001', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000001' limit 1), 'InsureCo', 'Visit', 150, 'submitted'),
  ('00000000-0000-0000-0000-000000000002', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000002' limit 1), 'InsureCo', 'Visit', 150, 'submitted');

insert into public.patient_documents (tenant_id, patient_id, file_name, file_path, file_size, file_type, uploaded_by)
values
  ('00000000-0000-0000-0000-000000000001', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000001' limit 1), 'doc-a.pdf', '00000000-0000-0000-0000-000000000001/doc-a.pdf', 10, 'application/pdf', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000002', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000002' limit 1), 'doc-b.pdf', '00000000-0000-0000-0000-000000000002/doc-b.pdf', 10, 'application/pdf', '00000000-0000-0000-0000-000000000012');

insert into public.notifications (tenant_id, user_id, title, body, type)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Notice 1', 'Hello', 'info'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 'Notice 2', 'Hello', 'info');

insert into public.feature_flags (tenant_id, feature_key, enabled)
values
  ('00000000-0000-0000-0000-000000000001', 'pharmacy_module', true),
  ('00000000-0000-0000-0000-000000000002', 'pharmacy_module', false);

set local session_replication_role = replica;
insert into public.client_error_logs (tenant_id, user_id, message)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'Error One'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 'Error Two');
set local session_replication_role = origin;

insert into public.audit_logs (tenant_id, user_id, action, entity_type, entity_id)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'update', 'patients', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000001' limit 1)),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 'update', 'patients', (select id from public.patients where tenant_id = '00000000-0000-0000-0000-000000000002' limit 1));

-- Switch into an authenticated context for RLS tests.
set local role authenticated;
set local row_security = on;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.patients),
  1::bigint,
  'Tenant user sees only their tenant patients'
);

select lives_ok(
  $$
  insert into public.patients (tenant_id, patient_code, full_name, status)
  values ('00000000-0000-0000-0000-000000000001', 'PT-000003', 'Patient C', 'active');
  $$,
  'Tenant user can insert patients in their tenant'
);

select throws_ok(
  $$
  insert into public.patients (tenant_id, patient_code, full_name, status)
  values ('00000000-0000-0000-0000-000000000002', 'PT-000004', 'Patient D', 'active');
  $$,
  '42501',
  'new row violates row-level security policy for table "patients"',
  'Tenant user cannot insert patients in other tenants'
);

select is(
  (select count(*) from public.appointments),
  1::bigint,
  'Tenant user sees only their tenant appointments'
);

select is(
  (select count(*) from public.prescriptions),
  1::bigint,
  'Tenant user sees only their tenant prescriptions'
);

select is(
  (select count(*) from public.invoices),
  1::bigint,
  'Tenant user sees only their tenant invoices'
);

select is(
  (select count(*) from public.lab_orders),
  1::bigint,
  'Tenant user sees only their tenant lab orders'
);

select is(
  (select count(*) from public.insurance_claims),
  1::bigint,
  'Tenant user sees only their tenant insurance claims'
);

select is(
  (select count(*) from public.patient_documents),
  1::bigint,
  'Tenant user sees only their tenant patient documents'
);

select is(
  (select count(*) from public.doctors),
  1::bigint,
  'Tenant user sees only their tenant doctors'
);

select is(
  (select count(*) from public.doctor_schedules),
  1::bigint,
  'Clinic admin sees only their tenant schedules'
);

select throws_ok(
  $$
  insert into public.doctor_schedules (tenant_id, doctor_id, day_of_week, start_time, end_time, is_active)
  values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000302', 2, '10:00', '12:00', true);
  $$,
  '42501',
  'new row violates row-level security policy for table "doctor_schedules"',
  'Clinic admin cannot insert schedules for other tenants'
);

select is(
  (select count(*) from public.medications),
  1::bigint,
  'Tenant user sees only their tenant medications'
);

select is(
  (select count(*) from public.notifications),
  1::bigint,
  'User sees only own notifications'
);

select is(
  (select count(*) from public.feature_flags),
  1::bigint,
  'Tenant user sees only their tenant feature flags'
);

select lives_ok(
  $$
  insert into public.feature_flags (tenant_id, feature_key, enabled)
  values ('00000000-0000-0000-0000-000000000001', 'lab_module', true);
  $$,
  'Clinic admin can manage feature flags in their tenant'
);

select throws_ok(
  $$
  insert into public.feature_flags (tenant_id, feature_key, enabled)
  values ('00000000-0000-0000-0000-000000000002', 'insurance_module', true);
  $$,
  '42501',
  'new row violates row-level security policy for table "feature_flags"',
  'Clinic admin cannot manage feature flags for other tenants'
);

select is(
  (select count(*) from public.client_error_logs),
  1::bigint,
  'Clinic admin sees only tenant client error logs'
);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'Tenant user sees only tenant profiles'
);

select is(
  (select count(*) from public.user_roles),
  1::bigint,
  'User sees only own roles'
);

select is(
  (select count(*) from public.tenants),
  1::bigint,
  'User sees only own tenant record'
);

select is(
  (select count(*) from public.appointment_reminder_log),
  0::bigint,
  'Authenticated users cannot access appointment reminder log'
);

select is(
  (select count(*) from public.audit_logs),
  2::bigint,
  'Clinic admin can view audit logs in their tenant'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select is(
  (select count(*) from public.patients),
  1::bigint,
  'Other tenant user sees only their tenant patients'
);

select is(
  (select count(*) from public.audit_logs),
  1::bigint,
  'Other tenant admin sees only their audit logs'
);

select * from finish();
rollback;
