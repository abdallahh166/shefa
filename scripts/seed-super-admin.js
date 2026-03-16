import { createClient } from "@supabase/supabase-js";

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optionalEnv(name) {
  return process.env[name] ?? null;
}

async function fetchServiceRoleKey({ accessToken, projectRef }) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch project api-keys (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected response from Supabase Management API (api-keys).");
  }

  // Supabase returns api keys as a list. We look for an entry that identifies the service role key.
  const serviceKeyEntry = data.find((k) => {
    const name = String(k?.name ?? "").toLowerCase();
    const type = String(k?.type ?? "").toLowerCase();
    const keyType = String(k?.key_type ?? "").toLowerCase();
    return name.includes("service") || type.includes("service") || keyType.includes("service_role");
  });

  const apiKey = serviceKeyEntry?.api_key ?? serviceKeyEntry?.key ?? serviceKeyEntry?.apiKey;
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("Could not locate service role key in api-keys response.");
  }

  return apiKey;
}

async function getUserByEmail(adminClient, email) {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data?.users?.find((u) => String(u?.email ?? "").toLowerCase() === target);
    if (user) return user;
    if (!data?.users?.length || data.users.length < perPage) return null;
  }
  throw new Error("User search exceeded paging limit (too many users).");
}

async function ensurePlatformTenant(adminClient, { slug, name }) {
  const { data: existing, error: existingErr } = await adminClient
    .from("tenants")
    .select("id, slug, pending_owner_email")
    .eq("slug", slug)
    .maybeSingle();

  if (existingErr) throw existingErr;
  if (existing?.id) return existing;

  const { data: created, error: createErr } = await adminClient
    .from("tenants")
    .insert({ name, slug, pending_owner_email: null })
    .select("id, slug, pending_owner_email")
    .single();

  if (createErr) throw createErr;

  // Best-effort: ensure a subscription exists (if the subscriptions table is present).
  try {
    const { error: subErr } = await adminClient.from("subscriptions").upsert(
      {
        tenant_id: created.id,
        plan: "free",
        status: "active",
        amount: 0,
        currency: "EGP",
        billing_cycle: "monthly",
      },
      { onConflict: "tenant_id", ignoreDuplicates: true },
    );
    void subErr;
  } catch {
    // Ignore: subscriptions may not exist yet in some environments.
  }

  return created;
}

async function seed() {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const email = requiredEnv("SUPER_ADMIN_EMAIL").trim().toLowerCase();
  const password = requiredEnv("SUPER_ADMIN_PASSWORD");

  const fullName = optionalEnv("SUPER_ADMIN_FULL_NAME") ?? "Super Admin";
  const tenantSlug = optionalEnv("SUPER_ADMIN_TENANT_SLUG") ?? "platform-admin";
  const tenantName = optionalEnv("SUPER_ADMIN_TENANT_NAME") ?? "Platform Admin";

  let serviceRoleKey = optionalEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    const accessToken = requiredEnv("SUPABASE_ACCESS_TOKEN");
    const projectRef = requiredEnv("SUPABASE_PROJECT_REF");
    serviceRoleKey = await fetchServiceRoleKey({ accessToken, projectRef });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const tenant = await ensurePlatformTenant(adminClient, { slug: tenantSlug, name: tenantName });

  let user = await getUserByEmail(adminClient, email);
  if (!user) {
    // Prefer the secure "founding owner" flow. If the tenant is already owned (pending_owner_email cleared),
    // set pending_owner_email for this one-time seed; otherwise fall back to an invite_code claim.
    const pending = String(tenant.pending_owner_email ?? "").trim().toLowerCase();
    let userMetadata = { full_name: fullName, tenant_id: tenant.id };

    if (!pending || pending === email) {
      const { error: updErr } = await adminClient
        .from("tenants")
        .update({ pending_owner_email: email })
        .eq("id", tenant.id);

      if (updErr) throw updErr;
    } else {
      const inviteCode = crypto.randomUUID();
      const { error: inviteErr } = await adminClient.from("user_invites").insert({
        tenant_id: tenant.id,
        email,
        role: "clinic_admin",
        invite_code: inviteCode,
        invited_by_user_id: "00000000-0000-0000-0000-000000000000",
      });
      if (inviteErr) throw inviteErr;
      userMetadata = { ...userMetadata, invite_code: inviteCode };
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (createErr) throw createErr;
    user = created?.user ?? null;
    if (!user?.id) throw new Error("User creation succeeded but no user id was returned.");
  }

  // Promote to super_admin (single-role model).
  const { error: roleErr } = await adminClient
    .from("user_roles")
    .update({ role: "super_admin" })
    .eq("user_id", user.id);
  if (roleErr) throw roleErr;

  // Verify role.
  const { data: roleRow, error: verifyErr } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (verifyErr) throw verifyErr;
  if (roleRow?.role !== "super_admin") throw new Error("Role update verification failed.");

  // Do not print secrets.
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: "seed_super_admin",
        email,
        user_id: user.id,
        tenant_id: tenant.id,
        tenant_slug: tenantSlug,
        role: "super_admin",
      },
      null,
      2,
    ),
  );
}

seed().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
