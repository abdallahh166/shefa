import { inviteStaffSchema } from "@/domain/settings/invite.schema";
import type { InviteStaffInput } from "@/domain/settings/invite.types";
import { useAuth } from "@/core/auth/authStore";
import { privilegedAccessService } from "@/services/auth/privilegedAccess.service";
import { toServiceError } from "@/services/supabase/errors";
import { userInviteRepository } from "./userInvite.repository";

export const userInviteService = {
  async inviteStaff(input: InviteStaffInput) {
    try {
      const parsed = inviteStaffSchema.parse(input);
      const { user } = useAuth.getState();
      const access = await privilegedAccessService.assertAction({
        action: "staff_invite",
        roleTier: "clinic_admin",
        requireStepUp: true,
        tenantId: user?.tenantId ?? null,
      });
      const stepUpGrantId = access?.stepUpGrantId ?? "";
      await userInviteRepository.inviteStaff({
        ...parsed,
        stepUpGrantId,
      });
    } catch (err) {
      throw toServiceError(err, "Failed to invite staff");
    }
  },
};
