import { z } from "zod";
import { createRequestId } from "@/core/observability/requestId";
import { useAuth, type AppUser, type TenantOverride } from "@/core/auth/authStore";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { auditLogService } from "@/services/settings/audit.service";
import { BusinessRuleError, ServiceError, toServiceError } from "@/services/supabase/errors";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { recentAuthService } from "@/services/auth/recentAuth.service";

const tenantOverrideSchema = z.object({
  id: uuidSchema,
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

type TargetTenant = Exclude<TenantOverride, null>;

function requireCurrentUser() {
  const currentUser = useAuth.getState().user;
  if (!currentUser) {
    throw new ServiceError("Missing authenticated user");
  }
  return currentUser;
}

function toPrimaryRole(currentUser: AppUser) {
  if (currentUser.globalRoles.includes("super_admin")) return "super_admin";
  return currentUser.tenantRoles[0] ?? null;
}

function toActorDetails(currentUser: AppUser) {
  return {
    actor_user_id: currentUser.id,
    actor_name: currentUser.name,
    actor_email: currentUser.email,
    actor_role: toPrimaryRole(currentUser),
    actor_global_roles: currentUser.globalRoles,
    actor_tenant_roles: currentUser.tenantRoles,
  };
}

export const adminImpersonationService = {
  async start(input: TargetTenant) {
    try {
      assertAnyPermission(["super_admin"], "Only super admins can impersonate clinics");
      recentAuthService.assertRecentAuth({ action: "tenant_impersonation_start" });
      const currentUser = requireCurrentUser();
      const targetTenant = tenantOverrideSchema.parse(input);
      const { impersonationSession, startImpersonation } = useAuth.getState();

      if (impersonationSession) {
        throw new BusinessRuleError("Finish the active impersonation session before starting another one");
      }

      const requestId = createRequestId();
      const startedAt = new Date().toISOString();
      const session = {
        requestId,
        startedAt,
        actor: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          globalRoles: currentUser.globalRoles,
          tenantRoles: currentUser.tenantRoles,
        },
        targetTenant,
      } as const;

      await auditLogService.logEvent({
        tenant_id: targetTenant.id,
        user_id: currentUser.id,
        action: "tenant_impersonation_started",
        action_type: "tenant_impersonation_start",
        entity_type: "tenant",
        entity_id: targetTenant.id,
        resource_type: "tenant",
        request_id: requestId,
        details: {
          ...toActorDetails(currentUser),
          target_tenant_id: targetTenant.id,
          target_tenant_slug: targetTenant.slug,
          target_tenant_name: targetTenant.name,
          started_at: startedAt,
        },
      });

      startImpersonation(targetTenant, session);
      return session;
    } catch (err) {
      throw toServiceError(err, "Failed to start tenant impersonation");
    }
  },

  async stop() {
    try {
      assertAnyPermission(["super_admin"], "Only super admins can end clinic impersonation");
      recentAuthService.assertRecentAuth({ action: "tenant_impersonation_end" });
      const currentUser = requireCurrentUser();
      const { impersonationSession, tenantOverride, stopImpersonation } = useAuth.getState();

      if (!impersonationSession || !tenantOverride) {
        throw new BusinessRuleError("No active impersonation session");
      }

      const endedAt = new Date().toISOString();
      const durationSeconds = Math.max(
        0,
        Math.round((new Date(endedAt).getTime() - new Date(impersonationSession.startedAt).getTime()) / 1000),
      );

      await auditLogService.logEvent({
        tenant_id: tenantOverride.id,
        user_id: currentUser.id,
        action: "tenant_impersonation_ended",
        action_type: "tenant_impersonation_end",
        entity_type: "tenant",
        entity_id: tenantOverride.id,
        resource_type: "tenant",
        request_id: impersonationSession.requestId,
        details: {
          ...toActorDetails(currentUser),
          target_tenant_id: tenantOverride.id,
          target_tenant_slug: tenantOverride.slug,
          target_tenant_name: tenantOverride.name,
          started_at: impersonationSession.startedAt,
          ended_at: endedAt,
          duration_seconds: durationSeconds,
        },
      });

      stopImpersonation();
      return {
        requestId: impersonationSession.requestId,
        endedAt,
        durationSeconds,
        targetTenant: tenantOverride,
      };
    } catch (err) {
      throw toServiceError(err, "Failed to stop tenant impersonation");
    }
  },
};
