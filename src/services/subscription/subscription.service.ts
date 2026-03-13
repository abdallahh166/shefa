import { subscriptionSummarySchema } from "@/domain/subscription/subscription.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { toServiceError } from "@/services/supabase/errors";
import { subscriptionRepository } from "./subscription.repository";

export const subscriptionService = {
  async getByTenant(tenantId: string) {
    try {
      const parsedTenantId = uuidSchema.parse(tenantId);
      const result = await subscriptionRepository.getByTenant(parsedTenantId);
      return result ? subscriptionSummarySchema.parse(result) : null;
    } catch (err) {
      throw toServiceError(err, "Failed to load subscription");
    }
  },
};
