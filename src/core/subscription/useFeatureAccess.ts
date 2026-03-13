import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSubscription, PlanType } from "./SubscriptionContext";
import { useAuth } from "@/core/auth/authStore";
import { featureFlagService } from "@/services/featureFlags/featureFlag.service";
import { queryKeys } from "@/services/queryKeys";
import type { FeatureFlagKey } from "@/domain/featureFlags/featureFlag.types";

export type Feature =
  | "appointments"
  | "billing"
  | "reports"
  | "sms_reminders"
  | "multi_doctor"
  | "analytics"
  | "laboratory"
  | "pharmacy"
  | "insurance";

const PLAN_FEATURES: Record<PlanType, Feature[]> = {
  free: ["appointments"],
  starter: ["appointments", "billing", "reports"],
  pro: ["appointments", "billing", "reports", "sms_reminders", "multi_doctor", "analytics", "laboratory", "pharmacy"],
  enterprise: ["appointments", "billing", "reports", "sms_reminders", "multi_doctor", "analytics", "laboratory", "pharmacy", "insurance"],
};

const PLAN_HIERARCHY: PlanType[] = ["free", "starter", "pro", "enterprise"];

const FEATURE_FLAG_MAP: Record<Feature, FeatureFlagKey | null> = {
  appointments: null,
  billing: null,
  reports: "advanced_reports",
  sms_reminders: null,
  multi_doctor: null,
  analytics: "advanced_reports",
  laboratory: "lab_module",
  pharmacy: "pharmacy_module",
  insurance: "insurance_module",
};

export function useFeatureAccess() {
  const { plan } = useSubscription();
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const { data: flags } = useQuery({
    queryKey: queryKeys.featureFlags.list(tenantId),
    queryFn: () => featureFlagService.list(),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });

  const flagMap = useMemo(() => {
    const map = new Map<FeatureFlagKey, boolean>();
    for (const flag of flags ?? []) {
      map.set(flag.feature_key, flag.enabled);
    }
    return map;
  }, [flags]);

  const isFlagEnabled = (flagKey: FeatureFlagKey | null) => {
    if (!flagKey) return true;
    return flagMap.get(flagKey) ?? true;
  };

  const hasFeature = (feature: Feature): boolean => {
    const inPlan = PLAN_FEATURES[plan]?.includes(feature) ?? false;
    if (!inPlan) return false;
    return isFlagEnabled(FEATURE_FLAG_MAP[feature]);
  };

  const requiredPlan = (feature: Feature): PlanType | null => {
    for (const p of PLAN_HIERARCHY) {
      if (PLAN_FEATURES[p]?.includes(feature)) return p;
    }
    return null;
  };

  return { hasFeature, requiredPlan, currentPlan: plan };
}
