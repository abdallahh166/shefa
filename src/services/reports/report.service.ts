import { z } from "zod";
import {
  appointmentStatusRowSchema,
  appointmentTypeRowSchema,
  doctorPerformanceRowSchema,
  patientGrowthRowSchema,
  reportOverviewSchema,
  revenueByMonthRowSchema,
  revenueByServiceRowSchema,
} from "@/domain/reports/reports.schema";
import { AuthorizationError, ServiceError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { reportRepository } from "./report.repository";

const statusCountsSchema = z.object({
  scheduled: z.number().int().nonnegative(),
  in_progress: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
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

export const reportService = {
  async canViewReports() {
    try {
      const { tenantId } = getTenantContext();
      await reportRepository.assertAccess(tenantId);
      return true;
    } catch (err) {
      const mapped = toServiceError(err, "Failed to verify report access");
      if (mapped instanceof AuthorizationError) return false;
      throw mapped;
    }
  },
  async getOverview() {
    try {
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
      });
    } catch (err) {
      return handleReportError(err, "Failed to load appointment status report", {
        scheduled: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
      });
    }
  },
  async getRevenueByService(limit = 6) {
    try {
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
