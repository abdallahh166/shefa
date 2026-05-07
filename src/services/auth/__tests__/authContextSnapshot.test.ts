import { beforeEach, describe, expect, it, vi } from "vitest";

const snapshotHarness = vi.hoisted(() => ({
  state: {
    user: null as null | { id: string; tenantId: string | null },
    tenantOverride: null as null | { id: string },
    sessionVersion: null as string | null,
  },
  metrics: [] as Array<{ name: string; payload: Record<string, unknown> }>,
}));

vi.mock("@/core/auth/authStore", () => ({
  useAuth: {
    getState: () => snapshotHarness.state,
  },
}));

vi.mock("../authMetrics", () => ({
  emitAuthMetric: vi.fn((name: string, payload: Record<string, unknown> = {}) => {
    snapshotHarness.metrics.push({ name, payload });
  }),
}));

import {
  assertAuthContextFresh,
  captureAuthContextSnapshot,
  StaleAuthContextError,
  withAuthStaleGuard,
} from "../authContextSnapshot";

describe("authContextSnapshot", () => {
  beforeEach(() => {
    snapshotHarness.state = {
      user: { id: "u1", tenantId: "tenant-1" },
      tenantOverride: null,
      sessionVersion: "u1:tenant-1:1",
    };
    snapshotHarness.metrics.length = 0;
  });

  it("captures the effective tenant and stable sessionVersion", () => {
    expect(captureAuthContextSnapshot()).toEqual({
      userId: "u1",
      tenantId: "tenant-1",
      sessionVersion: "u1:tenant-1:1",
    });

    snapshotHarness.state.tenantOverride = { id: "tenant-override" };

    expect(captureAuthContextSnapshot()).toEqual({
      userId: "u1",
      tenantId: "tenant-override",
      sessionVersion: "u1:tenant-1:1",
    });
  });

  it("returns null when no authenticated principal or sessionVersion exists", () => {
    snapshotHarness.state.user = null;
    expect(captureAuthContextSnapshot()).toBeNull();

    snapshotHarness.state.user = { id: "u1", tenantId: "tenant-1" };
    snapshotHarness.state.sessionVersion = null;
    expect(captureAuthContextSnapshot()).toBeNull();
  });

  it("rejects stale auth contexts on user, tenant, or sessionVersion boundaries", () => {
    const snapshot = captureAuthContextSnapshot();

    snapshotHarness.state.sessionVersion = "u1:tenant-1:2";
    expect(() => assertAuthContextFresh(snapshot)).toThrow(StaleAuthContextError);

    snapshotHarness.state.sessionVersion = "u1:tenant-1:1";
    snapshotHarness.state.tenantOverride = { id: "tenant-2" };
    expect(() => assertAuthContextFresh(snapshot)).toThrow(StaleAuthContextError);

    snapshotHarness.state.tenantOverride = null;
    snapshotHarness.state.user = { id: "u2", tenantId: "tenant-1" };
    expect(() => assertAuthContextFresh(snapshot)).toThrow(StaleAuthContextError);

    expect(snapshotHarness.metrics.every((metric) => !("access_token" in metric.payload))).toBe(true);
    expect(snapshotHarness.metrics).toHaveLength(3);
    expect(snapshotHarness.metrics[0]).toEqual({
      name: "stale_auth_context_rejected",
      payload: { userId: "u1" },
    });
  });

  it("prevents post-boundary writes from async work started under an old principal", async () => {
    const write = vi.fn();

    await expect(withAuthStaleGuard(async () => {
      snapshotHarness.state.sessionVersion = "u1:tenant-1:2";
      return () => write("old request completed");
    })).rejects.toThrow(StaleAuthContextError);

    expect(write).not.toHaveBeenCalled();
    expect(snapshotHarness.metrics).toContainEqual({
      name: "stale_auth_context_rejected",
      payload: { userId: "u1" },
    });
  });
});
