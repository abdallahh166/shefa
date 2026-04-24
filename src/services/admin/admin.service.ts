import { z } from "zod";
import {
  adminClientErrorTrendPointSchema,
  adminOperationsDashboardResponseSchema,
  adminOperationsAlertsResponseSchema,
  adminOperationsAlertSummarySchema,
  adminPricingPlanCreateSchema,
  adminPricingPlanSchema,
  adminPricingPlanUpdateSchema,
  adminRecentJobActivitySchema,
  adminRecentSystemErrorSchema,
  adminSubscriptionSchema,
  adminSubscriptionUpdateSchema,
  adminSubscriptionStatsSchema,
  adminTenantSchema,
  operationsAlertSeverityEnum,
  subscriptionPlanEnum,
  subscriptionStatusEnum,
} from "@/domain/admin/admin.schema";
import type {
  AdminClientErrorTrendPoint,
  AdminOperationsAlert,
  AdminOperationsAlertSummary,
  AdminPricingPlanCreateInput,
  AdminPricingPlanUpdateInput,
  AdminSubscriptionUpdateInput,
  AdminRecentJobActivity,
  AdminRecentSystemError,
} from "@/domain/admin/admin.types";
import { profileWithRolesSchema } from "@/domain/settings/profile.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { toServiceError } from "@/services/supabase/errors";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { useAuth } from "@/core/auth/authStore";
import { auditLogService } from "@/services/settings/audit.service";
import { recentAuthService } from "@/services/auth/recentAuth.service";
import { adminRepository } from "./admin.repository";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  plan: subscriptionPlanEnum.optional(),
  status: subscriptionStatusEnum.optional(),
});

const sortDirectionSchema = z.enum(["asc", "desc"]);
const tenantSortSchema = z
  .object({ column: z.enum(["name", "created_at"]), direction: sortDirectionSchema.optional() })
  .optional();
const profileSortSchema = z
  .object({ column: z.enum(["full_name", "created_at"]), direction: sortDirectionSchema.optional() })
  .optional();
const subscriptionSortSchema = z
  .object({
    column: z.enum(["plan", "status", "amount", "expires_at", "created_at"]),
    direction: sortDirectionSchema.optional(),
  })
  .optional();

const severityRank: Record<z.infer<typeof operationsAlertSeverityEnum>, number> = {
  healthy: 0,
  warning: 1,
  critical: 2,
};

function buildOperationsAlerts(summary: AdminOperationsAlertSummary): AdminOperationsAlert[] {
  const alerts: AdminOperationsAlert[] = [];

  if (summary.dead_letter_jobs_count > 0) {
    alerts.push({
      key: "dead_letters",
      title: "Dead-letter jobs",
      description: `${summary.dead_letter_jobs_count} jobs need manual intervention before they can continue.`,
      severity: "critical",
      count: summary.dead_letter_jobs_count,
    });
  }

  if (summary.stale_processing_jobs_count > 0) {
    alerts.push({
      key: "stale_jobs",
      title: "Stuck processing jobs",
      description: `${summary.stale_processing_jobs_count} jobs have been locked for more than 15 minutes.`,
      severity: "critical",
      count: summary.stale_processing_jobs_count,
    });
  }

  if (summary.recent_edge_failures_count > 0) {
    alerts.push({
      key: "edge_failures",
      title: "Edge function failures",
      description: `${summary.recent_edge_failures_count} edge-function errors were recorded in the last 15 minutes.`,
      severity: summary.recent_edge_failures_count >= 5 ? "critical" : "warning",
      count: summary.recent_edge_failures_count,
    });
  }

  if (summary.recent_job_failures_count > 0) {
    alerts.push({
      key: "job_failures",
      title: "Job worker failures",
      description: `${summary.recent_job_failures_count} job execution failures were recorded in the last 15 minutes.`,
      severity: summary.recent_job_failures_count >= 3 ? "critical" : "warning",
      count: summary.recent_job_failures_count,
    });
  }

  if (summary.retrying_jobs_count > 0) {
    alerts.push({
      key: "retrying_jobs",
      title: "Retrying jobs",
      description: `${summary.retrying_jobs_count} queued jobs are retrying after at least one failure.`,
      severity: summary.retrying_jobs_count >= 5 ? "critical" : "warning",
      count: summary.retrying_jobs_count,
    });
  }

  if (summary.pending_jobs_count >= 20) {
    alerts.push({
      key: "queue_backlog",
      title: "Queue backlog",
      description: `${summary.pending_jobs_count} jobs are waiting in the queue and may be building up.`,
      severity: summary.pending_jobs_count >= 50 ? "critical" : "warning",
      count: summary.pending_jobs_count,
    });
  }

  if (summary.recent_client_errors_count >= 5) {
    alerts.push({
      key: "client_errors",
      title: "Client error spike",
      description: `${summary.recent_client_errors_count} browser-side errors were logged in the last 15 minutes.`,
      severity: summary.recent_client_errors_count >= 15 ? "critical" : "warning",
      count: summary.recent_client_errors_count,
    });
  }

  return alerts.sort((left, right) => {
    const severityDelta = severityRank[right.severity] - severityRank[left.severity];
    if (severityDelta !== 0) return severityDelta;
    return right.count - left.count;
  });
}

