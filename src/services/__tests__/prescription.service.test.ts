import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/prescriptions/prescription.repository", () => ({
  prescriptionRepository: {
    listPaged: vi.fn(),
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

describe("prescriptionService permissions", () => {
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
    const { prescriptionService } = await import("@/services/prescriptions/prescription.service");

    await expect(
      prescriptionService.listPaged({ page: 1, pageSize: 10 }),
    ).rejects.toThrow("Not authorized");
  });

  it("blocks create when lacking manage permissions", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => false }),
      },
    }));
    const { prescriptionService } = await import("@/services/prescriptions/prescription.service");

    await expect(
      prescriptionService.create({
        patient_id: "00000000-0000-0000-0000-000000000aaa",
        doctor_id: "00000000-0000-0000-0000-000000000bbb",
        medication: "Rx",
        dosage: "1/day",
      } as any),
    ).rejects.toThrow("Not authorized");
  });
});
