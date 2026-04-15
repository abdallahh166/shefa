import { ServiceError } from "@/services/supabase/errors";
import { recentAuthService } from "@/services/auth/recentAuth.service";
import { securityRepository } from "./security.repository";

export const securityService = {
  async updatePassword(newPassword: string) {
    recentAuthService.assertRecentAuth({ action: "password_change" });
    if (!newPassword || newPassword.length < 8) {
      throw new ServiceError("Password must be at least 8 characters");
    }
    await securityRepository.updatePassword(newPassword);
  },
};
