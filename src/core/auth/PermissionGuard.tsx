import { ReactNode } from "react";
import { Permission } from "./authStore";
import { useAuth } from "./authStore";

interface PermissionGuardProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export const PermissionGuard = ({ permission, children, fallback = null }: PermissionGuardProps) => {
  const hasPermission = useAuth((s) => s.hasPermission);
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
};
