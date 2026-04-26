import { beforeEach, describe, expect, it, vi } from "vitest";

const subscriptionRepository = vi.hoisted(() => ({
  getByTenant: vi.fn(),
}));

const featureFlagRepository = vi.hoisted(() => ({
  listByTenant: vi.fn(),
}));

const useAuthState = vi.hoisted(() => ({
  getState: vi.fn(),
}));

vi.mock("@/services/subscription/subscription.repository", () => ({ subscriptionRepository }));
vi.mock("@/services/featureFlags/featureFlag.repository", () => ({ featureFlagRepository }));
vi.mock("@/services/supabase/tenant", () => ({
  getTenantContext: () => ({
    tenantId: "00000000-0000-0000-0000-000000000111",
    userId: "00000000-0000-0000-0000-000000000222",
  }),
}));
vi.mock("@/core/auth/authStore", () => ({
  useAuth: useAuthState,
}));

import { featureAccessService } from "@/services/subscription/featureAccess.service";

describe("featureAccessService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthState.getState.mockReturnValue({
      user: {
        id: "00000000-0000-0000-0000-000000000222",
        tenantRoles: ["clinic_admin"],
        globalRoles: [],
      },
      tenantOverride: null,
    });
    subscriptionRepository.getByTenant.mockResolvedValue({
      plan: "starter",
      status: "active",
      amount: 0,
      currency: "EGP",
      billing_cycle: "monthly",
      expires_at: "2099-01-01T00:00:00.000Z",
    });
    featureFlagRepository.listByTenant.mockResolvedValue([]);
  });

  it("allows a feature that is included in the active plan", async () => {
    await expect(featureAccessService.assertFeatureAccess("billing")).resolves.toMatchObject({
      plan: "starter",
      status: "active",
      isExpired: false,
    });
  });

  it("blocks a feature that is explicitly disabled by feature flag", async () => {
    subscriptionRepository.getByTenant.mockResolvedValue({
      plan: "pro",
      status: "active",
      amount: 0,
      currency: "EGP",
      billing_cycle: "monthly",
      expires_at: "2099-01-01T00:00:00.000Z",
    });
    featureFlagRepository.listByTenant.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000333",
        tenant_id: "00000000-0000-0000-0000-000000000111",
        feature_key: "lab_module",
        enabled: false,
        created_at: "2026-04-24T10:00:00.000Z",
      },
    ]);

    await expect(featureAccessService.assertFeatureAccess("laboratory")).rejects.toMatchObject({
      name: "AuthorizationError",
      code: "FEATURE_NOT_ENABLED",
      message: "Laboratory is disabled for this clinic.",
    });
  });

  it("treats expired subscriptions as free-tier access", async () => {
    subscriptionRepository.getByTenant.mockResolvedValue({
      plan: "enterprise",
      status: "expired",
      amount: 0,
      currency: "EGP",
      billing_cycle: "monthly",
      expires_at: "2026-04-01T00:00:00.000Z",
    });

    await expect(featureAccessService.assertFeatureAccess("insurance")).rejects.toMatchObject({
      name: "AuthorizationError",
      code: "FEATURE_NOT_ENABLED",
      message: "Insurance is not available on the current subscription.",
    });
  });

  it("grants enterprise access to super admins outside tenant impersonation", async () => {
    useAuthState.getState.mockReturnValue({
      user: {
        id: "00000000-0000-0000-0000-000000000222",
        tenantRoles: [],
        globalRoles: ["super_admin"],
      },
      tenantOverride: null,
    });

    await expect(featureAccessService.assertFeatureAccess("insurance")).resolves.toMatchObject({
      plan: "enterprise",
      status: "active",
      isExpired: false,
    });

    expect(subscriptionRepository.getByTenant).not.toHaveBeenCalled();
    expect(featureFlagRepository.listByTenant).not.toHaveBeenCalled();
  });
});
