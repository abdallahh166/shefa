import { z } from "zod";
import {
  adminOperationsAlertsResponseSchema,
  adminOperationsAlertSummarySchema,
  adminSubscriptionSchema,
  adminSubscriptionUpdateSchema,
  adminSubscriptionStatsSchema,
  adminTenantSchema,
  operationsAlertSeverityEnum,
  subscriptionPlanEnum,
  subscriptionStatusEnum,
} from "@/domain/admin/admin.schema";
import type {
  AdminOperationsAlert,
  AdminOperationsAlertSummary,
  AdminSubscriptionUpdateInput,
} from "@/domain/admin/admin.types";
import { profileWithRolesSchema } from "@/domain/settings/profile.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { toServiceError } from "@/services/supabase/errors";
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

export const adminService = {
  async listTenantsPaged(input?: {
    page?: number;
    pageSize?: number;
    search?: string;
    plan?: string;
    sort?: { column: "name" | "created_at"; direction?: "asc" | "desc" };
  }) {
    try {
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
      const result = await adminRepository.getSubscriptionStats();
      return adminSubscriptionStatsSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load subscription stats");
    }
  },
  async getOperationsAlerts() {
    try {
      const summary = adminOperationsAlertSummarySchema.parse(await adminRepository.getOperationsAlertSummary());
      const activeAlerts = buildOperationsAlerts(summary);
      const overallSeverity = activeAlerts[0]?.severity ?? "healthy";
      return adminOperationsAlertsResponseSchema.parse({
        summary,
        overall_severity: overallSeverity,
        active_alerts: activeAlerts,
      });
    } catch (err) {
      throw toServiceError(err, "Failed to load operations alerts");
    }
  },
  async updateSubscription(id: string, input: AdminSubscriptionUpdateInput) {
    try {
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
};
