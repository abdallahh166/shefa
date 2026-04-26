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

async function seed() {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const email = requiredEnv("SUPER_ADMIN_EMAIL").trim().toLowerCase();
  const password = requiredEnv("SUPER_ADMIN_PASSWORD");

  const fullName = optionalEnv("SUPER_ADMIN_FULL_NAME") ?? "Super Admin";

  let serviceRoleKey = optionalEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    const accessToken = requiredEnv("SUPABASE_ACCESS_TOKEN");
    const projectRef = requiredEnv("SUPABASE_PROJECT_REF");
    serviceRoleKey = await fetchServiceRoleKey({ accessToken, projectRef });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let user = await getUserByEmail(adminClient, email);
  if (!user) {
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, tenant_id: null },
    });

    if (createErr) throw createErr;
    user = created?.user ?? null;
    if (!user?.id) throw new Error("User creation succeeded but no user id was returned.");
  } else {
    const { data: updated, error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        full_name: fullName,
        tenant_id: null,
      },
    });
    if (updateErr) throw updateErr;
    user = updated?.user ?? user;
  }

  const { error: profileErr } = await adminClient
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        tenant_id: null,
        full_name: fullName,
      },
      { onConflict: "user_id" },
    );
  if (profileErr) throw profileErr;

  // Super admins are global-only and must not retain a tenant-scoped role.
  const { error: deleteTenantRoleErr } = await adminClient
    .from("user_roles")
    .delete()
    .eq("user_id", user.id)
    .eq("role", "super_admin");
  if (deleteTenantRoleErr) throw deleteTenantRoleErr;

  const { error: globalRoleErr } = await adminClient
    .from("user_global_roles")
    .upsert(
      {
        user_id: user.id,
        role: "super_admin",
        granted_by: null,
        break_glass: false,
        break_glass_reason: null,
      },
      { onConflict: "user_id,role" },
    );
  if (globalRoleErr) throw globalRoleErr;

  const { data: roleRow, error: verifyErr } = await adminClient
    .from("user_global_roles")
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
        tenant_id: null,
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