function buildOperationsAlertResponse(summary: AdminOperationsAlertSummary) {
  const activeAlerts = buildOperationsAlerts(summary);
  const overallSeverity = activeAlerts[0]?.severity ?? "healthy";

  return adminOperationsAlertsResponseSchema.parse({
    summary,
    overall_severity: overallSeverity,
    active_alerts: activeAlerts,
  });
}

function sortRecentJobActivity(rows: AdminRecentJobActivity[]) {
  return [...rows].sort((left, right) => {
    const statusRank = left.status === "dead_letter" ? 2 : left.status === "failed" ? 1 : 0;
    const rightStatusRank = right.status === "dead_letter" ? 2 : right.status === "failed" ? 1 : 0;
    if (rightStatusRank !== statusRank) return rightStatusRank - statusRank;
    return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
  });
}

function sortRecentSystemErrors(rows: AdminRecentSystemError[]) {
  return [...rows].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
}

function sortClientErrorTrend(rows: AdminClientErrorTrendPoint[]) {
  return [...rows].sort((left, right) => new Date(left.bucket_start).getTime() - new Date(right.bucket_start).getTime());
}

function assertSuperAdminAccess() {
  assertAnyPermission(["super_admin"], "Only super admins can access admin operations");
}

export const adminService = {
  async listTenantsPaged(input?: {
    page?: number;
    pageSize?: number;
    search?: string;
    plan?: string;
    sort?: { column: "name" | "created_at"; direction?: "asc" | "desc" };
  }) {
    try {
      assertSuperAdminAccess();
      const parsed = paginationSchema
        .pick({ page: true, pageSize: true, search: true, plan: true })
        .extend({ sort: tenantSortSchema })
        .parse(input ?? {});
      const { data, count } = await adminRepository.listTenantsPaged({
        limit: parsed.pageSize,
        offset: (parsed.page - 1) * parsed.pageSize,
        search: parsed.search,
        plan: parsed.plan,
        sort: parsed.sort
          ? { column: parsed.sort.column, ascending: parsed.sort.direction === "asc" }
          : undefined,
      });
      return { data: z.array(adminTenantSchema).parse(data), total: count };
    } catch (err) {
      throw toServiceError(err, "Failed to load tenants");
    }
  },
  async listProfilesWithRolesPaged(input?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: { column: "full_name" | "created_at"; direction?: "asc" | "desc" };
  }) {
    try {
      assertSuperAdminAccess();
      const parsed = paginationSchema
        .pick({ page: true, pageSize: true, search: true })
        .extend({ sort: profileSortSchema })
        .parse(input ?? {});
      const { data, count } = await adminRepository.listProfilesWithRolesPaged({
        limit: parsed.pageSize,
        offset: (parsed.page - 1) * parsed.pageSize,
        search: parsed.search,
        sort: parsed.sort
          ? { column: parsed.sort.column, ascending: parsed.sort.direction === "asc" }
          : undefined,
      });
      return { data: z.array(profileWithRolesSchema).parse(data), total: count };
    } catch (err) {
      throw toServiceError(err, "Failed to load profiles");
    }
  },
  async listSubscriptionsPaged(input?: {
    page?: number;
    pageSize?: number;
    search?: string;
    plan?: string;
    status?: string;
    sort?: { column: "plan" | "status" | "amount" | "expires_at" | "created_at"; direction?: "asc" | "desc" };
  }) {
    try {
      assertSuperAdminAccess();
      const parsed = paginationSchema
        .pick({ page: true, pageSize: true, search: true, plan: true, status: true })
        .extend({ sort: subscriptionSortSchema })
        .parse(input ?? {});
      const { data, count } = await adminRepository.listSubscriptionsPaged({
        limit: parsed.pageSize,
        offset: (parsed.page - 1) * parsed.pageSize,
        search: parsed.search,
        plan: parsed.plan,
        status: parsed.status,
        sort: parsed.sort
          ? { column: parsed.sort.column, ascending: parsed.sort.direction === "asc" }
          : undefined,
      });
      return { data: z.array(adminSubscriptionSchema).parse(data), total: count };
    } catch (err) {
      throw toServiceError(err, "Failed to load subscriptions");
    }
  },
  async getSubscriptionStats() {
    try {
      assertSuperAdminAccess();
      const result = await adminRepository.getSubscriptionStats();
      return adminSubscriptionStatsSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load subscription stats");
    }
  },
  async getOperationsAlerts() {
    try {
      assertSuperAdminAccess();
      const summary = adminOperationsAlertSummarySchema.parse(await adminRepository.getOperationsAlertSummary());
      return buildOperationsAlertResponse(summary);
    } catch (err) {
      throw toServiceError(err, "Failed to load operations alerts");
    }
  },
  async getOperationsDashboard() {
    try {
      assertSuperAdminAccess();
      const summary = adminOperationsAlertSummarySchema.parse(await adminRepository.getOperationsAlertSummary());
      const recentJobActivity = sortRecentJobActivity(
        z.array(adminRecentJobActivitySchema).parse(await adminRepository.getRecentJobActivity(8)),
      );
      const recentSystemErrors = sortRecentSystemErrors(
        z.array(adminRecentSystemErrorSchema).parse(await adminRepository.getRecentSystemErrors(8)),
      );
      const clientErrorTrend = sortClientErrorTrend(
        z.array(adminClientErrorTrendPointSchema).parse(await adminRepository.getClientErrorTrend(15, 6)),
      );
      const alertResponse = buildOperationsAlertResponse(summary);

      return adminOperationsDashboardResponseSchema.parse({
        ...alertResponse,
        recent_job_activity: recentJobActivity,
        recent_system_errors: recentSystemErrors,
        client_error_trend: clientErrorTrend,
      });
    } catch (err) {
      throw toServiceError(err, "Failed to load operations dashboard");
    }
  },
  async updateSubscription(id: string, input: AdminSubscriptionUpdateInput) {
    try {
      assertSuperAdminAccess();
      recentAuthService.assertRecentAuth({ action: "subscription_update" });
      const parsedId = uuidSchema.parse(id);
      const parsed = adminSubscriptionUpdateSchema.parse(input);
      const result = await adminRepository.updateSubscription(parsedId, parsed);
      const currentUser = useAuth.getState().user;
      if (currentUser) {
        await auditLogService.logEvent({
          tenant_id: result.tenant_id,
          user_id: currentUser.id,
          action: "admin_subscription_updated",
          action_type: "subscription_update",
          entity_type: "subscription",
          entity_id: result.id,
          details: { changes: parsed, actor_role: currentUser.role },
        });
      }
      return adminSubscriptionSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update subscription");
    }
  },
  async listPricingPlans() {
    try {
      assertSuperAdminAccess();
      const result = await adminRepository.listPricingPlans();
      return z.array(adminPricingPlanSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load pricing plans");
    }
  },
  async createPricingPlan(input: AdminPricingPlanCreateInput) {
    try {
      assertSuperAdminAccess();
      recentAuthService.assertRecentAuth({ action: "pricing_plan_update" });
      const parsed = adminPricingPlanCreateSchema.parse(input);
      const result = await adminRepository.createPricingPlan(parsed);
      const currentUser = useAuth.getState().user;
      if (currentUser?.tenantId) {
        await auditLogService.logEvent({
          tenant_id: currentUser.tenantId,
          user_id: currentUser.id,
          action: "admin_pricing_plan_created",
          action_type: "pricing_plan_create",
          entity_type: "pricing_plan",
          entity_id: result.id,
          details: { plan_code: result.plan_code, actor_role: currentUser.role },
        });
      }
      return adminPricingPlanSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to create pricing plan");
    }
  },
  async updatePricingPlan(id: string, input: AdminPricingPlanUpdateInput) {
    try {
      assertSuperAdminAccess();
      recentAuthService.assertRecentAuth({ action: "pricing_plan_update" });
      const parsedId = uuidSchema.parse(id);
      const parsed = adminPricingPlanUpdateSchema.parse(input);
      const result = await adminRepository.updatePricingPlan(parsedId, parsed);
      const currentUser = useAuth.getState().user;
      if (currentUser?.tenantId) {
        await auditLogService.logEvent({
          tenant_id: currentUser.tenantId,
          user_id: currentUser.id,
          action: "admin_pricing_plan_updated",
          action_type: "pricing_plan_update",
          entity_type: "pricing_plan",
          entity_id: result.id,
          details: { changes: parsed, actor_role: currentUser.role },
        });
      }
      return adminPricingPlanSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update pricing plan");
    }
  },
  async deletePricingPlan(id: string) {
    try {
      assertSuperAdminAccess();
      recentAuthService.assertRecentAuth({ action: "pricing_plan_update" });
      const parsedId = uuidSchema.parse(id);
      await adminRepository.deletePricingPlan(parsedId);
      const currentUser = useAuth.getState().user;
      if (currentUser?.tenantId) {
        await auditLogService.logEvent({
          tenant_id: currentUser.tenantId,
          user_id: currentUser.id,
          action: "admin_pricing_plan_deleted",
          action_type: "pricing_plan_delete",
          entity_type: "pricing_plan",
          entity_id: parsedId,
          details: { actor_role: currentUser.role },
        });
      }
    } catch (err) {
      throw toServiceError(err, "Failed to delete pricing plan");
    }
  },
};
