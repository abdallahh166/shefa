import { beforeEach, describe, expect, it, vi } from "vitest";
import { appointmentRepository } from "@/services/appointments/appointment.repository";
import { doctorRepository } from "@/services/doctors/doctor.repository";
import { doctorScheduleRepository } from "@/services/doctors/doctorSchedule.repository";

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

vi.mock("@/services/doctors/doctor.repository", () => ({
  doctorRepository: {
    getById: vi.fn(),
  },
}));

vi.mock("@/services/doctors/doctorSchedule.repository", () => ({
  doctorScheduleRepository: {
    listByDoctor: vi.fn(),
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
    vi.mocked(doctorRepository, true).getById.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000bbb",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      full_name: "Dr Ready",
      specialty: "General Practice",
      phone: null,
      email: null,
      rating: null,
      status: "available",
      deleted_at: null,
      deleted_by: null,
      created_at: "2026-03-11T08:00:00Z",
      updated_at: "2026-03-11T08:00:00Z",
    } as any);
    vi.mocked(doctorScheduleRepository, true).listByDoctor.mockResolvedValue([]);
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

  it("rejects booking when the doctor is on leave", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    vi.mocked(doctorRepository, true).getById.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000bbb",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      full_name: "Dr Away",
      specialty: "General Practice",
      phone: null,
      email: null,
      rating: null,
      status: "on_leave",
      deleted_at: null,
      deleted_by: null,
      created_at: "2026-03-11T08:00:00Z",
      updated_at: "2026-03-11T08:00:00Z",
    } as any);
    const { appointmentService } = await import("@/services/appointments/appointment.service");

    await expect(
      appointmentService.create({
        patient_id: "00000000-0000-0000-0000-000000000aaa",
        doctor_id: "00000000-0000-0000-0000-000000000bbb",
        appointment_date: "2026-03-14T10:00:00",
        duration_minutes: 30,
        type: "checkup",
      } as any),
    ).rejects.toThrow("Doctor is currently unavailable for booking");
  });

  it("rejects booking outside doctor working hours", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    vi.mocked(doctorScheduleRepository, true).listByDoctor.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000123",
        tenant_id: "00000000-0000-0000-0000-000000000111",
        doctor_id: "00000000-0000-0000-0000-000000000bbb",
        day_of_week: 1,
        start_time: "09:00",
        end_time: "17:00",
        is_active: true,
        created_at: "2026-03-11T08:00:00Z",
        updated_at: "2026-03-11T08:00:00Z",
      },
    ] as any);
    const { appointmentService } = await import("@/services/appointments/appointment.service");

    await expect(
      appointmentService.create({
        patient_id: "00000000-0000-0000-0000-000000000aaa",
        doctor_id: "00000000-0000-0000-0000-000000000bbb",
        appointment_date: "2026-03-16T18:00:00",
        duration_minutes: 30,
        type: "checkup",
      } as any),
    ).rejects.toThrow("Appointment falls outside the doctor's working hours");
  });

  it("blocks invalid status transitions", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(appointmentRepository, true);
    repo.getById.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000999",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      patient_id: "00000000-0000-0000-0000-000000000aaa",
      doctor_id: "00000000-0000-0000-0000-000000000bbb",
      appointment_date: "2026-03-14T10:00:00Z",
      duration_minutes: 30,
      type: "checkup",
      status: "scheduled",
      notes: null,
      created_at: "2026-03-14T10:00:00Z",
      updated_at: "2026-03-14T10:00:00Z",
    } as any);

    const { appointmentService } = await import("@/services/appointments/appointment.service");

    await expect(
      appointmentService.update("00000000-0000-0000-0000-000000000999", {
        status: "completed",
      }),
    ).rejects.toThrow("Cannot move appointment from scheduled to completed");
  });
});
