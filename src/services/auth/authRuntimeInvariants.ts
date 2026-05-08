import { useAuth } from "@/core/auth/authStore";
import { authRepository } from "@/services/auth/auth.repository";
import { emitAuthMetric } from "@/services/auth/authMetrics";

type RuntimeInvariantMode = "off" | "report" | "throw";

type RuntimeInvariantOptions = {
  mode?: RuntimeInvariantMode;
  intervalMs?: number;
};

const SCOPED_STORAGE_PATTERNS = [
  /^shefaa-cache:([^:]+):([^:]+):/,
  /^lang:([^:]+):([^:]+)$/,
];

let initialized = false;
let timer: number | null = null;
let inFlight = false;

function defaultMode(): RuntimeInvariantMode {
  const envMode = import.meta.env?.VITE_AUTH_RUNTIME_INVARIANTS;
  if (envMode === "throw" || envMode === "report" || envMode === "off") return envMode;
  if (import.meta.env?.DEV || import.meta.env?.MODE === "staging") return "throw";
  return "report";
}

function reportInvariant(name: string, details: Record<string, string | number | boolean | undefined>, mode: RuntimeInvariantMode) {
  emitAuthMetric("auth_runtime_invariant_failed", { invariant: name, ...details });

  const message = `Auth runtime invariant failed: ${name}`;
  if (mode === "throw") {
    throw new Error(message);
  }

  if (typeof console !== "undefined") {
    console.warn(message, details);
  }
}

function scopedStorageViolations(userId: string | null, tenantId: string | null) {
  if (typeof window === "undefined") return [];

  const violations: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i) ?? "";
    const match = SCOPED_STORAGE_PATTERNS
      .map((pattern) => key.match(pattern))
      .find(Boolean);

    if (!match) continue;

    const [, keyTenantId, keyUserId] = match;
    if (!tenantId || !userId || keyTenantId !== tenantId || keyUserId !== userId) {
      violations.push(key);
    }
  }

  return violations;
}

export async function assertAuthRuntimeInvariants(mode: RuntimeInvariantMode = defaultMode()) {
  if (mode === "off" || typeof window === "undefined") return;

  const state = useAuth.getState();
  const session = await authRepository.getSession().catch(() => ({ user: null }));
  const sessionUserId = session.user?.id ?? null;
  const appUserId = state.user?.id ?? null;
  const tenantId = state.tenantOverride?.id ?? state.user?.tenantId ?? null;
  const protectedRoute = /^\/tenant\//.test(window.location.pathname) || /^\/admin/.test(window.location.pathname);

  const violations = state.isAuthenticated && appUserId && tenantId
    ? scopedStorageViolations(appUserId, tenantId)
    : [];
  if (violations.length > 0) {
    reportInvariant("cross_principal_scoped_storage", {
      count: violations.length,
      sample: violations[0],
      tenantId: tenantId ?? undefined,
      userId: appUserId ?? undefined,
    }, mode);
  }

  if (state.isAuthenticated && appUserId && sessionUserId && appUserId !== sessionUserId) {
    reportInvariant("stale_principal_session_mismatch", {
      appUserId,
      sessionUserId,
    }, mode);
  }

  if (protectedRoute && state.isAuthenticated && !sessionUserId) {
    reportInvariant("authenticated_ui_without_session", {
      path: window.location.pathname,
      appUserId: appUserId ?? undefined,
    }, mode);
  }

  if (protectedRoute && state.authMachineState === "reauth_required") {
    reportInvariant("protected_ui_in_reauth_required", {
      path: window.location.pathname,
    }, mode);
  }
}

export function initAuthRuntimeInvariants(options: RuntimeInvariantOptions = {}) {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const mode = options.mode ?? defaultMode();
  if (mode === "off") return;

  const intervalMs = options.intervalMs ?? 15_000;
  const run = () => {
    if (inFlight) return;
    inFlight = true;
    void assertAuthRuntimeInvariants(mode)
      .catch((error) => {
        if (mode === "throw") {
          setTimeout(() => {
            throw error;
          }, 0);
        }
      })
      .finally(() => {
        inFlight = false;
      });
  };

  run();
  timer = window.setInterval(run, intervalMs);
  window.addEventListener("storage", run);
  window.addEventListener("visibilitychange", run);
}

export function resetAuthRuntimeInvariantsForTests() {
  initialized = false;
  inFlight = false;
  if (timer !== null && typeof window !== "undefined") {
    window.clearInterval(timer);
  }
  timer = null;
}
