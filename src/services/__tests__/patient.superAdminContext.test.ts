import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/services/supabase/errors";

const authState = vi.hoisted(() => ({
  user: {
    id: "00000000-0000-0000-0000-000000000111",
    tenantId: null,
    globalRoles: ["super_admin"] as const,
    tenantRoles: [] as const,
  },
  tenantOverride: null as { id: string; slug: string; name: string } | null,
  hasPermission: () => true,
}));

vi.mock("@/core/auth/authStore", () => ({
  useAuth: {
    getState: () => authState,
  },
}));

vi.mock("@/services/patients/patient.repository", () => ({
  patientRepository: {
    listPaged: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findByNameAndDOB: vi.fn(),
    hasActiveAppointments: vi.fn(),
    deleteBulk: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
  },
}));

describe("tenant-scoped services with super admin callers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.tenantOverride = null;
  });

  it("throws when a super admin calls a tenant service without an explicit tenant override", async () => {
    const { patientService } = await import("@/services/patients/patient.service");

    const request = patientService.listPaged({ page: 1, pageSize: 10 });

    await expect(request).rejects.toBeInstanceOf(AuthorizationError);
    await expect(request).rejects.toMatchObject({
      message: "Super admins must enter tenant access mode before using tenant-scoped operations",
    });
  });
});
