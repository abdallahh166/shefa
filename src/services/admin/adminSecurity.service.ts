import { useAuth } from "@/core/auth/authStore";
import { authService } from "@/services/auth/auth.service";
import { recentAuthService } from "@/services/auth/recentAuth.service";
import { AuthorizationError, toServiceError } from "@/services/supabase/errors";
import { assertAnyPermission } from "@/services/supabase/permissions";

type AdminSecurityOptions = {
  action: string;
  requireRecentAuth?: boolean;
  recentAuthMaxAgeMs?: number;
};

export const adminSecurityService = {
  async assertAccess(options: AdminSecurityOptions) {
    try {
      assertAnyPermission(["super_admin"], "Only super admins can access admin operations");

      const { user } = useAuth.getState();
      const isGlobalAdmin = user?.globalRoles?.includes("super_admin");
      if (!user || !isGlobalAdmin) {
        throw new AuthorizationError("Only super admins can access admin operations");
      }

      const assurance = await authService.getMfaAssuranceLevel();
      if (assurance.currentLevel !== "aal2") {
        throw new AuthorizationError("Super admin MFA is required for this action.", {
          code: "MFA_REQUIRED",
          details: assurance,
        });
      }

      if (options.requireRecentAuth) {
        recentAuthService.assertRecentAuth({
          action: options.action,
          maxAgeMs: options.recentAuthMaxAgeMs,
        });
      }
    } catch (err) {
      throw toServiceError(err, "Failed to verify super admin session");
    }
  },
};

export function isMfaRequiredError(err: unknown): err is AuthorizationError {
  return err instanceof AuthorizationError && err.code === "MFA_REQUIRED";
}
