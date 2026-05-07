import { useAuth } from "@/core/auth/authStore";
import { emitAuthMetric } from "./authMetrics";

export type AuthContextSnapshot = {
  userId: string;
  tenantId: string | null;
  sessionVersion: string;
};

export class StaleAuthContextError extends Error {
  readonly code = "STALE_AUTH_CONTEXT" as const;
  constructor(message = "Stale auth context") {
    super(message);
    this.name = "StaleAuthContextError";
  }
}

export function captureAuthContextSnapshot(): AuthContextSnapshot | null {
  const { user, tenantOverride, sessionVersion } = useAuth.getState();
  if (!user?.id || !sessionVersion) return null;
  return {
    userId: user.id,
    tenantId: tenantOverride?.id ?? user.tenantId,
    sessionVersion,
  };
}

export function assertAuthContextFresh(snapshot: AuthContextSnapshot | null) {
  if (!snapshot) return;
  const cur = captureAuthContextSnapshot();
  if (
    !cur
    || cur.sessionVersion !== snapshot.sessionVersion
    || cur.userId !== snapshot.userId
    || cur.tenantId !== snapshot.tenantId
  ) {
    emitAuthMetric("stale_auth_context_rejected", { userId: snapshot.userId });
    throw new StaleAuthContextError();
  }
}

/** Capture auth context before async work; assert unchanged before returning (last line of defense after principal switches). */
export async function withAuthStaleGuard<T>(work: () => Promise<T>): Promise<T> {
  const snapshot = captureAuthContextSnapshot();
  const result = await work();
  assertAuthContextFresh(snapshot);
  return result;
}
