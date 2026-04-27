import { z } from "zod";
import { supabase } from "@/services/supabase/client";
import { ServiceError, toServiceError } from "@/services/supabase/errors";
import type { PrivilegedRoleTier } from "@/core/auth/authStore";

const issuePrivilegedGrantSchema = z.object({
  action: z.string().trim().min(3).max(120).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  roleTier: z.enum(["super_admin", "clinic_admin"]),
  tenantId: z.string().uuid().optional().nullable(),
  resourceId: z.string().uuid().optional().nullable(),
  requestId: z.string().uuid().optional().nullable(),
});

export const privilegedStepUpService = {
  async issueGrant(input: {
    action: string;
    roleTier: PrivilegedRoleTier;
    tenantId?: string | null;
    resourceId?: string | null;
    requestId?: string | null;
  }) {
    try {
      const parsed = issuePrivilegedGrantSchema.parse(input);
      const { data, error } = await (supabase.rpc as any)("issue_privileged_step_up_grant", {
        _role_tier: parsed.roleTier,
        _action_key: parsed.action,
        _tenant_id: parsed.tenantId ?? null,
        _resource_id: parsed.resourceId ?? null,
        _request_id: parsed.requestId ?? null,
      });

      if (error || !data) {
        throw new ServiceError(error?.message ?? "Failed to issue privileged step-up grant", {
          code: error?.code,
          details: error,
        });
      }

      return z.string().uuid().parse(data);
    } catch (err) {
      throw toServiceError(err, "Failed to issue privileged step-up grant");
    }
  },
};
