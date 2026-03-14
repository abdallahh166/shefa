import { describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";

const useAuthMock = vi.hoisted(() => ({ getState: vi.fn() }));

vi.mock("@/core/auth/authStore", () => ({ useAuth: useAuthMock }));

describe("getTenantContext", () => {
  it("throws when tenant context is missing", () => {
    useAuthMock.getState.mockReturnValue({ user: null, tenantOverride: null });
    expect(() => getTenantContext()).toThrow(ServiceError);
  });

  it("uses tenant override for super admins", () => {
    useAuthMock.getState.mockReturnValue({
      user: { id: "user-1", tenantId: "tenant-1", role: "super_admin" },
      tenantOverride: { id: "tenant-override" },
    });

    expect(getTenantContext()).toEqual({ tenantId: "tenant-override", userId: "user-1" });
  });

  it("uses user tenant for non-super admins", () => {
    useAuthMock.getState.mockReturnValue({
      user: { id: "user-2", tenantId: "tenant-2", role: "doctor" },
      tenantOverride: { id: "tenant-override" },
    });

    expect(getTenantContext()).toEqual({ tenantId: "tenant-2", userId: "user-2" });
  });
});
