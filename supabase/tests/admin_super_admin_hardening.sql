begin;

select plan(19);

set local role postgres;
set local session_replication_role = replica;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.role', '', true);

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
    '23000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'tenantadmin-admin@test.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '23000000-0000-0000-0000-000000000099',
    'authenticated',
    'authenticated',
    'superadmin@test.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

truncate
  public.audit_logs,
  public.admin_idempotency,
  public.jobs,
  public.subscriptions,
  public.user_global_roles,
  public.user_roles,
  public.profiles,
  public.tenants
restart identity cascade;

insert into public.tenants (id, name, slug, status, status_changed_at)
values
  ('21000000-0000-0000-0000-000000000001', 'Tenant Alpha', 'tenant-alpha-admin', 'active', now()),
  ('21000000-0000-0000-0000-000000000002', 'Tenant Beta', 'tenant-beta-admin', 'active', now());

insert into public.profiles (id, user_id, tenant_id, full_name)
values
  ('22000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'Tenant Admin'),
  ('22000000-0000-0000-0000-000000000099', '23000000-0000-0000-0000-000000000099', null, 'Platform Super Admin');

insert into public.user_roles (id, user_id, role)
values
  ('24000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', 'clinic_admin');

insert into public.user_global_roles (id, user_id, role)
values
  ('25000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000099', 'super_admin');

insert into public.jobs (
  id,
  tenant_id,
  type,
  payload,
  status,
  attempts,
  max_attempts,
  last_error,
  error_code,
  error_class,
  initiated_as
)
values (
  '26000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001',
  'send-email',
  '{"recipient":"ops@example.com"}'::jsonb,
  'failed',
  3,
  3,
  'SMTP timeout',
  'HTTP_503',
  'transient',
  'system'
);

insert into public.audit_logs (
  tenant_id,
  user_id,
  actor_id,
  action,
  action_type,
  entity_type,
  resource_type,
  entity_id,
  resource_id,
  details,
  metadata,
  is_global
)
values (
  '21000000-0000-0000-0000-000000000002',
  '23000000-0000-0000-0000-000000000001',
  '23000000-0000-0000-0000-000000000001',
  'seeded_tenant_audit',
  'seeded_tenant_audit',
  'tenant',
  'tenant',
  '21000000-0000-0000-0000-000000000002',
  '21000000-0000-0000-0000-000000000002',
  '{}'::jsonb,
  '{}'::jsonb,
  false
);

insert into public.audit_logs (
  tenant_id,
  user_id,
  actor_id,
  action,
  action_type,
  entity_type,
  resource_type,
  entity_id,
  resource_id,
  details,
  metadata,
  is_global
)
values (
  null,
  '23000000-0000-0000-0000-000000000099',
  '23000000-0000-0000-0000-000000000099',
  'seeded_global_audit',
  'seeded_global_audit',
  'pricing_plan',
  'pricing_plan',
  null,
  null,
  '{}'::jsonb,
  '{}'::jsonb,
  true
);

insert into public.admin_idempotency (
  key,
  actor_id,
  action_type,
  request_id,
  tenant_id,
  resource_type,
  resource_id,
  response_payload,
  completed_at
)
values (
  '28000000-0000-0000-0000-000000000099',
  '23000000-0000-0000-0000-000000000099',
  'tenant_status_update',
  '27000000-0000-0000-0000-000000000099',
  '21000000-0000-0000-0000-000000000001',
  'tenant',
  '21000000-0000-0000-0000-000000000001',
  null,
  null
);

set local session_replication_role = origin;

select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_ugr_user_active'),
  'user_global_roles active-user index exists'
);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_audit_tenant_time'),
  'audit_logs tenant-time index exists'
);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_audit_actor_time'),
  'audit_logs actor-time index exists'
);

set local role authenticated;
set local row_security = on;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-0000-0000-000000000099","role":"authenticated","aal":"aal2"}',
  true
);
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000099', true);

select is(
  (select count(*) from public.user_global_roles),
  1::bigint,
  'super admin can read active global roles'
);

select is(
  (select count(*) from public.audit_logs),
  2::bigint,
  'super admin can read both tenant-scoped and global audit rows'
);

select is(
  public.admin_update_tenant_status(
    '21000000-0000-0000-0000-000000000001',
    'suspended',
    'Compliance review',
    '27000000-0000-0000-0000-000000000001',
    '28000000-0000-0000-0000-000000000001'
  ),
  '21000000-0000-0000-0000-000000000001'::uuid,
  'tenant lifecycle RPC succeeds for super admin'
);

