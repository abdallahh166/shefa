import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const featureFlagKeySchema = z.enum([
  "pharmacy_module",
  "lab_module",
  "insurance_module",
  "advanced_reports",
]);

export const featureFlagSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  feature_key: featureFlagKeySchema,
  enabled: z.boolean(),
  created_at: dateTimeStringSchema,
});

export const featureFlagUpsertSchema = z.object({
  feature_key: featureFlagKeySchema,
  enabled: z.boolean(),
});
