import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/laboratory/lab.repository", () => ({
  labRepository: {
    listPaged: vi.fn(),
    listPagedWithRelations: vi.fn(),
    countByStatus: vi.fn(),
    listByPatient: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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

vi.mock("@/services/settings/audit.service", () => ({
  auditLogService: {
    logEvent: vi.fn(),
  },
}));

describe("labService permissions", () => {
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
    const { labService } = await import("@/services/laboratory/lab.service");

    await expect(
      labService.listPaged({ page: 1, pageSize: 10 }),
    ).rejects.toThrow("Not authorized");
  });

  it("blocks create when lacking manage permissions", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => false }),
      },
    }));
    const { labService } = await import("@/services/laboratory/lab.service");

    await expect(
      labService.create({
        patient_id: "00000000-0000-0000-0000-000000000aaa",
        doctor_id: "00000000-0000-0000-0000-000000000bbb",
        test_name: "CBC",
      } as any),
    ).rejects.toThrow("Not authorized");
  });
});
