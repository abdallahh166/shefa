import { emitAuthMetric } from "./authMetrics";
import { ServiceError } from "@/services/supabase/errors";

let recoveryPromise: Promise<void> | null = null;

export const MAX_AUTH_RECOVERY_MS = 5_000;
export const MAX_QUEUED_RECOVERY_WAITERS = 50;
export const MAX_QUEUE_WAIT_MS = 5_000;

let recoveryWaiterCount = 0;

export function isAuthRecoveryInProgress() {
  return recoveryPromise !== null;
}

/** Wait for an in-flight recovery with backpressure; use from duplicate 401s. */
export async function awaitRecoveryWithBackpressure(): Promise<void> {
  const p = recoveryPromise;
  if (!p) return;

  recoveryWaiterCount++;
  if (recoveryWaiterCount > MAX_QUEUED_RECOVERY_WAITERS) {
    recoveryWaiterCount--;
    emitAuthMetric("auth_queue_overflow", { reason: "max_waiters" });
    throw new ServiceError("Authentication recovery queue overflow", { code: "REAUTH_REQUIRED" });
  }

  try {
    await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("QUEUE_WAIT_TIMEOUT")), MAX_QUEUE_WAIT_MS);
      }),
    ]);
  } catch (e) {
    if (e instanceof Error && e.message === "QUEUE_WAIT_TIMEOUT") {
      emitAuthMetric("auth_queue_overflow", { reason: "wait_timeout" });
      throw new ServiceError("Authentication recovery timed out", { code: "REAUTH_REQUIRED" });
    }
    throw e;
  } finally {
    recoveryWaiterCount--;
  }
}

export function runAuthRecovery(fn: () => Promise<void>): Promise<void> {
  if (recoveryPromise) return recoveryPromise;
  emitAuthMetric("auth_recovery_started", {});
  recoveryPromise = (async () => {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("RECOVERY_TIMEOUT")), MAX_AUTH_RECOVERY_MS);
    });
    await Promise.race([fn(), timeout]);
  })()
    .catch((err) => {
      emitAuthMetric("auth_recovery_failed", {
        errorCode: err instanceof Error ? err.message : "unknown",
      });
      throw err;
    })
    .finally(() => {
      recoveryPromise = null;
    });
  return recoveryPromise;
}