select is(
  public.admin_update_tenant_status(
    '21000000-0000-0000-0000-000000000001',
    'suspended',
    'Compliance review',
    '27000000-0000-0000-0000-000000000001',
    '28000000-0000-0000-0000-000000000001'
  ),
  '21000000-0000-0000-0000-000000000001'::uuid,
  'tenant lifecycle RPC returns the same result for a duplicate idempotency key'
);

select is(
  (
    select count(*)
    from public.audit_logs
    where request_id = '27000000-0000-0000-0000-000000000001'
      and action_type = 'tenant_status_update'
  ),
  1::bigint,
  'duplicate lifecycle retries do not create duplicate audit rows'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where request_id = '27000000-0000-0000-0000-000000000001'
      and is_global = false
      and tenant_id = '21000000-0000-0000-0000-000000000001'
  ),
  'tenant-scoped admin audit rows are marked non-global'
);

select throws_ok(
  $$
  select public.admin_retry_jobs(
    array['26000000-0000-0000-0000-000000000001'::uuid],
    '27000000-0000-0000-0000-000000000001',
    'Wrong action on reused key',
    '28000000-0000-0000-0000-000000000001'
  );
  $$,
  'P0001',
  'Idempotency key was already used for a different admin action',
  'reusing an idempotency key for a different admin mutation is rejected'
);

select throws_ok(
  $$
  select public.admin_update_tenant_status(
    '21000000-0000-0000-0000-000000000001',
    'active',
    'Manual concurrency probe',
    '27000000-0000-0000-0000-000000000099',
    '28000000-0000-0000-0000-000000000099'
  );
  $$,
  'P0001',
  'Admin action for this idempotency key is still in progress',
  'in-flight idempotency keys fail closed instead of replaying partial work'
);

select is(
  (
    select initiated_as
    from public.admin_retry_jobs(
      array['26000000-0000-0000-0000-000000000001'::uuid],
      '27000000-0000-0000-0000-000000000002',
      'Retry after SMTP fix',
      '28000000-0000-0000-0000-000000000002'
    )
    limit 1
  ),
  'super_admin',
  'manual admin retries stamp jobs with super_admin ownership'
);

select ok(
  exists (
    select 1
    from public.admin_recent_activity(10, null)
    where request_id = '27000000-0000-0000-0000-000000000001'
  ),
  'admin activity stream exposes recent admin actions with request IDs'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$
  insert into public.user_global_roles (user_id, role)
  values ('23000000-0000-0000-0000-000000000001', 'super_admin');
  $$,
  '42501',
  'new row violates row-level security policy for table "user_global_roles"',
  'tenant users cannot bypass safeguards by writing global roles directly'
);

select throws_ok(
  $$
  insert into public.audit_logs (tenant_id, user_id, actor_id, action, action_type, entity_type, resource_type, metadata, is_global)
  values (
    '21000000-0000-0000-0000-000000000001',
    '23000000-0000-0000-0000-000000000001',
    '23000000-0000-0000-0000-000000000001',
    'tamper_attempt',
    'tamper_attempt',
    'tenant',
    'tenant',
    '{}'::jsonb,
    false
  );
  $$,
  '42501',
  'new row violates row-level security policy for table "audit_logs"',
  'tenant users cannot bypass safeguards by writing audit logs directly'
);

select throws_ok(
  $$
  insert into public.admin_idempotency (key, actor_id, action_type, resource_type)
  values (
    '28000000-0000-0000-0000-000000000123',
    '23000000-0000-0000-0000-000000000001',
    'tenant_update',
    'tenant'
  );
  $$,
  '42501',
  'new row violates row-level security policy for table "admin_idempotency"',
  'tenant users cannot write idempotency rows directly'
);

select throws_ok(
  $$ select * from public.admin_recent_activity(10, null); $$,
  '42501',
  'Only super admins can access admin operations',
  'tenant users cannot read the global admin activity stream'
);

select throws_ok(
  $$
  select public.admin_update_tenant_status(
    '21000000-0000-0000-0000-000000000001',
    'deactivated',
    'Forbidden',
    '27000000-0000-0000-0000-000000000010',
    '28000000-0000-0000-0000-000000000010'
  );
  $$,
  '42501',
  'Only super admins can access admin operations',
  'tenant users cannot call super-admin lifecycle RPCs directly'
);

select is(
  (select count(*) from public.audit_logs),
  0::bigint,
  'tenant users cannot read global admin audit rows directly'
);

select * from finish();
rollback;
