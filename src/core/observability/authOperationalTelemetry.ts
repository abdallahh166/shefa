import { useAuth } from "@/core/auth/authStore";
import { clientErrorLogService } from "@/services/observability/clientErrorLog.service";
import { subscribeAuthMetrics, type AuthMetricPayload } from "@/services/auth/authMetrics";
import { captureError } from "./sentry";

const DURABLE_AUTH_METRICS = new Set([
  "login_succeeded",
  "login_failed",
  "refresh_succeeded",
  "refresh_failed",
  "auth_recovery_succeeded",
  "auth_recovery_failed",
  "session_drift_detected",
  "stale_auth_context_rejected",
  "auth_event_replay_rejected",
  "unexpected_logout",
  "auth_queue_overflow",
  "auth_kill_switch_activated",
  "auth_bootstrap_completed",
  "auth_refresh_storm_detected",
]);

const FAILURE_AUTH_METRICS = new Set([
  "login_failed",
  "refresh_failed",
  "auth_recovery_failed",
  "session_drift_detected",
  "stale_auth_context_rejected",
  "auth_event_replay_rejected",
  "unexpected_logout",
  "auth_queue_overflow",
  "auth_kill_switch_activated",
  "auth_refresh_storm_detected",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFRESH_STORM_WINDOW_MS = 60_000;
const REFRESH_STORM_THRESHOLD = 20;
const REFRESH_STORM_COOLDOWN_MS = 60_000;

let initialized = false;
let refreshAttempts: number[] = [];
let lastRefreshStormAt = 0;

function safeString(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return String(value).slice(0, 500);
}

function metricSeverity(name: string, payload: AuthMetricPayload) {
  if (name === "auth_bootstrap_completed" && payload.result === "failure") return "critical";
  if (name === "auth_kill_switch_activated" || name === "auth_refresh_storm_detected") return "critical";
  if (FAILURE_AUTH_METRICS.has(name)) return "warning";
  return "info";
}

function requestIdFromPayload(payload: AuthMetricPayload) {
  const trace = typeof payload.authTraceId === "string" ? payload.authTraceId : null;
  return trace && UUID_RE.test(trace) ? trace : null;
}

async function persistAuthMetric(name: string, payload: AuthMetricPayload) {
  if (!DURABLE_AUTH_METRICS.has(name)) return;

  const { user, tenantOverride } = useAuth.getState();
  const tenantId = tenantOverride?.id ?? user?.tenantId ?? null;
  const userId = user?.id ?? null;
  const severity = metricSeverity(name, payload);
  const metadata = {
    auth_metric: name,
    severity,
    ...payload,
  };

  if (severity !== "info") {
    captureError(new Error(`auth_metric:${name}`), {
      auth_metric: name,
      severity,
      tenant_id: tenantId,
      user_id: userId,
      metadata,
    });
  }

  if (!tenantId || !userId) return;

  try {
    await clientErrorLogService.log({
      tenant_id: tenantId,
      user_id: userId,
      request_id: requestIdFromPayload(payload),
      action_type: "auth_metric",
      resource_type: name,
      message: `Auth operational signal: ${name}`,
      stack: null,
      component_stack: null,
      metadata,
      url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    /* Telemetry must never break auth flow. */
  }
}

function recordRefreshAttempt(now: number) {
  refreshAttempts = refreshAttempts.filter((at) => now - at <= REFRESH_STORM_WINDOW_MS);
  refreshAttempts.push(now);
  if (
    refreshAttempts.length >= REFRESH_STORM_THRESHOLD
    && now - lastRefreshStormAt >= REFRESH_STORM_COOLDOWN_MS
  ) {
    lastRefreshStormAt = now;
    void persistAuthMetric("auth_refresh_storm_detected", {
      attempts: refreshAttempts.length,
      windowMs: REFRESH_STORM_WINDOW_MS,
    });
  }
}

export function initAuthOperationalTelemetry() {
  if (initialized) return;
  initialized = true;
  subscribeAuthMetrics((name, payload) => {
    if (name === "refresh_attempt") {
      recordRefreshAttempt(Date.now());
    }
    void persistAuthMetric(name, {
      ...payload,
      errorCode: safeString(payload.errorCode),
      reason: safeString(payload.reason),
      phase: safeString(payload.phase),
      result: safeString(payload.result),
    });
  });
}

export function resetAuthOperationalTelemetryForTests() {
  initialized = false;
  refreshAttempts = [];
  lastRefreshStormAt = 0;
}
