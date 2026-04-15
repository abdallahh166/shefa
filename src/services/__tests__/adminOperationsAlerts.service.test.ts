import { beforeEach, describe, expect, it, vi } from "vitest";

const adminRepository = vi.hoisted(() => ({
  listTenantsPaged: vi.fn(),
  listProfilesWithRolesPaged: vi.fn(),
  listSubscriptionsPaged: vi.fn(),
  getSubscriptionStats: vi.fn(),
  getOperationsAlertSummary: vi.fn(),
  updateSubscription: vi.fn(),
}));

vi.mock("@/services/admin/admin.repository", () => ({ adminRepository }));

import { adminService } from "@/services/admin/admin.service";

describe("adminService operations alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
