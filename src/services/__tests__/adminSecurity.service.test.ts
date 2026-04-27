import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/services/supabase/errors";

const privilegedAccessService = vi.hoisted(() => ({
  assertAction: vi.fn(),
}));

vi.mock("@/services/auth/privilegedAccess.service", () => ({
  privilegedAccessService,
  isMfaRequiredError: (err: unknown) =>
    err instanceof AuthorizationError && err.code === "MFA_REQUIRED",
}));

import { adminSecurityService, isMfaRequiredError } from "@/services/admin/adminSecurity.service";

describe("adminSecurityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    privilegedAccessService.assertAction.mockResolvedValue({ stepUpGrantId: null });
  });

  it("requires aal2 MFA for super admin access", async () => {
    privilegedAccessService.assertAction.mockRejectedValue(
      new AuthorizationError("Super admin MFA is required for this action.", { code: "MFA_REQUIRED" }),
    );

    await expect(adminSecurityService.assertAccess({ action: "tenant_update" })).rejects.toMatchObject({
      name: "AuthorizationError",
      code: "MFA_REQUIRED",
    });
  });

  it("requests a super-admin step-up flow for elevated actions", async () => {
    privilegedAccessService.assertAction.mockResolvedValue({ stepUpGrantId: "grant-123" });

    await expect(
      adminSecurityService.assertAccess({
        action: "tenant_delete",
        requireRecentAuth: true,
        requestId: "00000000-0000-0000-0000-000000000123",
      }),
    ).resolves.toEqual({ stepUpGrantId: "grant-123" });

    expect(privilegedAccessService.assertAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenant_delete",
        roleTier: "super_admin",
        requireStepUp: true,
      }),
    );
  });

  it("exposes a helper for MFA-required authorization failures", () => {
    expect(
      isMfaRequiredError(
        new AuthorizationError("Super admin MFA is required for this action.", { code: "MFA_REQUIRED" }),
      ),
    ).toBe(true);
  });
});
