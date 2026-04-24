import type { PricingPlan } from "@/domain/pricing/pricing.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const PRICING_PLAN_COLUMNS = [
  "id",
  "plan_code",
  "name",
  "description",
  "doctor_limit_label",
  "features",
  "monthly_price",
  "annual_price",
  "currency",
  "default_billing_cycle",
  "is_popular",
  "is_public",
  "is_enterprise_contact",
  "display_order",
  "created_at",
  "updated_at",
  "deleted_at",
].join(", ");

export interface PricingRepository {
  listPublic(): Promise<PricingPlan[]>;
}

export const pricingRepository: PricingRepository = {
  async listPublic() {
    const { data, error } = await supabase
      .from("pricing_plans")
      .select(PRICING_PLAN_COLUMNS)
      .is("deleted_at", null)
      .eq("is_public", true)
      .order("display_order", { ascending: true })
      .order("plan_code", { ascending: true });

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load pricing plans", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? []) as PricingPlan[];
  },
};
