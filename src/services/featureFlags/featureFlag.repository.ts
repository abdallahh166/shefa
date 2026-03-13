import type { FeatureFlag, FeatureFlagKey, FeatureFlagUpsertInput } from "@/domain/featureFlags/featureFlag.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const FLAG_COLUMNS = "id, tenant_id, feature_key, enabled, created_at";

export interface FeatureFlagRepository {
  listByTenant(tenantId: string): Promise<FeatureFlag[]>;
  get(tenantId: string, featureKey: FeatureFlagKey): Promise<FeatureFlag | null>;
  upsert(tenantId: string, input: FeatureFlagUpsertInput): Promise<FeatureFlag>;
}

export const featureFlagRepository: FeatureFlagRepository = {
  async listByTenant(tenantId) {
    const { data, error } = await supabase
      .from("feature_flags")
      .select(FLAG_COLUMNS)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load feature flags", { code: error.code, details: error });
    }

    return (data ?? []) as FeatureFlag[];
  },
  async get(tenantId, featureKey) {
    const { data, error } = await supabase
      .from("feature_flags")
      .select(FLAG_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("feature_key", featureKey)
      .maybeSingle();

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load feature flag", { code: error.code, details: error });
    }

    return (data ?? null) as FeatureFlag | null;
  },
  async upsert(tenantId, input) {
    const { data, error } = await supabase
      .from("feature_flags")
      .upsert(
        {
          tenant_id: tenantId,
          feature_key: input.feature_key,
          enabled: input.enabled,
        },
        { onConflict: "tenant_id,feature_key" },
      )
      .select(FLAG_COLUMNS)
      .single();

    if (error) {
      throw new ServiceError(error.message ?? "Failed to update feature flag", { code: error.code, details: error });
    }

    return data as FeatureFlag;
  },
};
