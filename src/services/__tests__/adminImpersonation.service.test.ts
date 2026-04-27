import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ServiceError } from "@/services/supabase/errors";

const createRequestId = vi.hoisted(() => vi.fn());
const startImpersonation = vi.hoisted(() => vi.fn());
const stopImpersonation = vi.hoisted(() => vi.fn());
const getState = vi.hoisted(() => vi.fn());
const privilegedAccessService = vi.hoisted(() => ({
  assertAction: vi.fn(),
}));
const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/core/observability/requestId", () => ({ createRequestId }));
vi.mock("@/services/auth/privilegedAccess.service", () => ({ privilegedAccessService }));
vi.mock("@/services/supabase/client", () => ({
  supabase: { rpc },
}));
vi.mock("@/core/auth/authStore", () => ({
  useAuth: { getState },
}));

import { adminImpersonationService } from "@/services/admin/adminImpersonation.service";

const superAdmin = {
  id: "00000000-0000-0000-0000-000000000111",
  name: "Super Admin",
  email: "admin@example.com",
  globalRoles: ["super_admin"] as const,
  tenantRoles: [] as const,
  tenantId: null,
  tenantSlug: null,
  tenantName: null,
};

const targetTenant = {
  id: "00000000-0000-0000-0000-000000000222",
  slug: "north-clinic",
  name: "North Clinic",
};

describe("adminImpersonationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createRequestId.mockReturnValue("00000000-0000-0000-0000-000000000123");
    privilegedAccessService.assertAction.mockResolvedValue({ stepUpGrantId: "grant-123" });
  });

  it("starts impersonation only after the server RPC succeeds", async () => {
    getState.mockReturnValue({
      user: superAdmin,
      impersonationSession: null,
      startImpersonation,
    });
    rpc.mockResolvedValue({
      data: {
        request_id: "00000000-0000-0000-0000-000000000123",
        started_at: "2026-04-15T00:00:00.000Z",
        target_tenant_id: targetTenant.id,
        target_tenant_name: targetTenant.name,
        target_tenant_slug: targetTenant.slug,
      },
      error: null,
    });

    const session = await adminImpersonationService.start(targetTenant);

    expect(privilegedAccessService.assertAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenant_impersonation_start",
        roleTier: "super_admin",
        requireStepUp: true,
      }),
    );
    expect(rpc).toHaveBeenCalledWith("admin_start_tenant_impersonation", expect.any(Object));
    expect(startImpersonation).toHaveBeenCalledWith(
      targetTenant,
      expect.objectContaining({
        requestId: "00000000-0000-0000-0000-000000000123",
        targetTenant,
      }),
    );
    expect(session).toEqual(
      expect.objectContaining({
        requestId: "00000000-0000-0000-0000-000000000123",
        targetTenant,
      }),
    );
  });

  it("ends impersonation only after the server RPC succeeds", async () => {
    getState.mockReturnValue({
      user: superAdmin,
      tenantOverride: targetTenant,
      impersonationSession: {
        requestId: "00000000-0000-0000-0000-000000000123",
        startedAt: "2026-04-15T00:00:00.000Z",
        actor: {
          id: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email,
          globalRoles: [...superAdmin.globalRoles],
          tenantRoles: [...superAdmin.tenantRoles],
        },
        targetTenant,
      },
      stopImpersonation,
    });
    rpc.mockResolvedValue({
      data: {
        request_id: "00000000-0000-0000-0000-000000000123",
        started_at: "2026-04-15T00:00:00.000Z",
        ended_at: "2026-04-15T00:10:00.000Z",
        duration_seconds: 600,
        target_tenant_id: targetTenant.id,
        target_tenant_name: targetTenant.name,
        target_tenant_slug: targetTenant.slug,
      },
      error: null,
    });

    const result = await adminImpersonationService.stop();

    expect(rpc).toHaveBeenCalledWith("admin_stop_tenant_impersonation", expect.any(Object));
    expect(stopImpersonation).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        requestId: "00000000-0000-0000-0000-000000000123",
        targetTenant,
      }),
    );
  });

  it("blocks non-super-admin users", async () => {
    getState.mockReturnValue({
      user: superAdmin,
      impersonationSession: null,
      startImpersonation,
    });
    privilegedAccessService.assertAction.mockRejectedValue(
      new AuthorizationError("Only super admins can impersonate clinics"),
    );

    await expect(adminImpersonationService.start(targetTenant)).rejects.toBeInstanceOf(AuthorizationError);
    expect(startImpersonation).not.toHaveBeenCalled();
  });

  it("blocks nested impersonation sessions", async () => {
    getState.mockReturnValue({
      user: superAdmin,
      impersonationSession: {
        requestId: "req-existing",
        startedAt: "2026-04-15T00:00:00.000Z",
        actor: {
          id: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email,
          globalRoles: [...superAdmin.globalRoles],
          tenantRoles: [...superAdmin.tenantRoles],
        },
        targetTenant,
      },
      startImpersonation,
    });

    await expect(adminImpersonationService.start(targetTenant)).rejects.toBeInstanceOf(ServiceError);
    expect(startImpersonation).not.toHaveBeenCalled();
  });
});
