import { z } from "zod";
import { dateStringSchema, dateTimeStringSchema } from "../shared/date.schema";

export const reportOverviewSchema = z.object({
  total_revenue: z.coerce.number().min(0),
  total_patients: z.coerce.number().int().min(0),
  total_appointments: z.coerce.number().int().min(0),
  avg_doctor_rating: z.coerce.number().min(0),
});

export const revenueByMonthRowSchema = z.object({
  month_start: dateStringSchema,
  revenue: z.coerce.number().min(0),
  expenses: z.coerce.number().min(0),
});

export const patientGrowthRowSchema = z.object({
  month_start: dateStringSchema,
  total_patients: z.coerce.number().int().min(0),
});

export const appointmentTypeRowSchema = z.object({
  type: z.string().min(1),
  count: z.coerce.number().int().min(0),
});

export const appointmentStatusRowSchema = z.object({
  status: z.string().min(1),
  count: z.coerce.number().int().min(0),
});

export const revenueByServiceRowSchema = z.object({
  service: z.string().min(1),
  revenue: z.coerce.number().min(0),
});

export const doctorPerformanceRowSchema = z.object({
  doctor_id: z.string().uuid(),
  doctor_name: z.string().min(1),
  appointments: z.coerce.number().int().min(0),
  completed: z.coerce.number().int().min(0),
  rating: z.coerce.number().min(0),
});

export const reportRefreshHealthEnum = z.enum(["healthy", "stale", "failing"]);

export const reportRefreshStatusSchema = z.object({
  last_started_at: dateTimeStringSchema.nullable().optional(),
  last_succeeded_at: dateTimeStringSchema.nullable().optional(),
  last_failed_at: dateTimeStringSchema.nullable().optional(),
  last_error: z.string().trim().max(5000).nullable().optional(),
  is_stale: z.boolean(),
  stale_after_minutes: z.coerce.number().int().positive(),
});

export const reportRefreshHealthSchema = reportRefreshStatusSchema.extend({
  health: reportRefreshHealthEnum,
  status_message: z.string().trim().min(1).max(240),
});
