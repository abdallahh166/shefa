import { beforeEach, describe, expect, it, vi } from "vitest";
import { patientRepository } from "@/services/patients/patient.repository";
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

  it("passes tenant context when creating a patient", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(patientRepository, true);
    repo.findByNameAndDOB.mockResolvedValue([]);
    repo.create.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000333",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      patient_code: "PT-1001",
      full_name: "Test Patient",
      status: "active",
      created_at: "2026-03-14T10:00:00Z",
      updated_at: "2026-03-14T10:00:00Z",
    } as any);

    const { patientService: service } = await import("@/services/patients/patient.service");
    await service.create({ full_name: "Test Patient" } as any);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: "Test Patient" }),
      "00000000-0000-0000-0000-000000000111",
    );
  });

  it("prevents duplicate patients with same name and DOB", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(patientRepository, true);
    repo.findByNameAndDOB.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000777",
        patient_code: "PT-1007",
        full_name: "Jane Smith",
        date_of_birth: "1990-01-15",
      } as any,
    ]);

    const { patientService: service } = await import("@/services/patients/patient.service");
    await expect(
      service.create({ full_name: "Jane Smith", date_of_birth: "1990-01-15" } as any),
    ).rejects.toThrow("already exists");
  });

  it("blocks deactivation when patient has active appointments", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(patientRepository, true);
    repo.hasActiveAppointments.mockResolvedValue(true);

    const { patientService: service } = await import("@/services/patients/patient.service");
    await expect(
      service.update("00000000-0000-0000-0000-000000000333", { status: "inactive" } as any),
    ).rejects.toThrow("active appointments");
  });
});
