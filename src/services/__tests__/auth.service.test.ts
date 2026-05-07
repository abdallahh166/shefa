import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "@/services/auth/auth.service";
import { authRepository } from "@/services/auth/auth.repository";
import { rateLimitService } from "@/services/security/rateLimit.service";

const authServiceHarness = vi.hoisted(() => ({
  setAuthMachineState: vi.fn(),
  cleanup: vi.fn(async () => undefined),
  broadcast: vi.fn(),
  metrics: [] as Array<{ name: string; payload: Record<string, unknown> }>,
}));

vi.mock("@/core/auth/authStore", () => ({
  useAuth: {
    getState: () => ({
      setAuthMachineState: authServiceHarness.setAuthMachineState,
    }),
  },
}));

vi.mock("@/services/auth/authSessionOrchestrator", () => ({
  broadcastAuthEvent: authServiceHarness.broadcast,
  runAuthCleanupEvent: authServiceHarness.cleanup,
}));

vi.mock("@/services/auth/authMetrics", () => ({
  emitAuthMetric: vi.fn((name: string, payload: Record<string, unknown> = {}) => {
    authServiceHarness.metrics.push({ name, payload });
  }),
}));

vi.mock("@/services/auth/auth.repository", () => ({
  authRepository: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    refreshSessionSingleFlight: vi.fn(),
    onAuthStateChange: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn(),
    getProfileByUserId: vi.fn(),
    getRolesByUserId: vi.fn(),
    getMfaAssuranceLevel: vi.fn(),
    registerClinic: vi.fn(),
  },
  isTransientAuthNetworkError: (error: { message?: string | null; name?: string }) => {
    const message = error.message?.toLowerCase() ?? "";
    return message.includes("network")
      || message.includes("fetch")
      || message.includes("failed to fetch")
      || error.name === "AuthRetryableFetchError";
  },
}));

vi.mock("@/services/security/rateLimit.service", () => ({
  rateLimitService: {
    assertAllowed: vi.fn(),
  },
}));

const repo = vi.mocked(authRepository, true);
const limiter = vi.mocked(rateLimitService, true);

describe("authService.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authServiceHarness.metrics.length = 0;
  });

  it("rejects login when email is not verified", async () => {
    repo.signInWithPassword.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000111",
      email: "user@example.com",
      email_confirmed_at: null,
    } as any);

    await expect(authService.login("user@example.com", "password")).rejects.toThrow(
      "Please verify your email",
    );
    expect(repo.signOut).toHaveBeenCalled();
  });

  it("allows login when email is verified", async () => {
    repo.signInWithPassword.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000111",
      email: "user@example.com",
      email_confirmed_at: new Date().toISOString(),
    } as any);
    repo.getProfileByUserId.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000222",
      user_id: "00000000-0000-0000-0000-000000000111",
      tenant_id: "00000000-0000-0000-0000-000000000333",
      full_name: "Demo User",
      tenants: { name: "Clinic", slug: "clinic", status: "active", status_reason: null },
    } as any);
    repo.getRolesByUserId.mockResolvedValue({
      tenantRoles: ["clinic_admin"],
      globalRoles: [],
    });

    await expect(authService.login("user@example.com", "password")).resolves.toBeUndefined();
    expect(repo.signOut).not.toHaveBeenCalled();
    expect(limiter.assertAllowed).toHaveBeenCalledWith("login", ["user@example.com"]);
  });
});

describe("authService.resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authServiceHarness.metrics.length = 0;
  });

  it("enforces rate limits for password reset", async () => {
    await authService.resetPassword("reset@example.com", "http://localhost/reset");
    expect(limiter.assertAllowed).toHaveBeenCalledWith("password_reset", ["reset@example.com"]);
  });
});

describe("authService recovery and boundary cleanup", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    authServiceHarness.metrics.length = 0;
    repo.getSession.mockResolvedValue({
      user: {
        id: "00000000-0000-0000-0000-000000000111",
        email: "user@example.com",
      } as any,
      expiresAt: 1_800_000_000,
      createdAt: "2026-03-01T00:00:00.000Z",
    });
    repo.signOut.mockResolvedValue(undefined);
  });

  it("coalesces concurrent unauthorized recovery into a single refresh", async () => {
    let releaseRefresh!: () => void;
    repo.refreshSessionSingleFlight.mockReturnValue(
      new Promise((resolve) => {
        releaseRefresh = () => resolve({ error: null });
      }),
    );

    const first = authService.handleUnauthorized({
      source: "http",
      endpoint: "https://example.test/rest/v1/patients",
      authTraceId: "trace-recovery",
    });
    const second = authService.handleUnauthorized({
      source: "http",
      endpoint: "https://example.test/rest/v1/appointments",
      authTraceId: "trace-recovery",
    });

    await Promise.resolve();
    expect(repo.refreshSessionSingleFlight).toHaveBeenCalledTimes(1);

    releaseRefresh();
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(authServiceHarness.setAuthMachineState).not.toHaveBeenCalledWith("reauth_required");
  });

  it("treats invalid refresh tokens as immediate terminal recovery failure", async () => {
    repo.refreshSessionSingleFlight.mockResolvedValue({
      error: { message: "Invalid refresh token: refresh token not found" },
    });

    await authService.handleUnauthorized({
      source: "http",
      endpoint: "https://example.test/rest/v1/patients",
      authTraceId: "trace-invalid-token",
    });

    expect(repo.refreshSessionSingleFlight).toHaveBeenCalledTimes(1);
    expect(authServiceHarness.setAuthMachineState).toHaveBeenCalledWith("reauth_required");
    expect(authServiceHarness.metrics).toContainEqual({
      name: "refresh_failed",
      payload: { terminal: true, authTraceId: "trace-invalid-token" },
    });
  });

  it("enforces the transient refresh retry cap before returning failure", async () => {
    vi.useFakeTimers();
    repo.refreshSessionSingleFlight.mockResolvedValue({
      error: { message: "Failed to fetch", name: "AuthRetryableFetchError" },
    });

    const result = authService.refreshSessionWithRetryPolicy("trace-retry-cap");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toEqual({ ok: false, code: "REFRESH_FAILED" });
    expect(repo.refreshSessionSingleFlight).toHaveBeenCalledTimes(3);
    expect(authServiceHarness.metrics.filter((metric) => metric.name === "refresh_attempt")).toHaveLength(3);
    vi.useRealTimers();
  });

  it("always runs logout boundary cleanup and releases listener guard after sign-out failures", async () => {
    repo.signOut
      .mockRejectedValueOnce(new Error("global sign-out failed"))
      .mockRejectedValueOnce(new Error("local sign-out failed"));

    await authService.logout("trace-logout", "u1:tenant-1");

    expect(repo.signOut).toHaveBeenNthCalledWith(1, { scope: "global" });
    expect(repo.signOut).toHaveBeenNthCalledWith(2, { scope: "local" });
    expect(authServiceHarness.cleanup).toHaveBeenCalledWith(expect.objectContaining({
      type: "LOGOUT",
      principalKey: "u1:tenant-1",
      authTraceId: "trace-logout",
    }));
    expect(authServiceHarness.broadcast).toHaveBeenCalledWith(expect.objectContaining({
      type: "LOGOUT",
      principalKey: "u1:tenant-1",
      authTraceId: "trace-logout",
    }));
  });
});
