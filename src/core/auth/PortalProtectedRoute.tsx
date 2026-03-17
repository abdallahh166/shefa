import { ReactNode, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { usePortalAuth } from "./portalAuthStore";

interface PortalProtectedRouteProps {
  children: ReactNode;
}

export const PortalProtectedRoute = ({ children }: PortalProtectedRouteProps) => {
  const { clinicSlug } = useParams();
  const { isLoading, isAuthenticated, initialize } = usePortalAuth();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={`/portal/${clinicSlug ?? ""}/login`} replace />;
  }

  return <>{children}</>;
};
