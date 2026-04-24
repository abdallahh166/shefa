import type { FeatureFlag, FeatureFlagKey } from "@/domain/featureFlags/featureFlag.types";
import type { PlanType } from "./SubscriptionContext";

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

export const PLAN_FEATURES: Record<PlanType, Feature[]> = {
  free: ["appointments"],
  starter: ["appointments", "billing", "reports"],
  pro: ["appointments", "billing", "reports", "sms_reminders", "multi_doctor", "analytics", "laboratory", "pharmacy"],
  enterprise: ["appointments", "billing", "reports", "sms_reminders", "multi_doctor", "analytics", "laboratory", "pharmacy", "insurance"],
};

export const PLAN_HIERARCHY: PlanType[] = ["free", "starter", "pro", "enterprise"];

export const FEATURE_FLAG_MAP: Record<Feature, FeatureFlagKey | null> = {
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

export const FEATURE_LABELS: Record<Feature, string> = {
  appointments: "Appointments",
  billing: "Billing",
  reports: "Reports",
  sms_reminders: "SMS reminders",
  multi_doctor: "Multi-doctor scheduling",
  analytics: "Analytics",
  laboratory: "Laboratory",
  pharmacy: "Pharmacy",
  insurance: "Insurance",
};

export function requiredPlanForFeature(feature: Feature): PlanType | null {
  for (const plan of PLAN_HIERARCHY) {
    if (PLAN_FEATURES[plan]?.includes(feature)) return plan;
  }
  return null;
}

export function isFeatureFlagEnabled(feature: Feature, flags: FeatureFlag[]) {
  const flagKey = FEATURE_FLAG_MAP[feature];
  if (!flagKey) return true;
  const explicitFlag = flags.find((flag) => flag.feature_key === flagKey);
  return explicitFlag?.enabled ?? true;
}

export function resolveEffectivePlan(plan: PlanType, status?: string, isExpired = false): PlanType {
  const isActiveSubscription = !isExpired && (status === undefined || status === "active" || status === "trialing");
  return isActiveSubscription ? plan : "free";
}

export function hasFeatureAccess(input: {
  feature: Feature;
  plan: PlanType;
  status?: string;
  isExpired?: boolean;
  flags?: FeatureFlag[];
}) {
  const effectivePlan = resolveEffectivePlan(input.plan, input.status, input.isExpired ?? false);
  const inPlan = PLAN_FEATURES[effectivePlan]?.includes(input.feature) ?? false;
  if (!inPlan) return false;
  return isFeatureFlagEnabled(input.feature, input.flags ?? []);
}
