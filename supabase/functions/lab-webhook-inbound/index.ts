import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceCors, getAllowedOriginsFromEnv } from "../_shared/cors.ts";
import { initSentry } from "../_shared/sentry.ts";
import { logError, logInfo } from "../_shared/logger.ts";
import { createRequestId } from "../_shared/request.ts";

const allowedOrigins = getAllowedOriginsFromEnv();

type LabWebhookPayload = {
  connection_id?: string;
  event_type?: string;
  payload?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  initSentry();
  const { corsHeaders, errorResponse } = enforceCors(req, {
    allowedOrigins,
    allowNoOrigin: true,
  });
  const requestId = createRequestId(req);
  const baseHeaders = { ...corsHeaders, "Content-Type": "application/json", "x-request-id": requestId };

  if (errorResponse) return errorResponse;
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: baseHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = (req.body ? await req.json().catch(() => ({})) : {}) as LabWebhookPayload;
    const connectionId = body.connection_id ?? req.headers.get("x-connection-id");
    const eventType = body.event_type ?? "lab_event";
    const payload = body.payload ?? (body as Record<string, unknown>);

    if (!connectionId) {
      return new Response(JSON.stringify({ error: "connection_id is required" }), { status: 400, headers: baseHeaders });
    }

    const { data: connection, error: connectionError } = await adminClient
      .from("external_lab_connections")
      .select("id, tenant_id, status, config")
      .eq("id", connectionId)
      .maybeSingle();

    if (connectionError || !connection) {
      return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404, headers: baseHeaders });
    }

    if (connection.status !== "active") {
      return new Response(JSON.stringify({ error: "Connection inactive" }), { status: 403, headers: baseHeaders });
    }

    const configuredSecret = (connection.config as Record<string, unknown>)?.webhook_secret as string | undefined;
    const providedSecret = req.headers.get("x-webhook-secret") ?? req.headers.get("x-lab-secret") ?? undefined;
    if (configuredSecret && configuredSecret !== providedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: baseHeaders });
    }

    const { data: eventData, error: insertError } = await adminClient
      .from("external_lab_events")
      .insert({
        tenant_id: connection.tenant_id,
        connection_id: connection.id,
        event_type: eventType,
        payload,
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    logInfo("lab_webhook_received", {
      request_id: requestId,
      action_type: "lab_webhook",
      resource_type: "external_lab_event",
      metadata: { connection_id: connection.id, event_type: eventType },
    });

    return new Response(JSON.stringify({ success: true, event_id: eventData?.id }), { status: 200, headers: baseHeaders });
  } catch (err) {
    logError("lab_webhook_failed", {
      request_id: requestId,
      action_type: "lab_webhook",
      resource_type: "external_lab_event",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }), {
      status: 500,
      headers: baseHeaders,
    });
  }
});
