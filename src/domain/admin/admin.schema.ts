import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";
import { pricingBillingCycleEnum, pricingPlanSchema } from "../pricing/pricing.schema";
import { tenantStatusEnum } from "../settings/tenant.schema";

export const subscriptionPlanEnum = z.enum(["free", "starter", "pro", "enterprise"]);
export const subscriptionStatusEnum = z.enum(["active", "trialing", "expired", "canceled"]);

export const adminTenantSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  pending_owner_email: z.string().trim().email().optional().nullable(),
  created_at: dateTimeStringSchema,
  tenant_status: tenantStatusEnum,
  status_reason: z.string().trim().max(500).optional().nullable(),
  status_changed_at: dateTimeStringSchema.optional().nullable(),
  plan: subscriptionPlanEnum.optional().nullable(),
  status: subscriptionStatusEnum.optional().nullable(),
});

export const adminTenantCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().min(3).max(40).optional().nullable(),
  address: z.string().trim().min(1).max(300).optional().nullable(),
  pending_owner_email: z.string().trim().email().optional().nullable(),
});

export const adminTenantUpdateSchema = adminTenantCreateSchema.partial();

export const adminTenantStatusUpdateSchema = z.object({
  status: tenantStatusEnum,
  status_reason: z.string().trim().max(500).optional().nullable(),
});

export const adminSubscriptionSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  plan: subscriptionPlanEnum,
  status: subscriptionStatusEnum,
  amount: z.coerce.number().min(0),
  currency: z.string().trim().min(1).max(10),
  billing_cycle: pricingBillingCycleEnum,
  expires_at: dateTimeStringSchema.optional().nullable(),
  created_at: dateTimeStringSchema,
  tenants: z
    .object({
      name: z.string().trim().min(1).max(200),
      slug: z.string().trim().min(1).max(120),
    })
    .optional()
    .nullable(),
});

export const adminSubscriptionUpdateSchema = z.object({
  plan: subscriptionPlanEnum.optional(),
  status: subscriptionStatusEnum.optional(),
  billing_cycle: pricingBillingCycleEnum.optional(),
});

export const adminPricingPlanSchema = pricingPlanSchema;
export const adminPricingPlanCreateSchema = pricingPlanSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
  });
export const adminPricingPlanUpdateSchema = adminPricingPlanCreateSchema.partial();

export const adminSubscriptionStatsSchema = z.object({
  active_count: z.coerce.number().int().nonnegative(),
  total_revenue: z.coerce.number().nonnegative(),
  plan_counts: z.record(subscriptionPlanEnum, z.coerce.number().int().nonnegative()),
});

export const operationsAlertSeverityEnum = z.enum(["healthy", "warning", "critical"]);
export const adminJobStatusEnum = z.enum(["pending", "processing", "completed", "failed", "dead_letter"]);
export const adminSystemLogLevelEnum = z.enum(["info", "warn", "error"]);

export const adminOperationsAlertSummarySchema = z.object({
  pending_jobs_count: z.coerce.number().int().nonnegative(),
  processing_jobs_count: z.coerce.number().int().nonnegative(),
  retrying_jobs_count: z.coerce.number().int().nonnegative(),
  dead_letter_jobs_count: z.coerce.number().int().nonnegative(),
  stale_processing_jobs_count: z.coerce.number().int().nonnegative(),
  recent_job_failures_count: z.coerce.number().int().nonnegative(),
  recent_edge_failures_count: z.coerce.number().int().nonnegative(),
  recent_client_errors_count: z.coerce.number().int().nonnegative(),
  last_job_failure_at: dateTimeStringSchema.nullable().optional(),
  last_edge_failure_at: dateTimeStringSchema.nullable().optional(),
  last_client_error_at: dateTimeStringSchema.nullable().optional(),
});

export const adminOperationsAlertSchema = z.object({
  key: z.enum([
    "dead_letters",
    "stale_jobs",
    "edge_failures",
    "job_failures",
    "retrying_jobs",
    "queue_backlog",
    "client_errors",
  ]),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(240),
  severity: operationsAlertSeverityEnum,
  count: z.coerce.number().int().nonnegative(),
});

export const adminOperationsAlertsResponseSchema = z.object({
  summary: adminOperationsAlertSummarySchema,
  overall_severity: operationsAlertSeverityEnum,
  active_alerts: z.array(adminOperationsAlertSchema),
});

export const adminRecentJobActivitySchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  tenant_name: z.string().trim().min(1).max(200).nullable().optional(),
  type: z.string().trim().min(1).max(120),
  status: adminJobStatusEnum,
  attempts: z.coerce.number().int().nonnegative(),
  max_attempts: z.coerce.number().int().positive(),
  last_error: z.string().trim().max(5000).nullable().optional(),
  locked_at: dateTimeStringSchema.nullable().optional(),
  locked_by: z.string().trim().max(120).nullable().optional(),
  run_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});

export const adminRecentSystemErrorSchema = z.object({
  id: uuidSchema,
  level: adminSystemLogLevelEnum,
  service: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(5000),
  tenant_id: uuidSchema.nullable().optional(),
  tenant_name: z.string().trim().min(1).max(200).nullable().optional(),
  request_id: z.string().trim().max(120).nullable().optional(),
  created_at: dateTimeStringSchema,
});

export const adminClientErrorTrendPointSchema = z.object({
  bucket_start: dateTimeStringSchema,
  error_count: z.coerce.number().int().nonnegative(),
  affected_tenants_count: z.coerce.number().int().nonnegative(),
});

export const adminOperationsDashboardResponseSchema = adminOperationsAlertsResponseSchema.extend({
  recent_job_activity: z.array(adminRecentJobActivitySchema),
  recent_system_errors: z.array(adminRecentSystemErrorSchema),
  client_error_trend: z.array(adminClientErrorTrendPointSchema),
});
