import { enforceCors, getAllowedOriginsFromEnv } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";

const allowedOrigins = getAllowedOriginsFromEnv();

Deno.serve(async (req) => {
  const { corsHeaders, errorResponse } = enforceCors(req, { allowedOrigins });
  if (errorResponse) return errorResponse;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return new Response(auth.error.body, {
      status: auth.error.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { adminClient, tenantId, userId } = auth;

  const { data: pendingClaims, error } = await adminClient
    .from("insurance_claims")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .limit(25);

  if (error) {
    return new Response(JSON.stringify({ error: error.message ?? "Failed to load claims" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await adminClient.rpc("log_audit_event", {
    _tenant_id: tenantId,
    _user_id: userId,
    _action: "job_process_insurance_claims",
    _entity_type: "job",
    _entity_id: null,
    _details: { status: "success", pending_count: pendingClaims?.length ?? 0 },
  });

  return new Response(JSON.stringify({ success: true, pending: pendingClaims?.length ?? 0 }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
