import { z } from "zod";
import {
  adminJobRetryInputSchema,
  adminClientErrorTrendPointSchema,
  adminOperationsDashboardResponseSchema,
  adminOperationsAlertsResponseSchema,
  adminOperationsAlertSummarySchema,
  adminPricingPlanCreateSchema,
  adminPricingPlanSchema,
  adminPricingPlanUpdateSchema,
  adminRecentActivitySchema,
  adminRecentJobActivitySchema,
  adminRecentSystemErrorSchema,
  adminSubscriptionSchema,
  adminSubscriptionUpdateSchema,
  adminSubscriptionStatsSchema,
  adminTenantFeatureFlagSchema,
  adminTenantFeatureFlagUpdateSchema,
  adminTenantCreateSchema,
  adminTenantSchema,
  adminTenantUsageSchema,
  adminTenantStatusUpdateSchema,
  adminTenantUpdateSchema,
  operationsAlertSeverityEnum,
  subscriptionPlanEnum,
  subscriptionStatusEnum,
} from "@/domain/admin/admin.schema";
import type {
  AdminClientErrorTrendPoint,
  AdminMutationContext,
  AdminOperationsAlert,
  AdminOperationsAlertSummary,
  AdminPricingPlanCreateInput,
  AdminPricingPlanUpdateInput,
  AdminRecentActivity,
  AdminTenantFeatureFlagUpdateInput,
  AdminTenantCreateInput,
  AdminTenantStatusUpdateInput,
  AdminSubscriptionUpdateInput,
  AdminTenantUpdateInput,
  AdminTenantUsage,
  AdminRecentJobActivity,
  AdminRecentSystemError,
} from "@/domain/admin/admin.types";
import { profileWithRolesSchema } from "@/domain/settings/profile.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { toServiceError } from "@/services/supabase/errors";
import { featureFlagRepository } from "@/services/featureFlags/featureFlag.repository";
import { createRequestId } from "@/core/observability/requestId";
import { adminSecurityService } from "./adminSecurity.service";
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

function sortRecentAdminActivity(rows: AdminRecentActivity[]) {
  return [...rows].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
}

function sortClientErrorTrend(rows: AdminClientErrorTrendPoint[]) {
  return [...rows].sort((left, right) => new Date(left.bucket_start).getTime() - new Date(right.bucket_start).getTime());
}

const ADMIN_TENANT_FEATURE_KEYS = [
  "advanced_reports",
  "lab_module",
  "pharmacy_module",
  "insurance_module",
] as const;

export function createAdminMutationContext(existing?: Partial<AdminMutationContext>): AdminMutationContext {
  const requestId = existing?.requestId ?? createRequestId();
  return {
    requestId,
    idempotencyKey: existing?.idempotencyKey ?? requestId,
    stepUpGrantId: existing?.stepUpGrantId ?? null,
  };
}

