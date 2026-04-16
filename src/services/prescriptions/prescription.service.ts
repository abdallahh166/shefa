import { z } from "zod";
import {
  prescriptionCreateSchema,
  prescriptionListParamsSchema,
  prescriptionSchema,
  prescriptionStatusEnum,
  prescriptionUpdateSchema,
  prescriptionWithDoctorSchema,
} from "@/domain/prescription/prescription.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { PrescriptionCreateInput, PrescriptionListParams, PrescriptionUpdateInput } from "@/domain/prescription/prescription.types";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { limitOffsetSchema } from "@/domain/shared/pagination.schema";
import { emitDomainEvent } from "@/core/events";
import { BusinessRuleError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { auditLogService } from "@/services/settings/audit.service";
import { prescriptionRepository } from "./prescription.repository";

const PRESCRIPTION_STATUS_TRANSITIONS: Record<
  z.infer<typeof prescriptionStatusEnum>,
  Array<z.infer<typeof prescriptionStatusEnum>>
> = {
  active: ["completed", "discontinued"],
  completed: [],
  discontinued: [],
};

function assertPrescriptionTransition(
  currentStatus: z.infer<typeof prescriptionStatusEnum>,
  nextStatus: z.infer<typeof prescriptionStatusEnum>,
  discontinuedReason?: string | null,
) {
  if (currentStatus === nextStatus) return;
  if (!PRESCRIPTION_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
    throw new BusinessRuleError(`Cannot move prescription from ${currentStatus} to ${nextStatus}`, {
      code: "PRESCRIPTION_STATUS_TRANSITION_INVALID",
      details: { currentStatus, nextStatus },
    });
  }

  if (nextStatus === "discontinued" && !discontinuedReason?.trim()) {
    throw new BusinessRuleError("Discontinued prescriptions require a reason", {
      code: "PRESCRIPTION_DISCONTINUE_REASON_REQUIRED",
    });
  }
}

export const prescriptionService = {
  async listPaged(params: PrescriptionListParams) {
    try {
      assertAnyPermission(["view_medical_records", "manage_medical_records"]);
      const parsed = prescriptionListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await prescriptionRepository.listPaged(parsed, tenantId);
      const data = z.array(prescriptionSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load prescriptions");
    }
  },
  async listByPatient(patientId: string, params?: LimitOffsetParams) {
    try {
      assertAnyPermission(["view_medical_records", "manage_medical_records"]);
      const parsedId = uuidSchema.parse(patientId);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const result = await prescriptionRepository.listByPatient(parsedId, tenantId, paging);
      return z.array(prescriptionWithDoctorSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load patient prescriptions");
    }
  },
  async create(input: PrescriptionCreateInput) {
    try {
      assertAnyPermission(["manage_medical_records"]);
      const parsed = prescriptionCreateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const result = await prescriptionRepository.create(parsed, tenantId);
      const prescription = prescriptionSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "prescription_created",
        action_type: "prescription_create",
        entity_type: "prescription",
        entity_id: prescription.id,
        details: {
          patient_id: prescription.patient_id,
          doctor_id: prescription.doctor_id,
          medication: prescription.medication,
        },
      });
      await emitDomainEvent(
        "PrescriptionIssued",
        {
          prescriptionId: prescription.id,
          patientId: prescription.patient_id,
          doctorId: prescription.doctor_id,
        },
        { tenantId, userId },
      );
      return prescription;
    } catch (err) {
      throw toServiceError(err, "Failed to create prescription");
    }
  },
  async update(id: string, input: PrescriptionUpdateInput) {
    try {
      assertAnyPermission(["manage_medical_records"]);
      const parsedId = uuidSchema.parse(id);
      const parsed = prescriptionUpdateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      if (parsed.status !== undefined) {
        const existing = prescriptionSchema.parse(await prescriptionRepository.getById(parsedId, tenantId));
        assertPrescriptionTransition(
          existing.status,
          parsed.status,
          parsed.discontinued_reason ?? existing.discontinued_reason,
        );
      }
      const result = await prescriptionRepository.update(parsedId, parsed, tenantId);
      const prescription = prescriptionSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "prescription_updated",
        action_type: "prescription_update",
        entity_type: "prescription",
        entity_id: prescription.id,
        details: parsed as Record<string, unknown>,
      });
      return prescription;
    } catch (err) {
      throw toServiceError(err, "Failed to update prescription");
    }
  },
  async archive(id: string) {
    try {
      assertAnyPermission(["manage_medical_records"]);
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await prescriptionRepository.archive(parsedId, tenantId, userId);
      const prescription = prescriptionSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "prescription_archived",
        action_type: "prescription_archive",
        entity_type: "prescription",
        entity_id: prescription.id,
      });
      return prescription;
    } catch (err) {
      throw toServiceError(err, "Failed to archive prescription");
    }
  },
  async restore(id: string) {
    try {
      assertAnyPermission(["manage_medical_records"]);
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await prescriptionRepository.restore(parsedId, tenantId);
      const prescription = prescriptionSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "prescription_restored",
        action_type: "prescription_restore",
        entity_type: "prescription",
        entity_id: prescription.id,
      });
      return prescription;
    } catch (err) {
      throw toServiceError(err, "Failed to restore prescription");
    }
  },
};
