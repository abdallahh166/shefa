import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceCors, getAllowedOriginsFromEnv } from "../_shared/cors.ts";
import { initSentry } from "../_shared/sentry.ts";
import { logError, logInfo } from "../_shared/logger.ts";
import { createRequestId } from "../_shared/request.ts";

const allowedOrigins = getAllowedOriginsFromEnv();

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getCount(
  client: ReturnType<typeof createClient>,
  table: string,
  tenantId: string,
) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return count ?? 0;
}

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
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: baseHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: baseHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const keyHash = await sha256Hex(apiKey);
    const { data: keyRow, error: keyError } = await adminClient
      .from("integration_api_keys")
      .select("id, tenant_id, scopes, status")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (keyError || !keyRow || keyRow.status !== "active") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: baseHeaders });
    }

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource") ?? "appointments";
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 100;

    const scopes = Array.isArray(keyRow.scopes) ? keyRow.scopes : [];
    if (scopes.length > 0 && !scopes.includes(resource)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: baseHeaders });
    }

    let data: unknown = null;

    switch (resource) {
      case "appointments": {
        const { data: rows, error } = await adminClient
          .from("appointments")
          .select("id, appointment_date, status, type, patient_id, doctor_id")
          .eq("tenant_id", keyRow.tenant_id)
          .order("appointment_date", { ascending: false })
          .limit(limit);
        if (error) throw error;
        data = rows ?? [];
        break;
      }
      case "invoices": {
        const { data: rows, error } = await adminClient
          .from("invoices")
          .select("id, invoice_code, service, amount, status, invoice_date, patient_id")
          .eq("tenant_id", keyRow.tenant_id)
          .order("invoice_date", { ascending: false })
          .limit(limit);
        if (error) throw error;
        data = rows ?? [];
        break;
      }
      case "lab_orders": {
        const { data: rows, error } = await adminClient
          .from("lab_orders")
          .select("id, test_name, status, result, created_at, patient_id")
          .eq("tenant_id", keyRow.tenant_id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        data = rows ?? [];
        break;
      }
      case "analytics": {
        const [appointments, invoices, patients, labs] = await Promise.all([
          getCount(adminClient, "appointments", keyRow.tenant_id),
          getCount(adminClient, "invoices", keyRow.tenant_id),
          getCount(adminClient, "patients", keyRow.tenant_id),
          getCount(adminClient, "lab_orders", keyRow.tenant_id),
        ]);
        data = { appointments, invoices, patients, lab_orders: labs };
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Unsupported resource" }), { status: 400, headers: baseHeaders });
    }

    await adminClient
      .from("integration_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id);

    logInfo("integration_api_access", {
      request_id: requestId,
      action_type: "integration_api",
      resource_type: resource,
      metadata: { tenant_id: keyRow.tenant_id },
    });

    return new Response(JSON.stringify({ success: true, resource, data }), { status: 200, headers: baseHeaders });
  } catch (err) {
    logError("integration_api_failed", {
      request_id: requestId,
      action_type: "integration_api",
      resource_type: "integration_api",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }), {
      status: 500,
      headers: baseHeaders,
    });
  }
});
