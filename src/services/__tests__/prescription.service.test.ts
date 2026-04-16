import { beforeEach, describe, expect, it, vi } from "vitest";
import { prescriptionRepository } from "@/services/prescriptions/prescription.repository";

const emitDomainEvent = vi.hoisted(() => vi.fn());

vi.mock("@/services/prescriptions/prescription.repository", () => ({
  prescriptionRepository: {
    listPaged: vi.fn(),
    listByPatient: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock("@/core/events", () => ({
  emitDomainEvent,
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
    emitDomainEvent.mockResolvedValue(undefined);
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
        route: "Oral",
        frequency: "Daily",
        quantity: 30,
      } as any),
    ).rejects.toThrow("Not authorized");
  });

  it("creates a prescription with structured directions and emits PrescriptionIssued", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(prescriptionRepository, true);
    repo.create.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000333",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      patient_id: "00000000-0000-0000-0000-000000000aaa",
      doctor_id: "00000000-0000-0000-0000-000000000bbb",
      medication: "Amoxicillin",
      dosage: "500 mg",
      route: "Oral",
      frequency: "Twice daily",
      quantity: 14,
      refills: 1,
      instructions: "Take with food",
      status: "active",
      prescribed_date: "2026-04-16",
      end_date: null,
      discontinued_reason: null,
      deleted_at: null,
      deleted_by: null,
      created_at: "2026-04-16T10:00:00Z",
    } as any);

    const { prescriptionService } = await import("@/services/prescriptions/prescription.service");

    await prescriptionService.create({
      patient_id: "00000000-0000-0000-0000-000000000aaa",
      doctor_id: "00000000-0000-0000-0000-000000000bbb",
      medication: "Amoxicillin",
      dosage: "500 mg",
      route: "Oral",
      frequency: "Twice daily",
      quantity: 14,
      refills: 1,
      instructions: "Take with food",
      prescribed_date: "2026-04-16",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "Oral",
        frequency: "Twice daily",
        quantity: 14,
      }),
      "00000000-0000-0000-0000-000000000111",
    );
    expect(emitDomainEvent).toHaveBeenCalledWith(
      "PrescriptionIssued",
      expect.objectContaining({
        patientId: "00000000-0000-0000-0000-000000000aaa",
      }),
      expect.any(Object),
    );
  });

  it("requires a reason when discontinuing a prescription", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(prescriptionRepository, true);
    repo.getById.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000333",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      patient_id: "00000000-0000-0000-0000-000000000aaa",
      doctor_id: "00000000-0000-0000-0000-000000000bbb",
      medication: "Amoxicillin",
      dosage: "500 mg",
      route: "Oral",
      frequency: "Twice daily",
      quantity: 14,
      refills: 1,
      instructions: null,
      status: "active",
      prescribed_date: "2026-04-16",
      end_date: null,
      discontinued_reason: null,
      deleted_at: null,
      deleted_by: null,
      created_at: "2026-04-16T10:00:00Z",
    } as any);

    const { prescriptionService } = await import("@/services/prescriptions/prescription.service");

    await expect(
      prescriptionService.update("00000000-0000-0000-0000-000000000333", {
        status: "discontinued",
      }),
    ).rejects.toThrow("Discontinued prescriptions require a reason");
  });

  it("blocks reopening a completed prescription", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(prescriptionRepository, true);
    repo.getById.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000333",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      patient_id: "00000000-0000-0000-0000-000000000aaa",
      doctor_id: "00000000-0000-0000-0000-000000000bbb",
      medication: "Amoxicillin",
      dosage: "500 mg",
      route: "Oral",
      frequency: "Twice daily",
      quantity: 14,
      refills: 1,
      instructions: null,
      status: "completed",
      prescribed_date: "2026-04-16",
      end_date: "2026-04-23",
      discontinued_reason: null,
      deleted_at: null,
      deleted_by: null,
      created_at: "2026-04-16T10:00:00Z",
    } as any);

    const { prescriptionService } = await import("@/services/prescriptions/prescription.service");

    await expect(
      prescriptionService.update("00000000-0000-0000-0000-000000000333", {
        status: "active",
      }),
    ).rejects.toThrow("Cannot move prescription from completed to active");
  });
});
