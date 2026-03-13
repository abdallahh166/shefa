import { z } from "zod";
import {
  featureFlagSchema,
  featureFlagUpsertSchema,
  featureFlagKeySchema,
} from "@/domain/featureFlags/featureFlag.schema";
import type { FeatureFlagKey, FeatureFlagUpsertInput } from "@/domain/featureFlags/featureFlag.types";
import { getTenantContext } from "@/services/supabase/tenant";
import { toServiceError } from "@/services/supabase/errors";
import { auditLogService } from "@/services/settings/audit.service";
import { featureFlagRepository } from "./featureFlag.repository";

export const featureFlagService = {
  async list() {
    try {
      const { tenantId } = getTenantContext();
      const result = await featureFlagRepository.listByTenant(tenantId);
      return z.array(featureFlagSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load feature flags");
    }
  },
  async isEnabled(featureKey: FeatureFlagKey) {
    try {
      const parsedKey = featureFlagKeySchema.parse(featureKey);
      const { tenantId } = getTenantContext();
      const flag = await featureFlagRepository.get(tenantId, parsedKey);
      if (!flag) return true;
      return featureFlagSchema.parse(flag).enabled;
    } catch (err) {
      throw toServiceError(err, "Failed to load feature flag");
    }
  },
  async setFlag(input: FeatureFlagUpsertInput) {
    try {
      const parsed = featureFlagUpsertSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const result = await featureFlagRepository.upsert(tenantId, parsed);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "feature_flag_updated",
        action_type: "feature_flag_update",
        entity_type: "feature_flags",
        entity_id: result.id,
        details: {
          feature_key: result.feature_key,
          enabled: result.enabled,
        },
      });
      return featureFlagSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update feature flag");
    }
  },
};
