import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const subscriptionSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  plan: z.string().trim().min(1),
  status: z.string().trim().min(1),
  amount: z.number(),
  currency: z.string().trim().min(1),
  billing_cycle: z.string().trim().min(1),
  started_at: dateTimeStringSchema,
  expires_at: dateTimeStringSchema.optional().nullable(),
});

export const subscriptionSummarySchema = subscriptionSchema.pick({
  plan: true,
  status: true,
  amount: true,
  currency: true,
  billing_cycle: true,
  expires_at: true,
});
