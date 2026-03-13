import { z } from "zod";
import { doctorCreateSchema, doctorListParamsSchema, doctorSchema, doctorUpdateSchema } from "@/domain/doctor/doctor.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { DoctorCreateInput, DoctorListParams, DoctorUpdateInput } from "@/domain/doctor/doctor.types";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { auditLogService } from "@/services/settings/audit.service";
import { doctorRepository } from "./doctor.repository";

export const doctorService = {
  async listPaged(params: DoctorListParams) {
    try {
      assertAnyPermission(["view_dashboard", "manage_users", "manage_clinic"]);
      const parsed = doctorListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await doctorRepository.listPaged(parsed, tenantId);
      const data = z.array(doctorSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load doctors");
    }
  },
  async create(input: DoctorCreateInput) {
    try {
      assertAnyPermission(["manage_users", "manage_clinic"]);
      const parsed = doctorCreateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const result = await doctorRepository.create(parsed, tenantId);
      const doctor = doctorSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "doctor_created",
        action_type: "doctor_create",
        entity_type: "doctor",
        entity_id: doctor.id,
        details: { full_name: doctor.full_name, specialty: doctor.specialty },
      });
      return doctor;
    } catch (err) {
      throw toServiceError(err, "Failed to create doctor");
    }
  },
  async update(id: string, input: DoctorUpdateInput) {
    try {
      assertAnyPermission(["manage_users", "manage_clinic"]);
      const parsedId = uuidSchema.parse(id);
      const parsed = doctorUpdateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const result = await doctorRepository.update(parsedId, parsed, tenantId);
      const doctor = doctorSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "doctor_updated",
        action_type: "doctor_update",
        entity_type: "doctor",
        entity_id: doctor.id,
        details: parsed as Record<string, unknown>,
      });
      return doctor;
    } catch (err) {
      throw toServiceError(err, "Failed to update doctor");
    }
  },
  async remove(id: string) {
    try {
      assertAnyPermission(["manage_users", "manage_clinic"]);
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      await doctorRepository.remove(parsedId, tenantId, userId);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "doctor_archived",
        action_type: "doctor_delete",
        entity_type: "doctor",
        entity_id: parsedId,
      });
      return;
    } catch (err) {
      throw toServiceError(err, "Failed to delete doctor");
    }
  },
  async archive(id: string) {
    try {
      assertAnyPermission(["manage_users", "manage_clinic"]);
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await doctorRepository.archive(parsedId, tenantId, userId);
      const doctor = doctorSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "doctor_archived",
        action_type: "doctor_archive",
        entity_type: "doctor",
        entity_id: doctor.id,
      });
      return doctor;
    } catch (err) {
      throw toServiceError(err, "Failed to archive doctor");
    }
  },
  async restore(id: string) {
    try {
      assertAnyPermission(["manage_users", "manage_clinic"]);
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await doctorRepository.restore(parsedId, tenantId);
      const doctor = doctorSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "doctor_restored",
        action_type: "doctor_restore",
        entity_type: "doctor",
        entity_id: doctor.id,
      });
      return doctor;
    } catch (err) {
      throw toServiceError(err, "Failed to restore doctor");
    }
  },
};
