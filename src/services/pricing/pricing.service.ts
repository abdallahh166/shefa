import { z } from "zod";
import { pricingPlanSchema } from "@/domain/pricing/pricing.schema";
import { toServiceError } from "@/services/supabase/errors";
import { pricingRepository } from "./pricing.repository";

export const pricingService = {
  async listPublic() {
    try {
      const result = await pricingRepository.listPublic();
      return z.array(pricingPlanSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load pricing plans");
    }
  },
};
