import { z } from "zod";
import { userPreferencesSchema, userPreferencesUpsertSchema } from "@/domain/settings/userPreferences.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { toServiceError } from "@/services/supabase/errors";
import { userPreferencesRepository } from "./userPreferences.repository";

export const userPreferencesService = {
  async getByUserId(userId: string) {
    try {
      const parsedId = uuidSchema.parse(userId);
      const result = await userPreferencesRepository.getByUserId(parsedId);
      return result ? userPreferencesSchema.parse(result) : null;
    } catch (err) {
      throw toServiceError(err, "Failed to load preferences");
    }
  },
  async upsert(input: { user_id: string; dark_mode: boolean }) {
    try {
      const parsed = userPreferencesUpsertSchema.parse(input);
      const result = await userPreferencesRepository.upsert(parsed);
      return userPreferencesSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to save preferences");
    }
  },
  async setDarkMode(userId: string, darkMode: boolean) {
    return this.upsert({ user_id: userId, dark_mode: darkMode });
  },
};
