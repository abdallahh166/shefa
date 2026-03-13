import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

export interface SecurityRepository {
  updatePassword(newPassword: string): Promise<void>;
}

export const securityRepository: SecurityRepository = {
  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to update password", { code: error.code, details: error });
    }
  },
};
