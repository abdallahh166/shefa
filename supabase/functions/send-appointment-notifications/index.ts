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
  logInfo("send_appointment_notifications_request", {
    request_id: requestId,
    tenant_id: tenantId,
    user_id: userId,
    action_type: "send_appointment_notifications",
    resource_type: "job",
  });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cronSecret = Deno.env.get("REMINDER_CRON_SECRET");
  if (!supabaseUrl || !cronSecret) {
    return new Response(JSON.stringify({ error: "Reminder job not configured" }), {
      status: 500,
      headers: baseHeaders,
    });
  }

  const functionUrl = `${supabaseUrl}/functions/v1/appointment-reminders`;
  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    logError("send_appointment_notifications_failed", {
      request_id: requestId,
      tenant_id: tenantId,
      user_id: userId,
      action_type: "send_appointment_notifications",
      resource_type: "job",
      metadata: { error: text },
    });
    await persistSystemLog(adminClient, "send-appointment-notifications", "error", "send_appointment_notifications_failed", {
      request_id: requestId,
      tenant_id: tenantId,
      user_id: userId,
      action_type: "send_appointment_notifications",
      resource_type: "job",
      metadata: { error: text || "Reminder job failed" },
    });
    return new Response(JSON.stringify({ error: text || "Reminder job failed" }), {
      status: 502,
      headers: baseHeaders,
    });
  }

  await adminClient.rpc("log_audit_event", {
    _tenant_id: tenantId,
    _user_id: userId,
    _action: "job_send_appointment_notifications",
    _entity_type: "job",
    _entity_id: null,
    _details: { status: "success" },
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: baseHeaders,
  });
});
