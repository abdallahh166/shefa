import { beforeEach, describe, expect, it, vi } from "vitest";

const adminRepository = vi.hoisted(() => ({
  listTenantsPaged: vi.fn(),
  createTenant: vi.fn(),
  updateTenant: vi.fn(),
  updateTenantStatus: vi.fn(),
  updateTenantFeatureFlag: vi.fn(),
  listProfilesWithRolesPaged: vi.fn(),
  listSubscriptionsPaged: vi.fn(),
  listPricingPlans: vi.fn(),
  createPricingPlan: vi.fn(),
  updatePricingPlan: vi.fn(),
  deletePricingPlan: vi.fn(),
  getSubscriptionStats: vi.fn(),
  getOperationsAlertSummary: vi.fn(),
  getRecentJobActivity: vi.fn(),
  getRecentSystemErrors: vi.fn(),
  getClientErrorTrend: vi.fn(),
  updateSubscription: vi.fn(),
}));

const featureFlagRepository = vi.hoisted(() => ({
  listByTenant: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/services/admin/admin.repository", () => ({ adminRepository }));
vi.mock("@/services/featureFlags/featureFlag.repository", () => ({ featureFlagRepository }));
const adminSecurityService = vi.hoisted(() => ({
  assertAccess: vi.fn(),
}));

vi.mock("@/services/admin/adminSecurity.service", () => ({ adminSecurityService }));

import { adminService } from "@/services/admin/admin.service";

describe("adminService tenant feature flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminSecurityService.assertAccess.mockResolvedValue({ stepUpGrantId: null });
  });

  it("merges missing flag rows as enabled by default", async () => {
    featureFlagRepository.listByTenant.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000201",
        tenant_id: "00000000-0000-0000-0000-000000000444",
        feature_key: "advanced_reports",
        enabled: false,
        created_at: "2026-04-24T18:00:00.000Z",
      },
    ]);

    const result = await adminService.listTenantFeatureFlags("00000000-0000-0000-0000-000000000444");

    expect(result).toEqual([
      { feature_key: "advanced_reports", enabled: false },
      { feature_key: "lab_module", enabled: true },
      { feature_key: "pharmacy_module", enabled: true },
      { feature_key: "insurance_module", enabled: true },
    ]);
  });

  it("audits super-admin feature flag changes against the target tenant", async () => {
    adminRepository.updateTenantFeatureFlag.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000202",
      feature_key: "lab_module",
      enabled: false,
    });

    const result = await adminService.updateTenantFeatureFlag(
      "00000000-0000-0000-0000-000000000444",
      { feature_key: "lab_module", enabled: false },
    );

    expect(result).toEqual({ feature_key: "lab_module", enabled: false });
    expect(adminSecurityService.assertAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenant_feature_flag_update",
        requireRecentAuth: true,
        tenantId: "00000000-0000-0000-0000-000000000444",
      }),
    );
  });
});
