type AuthMetricPayload = Record<string, string | number | boolean | undefined>;

const listeners = new Set<(name: string, payload: AuthMetricPayload) => void>();

const HIGH_FREQ_METRICS = new Set([
  "refresh_attempt",
  "token_refreshed_sampled",
]);

/** Sample 1 in N in production for noisy metrics; always emit in dev/test. */
const HIGH_FREQ_SAMPLE_EVERY = 10;
let highFreqCounter = 0;

export function bucketAuthErrorCode(raw: string | undefined): string {
  if (!raw) return "unknown";
  const m = raw.toLowerCase();
  if (m.includes("network") || m.includes("fetch")) return "network";
  if (m.includes("invalid refresh") || m.includes("refresh token")) return "invalid_token";
  if (m.includes("timeout")) return "timeout";
  if (m.includes("kill_switch")) return "kill_switch";
  return "other";
}

export function subscribeAuthMetrics(handler: (name: string, payload: AuthMetricPayload) => void) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function emitAuthMetric(name: string, payload: AuthMetricPayload = {}) {
  const isDev = Boolean(import.meta.env?.DEV);
  const isTest = typeof process !== "undefined" && Boolean(process.env.VITEST);
  if (HIGH_FREQ_METRICS.has(name) && !isDev && !isTest) {
    highFreqCounter++;
    if (highFreqCounter % HIGH_FREQ_SAMPLE_EVERY !== 0) return;
  }

  const safePayload: AuthMetricPayload = { ...payload };
  if (typeof safePayload.errorCode === "string") {
    safePayload.errorCode = bucketAuthErrorCode(safePayload.errorCode);
  }

  for (const h of listeners) {
    try {
      h(name, safePayload);
    } catch {
      /* ignore listener errors */
    }
  }
  if (isDev) {
    console.debug(`[auth-metric] ${name}`, safePayload);
  }
}
