import type { SubscriptionSummary } from "@/domain/subscription/subscription.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const SUBSCRIPTION_COLUMNS = "id, tenant_id, plan, status, amount, currency, billing_cycle, started_at, expires_at";

export interface SubscriptionRepository {
  getByTenant(tenantId: string): Promise<SubscriptionSummary | null>;
}

export const subscriptionRepository: SubscriptionRepository = {
  async getByTenant(tenantId) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select(SUBSCRIPTION_COLUMNS)
      .eq("tenant_id", tenantId)
      .single();
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load subscription", { code: error.code, details: error });
    }
    return (data ?? null) as SubscriptionSummary | null;
  },
};
