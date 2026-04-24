import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, Permission } from "./authStore";
import { useFeatureAccess, type Feature } from "@/core/subscription/useFeatureAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/primitives/Button";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: Permission;
  requiredFeature?: Feature;
}

const LoadingSkeleton = () => (
  <div className="flex h-screen overflow-hidden bg-background">
    {/* Sidebar skeleton */}
    <aside className="hidden lg:flex w-64 flex-col border-e bg-card p-4 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-md" />
      ))}
    </aside>

    {/* Main content skeleton */}
    <div className="flex-1 p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  </div>
);

export const ProtectedRoute = ({ children, requiredPermission, requiredFeature }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasPermission, user } = useAuth();
  const { hasFeature, requiredPlan, isLoading: featureLoading } = useFeatureAccess();

  if (isLoading || (requiredFeature && featureLoading)) {
    return <LoadingSkeleton />;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "super_admin" && user?.tenantStatus !== "active") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold mb-2">Clinic Access Blocked</h1>
          <p className="text-muted-foreground mb-3">
            This clinic is currently {user?.tenantStatus}. Staff access has been restricted by the platform administrator.
          </p>
          {user?.tenantStatusReason ? (
            <p className="text-sm text-muted-foreground">
              Reason: <span className="text-foreground">{user.tenantStatusReason}</span>
            </p>
          ) : null}
        </div>
      </div>
    );
  }
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  if (requiredFeature && !hasFeature(requiredFeature)) {
    const planRequired = requiredPlan(requiredFeature);
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold mb-2">Feature Unavailable</h1>
          <p className="text-muted-foreground mb-5">
            This module is not enabled for the current clinic subscription.
          </p>
          {planRequired ? (
            <p className="text-sm text-muted-foreground mb-5">
              Required plan: <span className="font-medium capitalize text-foreground">{planRequired}</span>
            </p>
          ) : null}
          <Button type="button" onClick={() => window.location.assign("/pricing")}>
            View Plans
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
