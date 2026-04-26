import { beforeEach, describe, expect, it, vi } from "vitest";

const adminRepository = vi.hoisted(() => ({
  listTenantsPaged: vi.fn(),
  listProfilesWithRolesPaged: vi.fn(),
  listSubscriptionsPaged: vi.fn(),
  getSubscriptionStats: vi.fn(),
  getOperationsAlertSummary: vi.fn(),
  getRecentJobActivity: vi.fn(),
  getRecentSystemErrors: vi.fn(),
  getClientErrorTrend: vi.fn(),
  updateSubscription: vi.fn(),
}));

const permissions = vi.hoisted(() => ({
  assertAnyPermission: vi.fn(),
}));

vi.mock("@/services/admin/admin.repository", () => ({ adminRepository }));
vi.mock("@/services/supabase/permissions", () => permissions);
vi.mock("@/services/admin/adminSecurity.service", () => ({
  adminSecurityService: {
    assertAccess: vi.fn(async () => undefined),
  },
}));

import { adminService } from "@/services/admin/admin.service";

describe("adminService operations alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.assertAnyPermission.mockReturnValue(undefined);
    adminRepository.getRecentJobActivity.mockResolvedValue([]);
    adminRepository.getRecentSystemErrors.mockResolvedValue([]);
    adminRepository.getClientErrorTrend.mockResolvedValue([]);
  });

  it("coerces RPC summary values and raises critical alerts", async () => {
    adminRepository.getOperationsAlertSummary.mockResolvedValue({
      pending_jobs_count: "52",
      processing_jobs_count: "7",
      retrying_jobs_count: "6",
      dead_letter_jobs_count: "1",
      stale_processing_jobs_count: "2",
      recent_job_failures_count: "3",
      recent_edge_failures_count: "6",
      recent_client_errors_count: "12",
      last_job_failure_at: "2026-04-15T10:00:00.000Z",
      last_edge_failure_at: "2026-04-15T10:02:00.000Z",
      last_client_error_at: "2026-04-15T10:03:00.000Z",
    });

    const result = await adminService.getOperationsAlerts();

    expect(result.summary.pending_jobs_count).toBe(52);
    expect(result.summary.recent_edge_failures_count).toBe(6);
    expect(result.overall_severity).toBe("critical");
    expect(result.active_alerts.some((alert) => alert.key === "dead_letters" && alert.severity === "critical")).toBe(true);
    expect(result.active_alerts.some((alert) => alert.key === "queue_backlog" && alert.count === 52)).toBe(true);
  });

  it("returns a healthy state when there are no active signals", async () => {
    adminRepository.getOperationsAlertSummary.mockResolvedValue({
      pending_jobs_count: 0,
      processing_jobs_count: 0,
      retrying_jobs_count: 0,
      dead_letter_jobs_count: 0,
      stale_processing_jobs_count: 0,
      recent_job_failures_count: 0,
      recent_edge_failures_count: 0,
      recent_client_errors_count: 0,
      last_job_failure_at: null,
      last_edge_failure_at: null,
      last_client_error_at: null,
    });

    const result = await adminService.getOperationsAlerts();

    expect(result.overall_severity).toBe("healthy");
    expect(result.active_alerts).toEqual([]);
  });

  it("builds an operations dashboard with recent drill-down data", async () => {
    adminRepository.getOperationsAlertSummary.mockResolvedValue({
      pending_jobs_count: 4,
      processing_jobs_count: 2,
      retrying_jobs_count: 1,
      dead_letter_jobs_count: 0,
      stale_processing_jobs_count: 0,
      recent_job_failures_count: 1,
      recent_edge_failures_count: 0,
      recent_client_errors_count: 3,
      last_job_failure_at: "2026-04-15T10:00:00.000Z",
      last_edge_failure_at: null,
      last_client_error_at: "2026-04-15T10:05:00.000Z",
    });
    adminRepository.getRecentJobActivity.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000111",
        tenant_id: "00000000-0000-0000-0000-000000000211",
        tenant_name: "Tenant A",
        type: "refresh_analytics",
        status: "failed",
        attempts: 1,
        max_attempts: 3,
        last_error: "timeout",
        locked_at: null,
        locked_by: null,
        run_at: "2026-04-15T10:00:00.000Z",
        updated_at: "2026-04-15T10:01:00.000Z",
      },
    ]);
    adminRepository.getRecentSystemErrors.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000112",
        level: "error",
        service: "job-worker",
        message: "worker failed",
        tenant_id: null,
        tenant_name: null,
        request_id: "req-1",
        created_at: "2026-04-15T10:02:00.000Z",
      },
    ]);
    adminRepository.getClientErrorTrend.mockResolvedValue([
      {
        bucket_start: "2026-04-15T09:45:00.000Z",
        error_count: 1,
        affected_tenants_count: 1,
      },
      {
        bucket_start: "2026-04-15T10:00:00.000Z",
        error_count: 3,
        affected_tenants_count: 2,
      },
    ]);

    const result = await adminService.getOperationsDashboard();

    expect(result.overall_severity).toBe("warning");
    expect(result.recent_job_activity[0].status).toBe("failed");
    expect(result.recent_system_errors[0].service).toBe("job-worker");
    expect(result.client_error_trend).toHaveLength(2);
    expect(result.client_error_trend[1].error_count).toBe(3);
  });
});
