import { useAuth } from "@/core/auth/authStore";
import { AuthorizationError, ServiceError } from "./errors";

export function getTenantContext() {
  const { user, tenantOverride } = useAuth.getState();
  if (!user?.id) {
    throw new ServiceError("Missing tenant context");
  }
  const isGlobalAdmin = user.globalRoles.includes("super_admin");
  if (isGlobalAdmin) {
    if (!tenantOverride?.id) {
      throw new AuthorizationError("Super admins must enter tenant access mode before using tenant-scoped operations");
    }
    return { tenantId: tenantOverride.id, userId: user.id };
  }
  if (!user.tenantId) {
    throw new ServiceError("Missing tenant context");
  }
  if (user.tenantStatus && user.tenantStatus !== "active") {
    throw new AuthorizationError(`Clinic access is ${user.tenantStatus}`);
  }
  return { tenantId: user.tenantId, userId: user.id };
}
