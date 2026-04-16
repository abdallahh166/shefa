import { enforceCors, getAllowedOriginsFromEnv } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { initSentry } from "../_shared/sentry.ts";
import { logError, logInfo, persistSystemLog } from "../_shared/logger.ts";
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
  logInfo("process_insurance_claims_request", {
    request_id: requestId,
    tenant_id: tenantId,
    user_id: userId,
    action_type: "process_insurance_claims",
    resource_type: "job",
  });

  const { data: submittedClaims, error } = await adminClient
    .from("insurance_claims")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "submitted")
    .limit(25);

  if (error) {
    logError("process_insurance_claims_failed", {
      request_id: requestId,
      tenant_id: tenantId,
      user_id: userId,
      action_type: "process_insurance_claims",
      resource_type: "job",
      metadata: { error: error.message ?? "Failed to load claims" },
    });
    await persistSystemLog(adminClient, "process-insurance-claims", "error", "process_insurance_claims_failed", {
      request_id: requestId,
      tenant_id: tenantId,
      user_id: userId,
      action_type: "process_insurance_claims",
      resource_type: "job",
      metadata: { error: error.message ?? "Failed to load claims" },
    });
    return new Response(JSON.stringify({ error: error.message ?? "Failed to load claims" }), {
      status: 500,
      headers: baseHeaders,
    });
  }

  const claimIds = (submittedClaims ?? []).map((claim) => claim.id);
  let processedCount = 0;
  if (claimIds.length > 0) {
    const { error: updateError, data: processedClaims } = await adminClient
      .from("insurance_claims")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
      })
      .in("id", claimIds)
      .eq("tenant_id", tenantId)
      .eq("status", "submitted")
      .select("id");

    if (updateError) {
      logError("process_insurance_claims_failed", {
        request_id: requestId,
        tenant_id: tenantId,
        user_id: userId,
        action_type: "process_insurance_claims",
        resource_type: "job",
        metadata: { error: updateError.message ?? "Failed to update claims" },
      });
      await persistSystemLog(adminClient, "process-insurance-claims", "error", "process_insurance_claims_failed", {
        request_id: requestId,
        tenant_id: tenantId,
        user_id: userId,
        action_type: "process_insurance_claims",
        resource_type: "job",
        metadata: { error: updateError.message ?? "Failed to update claims" },
      });
      return new Response(JSON.stringify({ error: updateError.message ?? "Failed to update claims" }), {
        status: 500,
        headers: baseHeaders,
      });
    }

    processedCount = processedClaims?.length ?? 0;
  }

  await adminClient.rpc("log_audit_event", {
    _tenant_id: tenantId,
    _user_id: userId,
    _action: "job_process_insurance_claims",
    _entity_type: "job",
    _entity_id: null,
    _details: { status: "success", submitted_count: submittedClaims?.length ?? 0, processed_count: processedCount },
  });

  return new Response(JSON.stringify({ success: true, submitted: submittedClaims?.length ?? 0, processed: processedCount }), {
    status: 200,
    headers: baseHeaders,
  });
});
