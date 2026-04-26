import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceCors, getAllowedOriginsFromEnv } from "../_shared/cors.ts";
import { initSentry } from "../_shared/sentry.ts";
import { logError, logInfo, logWarn, persistSystemLog } from "../_shared/logger.ts";
import { createRequestId } from "../_shared/request.ts";
import { requireAdmin } from "../_shared/auth.ts";

const allowedOrigins = getAllowedOriginsFromEnv();

const DEFAULT_BATCH_SIZE = 10;

type JobErrorClass = "transient" | "permanent";

function classifyJobFailure(status?: number, message?: string | null): {
  errorCode: string | null;
  errorClass: JobErrorClass;
} {
  const normalizedMessage = (message ?? "").toLowerCase();

  if (typeof status === "number") {
    if (status === 408 || status === 425 || status === 429 || status >= 500) {
      return { errorCode: `HTTP_${status}`, errorClass: "transient" };
    }

    if (status >= 400) {
      return { errorCode: `HTTP_${status}`, errorClass: "permanent" };
    }
  }

  if (
    normalizedMessage.includes("timeout")
    || normalizedMessage.includes("temporar")
    || normalizedMessage.includes("network")
    || normalizedMessage.includes("rate limit")
    || normalizedMessage.includes("too many requests")
  ) {
    return { errorCode: "TRANSIENT_ERROR", errorClass: "transient" };
  }

  return { errorCode: "PERMANENT_ERROR", errorClass: "permanent" };
}

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Allow either admin-authenticated calls or a worker secret.
  const workerSecret = Deno.env.get("JOB_WORKER_SECRET");
  const incomingSecret = req.headers.get("x-worker-secret");

  let adminClient: ReturnType<typeof createClient>;
  let tenantId: string | null = null;
  let userId: string | null = null;

  if (workerSecret && incomingSecret === workerSecret) {
    adminClient = createClient(supabaseUrl, serviceRoleKey);
  } else {
    const auth = await requireAdmin(req);
    if ("error" in auth) {
      return new Response(auth.error.body, { status: auth.error.status, headers: baseHeaders });
    }
    adminClient = auth.adminClient;
    tenantId = auth.tenantId;
    userId = auth.userId;
  }

  const body = req.body ? await req.json().catch(() => ({})) : {};
  const requestedJobId = typeof body?.job_id === "string" ? body.job_id : null;
  const batchSize = typeof body?.batch_size === "number" ? body.batch_size : DEFAULT_BATCH_SIZE;

  try {
    logInfo("job_worker_start", {
      request_id: requestId,
      tenant_id: tenantId ?? undefined,
      user_id: userId ?? undefined,
      action_type: "job_worker",
      resource_type: "job",
    });

    const nowIso = new Date().toISOString();
    let query = adminClient
      .from("jobs")
      .select("id, tenant_id, type, payload, attempts, max_attempts")
      .eq("status", "pending")
      .is("locked_at", null)
      .lte("run_at", nowIso)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (requestedJobId) {
      query = adminClient
        .from("jobs")
        .select("id, tenant_id, type, payload, attempts, max_attempts")
        .eq("id", requestedJobId)
        .eq("status", "pending")
        .is("locked_at", null)
        .limit(1);
    }

    const { data: jobs, error } = await query;
    if (error) throw error;

    let processed = 0;

    for (const job of jobs ?? []) {
      const lockRes = await adminClient
        .from("jobs")
        .update({
          locked_at: new Date().toISOString(),
          locked_by: "job-worker",
          status: "processing",
        })
        .eq("id", job.id)
        .is("locked_at", null)
        .select("id")
        .maybeSingle();

      if (lockRes.error || !lockRes.data?.id) {
        continue;
      }

      try {
        const functionUrl = `${supabaseUrl}/functions/v1/${job.type}`;
        const res = await fetch(functionUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(job.payload ?? {}),
        });

        if (!res.ok) {
          const errText = await res.text();
          const error = new Error(errText || `Job failed with status ${res.status}`) as Error & { status?: number };
          error.status = res.status;
          throw error;
        }

        await adminClient
          .from("jobs")
          .update({
            status: "completed",
            locked_at: null,
            locked_by: null,
            last_error: null,
            last_attempt_at: new Date().toISOString(),
            error_code: null,
            error_class: null,
          })
          .eq("id", job.id);

        await persistSystemLog(adminClient, "job-worker", "info", "job_completed", {
          request_id: requestId,
          tenant_id: job.tenant_id,
          user_id: userId ?? undefined,
          action_type: "job_worker",
          resource_type: "job",
          metadata: {
            job_id: job.id,
            job_type: job.type,
          },
        });
        processed += 1;
      } catch (err) {
        const attempts = (job.attempts ?? 0) + 1;
        const maxAttempts = job.max_attempts ?? 3;
        const nextAttemptAt = new Date(Date.now() + attempts * 60 * 1000).toISOString();
        const isDead = attempts >= maxAttempts;
        const message = err instanceof Error ? err.message : String(err);
        const status = typeof err === "object" && err !== null && "status" in err && typeof (err as { status?: unknown }).status === "number"
          ? Number((err as { status: number }).status)
          : undefined;
        const classification = classifyJobFailure(status, message);

        await adminClient
          .from("jobs")
          .update({
            attempts,
            status: isDead ? "dead_letter" : "pending",
            last_error: message,
            next_attempt_at: isDead ? null : nextAttemptAt,
            locked_at: null,
            locked_by: null,
            last_attempt_at: new Date().toISOString(),
            error_code: classification.errorCode,
            error_class: classification.errorClass,
          })
          .eq("id", job.id);

        await persistSystemLog(adminClient, "job-worker", "error", "job_failed", {
          request_id: requestId,
          tenant_id: job.tenant_id,
          user_id: userId ?? undefined,
          action_type: "job_worker",
          resource_type: "job",
          metadata: {
            job_id: job.id,
            job_type: job.type,
            attempts,
            error: message,
            error_code: classification.errorCode,
            error_class: classification.errorClass,
          },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), { status: 200, headers: baseHeaders });
  } catch (err) {
    logWarn("job_worker_failed", {
      request_id: requestId,
      action_type: "job_worker",
      resource_type: "job",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    await persistSystemLog(adminClient, "job-worker", "error", "job_worker_failed", {
      request_id: requestId,
      tenant_id: tenantId ?? undefined,
      user_id: userId ?? undefined,
      action_type: "job_worker",
      resource_type: "job",
      metadata: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
    logError("job_worker_failed", {
      request_id: requestId,
      action_type: "job_worker",
      resource_type: "job",
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }), {
      status: 500,
      headers: baseHeaders,
    });
  }
});
