import { beforeEach, describe, expect, it, vi } from "vitest";
import { appointmentRepository } from "@/services/appointments/appointment.repository";

vi.mock("@/services/appointments/appointment.repository", () => ({
  appointmentRepository: {
    listPaged: vi.fn(),
    listPagedWithRelations: vi.fn(),
    listByDateRange: vi.fn(),
    listByPatient: vi.fn(),
    countByStatus: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    getById: vi.fn(),
    hasConflict: vi.fn(),
  },
}));

vi.mock("@/services/events/domainEvent.repository", () => ({
  domainEventRepository: {
    insert: vi.fn(),
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

describe("appointmentService permissions", () => {
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
    const { appointmentService } = await import("@/services/appointments/appointment.service");

    await expect(
      appointmentService.listPaged({ page: 1, pageSize: 10 }),
    ).rejects.toThrow("Not authorized");
  });

  it("blocks create when lacking manage permissions", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => false }),
      },
    }));
    const { appointmentService } = await import("@/services/appointments/appointment.service");

    await expect(
      appointmentService.create({
        patient_id: "00000000-0000-0000-0000-000000000aaa",
        doctor_id: "00000000-0000-0000-0000-000000000bbb",
        appointment_date: "2026-03-11T09:00:00Z",
        type: "checkup",
      } as any),
    ).rejects.toThrow("Not authorized");
  });

  it("passes tenant context when creating an appointment", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(appointmentRepository, true);
    repo.create.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000333",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      patient_id: "00000000-0000-0000-0000-000000000aaa",
      doctor_id: "00000000-0000-0000-0000-000000000bbb",
      appointment_date: "2026-03-14T10:00:00Z",
      duration_minutes: 30,
      status: "scheduled",
      type: "checkup",
      created_at: "2026-03-14T10:00:00Z",
      updated_at: "2026-03-14T10:00:00Z",
    } as any);

    const { appointmentService } = await import("@/services/appointments/appointment.service");
    await appointmentService.create({
      patient_id: "00000000-0000-0000-0000-000000000aaa",
      doctor_id: "00000000-0000-0000-0000-000000000bbb",
      appointment_date: "2026-03-14T10:00:00Z",
      type: "checkup",
    } as any);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "checkup" }),
      "00000000-0000-0000-0000-000000000111",
    );
  });
});
