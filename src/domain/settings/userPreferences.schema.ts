import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const userPreferencesSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  dark_mode: z.boolean(),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});

export const userPreferencesUpsertSchema = z.object({
  user_id: uuidSchema,
  dark_mode: z.boolean(),
});
