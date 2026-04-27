import { useAuth } from "@/core/auth/authStore";
import { ServiceError } from "@/services/supabase/errors";
import { privilegedAccessService } from "@/services/auth/privilegedAccess.service";
import { securityRepository } from "./security.repository";

export const securityService = {
  async updatePassword(newPassword: string) {
    const { user } = useAuth.getState();
    if (user?.tenantRoles.includes("clinic_admin")) {
      await privilegedAccessService.assertAction({
        action: "password_change",
        roleTier: "clinic_admin",
        requireStepUp: true,
        tenantId: user.tenantId,
        resourceId: user.id,
      });
    }
    if (!newPassword || newPassword.length < 8) {
      throw new ServiceError("Password must be at least 8 characters");
    }
    await securityRepository.updatePassword(newPassword);
  },
};
