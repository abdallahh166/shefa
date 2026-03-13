import type { Permission } from "@/core/auth/authStore";
import { useAuth } from "@/core/auth/authStore";
import { AuthorizationError } from "./errors";

export function assertAnyPermission(permissions: Permission[], message?: string) {
  const { hasPermission } = useAuth.getState();
  const allowed = permissions.some((permission) => hasPermission(permission));
  if (!allowed) {
    throw new AuthorizationError(message ?? "Not authorized");
  }
}
