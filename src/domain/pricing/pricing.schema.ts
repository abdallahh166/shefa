import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const pricingPlanCodeEnum = z.enum(["free", "starter", "pro", "enterprise"]);
export const pricingBillingCycleEnum = z.enum(["monthly", "annual"]);

export const pricingPlanSchema = z.object({
  id: uuidSchema,
  plan_code: pricingPlanCodeEnum,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  doctor_limit_label: z.string().trim().min(1).max(120),
  features: z.array(z.string().trim().min(1).max(160)),
  monthly_price: z.coerce.number().min(0),
  annual_price: z.coerce.number().min(0),
  currency: z.string().trim().min(1).max(10),
  default_billing_cycle: pricingBillingCycleEnum,
  is_popular: z.boolean(),
  is_public: z.boolean(),
  is_enterprise_contact: z.boolean(),
  display_order: z.coerce.number().int().min(0),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
  deleted_at: dateTimeStringSchema.nullable().optional(),
});

export const pricingPlanCreateSchema = pricingPlanSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
});

export const pricingPlanUpdateSchema = pricingPlanCreateSchema.partial();
