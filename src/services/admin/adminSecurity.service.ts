import { toServiceError } from "@/services/supabase/errors";
import { privilegedAccessService } from "@/services/auth/privilegedAccess.service";

type AdminSecurityOptions = {
  action: string;
  requireRecentAuth?: boolean;
  recentAuthMaxAgeMs?: number;
  tenantId?: string | null;
  resourceId?: string | null;
  requestId?: string | null;
};

export const adminSecurityService = {
  async assertAccess(options: AdminSecurityOptions) {
    try {
      return await privilegedAccessService.assertAction({
        action: options.action,
        roleTier: "super_admin",
        requireStepUp: options.requireRecentAuth,
        tenantId: options.tenantId ?? null,
        resourceId: options.resourceId ?? null,
        requestId: options.requestId ?? null,
      });
    } catch (err) {
      throw toServiceError(err, "Failed to verify super admin session");
    }
  },
};

export { isMfaRequiredError } from "@/services/auth/privilegedAccess.service";
