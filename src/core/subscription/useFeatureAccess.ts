import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSubscription, PlanType } from "./SubscriptionContext";
import { useAuth } from "@/core/auth/authStore";
import { featureFlagService } from "@/services/featureFlags/featureFlag.service";
import { queryKeys } from "@/services/queryKeys";
import { hasFeatureAccess, requiredPlanForFeature, type Feature } from "./featureCatalog";

export function useFeatureAccess() {
  const { plan, status, isExpired, isLoading: subscriptionLoading } = useSubscription();
  const { user, tenantOverride } = useAuth();
  const tenantId = tenantOverride?.id ?? user?.tenantId;

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: queryKeys.featureFlags.list(tenantId),
    queryFn: () => featureFlagService.list(),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const hasFeature = (feature: Feature): boolean => {
    return hasFeatureAccess({
      feature,
      plan,
      status,
      isExpired,
      flags: flags ?? [],
    });
  };

  const requiredPlan = (feature: Feature): PlanType | null => requiredPlanForFeature(feature);

  return useMemo(() => ({
    hasFeature,
    requiredPlan,
    currentPlan: plan,
    isLoading: subscriptionLoading || flagsLoading,
  }), [plan, subscriptionLoading, flagsLoading, flags, status, isExpired]);
}
