import { z } from "zod";
import { appointmentQueueSchema, appointmentQueueWithRelationsSchema } from "@/domain/appointmentQueue/appointmentQueue.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { AppointmentQueueStatus } from "@/domain/appointmentQueue/appointmentQueue.types";
import { BusinessRuleError, ConflictError, NotFoundError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { auditLogService } from "@/services/settings/audit.service";
import { appointmentRepository } from "./appointment.repository";
import { appointmentQueueRepository } from "./appointmentQueue.repository";

const ACTIVE_QUEUE_STATUSES: AppointmentQueueStatus[] = ["waiting", "called", "in_service"];
const QUEUE_TRANSITIONS: Record<AppointmentQueueStatus, AppointmentQueueStatus[]> = {
  waiting: ["called", "no_show"],
  called: ["waiting", "in_service", "no_show"],
  in_service: ["done"],
  done: [],
  no_show: [],
};

function getTodayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isTerminalStatus(status: AppointmentQueueStatus) {
  return status === "done" || status === "no_show";
}

function assertQueueTransition(from: AppointmentQueueStatus, to: AppointmentQueueStatus) {
  if (from === to) return;
  if (!QUEUE_TRANSITIONS[from].includes(to)) {
    throw new BusinessRuleError(`Cannot move queue entry from ${from} to ${to}`, {
      code: "QUEUE_TRANSITION_INVALID",
      details: { from, to },
    });
  }
}

export const appointmentQueueService = {
  async listToday() {
    try {
      assertAnyPermission(["view_appointments", "manage_appointments"]);
      const { tenantId } = getTenantContext();
      const { start, end } = getTodayBounds();
      const result = await appointmentQueueRepository.listByCheckInRange(start, end, tenantId);
      return z.array(appointmentQueueWithRelationsSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load waiting room queue");
    }
  },
  async checkIn(appointmentId: string) {
    try {
      assertAnyPermission(["manage_appointments"]);
      const parsedId = uuidSchema.parse(appointmentId);
      const { tenantId, userId } = getTenantContext();
      const appointment = await appointmentRepository.getById(parsedId, tenantId);
      if (appointment.status !== "scheduled") {
        throw new BusinessRuleError("Only scheduled appointments can be checked in", {
          code: "APPOINTMENT_NOT_CHECKIN_ELIGIBLE",
          details: { status: appointment.status },
        });
      }

      const existing = await appointmentQueueRepository.getByAppointmentId(parsedId, tenantId);
      if (existing) {
        if (ACTIVE_QUEUE_STATUSES.includes(existing.status)) {
          throw new ConflictError("Appointment is already checked in", {
            code: "APPOINTMENT_ALREADY_CHECKED_IN",
            details: { queueId: existing.id, status: existing.status },
          });
        }
      }

      const entry = appointmentQueueSchema.parse(
        await appointmentQueueRepository.create({ appointment_id: parsedId, status: "waiting" }, tenantId),
      );

      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "appointment_checked_in",
        action_type: "appointment_check_in",
        entity_type: "appointment_queue",
        entity_id: entry.id,
        details: {
          appointment_id: appointment.id,
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
        },
      });

      return entry;
    } catch (err) {
      throw toServiceError(err, "Failed to check in appointment");
    }
  },
  async updateStatus(queueId: string, status: AppointmentQueueStatus) {
    try {
      assertAnyPermission(["manage_appointments"]);
      const parsedId = uuidSchema.parse(queueId);
      const parsedStatus = z.enum(["waiting", "called", "in_service", "done", "no_show"]).parse(status);
      const { tenantId, userId } = getTenantContext();
      const existing = await appointmentQueueRepository.getById(parsedId, tenantId);
      if (!existing) {
        throw new NotFoundError("Queue entry not found", { code: "QUEUE_ENTRY_NOT_FOUND" });
      }

      assertQueueTransition(existing.status, parsedStatus);

      const now = new Date().toISOString();
      const updated = appointmentQueueSchema.parse(
        await appointmentQueueRepository.update(
          parsedId,
          {
            status: parsedStatus,
            called_at: parsedStatus === "called" ? now : parsedStatus === "waiting" ? null : undefined,
            completed_at: isTerminalStatus(parsedStatus) ? now : undefined,
          },
          tenantId,
        ),
      );

      if (parsedStatus === "in_service") {
        await appointmentRepository.update(existing.appointment_id, { status: "in_progress" }, tenantId);
      } else if (parsedStatus === "done") {
        await appointmentRepository.update(existing.appointment_id, { status: "completed" }, tenantId);
      } else if (parsedStatus === "no_show") {
        await appointmentRepository.update(existing.appointment_id, { status: "no_show" }, tenantId);
      }

      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "appointment_queue_status_updated",
        action_type: "appointment_queue_update",
        entity_type: "appointment_queue",
        entity_id: updated.id,
        details: {
          appointment_id: updated.appointment_id,
          from_status: existing.status,
          to_status: updated.status,
        },
      });

      return updated;
    } catch (err) {
      throw toServiceError(err, "Failed to update waiting room status");
    }
  },
};
