begin;

select plan(11);

set local role postgres;
set local session_replication_role = replica;

truncate storage.objects;

truncate
  public.insurance_claims,
  public.medications,
  public.invoices,
  public.feature_flags,
  public.subscriptions,
  public.patients,
  public.user_roles,
  public.profiles,
  public.tenants
restart identity cascade;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000011',
    'authenticated',
    'authenticated',
    'rpc-tenant-one@test.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000022',
    'authenticated',
    'authenticated',
    'rpc-tenant-two@test.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

insert into public.tenants (id, name, slug)
values
  ('00000000-0000-0000-0000-000000000011', 'Tenant One', 'tenant-one'),
  ('00000000-0000-0000-0000-000000000022', 'Tenant Two', 'tenant-two');

insert into public.profiles (id, user_id, tenant_id, full_name)
values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000011', 'User One'),
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000022', 'User Two');

insert into public.user_roles (id, user_id, role)
values
  ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000011', 'clinic_admin'),
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000022', 'clinic_admin');

insert into public.subscriptions (tenant_id, plan, status, amount, currency, billing_cycle, started_at)
values
  ('00000000-0000-0000-0000-000000000011', 'enterprise', 'active', 500, 'EGP', 'monthly', now()),
  ('00000000-0000-0000-0000-000000000022', 'starter', 'active', 100, 'EGP', 'monthly', now());

insert into public.feature_flags (tenant_id, feature_key, enabled)
values
  ('00000000-0000-0000-0000-000000000011', 'billing', true),
  ('00000000-0000-0000-0000-000000000011', 'pharmacy_module', true),
  ('00000000-0000-0000-0000-000000000011', 'insurance_module', true)
on conflict (tenant_id, feature_key) do update
set enabled = excluded.enabled;

insert into public.patients (id, tenant_id, patient_code, full_name, status)
values
  ('00000000-0000-0000-0000-000000001111', '00000000-0000-0000-0000-000000000011', 'PT-1001', 'Patient One', 'active'),
  ('00000000-0000-0000-0000-000000002222', '00000000-0000-0000-0000-000000000022', 'PT-2001', 'Patient Two', 'active');

insert into public.invoices (tenant_id, patient_id, invoice_code, service, amount, status)
values
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000001111',
    'INV-A',
    'Consult',
    100,
    'paid'
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000001111',
    'INV-B',
    'Consult',
    50,
    'pending'
  ),
  (
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000002222',
    'INV-C',
    'Consult',
    500,
    'paid'
  );

update public.invoices
set
  amount_paid = case
    when invoice_code in ('INV-A', 'INV-C') then amount
    else 0
  end,
  balance_due = case
    when invoice_code in ('INV-A', 'INV-C') then 0
    else amount
  end;

insert into public.medications (tenant_id, name, category, stock, unit, price, status)
values
  ('00000000-0000-0000-0000-000000000011', 'Med A', 'General', 10, 'tabs', 5, 'in_stock'),
  ('00000000-0000-0000-0000-000000000022', 'Med B', 'General', 20, 'tabs', 7, 'low_stock');

insert into public.insurance_claims (tenant_id, patient_id, provider, service, amount, status)
values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000001111', 'InsureCo', 'Visit', 150, 'submitted'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000002222', 'OtherInsure', 'Visit', 200, 'approved');

insert into storage.objects (bucket_id, name, owner)
values
  ('patient-documents', '00000000-0000-0000-0000-000000000011/doc-a.pdf', '00000000-0000-0000-0000-000000000011'),
  ('patient-documents', '00000000-0000-0000-0000-000000000022/doc-b.pdf', '00000000-0000-0000-0000-000000000022');

insert into storage.objects (bucket_id, name, owner)
values
  ('avatars', '00000000-0000-0000-0000-000000000011/avatar.png', '00000000-0000-0000-0000-000000000011'),
  ('avatars', '00000000-0000-0000-0000-000000000022/avatar.png', '00000000-0000-0000-0000-000000000022');

set local session_replication_role = origin;

select public.refresh_report_materialized_views();

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select total_count from public.get_invoice_summary()),
  2::bigint,
  'Invoice summary returns tenant scoped total count'
);

select is(
  (select paid_amount from public.get_invoice_summary()),
  100::numeric,
  'Invoice summary returns tenant scoped paid amount'
);

select is(
  (select total_count from public.get_medication_summary()),
  1::bigint,
  'Medication summary returns tenant scoped total count'
);

select is(
  (select providers_count from public.get_insurance_summary()),
  1::bigint,
  'Insurance summary returns tenant scoped provider count'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'patient-documents'),
  1::bigint,
  'Storage policies restrict patient documents to tenant paths'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'avatars'),
  1::bigint,
  'Storage policies restrict avatars to tenant users'
);

select is(
  (select count(*) from public.search_global('Patient', 10)),
  1::bigint,
  'Global search returns tenant-scoped patients only'
);

select is(
  (select count(*) from public.search_global('INV', 10)),
  2::bigint,
  'Global search returns tenant-scoped invoices only'
);

select ok(
  public.check_rate_limit('test-key', 2, 60),
  'Rate limit allows first hit'
);

select ok(
  public.check_rate_limit('test-key', 2, 60),
  'Rate limit allows second hit'
);

select ok(
  not public.check_rate_limit('test-key', 2, 60),
  'Rate limit blocks third hit'
);

select * from finish();
rollback;
