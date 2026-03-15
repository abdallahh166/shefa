import type {
  AppointmentStatusRow,
  AppointmentTypeRow,
  DoctorPerformanceRow,
  PatientGrowthRow,
  ReportOverview,
  RevenueByMonthRow,
  RevenueByServiceRow,
} from "@/domain/reports/reports.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

export interface ReportRepository {
  assertAccess(tenantId: string): Promise<void>;
  getOverview(tenantId: string): Promise<ReportOverview>;
  getRevenueByMonth(tenantId: string, months?: number): Promise<RevenueByMonthRow[]>;
  getPatientGrowth(tenantId: string, months?: number): Promise<PatientGrowthRow[]>;
  getAppointmentTypes(tenantId: string): Promise<AppointmentTypeRow[]>;
  getAppointmentStatuses(tenantId: string): Promise<AppointmentStatusRow[]>;
  getRevenueByService(tenantId: string, limit?: number): Promise<RevenueByServiceRow[]>;
  getDoctorPerformance(tenantId: string): Promise<DoctorPerformanceRow[]>;
}

export const reportRepository: ReportRepository = {
  async assertAccess(_tenantId) {
    const { error } = await supabase.rpc("assert_can_view_reports");
    if (error) {
      throw new ServiceError(error.message ?? "Not authorized to view reports", {
        code: error.code,
        details: error,
      });
    }
  },
  async getOverview(_tenantId) {
    const { data, error } = await supabase.rpc("get_report_overview");
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load report overview", {
        code: error.code,
        details: error,
      });
    }
    return ((data as any)?.[0] ?? { total_revenue: 0, total_patients: 0, total_appointments: 0, avg_doctor_rating: 0 }) as ReportOverview;
  },
  async getRevenueByMonth(_tenantId, months = 6) {
    const { data, error } = await supabase.rpc("get_report_revenue_by_month", { _months: months });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load revenue report", {
        code: error.code,
        details: error,
      });
    }
    return (data ?? []) as RevenueByMonthRow[];
  },
  async getPatientGrowth(_tenantId, months = 6) {
    const { data, error } = await supabase.rpc("get_report_patient_growth", { _months: months });
    if (error) {
      const shouldRetry =
        /_months|signature|function|get_report_patient_growth/i.test(error.message ?? "") ||
        ["PGRST202", "PGRST203", "PGRST116", "PGRST301", "PGRST204"].includes(error.code ?? "");
      if (shouldRetry) {
        const fallback = await supabase.rpc("get_report_patient_growth");
        if (!fallback.error) {
          return (fallback.data ?? []) as PatientGrowthRow[];
        }
      }
      throw new ServiceError(error.message ?? "Failed to load patient growth report", {
        code: error.code,
        details: error,
      });
    }
    return (data ?? []) as PatientGrowthRow[];
  },
  async getAppointmentTypes(_tenantId) {
    const { data, error } = await supabase.rpc("get_report_appointment_types");
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load appointment types report", {
        code: error.code,
        details: error,
      });
    }
    return (data ?? []) as AppointmentTypeRow[];
  },
  async getAppointmentStatuses(_tenantId) {
    const { data, error } = await supabase.rpc("get_report_appointment_statuses");
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load appointment status report", {
        code: error.code,
        details: error,
      });
    }
    return (data ?? []) as AppointmentStatusRow[];
  },
  async getRevenueByService(_tenantId, limit = 6) {
    const { data, error } = await supabase.rpc("get_report_revenue_by_service", { _limit: limit });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load revenue by service report", {
        code: error.code,
        details: error,
      });
    }
    return (data ?? []) as RevenueByServiceRow[];
  },
  async getDoctorPerformance(_tenantId) {
    const { data, error } = await supabase.rpc("get_report_doctor_performance");
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load doctor performance report", {
        code: error.code,
        details: error,
      });
    }
    return (data ?? []) as DoctorPerformanceRow[];
  },
};
