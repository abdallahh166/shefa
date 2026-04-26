import type { z } from "zod";
import {
  adminClientErrorTrendPointSchema,
  adminOperationsDashboardResponseSchema,
  adminOperationsAlertsResponseSchema,
  adminOperationsAlertSchema,
  adminOperationsAlertSummarySchema,
  adminJobRetryInputSchema,
  adminPricingPlanCreateSchema,
  adminPricingPlanSchema,
  adminPricingPlanUpdateSchema,
  adminRecentActivitySchema,
  adminRecentJobActivitySchema,
  adminRecentSystemErrorSchema,
  adminTenantFeatureFlagSchema,
  adminTenantFeatureFlagUpdateSchema,
  adminTenantCreateSchema,
  adminSubscriptionSchema,
  adminTenantStatusUpdateSchema,
  adminTenantUsageSchema,
  adminSubscriptionUpdateSchema,
  adminSubscriptionStatsSchema,
  adminTenantSchema,
  adminTenantUpdateSchema,
} from "./admin.schema";

export type AdminTenant = z.infer<typeof adminTenantSchema>;
export type AdminTenantCreateInput = z.infer<typeof adminTenantCreateSchema>;
export type AdminTenantUpdateInput = z.infer<typeof adminTenantUpdateSchema>;
export type AdminTenantStatusUpdateInput = z.infer<typeof adminTenantStatusUpdateSchema>;
export type AdminTenantFeatureFlag = z.infer<typeof adminTenantFeatureFlagSchema>;
export type AdminTenantFeatureFlagUpdateInput = z.infer<typeof adminTenantFeatureFlagUpdateSchema>;
export type AdminSubscription = z.infer<typeof adminSubscriptionSchema>;
export type AdminSubscriptionUpdateInput = z.infer<typeof adminSubscriptionUpdateSchema>;
export type AdminSubscriptionStats = z.infer<typeof adminSubscriptionStatsSchema>;
export type AdminOperationsAlertSummary = z.infer<typeof adminOperationsAlertSummarySchema>;
export type AdminOperationsAlert = z.infer<typeof adminOperationsAlertSchema>;
export type AdminOperationsAlertsResponse = z.infer<typeof adminOperationsAlertsResponseSchema>;
export type AdminPricingPlan = z.infer<typeof adminPricingPlanSchema>;
export type AdminPricingPlanCreateInput = z.infer<typeof adminPricingPlanCreateSchema>;
export type AdminPricingPlanUpdateInput = z.infer<typeof adminPricingPlanUpdateSchema>;
export type AdminRecentJobActivity = z.infer<typeof adminRecentJobActivitySchema>;
export type AdminRecentActivity = z.infer<typeof adminRecentActivitySchema>;
export type AdminRecentSystemError = z.infer<typeof adminRecentSystemErrorSchema>;
export type AdminClientErrorTrendPoint = z.infer<typeof adminClientErrorTrendPointSchema>;
export type AdminOperationsDashboardResponse = z.infer<typeof adminOperationsDashboardResponseSchema>;
export type AdminTenantUsage = z.infer<typeof adminTenantUsageSchema>;
export type AdminJobRetryInput = z.infer<typeof adminJobRetryInputSchema>;

export type AdminMutationContext = {
  requestId: string;
  idempotencyKey: string;
};
