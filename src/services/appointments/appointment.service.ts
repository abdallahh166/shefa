import { z } from "zod";
import {
  appointmentCreateSchema,
  appointmentListParamsSchema,
  appointmentSchema,
  appointmentUpdateSchema,
  appointmentWithDoctorSchema,
  appointmentWithPatientDoctorSchema,
} from "@/domain/appointment/appointment.schema";
import { dateTimeStringSchema } from "@/domain/shared/date.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { AppointmentCreateInput, AppointmentListParams, AppointmentUpdateInput } from "@/domain/appointment/appointment.types";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { limitOffsetSchema } from "@/domain/shared/pagination.schema";
import { emitDomainEvent } from "@/core/events";
import { ServiceError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { auditLogService } from "@/services/settings/audit.service";
import { appointmentRepository } from "./appointment.repository";

async function ensureNoConflict(
  doctorId: string,
  appointmentDate: string,
  tenantId: string,
  excludeId?: string,
) {
  const hasConflict = await appointmentRepository.hasConflict(doctorId, appointmentDate, tenantId, excludeId);
  if (hasConflict) {
    throw new Error("Appointment conflict detected");
  }
}

function isExclusionConflict(err: unknown) {
  if (!(err instanceof ServiceError)) return false;
  if (err.code === "23P01") return true;
  const message = `${err.message ?? ""}`;
  const detailsMessage =
    typeof (err.details as { message?: string } | undefined)?.message === "string"
      ? (err.details as { message: string }).message
      : "";
  return message.includes("appointments_no_overlap") || detailsMessage.includes("appointments_no_overlap");
}

export const appointmentService = {
  async listPaged(params: AppointmentListParams) {
    try {
      assertAnyPermission(["view_appointments", "manage_appointments"]);
      const parsed = appointmentListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await appointmentRepository.listPaged(parsed, tenantId);
      const data = z.array(appointmentSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load appointments");
    }
  },
  async listPagedWithRelations(params: AppointmentListParams) {
    try {
      assertAnyPermission(["view_appointments", "manage_appointments"]);
      const parsed = appointmentListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await appointmentRepository.listPagedWithRelations(parsed, tenantId);
      const data = z.array(appointmentWithPatientDoctorSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load appointments");
    }
  },
  async listByDateRange(start: string, end: string, params?: LimitOffsetParams) {
    try {
      assertAnyPermission(["view_appointments", "manage_appointments"]);
      const parsedStart = dateTimeStringSchema.parse(start);
      const parsedEnd = dateTimeStringSchema.parse(end);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const result = await appointmentRepository.listByDateRange(parsedStart, parsedEnd, tenantId, paging);
      return z.array(appointmentWithPatientDoctorSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load appointments");
    }
  },
  async listByPatient(patientId: string, params?: LimitOffsetParams) {
    try {
      assertAnyPermission(["view_appointments", "manage_appointments"]);
      const parsedId = uuidSchema.parse(patientId);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const result = await appointmentRepository.listByPatient(parsedId, tenantId, paging);
      return z.array(appointmentWithDoctorSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load patient appointments");
    }
  },
  async countByStatus() {
    try {
      assertAnyPermission(["view_appointments", "manage_appointments"]);
      const { tenantId } = getTenantContext();
      const result = await appointmentRepository.countByStatus(tenantId);
      return z.record(z.number().int().nonnegative()).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load appointment counts");
    }
  },
  async create(input: AppointmentCreateInput) {
    try {
      assertAnyPermission(["manage_appointments"]);
      const parsed = appointmentCreateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      await ensureNoConflict(parsed.doctor_id, parsed.appointment_date, tenantId);
      const result = await appointmentRepository.create(parsed, tenantId);
      const appointment = appointmentSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "appointment_created",
        action_type: "appointment_create",
        entity_type: "appointment",
        entity_id: appointment.id,
        details: {
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          appointment_date: appointment.appointment_date,
          status: appointment.status,
        },
      });
      await emitDomainEvent(
        "AppointmentCreated",
        {
          appointmentId: appointment.id,
          patientId: appointment.patient_id,
          doctorId: appointment.doctor_id,
          appointmentDate: appointment.appointment_date,
        },
        { tenantId, userId },
      );
      return appointment;
    } catch (err) {
      if (isExclusionConflict(err)) {
        throw new ServiceError("Appointment overlaps with an existing booking", {
          code: "APPOINTMENT_OVERLAP",
          details: err,
        });
      }
      throw toServiceError(err, "Failed to create appointment");
    }
  },
  async update(id: string, input: AppointmentUpdateInput) {
    try {
      assertAnyPermission(["manage_appointments"]);
      const parsedId = uuidSchema.parse(id);
      const parsed = appointmentUpdateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      if (parsed.doctor_id !== undefined || parsed.appointment_date !== undefined) {
        const existing = await appointmentRepository.getById(parsedId, tenantId);
        const doctorId = parsed.doctor_id ?? existing.doctor_id;
        const appointmentDate = parsed.appointment_date ?? existing.appointment_date;
        await ensureNoConflict(doctorId, appointmentDate, tenantId, parsedId);
      }
      const result = await appointmentRepository.update(parsedId, parsed, tenantId);
      const appointment = appointmentSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "appointment_updated",
        action_type: "appointment_update",
        entity_type: "appointment",
        entity_id: appointment.id,
        details: parsed as Record<string, unknown>,
      });
      return appointment;
    } catch (err) {
      if (isExclusionConflict(err)) {
        throw new ServiceError("Appointment overlaps with an existing booking", {
          code: "APPOINTMENT_OVERLAP",
          details: err,
        });
      }
      throw toServiceError(err, "Failed to update appointment");
    }
  },
  async archive(id: string) {
    try {
      assertAnyPermission(["manage_appointments"]);
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await appointmentRepository.archive(parsedId, tenantId, userId);
      const appointment = appointmentSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "appointment_archived",
        action_type: "appointment_archive",
        entity_type: "appointment",
        entity_id: appointment.id,
      });
      return appointment;
    } catch (err) {
      throw toServiceError(err, "Failed to archive appointment");
    }
  },
  async restore(id: string) {
    try {
      assertAnyPermission(["manage_appointments"]);
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await appointmentRepository.restore(parsedId, tenantId);
      const appointment = appointmentSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "appointment_restored",
        action_type: "appointment_restore",
        entity_type: "appointment",
        entity_id: appointment.id,
      });
      return appointment;
    } catch (err) {
      throw toServiceError(err, "Failed to restore appointment");
    }
  },
};
