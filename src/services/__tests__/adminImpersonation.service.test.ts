import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError } from "@/services/supabase/errors";

const createRequestId = vi.hoisted(() => vi.fn());
const logEvent = vi.hoisted(() => vi.fn());
const startImpersonation = vi.hoisted(() => vi.fn());
const stopImpersonation = vi.hoisted(() => vi.fn());
const getState = vi.hoisted(() => vi.fn());

vi.mock("@/core/observability/requestId", () => ({ createRequestId }));
vi.mock("@/services/settings/audit.service", () => ({
  auditLogService: { logEvent },
}));
vi.mock("@/core/auth/authStore", () => ({
  useAuth: { getState },
}));

import { adminImpersonationService } from "@/services/admin/adminImpersonation.service";

const superAdmin = {
  id: "00000000-0000-0000-0000-000000000111",
  name: "Super Admin",
  email: "admin@example.com",
  role: "super_admin" as const,
  tenantId: "00000000-0000-0000-0000-000000000999",
  tenantSlug: "platform",
  tenantName: "Platform",
};

const targetTenant = {
  id: "00000000-0000-0000-0000-000000000222",
  slug: "north-clinic",
  name: "North Clinic",
};

describe("adminImpersonationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createRequestId.mockReturnValue("req-123");
  });

  it("starts impersonation only after the audit log succeeds", async () => {
    getState.mockReturnValue({
      user: superAdmin,
      hasPermission: () => true,
      lastVerifiedAt: new Date().toISOString(),
      impersonationSession: null,
      startImpersonation,
    });
    logEvent.mockResolvedValue(undefined);

    const session = await adminImpersonationService.start(targetTenant);

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: targetTenant.id,
        user_id: superAdmin.id,
        action: "tenant_impersonation_started",
        request_id: "req-123",
      })
    );
    expect(startImpersonation).toHaveBeenCalledWith(
      targetTenant,
      expect.objectContaining({
        requestId: "req-123",
        targetTenant,
      })
    );
    expect(session).toEqual(
      expect.objectContaining({
        requestId: "req-123",
        targetTenant,
      })
    );
  });

  it("ends impersonation only after the audit log succeeds", async () => {
    getState.mockReturnValue({
      user: superAdmin,
      hasPermission: () => true,
      lastVerifiedAt: new Date().toISOString(),
      tenantOverride: targetTenant,
      impersonationSession: {
        requestId: "req-123",
        startedAt: "2026-04-15T00:00:00.000Z",
        actor: {
          id: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email,
          role: superAdmin.role,
        },
        targetTenant,
      },
      stopImpersonation,
    });
    logEvent.mockResolvedValue(undefined);

    const result = await adminImpersonationService.stop();

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: targetTenant.id,
        action: "tenant_impersonation_ended",
        request_id: "req-123",
      })
    );
    expect(stopImpersonation).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        requestId: "req-123",
        targetTenant,
      })
    );
  });

  it("blocks non-super-admin users", async () => {
    getState.mockReturnValue({
      user: superAdmin,
      hasPermission: () => false,
      lastVerifiedAt: new Date().toISOString(),
      impersonationSession: null,
      startImpersonation,
    });

    await expect(adminImpersonationService.start(targetTenant)).rejects.toBeInstanceOf(AuthorizationError);
    expect(logEvent).not.toHaveBeenCalled();
    expect(startImpersonation).not.toHaveBeenCalled();
  });

  it("blocks nested impersonation sessions", async () => {
    getState.mockReturnValue({
      user: superAdmin,
      hasPermission: () => true,
      lastVerifiedAt: new Date().toISOString(),
      impersonationSession: {
        requestId: "req-existing",
        startedAt: "2026-04-15T00:00:00.000Z",
        actor: {
          id: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email,
          role: superAdmin.role,
        },
        targetTenant,
      },
      startImpersonation,
    });

    await expect(adminImpersonationService.start(targetTenant)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(logEvent).not.toHaveBeenCalled();
    expect(startImpersonation).not.toHaveBeenCalled();
  });
});
