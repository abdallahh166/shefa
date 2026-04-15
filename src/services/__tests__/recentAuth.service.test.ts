import { describe, expect, it, vi } from "vitest";

const getState = vi.hoisted(() => vi.fn());

vi.mock("@/core/auth/authStore", () => ({
  useAuth: { getState },
}));

import { recentAuthService } from "@/services/auth/recentAuth.service";

describe("recentAuthService", () => {
  it("treats recent privileged authentication as fresh", () => {
    getState.mockReturnValue({
      user: { role: "super_admin" },
      lastVerifiedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    });

    expect(recentAuthService.isFresh()).toBe(true);
    expect(recentAuthService.getRequiredWindowMs("super_admin")).toBe(10 * 60 * 1000);
  });

  it("rejects stale authentication for sensitive actions", () => {
    getState.mockReturnValue({
      user: { role: "clinic_admin" },
      lastVerifiedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });

    expect(() => recentAuthService.assertRecentAuth({ action: "subscription_update" })).toThrowError(
      /sign in again/i
    );
  });

  it("treats missing verification timestamp as stale", () => {
    getState.mockReturnValue({
      user: { role: "super_admin" },
      lastVerifiedAt: null,
    });

    expect(recentAuthService.isFresh()).toBe(false);
  });
});
