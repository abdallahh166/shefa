import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/services/patients/patient.repository", () => ({
  patientRepository: {
    listPaged: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteBulk: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock("@/services/supabase/tenant", () => ({
  getTenantContext: () => ({
    tenantId: "00000000-0000-0000-0000-000000000111",
    userId: "00000000-0000-0000-0000-000000000222",
  }),
}));

describe("patientService permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("blocks list when lacking view permissions", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => false }),
      },
    }));
    const { patientService: service } = await import("@/services/patients/patient.service");

    await expect(service.listPaged({ page: 1, pageSize: 10 })).rejects.toThrow("Not authorized");
  });

  it("blocks create when lacking manage permissions", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => false }),
      },
    }));
    const { patientService: service } = await import("@/services/patients/patient.service");

    await expect(
      service.create({ full_name: "Patient X" } as any),
    ).rejects.toThrow("Not authorized");
  });
});
