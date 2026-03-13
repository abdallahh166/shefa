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

  const { data: invoices, error } = await adminClient
    .from("invoices")
    .select("id, invoice_code, status")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .limit(25);

  if (error) {
    return new Response(JSON.stringify({ error: error.message ?? "Failed to load invoices" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await adminClient.rpc("log_audit_event", {
    _tenant_id: tenantId,
    _user_id: userId,
    _action: "job_send_invoice_emails",
    _entity_type: "job",
    _entity_id: null,
    _details: { status: "success", pending_count: invoices?.length ?? 0 },
  });

  return new Response(JSON.stringify({ success: true, pending: invoices?.length ?? 0 }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
