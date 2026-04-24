import { z } from "zod";
import {
  appointmentStatusRowSchema,
  appointmentTypeRowSchema,
  doctorPerformanceRowSchema,
  patientGrowthRowSchema,
  reportOverviewSchema,
  reportRefreshHealthSchema,
  reportRefreshStatusSchema,
  revenueByMonthRowSchema,
  revenueByServiceRowSchema,
} from "@/domain/reports/reports.schema";
import { featureAccessService } from "@/services/subscription/featureAccess.service";
import { AuthorizationError, ServiceError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { reportRepository } from "./report.repository";

const statusCountsSchema = z.object({
  scheduled: z.number().int().nonnegative(),
  in_progress: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  no_show: z.number().int().nonnegative(),
});

const monthsSchema = z.coerce.number().int().min(1).max(24);
const limitSchema = z.coerce.number().int().min(1).max(20);

const monthLabel = (dateStr: string, withYear: boolean) =>
  new Date(dateStr).toLocaleString("en", withYear ? { month: "short", year: "2-digit" } : { month: "short" });

const reportStaleErrorCodes = new Set([
  "42P01", // undefined table/view
  "42703", // undefined column
  "42883", // undefined function
  "42P10", // invalid column reference
  "PGRST202", // RPC not found
  "PGRST203",
  "PGRST204",
]);

const reportStaleMessageFragments = [
  "materialized view",
  "mv_report_",
  "relation \"mv_report",
  "cache lookup failed",
  "get_report_",
  "does not exist",
];

const isReportStaleError = (err: ServiceError) => {
  if (err.code && reportStaleErrorCodes.has(err.code)) return true;
  const detailMessage =
    typeof err.details === "object" && err.details && "message" in err.details
      ? String((err.details as { message?: string }).message ?? "")
      : "";
  const combined = `${err.message ?? ""} ${detailMessage}`.toLowerCase();
  return reportStaleMessageFragments.some((fragment) => combined.includes(fragment));
};

const handleReportError = <T>(err: unknown, fallbackMessage: string, fallbackValue: T): T => {
  const mapped = toServiceError(err, fallbackMessage);
  if (mapped instanceof AuthorizationError) {
    throw mapped;
  }
  if (mapped instanceof ServiceError && isReportStaleError(mapped)) {
    return fallbackValue;
  }
  throw mapped;
};

const minutesSince = (value?: string | null) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
};

