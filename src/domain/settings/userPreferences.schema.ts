import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const localePreferenceSchema = z.enum(["en", "ar"]);

export const userPreferencesSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  dark_mode: z.boolean(),
  locale: localePreferenceSchema.nullish(),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});

export const userPreferencesUpsertSchema = z.object({
  user_id: uuidSchema,
  dark_mode: z.boolean().optional(),
  locale: localePreferenceSchema.optional(),
}).refine((value) => value.dark_mode !== undefined || value.locale !== undefined, {
  message: "At least one preference field is required",
});
