import { useAuth } from "@/core/auth/authStore";
import { ServiceError } from "./errors";

export function getTenantContext() {
  const { user, tenantOverride } = useAuth.getState();
  if (!user?.tenantId || !user?.id) {
    throw new ServiceError("Missing tenant context");
  }
  const tenantId =
    user.role === "super_admin" && tenantOverride?.id
      ? tenantOverride.id
      : user.tenantId;
  return { tenantId, userId: user.id };
}
