import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) };
  }

  const userId = claimsData.claims.sub as string;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: globalRoleData } = await adminClient
    .from("user_global_roles")
    .select("role")
    .eq("user_id", userId)
    .is("revoked_at", null)
    ;

  const { data: tenantRoleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    ;

  const globalRoles = (globalRoleData ?? []).map((entry) => entry.role);
  const tenantRoles = (tenantRoleData ?? []).map((entry) => entry.role);
  const isSuperAdmin = globalRoles.includes("super_admin");
  const isClinicAdmin = tenantRoles.includes("clinic_admin");

  if (!isSuperAdmin && !isClinicAdmin) {
    return { error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) };
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (isSuperAdmin) {
    return { adminClient, userId, tenantId: null };
  }

  if (!profile?.tenant_id) {
    return { error: new Response(JSON.stringify({ error: "Tenant not found" }), { status: 400 }) };
  }

  return { adminClient, userId, tenantId: profile.tenant_id };
}
