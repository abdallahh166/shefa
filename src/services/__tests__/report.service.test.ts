import { describe, expect, it, vi, beforeEach } from "vitest";
import { reportService } from "@/services/reports/report.service";
import { reportRepository } from "@/services/reports/report.repository";
import { featureAccessService } from "@/services/subscription/featureAccess.service";
import { AuthorizationError } from "@/services/supabase/errors";

vi.mock("@/services/supabase/tenant", () => ({
  getTenantContext: () => ({ tenantId: "00000000-0000-0000-0000-000000000111", userId: "00000000-0000-0000-0000-000000000222" }),
}));

vi.mock("@/core/auth/authStore", () => ({
  useAuth: {
    getState: () => ({
      hasPermission: () => true,
    }),
  },
}));

vi.mock("@/services/reports/report.repository", () => ({
  reportRepository: {
    assertAccess: vi.fn(),
    getRefreshStatus: vi.fn(),
    getOverview: vi.fn(),
    getRevenueByMonth: vi.fn(),
    getPatientGrowth: vi.fn(),
    getAppointmentTypes: vi.fn(),
    getAppointmentStatuses: vi.fn(),
    getRevenueByService: vi.fn(),
    getDoctorPerformance: vi.fn(),
  },
}));

vi.mock("@/services/subscription/featureAccess.service", () => ({
  featureAccessService: {
    assertFeatureAccess: vi.fn(),
  },
}));

const repo = vi.mocked(reportRepository, true);
const featureAccess = vi.mocked(featureAccessService, true);

describe("reportService aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featureAccess.assertFeatureAccess.mockResolvedValue({
      plan: "starter",
      status: "active",
      isExpired: false,
      flags: [],
    } as any);
  });

  it("coerces overview numeric values", async () => {
    repo.getOverview.mockResolvedValue({
      total_revenue: "1200.5",
      total_patients: "25",
      total_appointments: "40",
      avg_doctor_rating: "4.2",
    } as any);

    const result = await reportService.getOverview();

    expect(result.total_revenue).toBe(1200.5);
    expect(result.total_patients).toBe(25);
    expect(result.total_appointments).toBe(40);
    expect(result.avg_doctor_rating).toBe(4.2);
  });

  it("marks refresh status as failing when the latest refresh failed", async () => {
    repo.getRefreshStatus.mockResolvedValue({
      last_started_at: "2026-04-15T08:00:00.000Z",
      last_succeeded_at: "2026-04-15T07:00:00.000Z",
      last_failed_at: "2026-04-15T08:05:00.000Z",
      last_error: "refresh failed",
      is_stale: true,
      stale_after_minutes: 120,
    } as any);

    const result = await reportService.getRefreshStatus();

    expect(result.health).toBe("failing");
    expect(result.status_message).toContain("failing");
  });

  it("marks refresh status as healthy when data is fresh", async () => {
    repo.getRefreshStatus.mockResolvedValue({
      last_started_at: "2026-04-15T08:00:00.000Z",
      last_succeeded_at: new Date().toISOString(),
      last_failed_at: null,
      last_error: null,
      is_stale: false,
      stale_after_minutes: 120,
    } as any);

    const result = await reportService.getRefreshStatus();

    expect(result.health).toBe("healthy");
    expect(result.status_message).toContain("fresh");
  });

  it("maps revenue by month to labels", async () => {
    repo.getRevenueByMonth.mockResolvedValue([
      { month_start: "2026-01-01", revenue: "100", expenses: "40" },
      { month_start: "2026-02-01", revenue: "200", expenses: "50" },
    ] as any);

    const result = await reportService.getRevenueByMonth(6);

    expect(result).toHaveLength(2);
    expect(result[0].month).toMatch(/Jan/);
    expect(result[1].month).toMatch(/Feb/);
    expect(result[0].revenue).toBe(100);
    expect(result[0].expenses).toBe(40);
  });

  it("aggregates appointment status counts", async () => {
    repo.getAppointmentStatuses.mockResolvedValue([
      { status: "scheduled", count: "2" },
      { status: "completed", count: "5" },
      { status: "no_show", count: "1" },
    ] as any);

    const result = await reportService.getAppointmentStatusCounts();

    expect(result.scheduled).toBe(2);
    expect(result.completed).toBe(5);
    expect(result.in_progress).toBe(0);
    expect(result.cancelled).toBe(0);
    expect(result.no_show).toBe(1);
  });

  it("returns false when reports are not included in the current subscription", async () => {
    featureAccess.assertFeatureAccess.mockRejectedValue(
      new AuthorizationError("Reports are not available on the current subscription."),
    );

    const result = await reportService.canViewReports();

    expect(result).toBe(false);
    expect(repo.assertAccess).not.toHaveBeenCalled();
  });
});
