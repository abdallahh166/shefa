import { z } from "zod";
import { createRequestId } from "@/core/observability/requestId";
import { useAuth, type TenantOverride } from "@/core/auth/authStore";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { supabase } from "@/services/supabase/client";
import { ServiceError, toServiceError } from "@/services/supabase/errors";
import { privilegedAccessService } from "@/services/auth/privilegedAccess.service";

const tenantOverrideSchema = z.object({
  id: uuidSchema,
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

type TargetTenant = Exclude<TenantOverride, null>;

const impersonationStartResponseSchema = z.object({
  request_id: uuidSchema,
  started_at: z.string(),
  target_tenant_id: uuidSchema,
  target_tenant_name: z.string().trim().min(1),
  target_tenant_slug: z.string().trim().min(1),
});

const impersonationStopResponseSchema = z.object({
  request_id: uuidSchema,
  started_at: z.string(),
  ended_at: z.string(),
  duration_seconds: z.number().int().nonnegative(),
  target_tenant_id: uuidSchema,
  target_tenant_name: z.string().trim().min(1),
  target_tenant_slug: z.string().trim().min(1),
});

function requireCurrentUser() {
  const currentUser = useAuth.getState().user;
  if (!currentUser) {
    throw new ServiceError("Missing authenticated user");
  }
  return currentUser;
}

export const adminImpersonationService = {
  async start(input: TargetTenant) {
    try {
      const currentUser = requireCurrentUser();
      const targetTenant = tenantOverrideSchema.parse(input);
      const { impersonationSession, startImpersonation } = useAuth.getState();

      if (impersonationSession) {
        throw new ServiceError("Finish the active impersonation session before starting another one", {
          code: "ACTIVE_IMPERSONATION_EXISTS",
        });
      }

      const requestId = createRequestId();
      const access = await privilegedAccessService.assertAction({
        action: "tenant_impersonation_start",
        roleTier: "super_admin",
        requireStepUp: true,
        tenantId: targetTenant.id,
        resourceId: targetTenant.id,
        requestId,
      });
      const stepUpGrantId = access?.stepUpGrantId ?? null;

      const { data, error } = await (supabase.rpc as any)("admin_start_tenant_impersonation", {
        _target_tenant_id: targetTenant.id,
        _request_id: requestId,
        _step_up_grant_id: stepUpGrantId,
      });

      if (error) {
        throw new ServiceError(error.message ?? "Failed to start tenant impersonation", {
          code: error.code,
          details: error,
        });
      }

      const payload = impersonationStartResponseSchema.parse(Array.isArray(data) ? data[0] : data);
      const session = {
        requestId: payload.request_id,
        startedAt: payload.started_at,
        actor: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          globalRoles: currentUser.globalRoles,
          tenantRoles: currentUser.tenantRoles,
        },
        targetTenant: {
          id: payload.target_tenant_id,
          slug: payload.target_tenant_slug,
          name: payload.target_tenant_name,
        },
      } as const;

      startImpersonation(session.targetTenant, session);
      return session;
    } catch (err) {
      throw toServiceError(err, "Failed to start tenant impersonation");
    }
  },

  async stop() {
    try {
      const { impersonationSession, tenantOverride, stopImpersonation } = useAuth.getState();
      if (!impersonationSession || !tenantOverride) {
        throw new ServiceError("No active impersonation session");
      }

      const access = await privilegedAccessService.assertAction({
        action: "tenant_impersonation_end",
        roleTier: "super_admin",
        requireStepUp: true,
        tenantId: tenantOverride.id,
        resourceId: tenantOverride.id,
        requestId: impersonationSession.requestId,
      });
      const stepUpGrantId = access?.stepUpGrantId ?? null;

      const { data, error } = await (supabase.rpc as any)("admin_stop_tenant_impersonation", {
        _request_id: impersonationSession.requestId,
        _step_up_grant_id: stepUpGrantId,
      });

      if (error) {
        throw new ServiceError(error.message ?? "Failed to stop tenant impersonation", {
          code: error.code,
          details: error,
        });
      }

      const payload = impersonationStopResponseSchema.parse(Array.isArray(data) ? data[0] : data);
      stopImpersonation();

      return {
        requestId: payload.request_id,
        endedAt: payload.ended_at,
        durationSeconds: payload.duration_seconds,
        targetTenant: {
          id: payload.target_tenant_id,
          slug: payload.target_tenant_slug,
          name: payload.target_tenant_name,
        },
      };
    } catch (err) {
      throw toServiceError(err, "Failed to stop tenant impersonation");
    }
  },
};
