import type { z } from "zod";
import { userPreferencesSchema, userPreferencesUpsertSchema } from "./userPreferences.schema";

export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserPreferencesUpsertInput = z.infer<typeof userPreferencesUpsertSchema>;
