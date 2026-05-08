import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitAuthMetric } from "@/services/auth/authMetrics";
import { initAuthOperationalTelemetry, resetAuthOperationalTelemetryForTests } from "./authOperationalTelemetry";

const telemetryHarness = vi.hoisted(() => ({
  log: vi.fn(async () => undefined),
  captureError: vi.fn(),
}));

vi.mock("@/core/auth/authStore", () => ({
  useAuth: {
    getState: () => ({
      user: {
        id: "00000000-0000-0000-0000-000000000222",
        tenantId: "00000000-0000-0000-0000-000000000111",
      },
      tenantOverride: null,
    }),
  },
}));

vi.mock("@/services/observability/clientErrorLog.service", () => ({
  clientErrorLogService: {
    log: telemetryHarness.log,
  },
}));

vi.mock("./sentry", () => ({
  captureError: telemetryHarness.captureError,
}));

describe("authOperationalTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthOperationalTelemetryForTests();
  });

  it("persists critical auth metrics as structured auth operational signals", async () => {
    initAuthOperationalTelemetry();

    emitAuthMetric("refresh_failed", {
      authTraceId: "00000000-0000-4000-8000-000000000999",
      terminal: true,
    });
    await Promise.resolve();

    expect(telemetryHarness.log).toHaveBeenCalledWith(expect.objectContaining({
      action_type: "auth_metric",
      resource_type: "refresh_failed",
      request_id: "00000000-0000-4000-8000-000000000999",
      metadata: expect.objectContaining({
        auth_metric: "refresh_failed",
        severity: "warning",
        terminal: true,
      }),
    }));
  });

  it("emits a synthetic refresh storm signal when refresh attempts spike", async () => {
    vi.useFakeTimers();
    initAuthOperationalTelemetry();

    for (let i = 0; i < 20; i++) {
      emitAuthMetric("refresh_attempt", { attempt: i });
    }
    await vi.runAllTimersAsync();

    expect(telemetryHarness.log).toHaveBeenCalledWith(expect.objectContaining({
      action_type: "auth_metric",
      resource_type: "auth_refresh_storm_detected",
      metadata: expect.objectContaining({
        auth_metric: "auth_refresh_storm_detected",
        severity: "critical",
        attempts: 20,
      }),
    }));
    vi.useRealTimers();
  });
});
