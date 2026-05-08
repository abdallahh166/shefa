export type AuthMachineState =
  | "initializing"
  | "unauthenticated"
  | "unauthenticated_pending_cleanup"
  | "authenticating"
  | "mfa_required"
  | "mfa_verifying"
  | "authenticated"
  | "refreshing"
  | "reauth_required"
  | "error";

const ALLOWED: Record<AuthMachineState, AuthMachineState[]> = {
  initializing: [
    "unauthenticated",
    "authenticating",
    "mfa_required",
    "authenticated",
    "reauth_required",
    "error",
    "unauthenticated_pending_cleanup",
  ],
  unauthenticated: ["authenticating", "initializing", "unauthenticated_pending_cleanup", "refreshing"],
  unauthenticated_pending_cleanup: ["unauthenticated", "error", "reauth_required"],
  authenticating: ["mfa_required", "authenticated", "unauthenticated", "error", "reauth_required", "unauthenticated_pending_cleanup"],
  mfa_required: ["mfa_verifying", "authenticated", "unauthenticated", "reauth_required", "error", "unauthenticated_pending_cleanup"],
  mfa_verifying: ["authenticated", "mfa_required", "unauthenticated", "reauth_required", "error", "unauthenticated_pending_cleanup"],
  authenticated: [
    "refreshing",
    "mfa_required",
    "mfa_verifying",
    "unauthenticated",
    "unauthenticated_pending_cleanup",
    "reauth_required",
    "error",
    "authenticating",
  ],
  refreshing: ["authenticated", "reauth_required", "unauthenticated", "error", "unauthenticated_pending_cleanup"],
  reauth_required: ["unauthenticated", "authenticating", "unauthenticated_pending_cleanup", "initializing"],
  error: ["unauthenticated", "authenticating", "initializing", "reauth_required"],
};

export function assertAuthTransition(from: AuthMachineState, to: AuthMachineState) {
  if (from === to) return;
  const ok = ALLOWED[from]?.includes(to);
  if (!ok && import.meta.env?.DEV) {
    throw new Error(`Invalid auth transition: ${from} → ${to}`);
  }
}

export function isBlockingProtectedRouteState(state: AuthMachineState) {
  return (
    state === "initializing"
    || state === "unauthenticated_pending_cleanup"
    || state === "refreshing"
  );
}

export function isSafeModeState(state: AuthMachineState) {
  return state === "reauth_required" || state === "error";
}
