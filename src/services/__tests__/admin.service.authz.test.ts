import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/services/supabase/errors";

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
});
