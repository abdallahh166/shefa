begin;

select plan(27);

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
    '23000000-0000-0000-0000-000000000098',
    'authenticated',
    'authenticated',
    'backup-superadmin@test.com',
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
  public.admin_impersonation_sessions,
  public.privileged_step_up_grants,
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
  ('22000000-0000-0000-0000-000000000098', '23000000-0000-0000-0000-000000000098', null, 'Backup Platform Super Admin'),
  ('22000000-0000-0000-0000-000000000099', '23000000-0000-0000-0000-000000000099', null, 'Platform Super Admin');

insert into public.user_roles (id, user_id, role)
values
  ('24000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', 'clinic_admin');

insert into public.user_global_roles (id, user_id, role)
values
  ('25000000-0000-0000-0000-000000000098', '23000000-0000-0000-0000-000000000098', 'super_admin'),
  ('25000000-0000-0000-0000-000000000099', '23000000-0000-0000-0000-000000000099', 'super_admin');

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
  json_build_object(
    'sub', '23000000-0000-0000-0000-000000000099',
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', 'super-admin-session-1',
    'amr', json_build_array(
      json_build_object(
        'method', 'password',
        'timestamp', floor(extract(epoch from now()))::bigint
      )
    )
  )::text,
  true
);
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000099', true);

select is(
  (select count(*) from public.user_global_roles),
  2::bigint,
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
    '28000000-0000-0000-0000-000000000001',
    public.issue_privileged_step_up_grant(
      'super_admin'::public.privileged_role_tier,
      'tenant_status_update',
      '21000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      '27000000-0000-0000-0000-000000000001'
    )
  ),
  '21000000-0000-0000-0000-000000000001'::uuid,
  'tenant lifecycle RPC succeeds for super admin with a scoped step-up grant'
);

select is(
  public.admin_update_tenant_status(
    '21000000-0000-0000-0000-000000000001',
    'suspended',
    'Compliance review',
    '27000000-0000-0000-0000-000000000001',
    '28000000-0000-0000-0000-000000000001',
    public.issue_privileged_step_up_grant(
      'super_admin'::public.privileged_role_tier,
      'tenant_status_update',
      '21000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      '27000000-0000-0000-0000-000000000001'
    )
  ),
  '21000000-0000-0000-0000-000000000001'::uuid,
  'tenant lifecycle RPC returns the same result for a duplicate idempotency key with a new scoped grant'
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
      and action_type = 'tenant_status_update'
      and is_global = false
      and tenant_id = '21000000-0000-0000-0000-000000000001'
  ),
  'tenant-scoped admin audit rows are marked non-global'
);

select throws_ok(
  $$
  select public.admin_update_tenant_status(
    '21000000-0000-0000-0000-000000000001',
    'active',
    'Missing grant',
    '27000000-0000-0000-0000-000000000003',
    '28000000-0000-0000-0000-000000000003',
    null
  );
  $$,
  '42501',
  'Valid privileged step-up grant required for this action',
  'super admin lifecycle RPCs reject missing step-up grants'
);

select throws_ok(
  $$
  do $inner$
  declare
    v_grant_id uuid;
  begin
    v_grant_id := public.issue_privileged_step_up_grant(
      'super_admin'::public.privileged_role_tier,
      'tenant_status_update',
      '21000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      '27000000-0000-0000-0000-000000000004'
    );

    perform public.admin_update_tenant_status(
      '21000000-0000-0000-0000-000000000001',
      'active',
      'First use',
      '27000000-0000-0000-0000-000000000004',
      '28000000-0000-0000-0000-000000000004',
      v_grant_id
    );

    perform public.admin_update_tenant_status(
      '21000000-0000-0000-0000-000000000001',
      'suspended',
      'Second use should fail',
      '27000000-0000-0000-0000-000000000005',
      '28000000-0000-0000-0000-000000000005',
      v_grant_id
    );
  end
  $inner$;
  $$,
  '42501',
  'Valid privileged step-up grant required for this action',
  'reused privileged step-up grants are rejected'
);

select throws_ok(
  $$
  select public.admin_update_tenant_status(
    '21000000-0000-0000-0000-000000000002',
    'suspended',
    'Wrong scope',
    '27000000-0000-0000-0000-000000000006',
    '28000000-0000-0000-0000-000000000006',
    public.issue_privileged_step_up_grant(
      'super_admin'::public.privileged_role_tier,
      'tenant_status_update',
      '21000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      '27000000-0000-0000-0000-000000000006'
    )
  );
  $$,
  '42501',
  'Valid privileged step-up grant required for this action',
  'tenant lifecycle RPCs reject grants with the wrong tenant or resource scope'
);

