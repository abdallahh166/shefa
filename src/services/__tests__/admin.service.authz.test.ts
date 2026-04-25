import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/services/supabase/errors";

const adminRepository = vi.hoisted(() => ({
  listTenantsPaged: vi.fn(),
  createTenant: vi.fn(),
  updateTenant: vi.fn(),
  updateTenantStatus: vi.fn(),
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

const permissions = vi.hoisted(() => ({
  assertAnyPermission: vi.fn(),
}));

const featureFlagRepository = vi.hoisted(() => ({
  listByTenant: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/services/admin/admin.repository", () => ({ adminRepository }));
vi.mock("@/services/supabase/permissions", () => permissions);
vi.mock("@/services/featureFlags/featureFlag.repository", () => ({ featureFlagRepository }));
vi.mock("@/services/auth/recentAuth.service", () => ({
  recentAuthService: {
    assertRecentAuth: vi.fn(),
  },
}));
vi.mock("@/services/settings/audit.service", () => ({
  auditLogService: {
    logEvent: vi.fn(),
  },
}));
vi.mock("@/core/auth/authStore", () => ({
  useAuth: {
    getState: () => ({
      user: {
        id: "00000000-0000-0000-0000-000000000111",
        role: "super_admin",
      },
    }),
  },
}));

import { adminService } from "@/services/admin/admin.service";

describe("adminService authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.assertAnyPermission.mockReturnValue(undefined);
  });

  it("checks for super admin access before listing tenants", async () => {
    adminRepository.listTenantsPaged.mockResolvedValue({ data: [], count: 0 });

    await adminService.listTenantsPaged({ page: 1, pageSize: 20 });

    expect(permissions.assertAnyPermission).toHaveBeenCalledWith(
      ["super_admin"],
      "Only super admins can access admin operations",
    );
  });

  it("rejects non-super-admin callers before hitting admin queries", async () => {
    permissions.assertAnyPermission.mockImplementation(() => {
      throw new AuthorizationError("Only super admins can access admin operations");
    });

    await expect(adminService.getSubscriptionStats()).rejects.toMatchObject({
      name: "AuthorizationError",
      message: "Only super admins can access admin operations",
    });

    expect(adminRepository.getSubscriptionStats).not.toHaveBeenCalled();
  });

  it("checks for super admin access before listing pricing plans", async () => {
    adminRepository.listPricingPlans.mockResolvedValue([]);

    await adminService.listPricingPlans();

    expect(permissions.assertAnyPermission).toHaveBeenCalledWith(
      ["super_admin"],
      "Only super admins can access admin operations",
    );
  });

  it("blocks pricing plan creation for non-super-admin callers", async () => {
    permissions.assertAnyPermission.mockImplementation(() => {
      throw new AuthorizationError("Only super admins can access admin operations");
    });

    await expect(adminService.createPricingPlan({
      plan_code: "pro",
      name: "Professional",
      description: "Advanced clinics",
      doctor_limit_label: "Unlimited doctors",
      features: ["Reports", "Insurance"],
      monthly_price: 799,
      annual_price: 7990,
      currency: "EGP",
      default_billing_cycle: "monthly",
      is_popular: true,
      is_public: true,
      is_enterprise_contact: false,
      display_order: 2,
    })).rejects.toMatchObject({
      name: "AuthorizationError",
      message: "Only super admins can access admin operations",
    });

    expect(adminRepository.createPricingPlan).not.toHaveBeenCalled();
  });

  it("blocks tenant lifecycle changes for non-super-admin callers", async () => {
    permissions.assertAnyPermission.mockImplementation(() => {
      throw new AuthorizationError("Only super admins can access admin operations");
    });

    await expect(adminService.updateTenantStatus(
      "00000000-0000-0000-0000-000000000444",
      { status: "suspended", status_reason: "Compliance review" },
    )).rejects.toMatchObject({
      name: "AuthorizationError",
      message: "Only super admins can access admin operations",
    });

    expect(adminRepository.updateTenantStatus).not.toHaveBeenCalled();
  });

  it("checks for super admin access before listing tenant feature flags", async () => {
    featureFlagRepository.listByTenant.mockResolvedValue([]);

    await adminService.listTenantFeatureFlags("00000000-0000-0000-0000-000000000444");

    expect(permissions.assertAnyPermission).toHaveBeenCalledWith(
      ["super_admin"],
      "Only super admins can access admin operations",
    );
  });

  it("blocks tenant feature flag changes for non-super-admin callers", async () => {
    permissions.assertAnyPermission.mockImplementation(() => {
      throw new AuthorizationError("Only super admins can access admin operations");
    });

    await expect(adminService.updateTenantFeatureFlag(
      "00000000-0000-0000-0000-000000000444",
      { feature_key: "advanced_reports", enabled: false },
    )).rejects.toMatchObject({
      name: "AuthorizationError",
      message: "Only super admins can access admin operations",
    });

    expect(featureFlagRepository.upsert).not.toHaveBeenCalled();
  });
});
