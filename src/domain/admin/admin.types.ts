import type { z } from "zod";
import {
  adminOperationsAlertsResponseSchema,
  adminOperationsAlertSchema,
  adminOperationsAlertSummarySchema,
  adminSubscriptionSchema,
  adminSubscriptionUpdateSchema,
  adminSubscriptionStatsSchema,
  adminTenantSchema,
} from "./admin.schema";

export type AdminTenant = z.infer<typeof adminTenantSchema>;
export type AdminSubscription = z.infer<typeof adminSubscriptionSchema>;
export type AdminSubscriptionUpdateInput = z.infer<typeof adminSubscriptionUpdateSchema>;
export type AdminSubscriptionStats = z.infer<typeof adminSubscriptionStatsSchema>;
export type AdminOperationsAlertSummary = z.infer<typeof adminOperationsAlertSummarySchema>;
export type AdminOperationsAlert = z.infer<typeof adminOperationsAlertSchema>;
export type AdminOperationsAlertsResponse = z.infer<typeof adminOperationsAlertsResponseSchema>;