select throws_ok(
  $$
  do $inner$
  declare
    v_grant_id uuid;
  begin
    v_grant_id := public.issue_privileged_step_up_grant(
      'super_admin'::public.privileged_role_tier,
      'tenant_status_update',
      '21000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      '27000000-0000-0000-0000-000000000007'
    );

    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', '23000000-0000-0000-0000-000000000098',
        'role', 'authenticated',
        'aal', 'aal2',
        'session_id', 'super-admin-session-2',
        'amr', json_build_array(
          json_build_object(
            'method', 'password',
            'timestamp', floor(extract(epoch from now()))::bigint
          )
        )
      )::text,
      true
    );
    perform set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000098', true);

    perform public.admin_update_tenant_status(
      '21000000-0000-0000-0000-000000000001',
      'active',
      'Wrong actor',
      '27000000-0000-0000-0000-000000000008',
      '28000000-0000-0000-0000-000000000008',
      v_grant_id
    );
  end
  $inner$;
  $$,
  '42501',
  'Valid privileged step-up grant required for this action',
  'tenant lifecycle RPCs reject grants issued to a different actor or session'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '23000000-0000-0000-0000-000000000099',
    'role', 'authenticated',
    'aal', 'aal1',
    'session_id', 'super-admin-session-1',
    'amr', json_build_array(
      json_build_object(
        'method', 'password',
        'timestamp', floor(extract(epoch from now()))::bigint
      )
    )
  )::text,
  true
);
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000099', true);

select throws_ok(
  $$
  select public.admin_update_tenant_status(
    '21000000-0000-0000-0000-000000000001',
    'active',
    'AAL downgrade',
    '27000000-0000-0000-0000-000000000009',
    '28000000-0000-0000-0000-000000000009',
    null
  );
  $$,
  '42501',
  'Super admin MFA is required for this action',
  'super admin lifecycle RPCs fail closed when the session drops below aal2'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '23000000-0000-0000-0000-000000000099',
    'role', 'authenticated',
    'aal', 'aal2',
    'session_id', 'super-admin-session-1',
    'amr', json_build_array(
      json_build_object(
        'method', 'password',
        'timestamp', floor(extract(epoch from now()))::bigint
      )
    )
  )::text,
  true
);
select set_config('request.jwt.claim.sub', '23000000-0000-0000-0000-000000000099', true);

select throws_ok(
  $$
  select public.admin_retry_jobs(
    array['26000000-0000-0000-0000-000000000001'::uuid],
    '27000000-0000-0000-0000-000000000001',
    'Wrong action on reused key',
    '28000000-0000-0000-0000-000000000099',
    public.issue_privileged_step_up_grant(
      'super_admin'::public.privileged_role_tier,
      'job_retry',
      null,
      '26000000-0000-0000-0000-000000000001',
      '27000000-0000-0000-0000-000000000001'
    )
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
    '28000000-0000-0000-0000-000000000099',
    public.issue_privileged_step_up_grant(
      'super_admin'::public.privileged_role_tier,
      'tenant_status_update',
      '21000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      '27000000-0000-0000-0000-000000000099'
    )
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
      '28000000-0000-0000-0000-000000000002',
      public.issue_privileged_step_up_grant(
        'super_admin'::public.privileged_role_tier,
        'job_retry',
        null,
        '26000000-0000-0000-0000-000000000001',
        '27000000-0000-0000-0000-000000000002'
      )
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

select is(
  (
    select target_tenant_id
    from public.admin_start_tenant_impersonation(
      '21000000-0000-0000-0000-000000000001',
      '27000000-0000-0000-0000-000000000010',
      public.issue_privileged_step_up_grant(
        'super_admin'::public.privileged_role_tier,
        'tenant_impersonation_start',
        '21000000-0000-0000-0000-000000000001',
        '21000000-0000-0000-0000-000000000001',
        '27000000-0000-0000-0000-000000000010'
      )
    )
    limit 1
  ),
  '21000000-0000-0000-0000-000000000001'::uuid,
  'super admins can start a server-bound impersonation session with a scoped grant'
);

select throws_ok(
  $$
  select *
  from public.admin_start_tenant_impersonation(
    '21000000-0000-0000-0000-000000000002',
    '27000000-0000-0000-0000-000000000011',
    public.issue_privileged_step_up_grant(
      'super_admin'::public.privileged_role_tier,
      'tenant_impersonation_start',
      '21000000-0000-0000-0000-000000000002',
      '21000000-0000-0000-0000-000000000002',
      '27000000-0000-0000-0000-000000000011'
    )
  );
  $$,
  'P0001',
  'Only one active impersonation session is allowed per actor',
  'only one active impersonation session is allowed per actor'
);

select is(
  (
    select request_id
    from public.admin_stop_tenant_impersonation(
      '27000000-0000-0000-0000-000000000010',
      public.issue_privileged_step_up_grant(
        'super_admin'::public.privileged_role_tier,
        'tenant_impersonation_end',
        '21000000-0000-0000-0000-000000000001',
        '21000000-0000-0000-0000-000000000001',
        '27000000-0000-0000-0000-000000000010'
      )
    )
    limit 1
  ),
  '27000000-0000-0000-0000-000000000010'::uuid,
  'super admins can end an impersonation session with a new scoped grant'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '23000000-0000-0000-0000-000000000001',
    'role', 'authenticated',
    'aal', 'aal1',
    'session_id', 'tenant-admin-session-1',
    'amr', json_build_array(
      json_build_object(
        'method', 'password',
        'timestamp', floor(extract(epoch from now()))::bigint
      )
    )
  )::text,
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
    '27000000-0000-0000-0000-000000000012',
    '28000000-0000-0000-0000-000000000012',
    null
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
