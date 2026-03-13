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

  const { error: refreshError } = await adminClient.rpc("refresh_report_materialized_views");
  if (refreshError) {
    return new Response(JSON.stringify({ error: refreshError.message ?? "Refresh failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: overview, error: overviewError } = await adminClient.rpc("get_report_overview");
  if (overviewError) {
    return new Response(JSON.stringify({ error: overviewError.message ?? "Report fetch failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await adminClient.rpc("log_audit_event", {
    _tenant_id: tenantId,
    _user_id: userId,
    _action: "job_generate_monthly_reports",
    _entity_type: "job",
    _entity_id: null,
    _details: { status: "success" },
  });

  return new Response(JSON.stringify({ success: true, overview }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
