import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/services/supabase/errors";

const useAuth = vi.hoisted(() => ({
  getState: vi.fn(),
}));

const privilegedSessionService = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

const recentAuthService = vi.hoisted(() => ({
  assertRecentAuth: vi.fn(),
}));

const privilegedStepUpService = vi.hoisted(() => ({
  issueGrant: vi.fn(),
}));

const assertAnyPermission = vi.hoisted(() => vi.fn());

vi.mock("@/core/auth/authStore", () => ({ useAuth }));
vi.mock("@/services/auth/privilegedSession.service", () => ({ privilegedSessionService }));
vi.mock("@/services/auth/recentAuth.service", () => ({ recentAuthService }));
vi.mock("@/services/auth/privilegedStepUp.service", () => ({ privilegedStepUpService }));
vi.mock("@/services/supabase/permissions", () => ({ assertAnyPermission }));

import { privilegedAccessService } from "@/services/auth/privilegedAccess.service";

describe("privilegedAccessService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.getState.mockReturnValue({
      user: {
        id: "user-1",
        tenantId: "tenant-1",
      },
    });
    recentAuthService.assertRecentAuth.mockReturnValue(undefined);
    privilegedStepUpService.issueGrant.mockResolvedValue("grant-123");
  });

  it("rejects privileged actions until MFA is enrolled", async () => {
    privilegedSessionService.refresh.mockResolvedValue({
      roleTier: "clinic_admin",
      isMfaEnrolled: false,
      aal: "aal1",
    });

    await expect(
      privilegedAccessService.assertAction({
        action: "staff_invite",
        roleTier: "clinic_admin",
        requireStepUp: true,
        tenantId: "tenant-1",
      }),
    ).rejects.toMatchObject({
      code: "PRIVILEGED_MFA_ENROLLMENT_REQUIRED",
    });
  });

  it("rejects privileged actions when aal2 is missing", async () => {
    privilegedSessionService.refresh.mockResolvedValue({
      roleTier: "clinic_admin",
      isMfaEnrolled: true,
      aal: "aal1",
    });

    await expect(
      privilegedAccessService.assertAction({
        action: "staff_invite",
        roleTier: "clinic_admin",
        requireStepUp: true,
        tenantId: "tenant-1",
      }),
    ).rejects.toMatchObject({
      code: "MFA_REQUIRED",
    });
  });

  it("returns no grant when a privileged action does not require step-up", async () => {
    privilegedSessionService.refresh.mockResolvedValue({
      roleTier: "clinic_admin",
      isMfaEnrolled: true,
      aal: "aal2",
    });

    await expect(
      privilegedAccessService.assertAction({
        action: "clinic_admin_settings_view",
        roleTier: "clinic_admin",
        requireStepUp: false,
        tenantId: "tenant-1",
      }),
    ).resolves.toEqual({ stepUpGrantId: null });

    expect(privilegedStepUpService.issueGrant).not.toHaveBeenCalled();
  });

  it("issues a server-side step-up grant for fresh privileged mutations", async () => {
    privilegedSessionService.refresh.mockResolvedValue({
      roleTier: "super_admin",
      isMfaEnrolled: true,
      aal: "aal2",
    });

    await expect(
      privilegedAccessService.assertAction({
        action: "tenant_status_update",
        roleTier: "super_admin",
        requireStepUp: true,
        tenantId: "tenant-1",
        resourceId: "tenant-1",
        requestId: "request-1",
      }),
    ).resolves.toEqual({ stepUpGrantId: "grant-123" });

    expect(assertAnyPermission).toHaveBeenCalledWith(
      ["super_admin"],
      "Only super admins can access this action",
    );
    expect(recentAuthService.assertRecentAuth).toHaveBeenCalledWith({ action: "tenant_status_update" });
    expect(privilegedStepUpService.issueGrant).toHaveBeenCalledWith({
      action: "tenant_status_update",
      roleTier: "super_admin",
      tenantId: "tenant-1",
      resourceId: "tenant-1",
      requestId: "request-1",
    });
  });

  it("fails closed when there is no authenticated user", async () => {
    useAuth.getState.mockReturnValue({ user: null });

    await expect(
      privilegedAccessService.assertAction({
        action: "tenant_status_update",
        roleTier: "super_admin",
        requireStepUp: true,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
