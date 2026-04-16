import { beforeEach, describe, expect, it, vi } from "vitest";
import { appointmentQueueService } from "@/services/appointments/appointmentQueue.service";
import { appointmentQueueRepository } from "@/services/appointments/appointmentQueue.repository";
import { appointmentRepository } from "@/services/appointments/appointment.repository";

vi.mock("@/services/supabase/tenant", () => ({
  getTenantContext: () => ({ tenantId: "00000000-0000-0000-0000-000000000111", userId: "00000000-0000-0000-0000-000000000222" }),
}));

vi.mock("@/core/auth/authStore", () => ({
  useAuth: {
    getState: () => ({
      hasPermission: () => true,
    }),
  },
}));

vi.mock("@/services/settings/audit.service", () => ({
  auditLogService: {
    logEvent: vi.fn(),
  },
}));

vi.mock("@/services/appointments/appointmentQueue.repository", () => ({
  appointmentQueueRepository: {
    listByCheckInRange: vi.fn(),
    getById: vi.fn(),
    getByAppointmentId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/services/appointments/appointment.repository", () => ({
  appointmentRepository: {
    getById: vi.fn(),
    update: vi.fn(),
  },
}));

const queueRepo = vi.mocked(appointmentQueueRepository, true);
const appointmentRepo = vi.mocked(appointmentRepository, true);

describe("appointmentQueueService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks in a scheduled appointment", async () => {
    appointmentRepo.getById.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000333",
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
    queueRepo.getByAppointmentId.mockResolvedValue(null);
    queueRepo.create.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000444",
      appointment_id: "00000000-0000-0000-0000-000000000333",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      check_in_at: "2026-03-14T09:55:00Z",
      position: null,
      status: "waiting",
      called_at: null,
      completed_at: null,
      created_at: "2026-03-14T09:55:00Z",
    } as any);

    const result = await appointmentQueueService.checkIn("00000000-0000-0000-0000-000000000333");

    expect(result.status).toBe("waiting");
    expect(queueRepo.create).toHaveBeenCalledWith(
      { appointment_id: "00000000-0000-0000-0000-000000000333", status: "waiting" },
      "00000000-0000-0000-0000-000000000111",
    );
  });

  it("rejects duplicate active check-ins", async () => {
    appointmentRepo.getById.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000333",
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
    queueRepo.getByAppointmentId.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000444",
      appointment_id: "00000000-0000-0000-0000-000000000333",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      check_in_at: "2026-03-14T09:55:00Z",
      position: null,
      status: "waiting",
      called_at: null,
      completed_at: null,
      created_at: "2026-03-14T09:55:00Z",
    } as any);

    await expect(
      appointmentQueueService.checkIn("00000000-0000-0000-0000-000000000333"),
    ).rejects.toThrow("Appointment is already checked in");
  });

  it("marks the appointment no-show when the queue is closed as no-show", async () => {
    queueRepo.getById.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000444",
      appointment_id: "00000000-0000-0000-0000-000000000333",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      check_in_at: "2026-03-14T09:55:00Z",
      position: null,
      status: "waiting",
      called_at: null,
      completed_at: null,
      created_at: "2026-03-14T09:55:00Z",
    } as any);
    queueRepo.update.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000444",
      appointment_id: "00000000-0000-0000-0000-000000000333",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      check_in_at: "2026-03-14T09:55:00Z",
      position: null,
      status: "no_show",
      called_at: null,
      completed_at: "2026-03-14T10:20:00Z",
      created_at: "2026-03-14T09:55:00Z",
    } as any);

    await appointmentQueueService.updateStatus("00000000-0000-0000-0000-000000000444", "no_show");

    expect(appointmentRepo.update).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000333",
      { status: "no_show" },
      "00000000-0000-0000-0000-000000000111",
    );
  });
});
