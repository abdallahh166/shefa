import { z } from "zod";
import {
  FEATURE_FLAG_MAP,
  FEATURE_LABELS,
  hasFeatureAccess,
  requiredPlanForFeature,
  resolveEffectivePlan,
  type Feature,
} from "@/core/subscription/featureCatalog";
import { useAuth } from "@/core/auth/authStore";
import { featureFlagSchema } from "@/domain/featureFlags/featureFlag.schema";
import { subscriptionSummarySchema } from "@/domain/subscription/subscription.schema";
import { AuthorizationError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { featureFlagRepository } from "@/services/featureFlags/featureFlag.repository";
import { subscriptionRepository } from "./subscription.repository";

type EntitlementSnapshot = {
  plan: "free" | "starter" | "pro" | "enterprise";
  status: string;
  isExpired: boolean;
  flags: Array<z.infer<typeof featureFlagSchema>>;
};

const inFlightSnapshotRequests = new Map<string, Promise<EntitlementSnapshot>>();

function computeIsExpired(status: string, expiresAt?: string | null) {
  if (!["active", "trialing"].includes(status)) return true;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

async function loadSnapshot(tenantId: string): Promise<EntitlementSnapshot> {
  const { user, tenantOverride } = useAuth.getState();
  if (user?.role === "super_admin" && !tenantOverride) {
    return {
      plan: "enterprise",
      status: "active",
      isExpired: false,
      flags: [],
    };
  }

  const [subscription, rawFlags] = await Promise.all([
    subscriptionRepository.getByTenant(tenantId),
    featureFlagRepository.listByTenant(tenantId),
  ]);

  const parsedSubscription = subscription ? subscriptionSummarySchema.parse(subscription) : null;
  const flags = z.array(featureFlagSchema).parse(rawFlags);
  const plan = (parsedSubscription?.plan as EntitlementSnapshot["plan"] | undefined) ?? "free";
  const status = parsedSubscription?.status ?? "active";
  const isExpired = computeIsExpired(status, parsedSubscription?.expires_at);

  return {
    plan,
    status,
    isExpired,
    flags,
  };
}

async function getEntitlementSnapshot() {
  const { tenantId } = getTenantContext();
  const existing = inFlightSnapshotRequests.get(tenantId);
  if (existing) return existing;

  const request = loadSnapshot(tenantId).finally(() => {
    inFlightSnapshotRequests.delete(tenantId);
  });
  inFlightSnapshotRequests.set(tenantId, request);
  return request;
}

export const featureAccessService = {
  async getSnapshot() {
    try {
      return await getEntitlementSnapshot();
    } catch (err) {
      throw toServiceError(err, "Failed to resolve feature access");
    }
  },
  async assertFeatureAccess(feature: Feature) {
    try {
      const snapshot = await getEntitlementSnapshot();
      const enabled = hasFeatureAccess({
        feature,
        plan: snapshot.plan,
        status: snapshot.status,
        isExpired: snapshot.isExpired,
        flags: snapshot.flags,
      });

      if (!enabled) {
        const flagKey = FEATURE_FLAG_MAP[feature];
        const explicitFlag = flagKey
          ? snapshot.flags.find((flag) => flag.feature_key === flagKey)
          : null;
        const effectivePlan = resolveEffectivePlan(snapshot.plan, snapshot.status, snapshot.isExpired);
        const reason = explicitFlag && !explicitFlag.enabled
          ? `${FEATURE_LABELS[feature]} is disabled for this clinic.`
          : `${FEATURE_LABELS[feature]} is not available on the current subscription.`;

        throw new AuthorizationError(reason, {
          code: "FEATURE_NOT_ENABLED",
          details: {
            feature,
            plan: snapshot.plan,
            effectivePlan,
            requiredPlan: requiredPlanForFeature(feature),
            status: snapshot.status,
            isExpired: snapshot.isExpired,
            featureFlag: explicitFlag?.feature_key ?? null,
          },
        });
      }

      return snapshot;
    } catch (err) {
      throw toServiceError(err, "Failed to verify feature access");
    }
  },
};