function extractStepUpGrantId(access: { stepUpGrantId?: string | null } | null | undefined) {
  return access?.stepUpGrantId ?? null;
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
      await adminSecurityService.assertAccess({ action: "admin_list_tenants" });
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
      await adminSecurityService.assertAccess({ action: "admin_list_profiles" });
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
  async createTenant(input: AdminTenantCreateInput, context?: AdminMutationContext) {
    try {
      const mutationContext = createAdminMutationContext(context);
      const access = await adminSecurityService.assertAccess({
        action: "tenant_create",
        requireRecentAuth: true,
        requestId: mutationContext.requestId,
      });
      const stepUpGrantId = extractStepUpGrantId(access);
      const parsed = adminTenantCreateSchema.parse(input);
      const result = await adminRepository.createTenant(parsed, {
        ...mutationContext,
        stepUpGrantId,
      });
      return adminTenantSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to create tenant");
    }
  },
  async updateTenant(id: string, input: AdminTenantUpdateInput, context?: AdminMutationContext) {
    try {
      const parsedId = uuidSchema.parse(id);
      const mutationContext = createAdminMutationContext(context);
      const access = await adminSecurityService.assertAccess({
        action: "tenant_update",
        requireRecentAuth: true,
        resourceId: parsedId,
        requestId: mutationContext.requestId,
      });
      const stepUpGrantId = extractStepUpGrantId(access);
      const parsed = adminTenantUpdateSchema.parse(input);
      const result = await adminRepository.updateTenant(parsedId, parsed, {
        ...mutationContext,
        stepUpGrantId,
      });
      return adminTenantSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update tenant");
    }
  },
  async updateTenantStatus(id: string, input: AdminTenantStatusUpdateInput, context?: AdminMutationContext) {
    try {
      const parsedId = uuidSchema.parse(id);
      const mutationContext = createAdminMutationContext(context);
      const access = await adminSecurityService.assertAccess({
        action: "tenant_status_update",
        requireRecentAuth: true,
        tenantId: parsedId,
        resourceId: parsedId,
        requestId: mutationContext.requestId,
      });
      const stepUpGrantId = extractStepUpGrantId(access);
      const parsed = adminTenantStatusUpdateSchema.parse(input);
      const result = await adminRepository.updateTenantStatus(parsedId, parsed, {
        ...mutationContext,
        stepUpGrantId,
      });
      return adminTenantSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update tenant status");
    }
  },
  async listTenantFeatureFlags(tenantId: string) {
    try {
      await adminSecurityService.assertAccess({ action: "admin_list_tenant_feature_flags" });
      const parsedTenantId = uuidSchema.parse(tenantId);
      const rows = await featureFlagRepository.listByTenant(parsedTenantId);
      const rowsByKey = new Map(rows.map((row) => [row.feature_key, row.enabled]));

      return ADMIN_TENANT_FEATURE_KEYS.map((featureKey) =>
        adminTenantFeatureFlagSchema.parse({
          feature_key: featureKey,
          enabled: rowsByKey.get(featureKey) ?? true,
        }),
      );
    } catch (err) {
      throw toServiceError(err, "Failed to load tenant feature flags");
    }
  },
  async updateTenantFeatureFlag(
    tenantId: string,
    input: AdminTenantFeatureFlagUpdateInput,
    context?: AdminMutationContext,
    ) {
    try {
      const parsedTenantId = uuidSchema.parse(tenantId);
      const mutationContext = createAdminMutationContext(context);
      const access = await adminSecurityService.assertAccess({
        action: "tenant_feature_flag_update",
        requireRecentAuth: true,
        tenantId: parsedTenantId,
        requestId: mutationContext.requestId,
      });
      const stepUpGrantId = extractStepUpGrantId(access);
      const parsed = adminTenantFeatureFlagUpdateSchema.parse(input);
      const result = await adminRepository.updateTenantFeatureFlag(
        parsedTenantId,
        parsed.feature_key,
        parsed.enabled,
        {
          ...mutationContext,
          stepUpGrantId,
        },
      );
      return adminTenantFeatureFlagSchema.parse({
        feature_key: result.feature_key,
        enabled: result.enabled,
      });
    } catch (err) {
      throw toServiceError(err, "Failed to update tenant feature flag");
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
      await adminSecurityService.assertAccess({ action: "admin_list_subscriptions" });
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
      await adminSecurityService.assertAccess({ action: "admin_subscription_stats" });
      const result = await adminRepository.getSubscriptionStats();
      return adminSubscriptionStatsSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load subscription stats");
    }
  },
  async getOperationsAlerts(tenantId?: string) {
    try {
      await adminSecurityService.assertAccess({ action: "admin_operations_alerts" });
      const parsedTenantId = tenantId ? uuidSchema.parse(tenantId) : undefined;
      const summary = adminOperationsAlertSummarySchema.parse(await adminRepository.getOperationsAlertSummary(parsedTenantId));
      return buildOperationsAlertResponse(summary);
    } catch (err) {
      throw toServiceError(err, "Failed to load operations alerts");
    }
  },
  async getOperationsDashboard(tenantId?: string) {
    try {
      await adminSecurityService.assertAccess({ action: "admin_operations_dashboard" });
      const parsedTenantId = tenantId ? uuidSchema.parse(tenantId) : undefined;
      const summary = adminOperationsAlertSummarySchema.parse(await adminRepository.getOperationsAlertSummary(parsedTenantId));
      const recentJobActivity = sortRecentJobActivity(
        z.array(adminRecentJobActivitySchema).parse(await adminRepository.getRecentJobActivity(25, parsedTenantId)),
      );
      const recentSystemErrors = sortRecentSystemErrors(
        z.array(adminRecentSystemErrorSchema).parse(await adminRepository.getRecentSystemErrors(8, parsedTenantId)),
      );
      const clientErrorTrend = sortClientErrorTrend(
        z.array(adminClientErrorTrendPointSchema).parse(await adminRepository.getClientErrorTrend(15, 6, parsedTenantId)),
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
  async getRecentActivity(tenantId?: string) {
    try {
      await adminSecurityService.assertAccess({ action: "admin_activity_stream" });
      const parsedTenantId = tenantId ? uuidSchema.parse(tenantId) : undefined;
      return z.array(adminRecentActivitySchema).parse(
        sortRecentAdminActivity(await adminRepository.getRecentActivity(25, parsedTenantId)),
      );
    } catch (err) {
      throw toServiceError(err, "Failed to load recent admin activity");
    }
  },
  async updateSubscription(id: string, input: AdminSubscriptionUpdateInput, context?: AdminMutationContext) {
    try {
      const parsedId = uuidSchema.parse(id);
      const mutationContext = createAdminMutationContext(context);
      const access = await adminSecurityService.assertAccess({
        action: "subscription_update",
        requireRecentAuth: true,
        resourceId: parsedId,
        requestId: mutationContext.requestId,
      });
      const stepUpGrantId = extractStepUpGrantId(access);
      const parsed = adminSubscriptionUpdateSchema.parse(input);
      const result = await adminRepository.updateSubscription(parsedId, parsed, {
        ...mutationContext,
        stepUpGrantId,
      });
      return adminSubscriptionSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update subscription");
    }
  },
  async listPricingPlans() {
    try {
      await adminSecurityService.assertAccess({ action: "admin_list_pricing_plans" });
      const result = await adminRepository.listPricingPlans();
      return z.array(adminPricingPlanSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load pricing plans");
    }
  },
  async createPricingPlan(input: AdminPricingPlanCreateInput, context?: AdminMutationContext) {
    try {
      const mutationContext = createAdminMutationContext(context);
      const access = await adminSecurityService.assertAccess({
        action: "pricing_plan_create",
        requireRecentAuth: true,
        requestId: mutationContext.requestId,
      });
      const stepUpGrantId = extractStepUpGrantId(access);
      const parsed = adminPricingPlanCreateSchema.parse(input);
      const result = await adminRepository.createPricingPlan(parsed, {
        ...mutationContext,
        stepUpGrantId,
      });
      return adminPricingPlanSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to create pricing plan");
    }
  },
  async updatePricingPlan(id: string, input: AdminPricingPlanUpdateInput, context?: AdminMutationContext) {
    try {
      const parsedId = uuidSchema.parse(id);
      const mutationContext = createAdminMutationContext(context);
      const access = await adminSecurityService.assertAccess({
        action: "pricing_plan_update",
        requireRecentAuth: true,
        resourceId: parsedId,
        requestId: mutationContext.requestId,
      });
      const stepUpGrantId = extractStepUpGrantId(access);
      const parsed = adminPricingPlanUpdateSchema.parse(input);
      const result = await adminRepository.updatePricingPlan(parsedId, parsed, {
        ...mutationContext,
        stepUpGrantId,
      });
      return adminPricingPlanSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update pricing plan");
    }
  },
  async deletePricingPlan(id: string, context?: AdminMutationContext) {
    try {
      const parsedId = uuidSchema.parse(id);
      const mutationContext = createAdminMutationContext(context);
      const access = await adminSecurityService.assertAccess({
        action: "pricing_plan_delete",
        requireRecentAuth: true,
        resourceId: parsedId,
        requestId: mutationContext.requestId,
      });
      const stepUpGrantId = extractStepUpGrantId(access);
      await adminRepository.deletePricingPlan(parsedId, {
        ...mutationContext,
        stepUpGrantId,
      });
    } catch (err) {
      throw toServiceError(err, "Failed to delete pricing plan");
    }
  },
  async getTenantUsage(tenantId: string): Promise<AdminTenantUsage> {
    try {
      await adminSecurityService.assertAccess({ action: "admin_tenant_usage" });
      const parsedTenantId = uuidSchema.parse(tenantId);
      const result = await adminRepository.getTenantUsage(parsedTenantId);
      return adminTenantUsageSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load tenant usage");
    }
  },
  async retryJobs(input: { job_ids: string[]; reason: string }, context?: AdminMutationContext) {
    try {
      const mutationContext = createAdminMutationContext(context);
      const parsed = adminJobRetryInputSchema.parse(input);
      const access = await adminSecurityService.assertAccess({
        action: input.job_ids.length > 1 ? "job_retry_bulk" : "job_retry",
        requireRecentAuth: true,
        resourceId: parsed.job_ids[0] ?? null,
        requestId: mutationContext.requestId,
      });
      const stepUpGrantId = extractStepUpGrantId(access);
      return z.array(adminRecentJobActivitySchema).parse(
        await adminRepository.retryJobs({
          ...parsed,
          ...mutationContext,
          stepUpGrantId,
        }),
      );
    } catch (err) {
      throw toServiceError(err, "Failed to retry jobs");
    }
  },
};
