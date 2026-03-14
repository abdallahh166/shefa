import { enforceCors, getAllowedOriginsFromEnv } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { initSentry } from "../_shared/sentry.ts";
import { logError, logInfo } from "../_shared/logger.ts";
import { createRequestId } from "../_shared/request.ts";

const allowedOrigins = getAllowedOriginsFromEnv();

Deno.serve(async (req) => {
  initSentry();
  const { corsHeaders, errorResponse } = enforceCors(req, { allowedOrigins });
  const requestId = createRequestId(req);
  const baseHeaders = { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId };
  if (errorResponse) return errorResponse;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: baseHeaders,
    });
  }

  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return new Response(auth.error.body, {
      status: auth.error.status,
      headers: baseHeaders,
    });
  }

  const { adminClient, tenantId, userId } = auth;
  logInfo("generate_monthly_reports_request", {
    request_id: requestId,
    tenant_id: tenantId,
    user_id: userId,
    action_type: "generate_monthly_reports",
    resource_type: "job",
  });

  const { error: refreshError } = await adminClient.rpc("refresh_report_materialized_views");
  if (refreshError) {
    logError("generate_monthly_reports_refresh_failed", {
      request_id: requestId,
      tenant_id: tenantId,
      user_id: userId,
      action_type: "generate_monthly_reports",
      resource_type: "job",
      metadata: { error: refreshError.message ?? "Refresh failed" },
    });
    return new Response(JSON.stringify({ error: refreshError.message ?? "Refresh failed" }), {
      status: 500,
      headers: baseHeaders,
    });
  }

  const { data: overview, error: overviewError } = await adminClient.rpc("get_report_overview");
  if (overviewError) {
    logError("generate_monthly_reports_fetch_failed", {
      request_id: requestId,
      tenant_id: tenantId,
      user_id: userId,
      action_type: "generate_monthly_reports",
      resource_type: "job",
      metadata: { error: overviewError.message ?? "Report fetch failed" },
    });
    return new Response(JSON.stringify({ error: overviewError.message ?? "Report fetch failed" }), {
      status: 500,
      headers: baseHeaders,
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
    headers: baseHeaders,
  });
});
