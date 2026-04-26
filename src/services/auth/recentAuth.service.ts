import { useAuth, type Role } from "@/core/auth/authStore";
import { AuthorizationError } from "@/services/supabase/errors";

const RECENT_AUTH_WINDOWS_MS: Record<Role, number> = {
  super_admin: 10 * 60 * 1000,
  clinic_admin: 15 * 60 * 1000,
  doctor: 30 * 60 * 1000,
  receptionist: 30 * 60 * 1000,
  nurse: 30 * 60 * 1000,
  accountant: 30 * 60 * 1000,
};

function resolvePrimaryRole(user: { globalRoles?: string[]; tenantRoles?: string[] } | null | undefined): Role | null {
  if (user?.globalRoles?.includes("super_admin")) return "super_admin";
  return (user?.tenantRoles?.[0] as Role | undefined) ?? null;
}

function getRequiredWindowMs(role: Role, overrideMs?: number) {
  return overrideMs ?? RECENT_AUTH_WINDOWS_MS[role];
}

export const recentAuthService = {
  getRequiredWindowMs(role: Role, overrideMs?: number) {
    return getRequiredWindowMs(role, overrideMs);
  },

  isFresh(input?: { maxAgeMs?: number }) {
    const { user, lastVerifiedAt } = useAuth.getState();
    if (!user || !lastVerifiedAt) return false;
    const primaryRole = resolvePrimaryRole(user);
    if (!primaryRole) return false;
    const verifiedAt = new Date(lastVerifiedAt).getTime();
    if (Number.isNaN(verifiedAt)) return false;
    return Date.now() - verifiedAt <= getRequiredWindowMs(primaryRole, input?.maxAgeMs);
  },

  assertRecentAuth(input: { action: string; maxAgeMs?: number }) {
    const { user, lastVerifiedAt } = useAuth.getState();
    const primaryRole = resolvePrimaryRole(user);
    if (!user || !lastVerifiedAt || !primaryRole) {
      throw new AuthorizationError("Please sign in again to continue this action.", {
        code: "FRESH_AUTH_REQUIRED",
        details: {
          action: input.action,
          lastVerifiedAt,
          maxAgeMs: primaryRole ? getRequiredWindowMs(primaryRole, input.maxAgeMs) : input.maxAgeMs ?? null,
        },
      });
    }

    const maxAgeMs = getRequiredWindowMs(primaryRole, input.maxAgeMs);
    const verifiedAt = new Date(lastVerifiedAt).getTime();
    if (Number.isNaN(verifiedAt) || Date.now() - verifiedAt > maxAgeMs) {
      throw new AuthorizationError("Please sign in again to continue this action.", {
        code: "FRESH_AUTH_REQUIRED",
        details: {
          action: input.action,
          lastVerifiedAt,
          maxAgeMs,
        },
      });
    }
  },
};

export function isFreshAuthRequiredError(err: unknown): err is AuthorizationError {
  return err instanceof AuthorizationError && err.code === "FRESH_AUTH_REQUIRED";
}
