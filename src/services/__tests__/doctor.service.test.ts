import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/doctors/doctor.repository", () => ({
  doctorRepository: {
    listPaged: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    remove: vi.fn(),
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

describe("doctorService permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("blocks create when lacking manage permissions", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => false }),
      },
    }));
    const { doctorService } = await import("@/services/doctors/doctor.service");

    await expect(
      doctorService.create({ full_name: "Doctor X", specialty: "General" } as any),
    ).rejects.toThrow("Not authorized");
  });

  it("blocks schedule listing when lacking manage permissions", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => false }),
      },
    }));
    const { doctorScheduleService } = await import("@/services/doctors/doctorSchedule.service");

    await expect(
      doctorScheduleService.listByDoctor("00000000-0000-0000-0000-000000000010"),
    ).rejects.toThrow("Not authorized");
  });
});
