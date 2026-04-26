begin;

select plan(18);

set local role postgres;
set local session_replication_role = replica;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.role', '', true);

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-0000-0000-000000000001', 'Free Clinic', 'free-clinic-ent'),
  ('10000000-0000-0000-0000-000000000002', 'Starter Clinic', 'starter-clinic-ent'),
  ('10000000-0000-0000-0000-000000000003', 'Pro Pharmacy Off', 'pro-pharmacy-off-ent'),
  ('10000000-0000-0000-0000-000000000004', 'Pro Lab Off', 'pro-lab-off-ent'),
  ('10000000-0000-0000-0000-000000000005', 'Enterprise Insurance Off', 'enterprise-insurance-off-ent');

insert into public.profiles (id, user_id, tenant_id, full_name)
values
  ('11000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Free Admin'),
  ('11000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Starter Admin'),
  ('11000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Pro Admin'),
  ('11000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'Pro Lab Disabled Admin'),
  ('11000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'Enterprise Admin'),
  ('11000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000099', null, 'Platform Super Admin');

insert into public.user_roles (id, user_id, role)
values
  ('12000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'clinic_admin'),
  ('12000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'clinic_admin'),
  ('12000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'clinic_admin'),
  ('12000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'clinic_admin'),
  ('12000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'clinic_admin');

insert into public.user_global_roles (id, user_id, role)
values
  ('12500000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000099', 'super_admin');

set local session_replication_role = origin;

insert into public.subscriptions (tenant_id, plan, status, amount, currency, billing_cycle, started_at)
values
  ('10000000-0000-0000-0000-000000000001', 'free', 'active', 0, 'EGP', 'monthly', now()),
  ('10000000-0000-0000-0000-000000000002', 'starter', 'active', 100, 'EGP', 'monthly', now()),
  ('10000000-0000-0000-0000-000000000003', 'pro', 'active', 200, 'EGP', 'monthly', now()),
  ('10000000-0000-0000-0000-000000000004', 'pro', 'active', 200, 'EGP', 'monthly', now()),
  ('10000000-0000-0000-0000-000000000005', 'enterprise', 'active', 500, 'EGP', 'monthly', now())
on conflict (tenant_id) do update
set
  plan = excluded.plan,
  status = excluded.status,
  amount = excluded.amount,
  currency = excluded.currency,
  billing_cycle = excluded.billing_cycle,
  started_at = excluded.started_at,
  expires_at = null;

insert into public.feature_flags (tenant_id, feature_key, enabled)
values
  ('10000000-0000-0000-0000-000000000002', 'advanced_reports', false),
  ('10000000-0000-0000-0000-000000000003', 'pharmacy_module', false),
  ('10000000-0000-0000-0000-000000000003', 'lab_module', true),
  ('10000000-0000-0000-0000-000000000004', 'lab_module', false),
  ('10000000-0000-0000-0000-000000000005', 'insurance_module', false)
on conflict (tenant_id, feature_key) do update
set enabled = excluded.enabled;

insert into public.patients (id, tenant_id, patient_code, full_name, status, user_id)
values
  ('13000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'PT-E001', 'Free Patient', 'active', '30000000-0000-0000-0000-000000000001'),
  ('13000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'PT-E002', 'Starter Patient', 'active', null),
  ('13000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'PT-E003', 'Pro Patient', 'active', null),
  ('13000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'PT-E004', 'Lab Disabled Patient', 'active', '30000000-0000-0000-0000-000000000004'),
  ('13000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'PT-E005', 'Enterprise Patient', 'active', null);

insert into public.patient_accounts (id, tenant_id, patient_id, auth_user_id, status, activated_at)
values
  ('14000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'active', now()),
  ('14000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '13000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'active', now())
on conflict (auth_user_id) do update
set
  tenant_id = excluded.tenant_id,
  patient_id = excluded.patient_id,
  status = excluded.status,
  activated_at = excluded.activated_at;

insert into public.doctors (id, tenant_id, full_name, specialty, status)
values
  ('15000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Dr Pro', 'General', 'available'),
  ('15000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'Dr Lab Disabled', 'General', 'available');

insert into public.invoices (id, tenant_id, patient_id, invoice_code, service, amount, amount_paid, balance_due, status, invoice_date)
values
  ('16000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'INV-ENT-FREE', 'Consultation', 100, 0, 100, 'pending', current_date),
  ('16000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', 'INV-ENT-STARTER', 'Consultation', 150, 0, 150, 'pending', current_date);

insert into public.medications (id, tenant_id, name, category, stock, unit, price, status)
values
  ('17000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Medication Pro', 'General', 15, 'tabs', 10, 'in_stock');

insert into public.lab_orders (id, tenant_id, patient_id, doctor_id, test_name, status)
values
  ('18000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000003', 'CBC', 'pending'),
  ('18000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', '13000000-0000-0000-0000-000000000004', '15000000-0000-0000-0000-000000000004', 'CBC', 'pending');

insert into public.insurance_claims (id, tenant_id, patient_id, provider, service, amount, claim_date, status)
values
  ('19000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', '13000000-0000-0000-0000-000000000005', 'InsureCo', 'Consultation', 250, current_date, 'submitted');

insert into public.insurance_claim_attachments (
  id,
  claim_id,
  tenant_id,
  file_name,
  file_path,
  file_size,
  file_type,
  attachment_type,
  uploaded_by
)
values
  (
    '1a000000-0000-0000-0000-000000000005',
    '19000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005',
    'eob.pdf',
    '10000000-0000-0000-0000-000000000005/eob.pdf',
    512,
    'application/pdf',
    'eob',
    '20000000-0000-0000-0000-000000000005'
  );

insert into storage.objects (bucket_id, name, owner)
values
  ('insurance-attachments', '10000000-0000-0000-0000-000000000005/eob.pdf', '20000000-0000-0000-0000-000000000005');

set local role authenticated;
set local row_security = on;
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*) from public.invoices),
  0::bigint,
  'Free-plan clinic admin cannot read billing rows directly'
);

select throws_ok(
  $$ select * from public.get_invoice_summary(); $$,
  '42501',
  'Feature billing is not enabled for this tenant',
  'Free-plan clinic admin cannot call billing summary RPC'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is(
  (select total_count from public.get_invoice_summary()),
  1::bigint,
  'Starter clinic can still use billing RPCs'
);

select throws_ok(
  $$ select * from public.get_report_overview(); $$,
  '42501',
  'Feature reports is not enabled for this tenant',
  'Reports RPC is blocked when advanced_reports is disabled'
);

select is(
  public.has_tenant_feature_access('billing'),
  true,
  'Starter clinic still has billing entitlement'
);

select is(
  public.has_tenant_feature_access('reports'),
  false,
  'Starter clinic loses reports entitlement when the feature flag is disabled'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*) from public.medications),
  0::bigint,
  'Pro clinic cannot read pharmacy rows when pharmacy_module is disabled'
);

select throws_ok(
  $$ select * from public.get_medication_summary(); $$,
  '42501',
  'Feature pharmacy is not enabled for this tenant',
  'Pharmacy summary RPC is blocked when pharmacy_module is disabled'
);

select is(
  (select count(*) from public.lab_orders),
  1::bigint,
  'Pro clinic still reads lab rows when lab_module remains enabled'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
select is(
  (select count(*) from public.lab_orders),
  0::bigint,
  'Pro clinic cannot read lab rows when lab_module is disabled'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000005', true);
select is(
  (select count(*) from public.insurance_claims),
  0::bigint,
  'Enterprise clinic cannot read insurance claims when insurance_module is disabled'
);

select throws_ok(
  $$ select * from public.get_insurance_summary(); $$,
  '42501',
  'Feature insurance is not enabled for this tenant',
  'Insurance summary RPC is blocked when insurance_module is disabled'
);

select is(
  (select count(*) from public.insurance_claim_attachments),
  0::bigint,
  'Enterprise clinic cannot read insurance attachments when insurance_module is disabled'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'insurance-attachments'),
  0::bigint,
  'Insurance attachment storage bucket is hidden when insurance_module is disabled'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*) from public.invoices),
  0::bigint,
  'Portal user cannot read own invoices when billing is unavailable for the tenant'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000004', true);
select is(
  (select count(*) from public.lab_orders),
  0::bigint,
  'Portal user cannot read own lab orders when lab_module is disabled'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000099', true);
select is(
  (select count(*) from public.invoices),
  2::bigint,
  'Super admin bypasses tenant feature gating for invoices'
);

select is(
  (select count(*) from public.insurance_claim_attachments),
  1::bigint,
  'Super admin bypasses tenant feature gating for insurance attachments'
);

select * from finish();
rollback;
