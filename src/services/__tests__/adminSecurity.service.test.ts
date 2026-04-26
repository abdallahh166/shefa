import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/services/supabase/errors";

const permissions = vi.hoisted(() => ({
  assertAnyPermission: vi.fn(),
}));

const authService = vi.hoisted(() => ({
  getMfaAssuranceLevel: vi.fn(),
}));

const recentAuthService = vi.hoisted(() => ({
  assertRecentAuth: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: {
    id: "00000000-0000-0000-0000-000000000111",
    globalRoles: ["super_admin"] as const,
    tenantRoles: [] as const,
  },
}));

vi.mock("@/services/supabase/permissions", () => permissions);
vi.mock("@/services/auth/auth.service", () => ({ authService }));
vi.mock("@/services/auth/recentAuth.service", () => ({ recentAuthService }));
vi.mock("@/core/auth/authStore", () => ({
  useAuth: {
    getState: () => authState,
  },
}));

import { adminSecurityService, isMfaRequiredError } from "@/services/admin/adminSecurity.service";

describe("adminSecurityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.assertAnyPermission.mockReturnValue(undefined);
    authState.user = {
      id: "00000000-0000-0000-0000-000000000111",
      globalRoles: ["super_admin"],
      tenantRoles: [],
    };
    authService.getMfaAssuranceLevel.mockResolvedValue({
      currentLevel: "aal2",
      nextLevel: "aal2",
    });
  });

  it("requires aal2 MFA for super admin access", async () => {
    authService.getMfaAssuranceLevel.mockResolvedValue({
      currentLevel: "aal1",
      nextLevel: "aal2",
    });

    await expect(adminSecurityService.assertAccess({ action: "tenant_update" })).rejects.toMatchObject({
      name: "AuthorizationError",
      code: "MFA_REQUIRED",
    });
  });

  it("runs recent-auth checks for elevated actions", async () => {
    await adminSecurityService.assertAccess({
      action: "tenant_delete",
      requireRecentAuth: true,
      recentAuthMaxAgeMs: 60_000,
    });

    expect(recentAuthService.assertRecentAuth).toHaveBeenCalledWith({
      action: "tenant_delete",
      maxAgeMs: 60_000,
    });
  });

  it("exposes a helper for MFA-required authorization failures", () => {
    expect(
      isMfaRequiredError(
        new AuthorizationError("Super admin MFA is required for this action.", { code: "MFA_REQUIRED" }),
      ),
    ).toBe(true);
  });
});
