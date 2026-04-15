import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const subscriptionPlanEnum = z.enum(["free", "starter", "pro", "enterprise"]);
export const subscriptionStatusEnum = z.enum(["active", "trialing", "expired", "canceled"]);

export const adminTenantSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  created_at: dateTimeStringSchema,
  plan: subscriptionPlanEnum.optional().nullable(),
  status: subscriptionStatusEnum.optional().nullable(),
});

export const adminSubscriptionSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  plan: subscriptionPlanEnum,
  status: subscriptionStatusEnum,
  amount: z.coerce.number().min(0),
  currency: z.string().trim().min(1).max(10),
  billing_cycle: z.string().trim().min(1).max(30),
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
});

export const adminSubscriptionStatsSchema = z.object({
  active_count: z.coerce.number().int().nonnegative(),
  total_revenue: z.coerce.number().nonnegative(),
  plan_counts: z.record(subscriptionPlanEnum, z.coerce.number().int().nonnegative()),
});

export const operationsAlertSeverityEnum = z.enum(["healthy", "warning", "critical"]);

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
