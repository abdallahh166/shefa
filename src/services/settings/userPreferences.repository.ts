import type { UserPreferences, UserPreferencesUpsertInput } from "@/domain/settings/userPreferences.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const PREF_COLUMNS = "id, user_id, dark_mode, created_at, updated_at";

export interface UserPreferencesRepository {
  getByUserId(userId: string): Promise<UserPreferences | null>;
  upsert(input: UserPreferencesUpsertInput): Promise<UserPreferences>;
}

export const userPreferencesRepository: UserPreferencesRepository = {
  async getByUserId(userId) {
    const { data, error } = await supabase
      .from("user_preferences")
      .select(PREF_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load preferences", { code: error.code, details: error });
    }
    return (data ?? null) as UserPreferences | null;
  },
  async upsert(input) {
    const { data, error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: input.user_id, dark_mode: input.dark_mode }, { onConflict: "user_id" })
      .select(PREF_COLUMNS)
      .single();
    if (error) {
      throw new ServiceError(error.message ?? "Failed to save preferences", { code: error.code, details: error });
    }
    return data as UserPreferences;
  },
};