export const reportService = {
  async canViewReports() {
    try {
      await featureAccessService.assertFeatureAccess("reports");
      const { tenantId } = getTenantContext();
      await reportRepository.assertAccess(tenantId);
      return true;
    } catch (err) {
      const mapped = toServiceError(err, "Failed to verify report access");
      if (mapped instanceof AuthorizationError) return false;
      throw mapped;
    }
  },
  async getRefreshStatus() {
    try {
      await featureAccessService.assertFeatureAccess("reports");
      const { tenantId } = getTenantContext();
      const raw = await reportRepository.getRefreshStatus(tenantId);
      if (!raw) {
        return reportRefreshHealthSchema.parse({
          last_started_at: null,
          last_succeeded_at: null,
          last_failed_at: null,
          last_error: null,
          is_stale: true,
          stale_after_minutes: 120,
          health: "stale",
          status_message: "Reporting has not completed an initial refresh yet.",
        });
      }

      const parsed = reportRefreshStatusSchema.parse(raw);
      const failedAfterSuccess =
        !!parsed.last_failed_at &&
        (!parsed.last_succeeded_at || new Date(parsed.last_failed_at).getTime() > new Date(parsed.last_succeeded_at).getTime());

      const health = failedAfterSuccess ? "failing" : parsed.is_stale ? "stale" : "healthy";
      const staleMinutes = minutesSince(parsed.last_succeeded_at);
      const statusMessage =
        health === "failing"
          ? "Reporting refresh is failing. Data may be stale until the next successful refresh."
          : health === "stale"
            ? `Reporting data is stale${staleMinutes !== null ? ` (${staleMinutes} minutes since the last successful refresh)` : ""}.`
            : `Reporting data is fresh${staleMinutes !== null ? ` (${staleMinutes} minutes since the last successful refresh)` : ""}.`;

      return reportRefreshHealthSchema.parse({
        ...parsed,
        health,
        status_message: statusMessage,
      });
    } catch (err) {
      return handleReportError(err, "Failed to load report refresh status", {
        last_started_at: null,
        last_succeeded_at: null,
        last_failed_at: null,
        last_error: null,
        is_stale: true,
        stale_after_minutes: 120,
        health: "stale",
        status_message: "Reporting refresh status is unavailable right now.",
      });
    }
  },
  async getOverview() {
    try {
      await featureAccessService.assertFeatureAccess("reports");
      const { tenantId } = getTenantContext();
      const result = await reportRepository.getOverview(tenantId);
      return reportOverviewSchema.parse(result);
    } catch (err) {
      return handleReportError(err, "Failed to load reports overview", {
        total_revenue: 0,
        total_patients: 0,
        total_appointments: 0,
        avg_doctor_rating: 0,
      });
    }
  },
  async getRevenueByMonth(months = 6) {
    try {
      await featureAccessService.assertFeatureAccess("reports");
      const { tenantId } = getTenantContext();
      const safeMonths = monthsSchema.parse(months);
      const result = await reportRepository.getRevenueByMonth(tenantId, safeMonths);
      const rows = z.array(revenueByMonthRowSchema).parse(result);
      return rows.map((row) => ({
        month: monthLabel(row.month_start, true),
        revenue: row.revenue,
        expenses: row.expenses,
      }));
    } catch (err) {
      return handleReportError(err, "Failed to load revenue report", []);
    }
  },
  async getPatientGrowth(months = 6) {
    try {
      await featureAccessService.assertFeatureAccess("reports");
      const { tenantId } = getTenantContext();
      const safeMonths = monthsSchema.parse(months);
      const result = await reportRepository.getPatientGrowth(tenantId, safeMonths);
      const rows = z.array(patientGrowthRowSchema).parse(result);
      return rows.map((row) => ({
        month: monthLabel(row.month_start, false),
        patients: row.total_patients,
      }));
    } catch (err) {
      return handleReportError(err, "Failed to load patient growth report", []);
    }
  },
  async getAppointmentTypes() {
    try {
      await featureAccessService.assertFeatureAccess("reports");
      const { tenantId } = getTenantContext();
      const result = await reportRepository.getAppointmentTypes(tenantId);
      const rows = z.array(appointmentTypeRowSchema).parse(result);
      return rows.map((row) => ({
        name: row.type.replace("_", " "),
        value: row.count,
      }));
    } catch (err) {
      return handleReportError(err, "Failed to load appointment types report", []);
    }
  },
  async getAppointmentStatusCounts() {
    try {
      await featureAccessService.assertFeatureAccess("reports");
      const { tenantId } = getTenantContext();
      const result = await reportRepository.getAppointmentStatuses(tenantId);
      const rows = z.array(appointmentStatusRowSchema).parse(result);
      const counts = rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {});
      return statusCountsSchema.parse({
        scheduled: counts.scheduled ?? 0,
        in_progress: counts.in_progress ?? 0,
        completed: counts.completed ?? 0,
        cancelled: counts.cancelled ?? 0,
        no_show: counts.no_show ?? 0,
      });
    } catch (err) {
      return handleReportError(err, "Failed to load appointment status report", {
        scheduled: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      });
    }
  },
  async getRevenueByService(limit = 6) {
    try {
      await featureAccessService.assertFeatureAccess("reports");
      const { tenantId } = getTenantContext();
      const safeLimit = limitSchema.parse(limit);
      const result = await reportRepository.getRevenueByService(tenantId, safeLimit);
      const rows = z.array(revenueByServiceRowSchema).parse(result);
      return rows.map((row) => ({
        name: row.service,
        value: row.revenue,
      }));
    } catch (err) {
      return handleReportError(err, "Failed to load revenue by service report", []);
    }
  },
  async getDoctorPerformance() {
    try {
      await featureAccessService.assertFeatureAccess("reports");
      const { tenantId } = getTenantContext();
      const result = await reportRepository.getDoctorPerformance(tenantId);
      const rows = z.array(doctorPerformanceRowSchema).parse(result);
      return rows
        .map((row) => {
          const completedRateValue = row.appointments ? Math.round((row.completed / row.appointments) * 100) : 0;
          return {
            name: row.doctor_name,
            appointments: row.appointments,
            rating: row.rating,
            completedRate: `${completedRateValue}%`,
            trend: row.completed > row.appointments / 2,
          };
        })
        .sort((a, b) => b.appointments - a.appointments);
    } catch (err) {
      return handleReportError(err, "Failed to load doctor performance report", []);
    }
  },
};
