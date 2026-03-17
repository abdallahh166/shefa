import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RtcTokenBuilder, RtcRole } from "https://esm.sh/agora-access-token@2.0.4";
import { enforceCors, getAllowedOriginsFromEnv } from "../_shared/cors.ts";
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: baseHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: baseHeaders });
  }

  const { appointment_id } = await req.json().catch(() => ({}));
  if (!appointment_id) {
    return new Response(JSON.stringify({ error: "appointment_id is required" }), { status: 400, headers: baseHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const appId = Deno.env.get("AGORA_APP_ID");
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE");

    if (!appId || !appCertificate) {
      return new Response(JSON.stringify({ error: "AGORA_APP_ID or AGORA_APP_CERTIFICATE missing" }), {
        status: 500,
        headers: baseHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, tenant_id")
      .eq("id", appointment_id)
      .maybeSingle();

    if (appointmentError || !appointment?.tenant_id) {
      throw appointmentError ?? new Error("Appointment not found or unauthorized");
    }

    const { data: existing } = await supabase
      .from("video_sessions")
      .select("id, channel_name, tenant_id")
      .eq("appointment_id", appointment_id)
      .maybeSingle();

    let channel = existing?.channel_name;

    if (!channel) {
      channel = `appt-${appointment_id}`;
      const { error: insertError } = await supabase
        .from("video_sessions")
        .insert({
          appointment_id,
          channel_name: channel,
          tenant_id: appointment.tenant_id,
        });
      if (insertError) {
        throw insertError;
      }
    }

    const uid = 0;
    const expireTime = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channel, uid, RtcRole.PUBLISHER, expireTime);

    logInfo("agora_token_generated", {
      request_id: requestId,
      action_type: "agora_token",
      resource_type: "video_session",
      metadata: { appointment_id },
    });

    return new Response(JSON.stringify({ appId, channel, token, uid }), { status: 200, headers: baseHeaders });
  } catch (err) {
    logError("agora_token_failed", {
      request_id: requestId,
      action_type: "agora_token",
      resource_type: "video_session",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }), {
      status: 500,
      headers: baseHeaders,
    });
  }
});
