import type { z } from "zod";
import {
  pricingPlanSchema,
  pricingPlanCreateSchema,
  pricingPlanUpdateSchema,
  pricingPlanCodeEnum,
  pricingBillingCycleEnum,
} from "./pricing.schema";

export type PricingPlan = z.infer<typeof pricingPlanSchema>;
export type PricingPlanCreateInput = z.infer<typeof pricingPlanCreateSchema>;
export type PricingPlanUpdateInput = z.infer<typeof pricingPlanUpdateSchema>;
export type PricingPlanCode = z.infer<typeof pricingPlanCodeEnum>;
export type PricingBillingCycle = z.infer<typeof pricingBillingCycleEnum>;
