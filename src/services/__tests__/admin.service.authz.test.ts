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
  getRecentActivity: vi.fn(),
  getRecentSystemErrors: vi.fn(),
  getClientErrorTrend: vi.fn(),
  updateSubscription: vi.fn(),
  getTenantUsage: vi.fn(),
  retryJobs: vi.fn(),
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

describe("adminService authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminSecurityService.assertAccess.mockResolvedValue({ stepUpGrantId: null });
  });

  it("checks for super admin access before listing tenants", async () => {
    adminRepository.listTenantsPaged.mockResolvedValue({ data: [], count: 0 });

    await adminService.listTenantsPaged({ page: 1, pageSize: 20 });

    expect(adminSecurityService.assertAccess).toHaveBeenCalledWith({ action: "admin_list_tenants" });
  });

  it("rejects non-super-admin callers before hitting admin queries", async () => {
    adminSecurityService.assertAccess.mockRejectedValue(
      new AuthorizationError("Only super admins can access admin operations"),
    );

    await expect(adminService.getSubscriptionStats()).rejects.toMatchObject({
      name: "AuthorizationError",
      message: "Only super admins can access admin operations",
    });

    expect(adminRepository.getSubscriptionStats).not.toHaveBeenCalled();
  });

  it("checks for super admin access before listing pricing plans", async () => {
    adminRepository.listPricingPlans.mockResolvedValue([]);

    await adminService.listPricingPlans();

    expect(adminSecurityService.assertAccess).toHaveBeenCalledWith({ action: "admin_list_pricing_plans" });
  });

  it("blocks pricing plan creation for non-super-admin callers", async () => {
    adminSecurityService.assertAccess.mockRejectedValue(
      new AuthorizationError("Only super admins can access admin operations"),
    );

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
    adminSecurityService.assertAccess.mockRejectedValue(
      new AuthorizationError("Only super admins can access admin operations"),
    );

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

    expect(adminSecurityService.assertAccess).toHaveBeenCalledWith({ action: "admin_list_tenant_feature_flags" });
  });

  it("blocks tenant feature flag changes for non-super-admin callers", async () => {
    adminSecurityService.assertAccess.mockRejectedValue(
      new AuthorizationError("Only super admins can access admin operations"),
    );

    await expect(adminService.updateTenantFeatureFlag(
      "00000000-0000-0000-0000-000000000444",
      { feature_key: "advanced_reports", enabled: false },
    )).rejects.toMatchObject({
      name: "AuthorizationError",
      message: "Only super admins can access admin operations",
    });

    expect(featureFlagRepository.upsert).not.toHaveBeenCalled();
  });

  it("checks for super admin access before loading tenant usage", async () => {
    adminRepository.getTenantUsage.mockResolvedValue({
      tenant_id: "00000000-0000-0000-0000-000000000444",
      patients_count: 12,
      staff_count: 3,
      storage_bytes: 2048,
      api_requests_30d: 50,
      jobs_pending_count: 1,
      jobs_failed_count: 0,
    });

    await adminService.getTenantUsage("00000000-0000-0000-0000-000000000444");

    expect(adminSecurityService.assertAccess).toHaveBeenCalledWith({ action: "admin_tenant_usage" });
  });

  it("blocks job retry for non-super-admin callers", async () => {
    adminSecurityService.assertAccess.mockRejectedValue(
      new AuthorizationError("Only super admins can access admin operations"),
    );

    await expect(adminService.retryJobs({
      job_ids: ["00000000-0000-0000-0000-000000000555"],
      reason: "Retry after transient failure",
    })).rejects.toMatchObject({
      name: "AuthorizationError",
      message: "Only super admins can access admin operations",
    });

    expect(adminRepository.retryJobs).not.toHaveBeenCalled();
  });
});
