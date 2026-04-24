import { useAuth } from "@/core/auth/authStore";
import { AuthorizationError, ServiceError } from "./errors";

export function getTenantContext() {
  const { user, tenantOverride } = useAuth.getState();
  if (!user?.tenantId || !user?.id) {
    throw new ServiceError("Missing tenant context");
  }
  if (user.role !== "super_admin" && user.tenantStatus !== "active") {
    throw new AuthorizationError(`Clinic access is ${user.tenantStatus}`);
  }
  const tenantId =
    user.role === "super_admin" && tenantOverride?.id
      ? tenantOverride.id
      : user.tenantId;
  return { tenantId, userId: user.id };
}
