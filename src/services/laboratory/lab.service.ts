import { z } from "zod";
import {
  labOrderWithDoctorSchema,
  labOrderWithPatientDoctorSchema,
  labResultCreateSchema,
  labResultListParamsSchema,
  labResultSchema,
  labResultUpdateSchema,
} from "@/domain/lab/lab.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { LabResultCreateInput, LabResultListParams, LabResultUpdateInput } from "@/domain/lab/lab.types";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { limitOffsetSchema } from "@/domain/shared/pagination.schema";
import { emitDomainEvent } from "@/core/events";
import { BusinessRuleError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { featureAccessService } from "@/services/subscription/featureAccess.service";
import { auditLogService } from "@/services/settings/audit.service";
import { rateLimitService } from "@/services/security/rateLimit.service";
import { labRepository } from "./lab.repository";

const labStatusCountsSchema = z.object({
  pending: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
});

function buildResultSummary(order: {
  result?: string | null;
  result_value?: string | null;
  result_unit?: string | null;
  reference_range?: string | null;
  abnormal_flag?: string | null;
}) {
  const mainValue = [order.result_value?.trim(), order.result_unit?.trim()].filter(Boolean).join(" ");
  const meta = [order.reference_range?.trim(), order.abnormal_flag?.trim()].filter(Boolean).join(" | ");
  const structuredSummary = [mainValue, meta].filter(Boolean).join(" | ");
  if (structuredSummary) return structuredSummary;
  return order.result?.trim() || null;
}

function hasStructuredResultValue(order: {
  result_value?: string | null;
}) {
  return Boolean(order.result_value?.trim());
}

export const labService = {
  async listPaged(params: LabResultListParams) {
    try {
      assertAnyPermission(["view_medical_records", "manage_medical_records", "manage_laboratory"]);
      await featureAccessService.assertFeatureAccess("laboratory");
      const parsed = labResultListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await labRepository.listPaged(parsed, tenantId);
      const data = z.array(labResultSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load lab orders");
    }
  },
  async listPagedWithRelations(params: LabResultListParams) {
    try {
      assertAnyPermission(["view_medical_records", "manage_medical_records", "manage_laboratory"]);
      await featureAccessService.assertFeatureAccess("laboratory");
      const parsed = labResultListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await labRepository.listPagedWithRelations(parsed, tenantId);
      const data = z.array(labOrderWithPatientDoctorSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load lab orders");
    }
  },
  async countByStatus() {
    try {
      assertAnyPermission(["view_medical_records", "manage_medical_records", "manage_laboratory"]);
      await featureAccessService.assertFeatureAccess("laboratory");
      const { tenantId } = getTenantContext();
      const result = await labRepository.countByStatus(tenantId);
      return labStatusCountsSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load lab order counts");
    }
  },
  async listByPatient(patientId: string, params?: LimitOffsetParams) {
    try {
      assertAnyPermission(["view_medical_records", "manage_medical_records", "manage_laboratory"]);
      await featureAccessService.assertFeatureAccess("laboratory");
      const parsedId = uuidSchema.parse(patientId);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const result = await labRepository.listByPatient(parsedId, tenantId, paging);
      return z.array(labOrderWithDoctorSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load patient lab orders");
    }
  },
  async create(input: LabResultCreateInput) {
    try {
      assertAnyPermission(["manage_medical_records", "manage_laboratory"]);
      await featureAccessService.assertFeatureAccess("laboratory");
      const parsed = labResultCreateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const result = await labRepository.create(parsed, tenantId);
      const labOrder = labResultSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "lab_order_created",
        action_type: "lab_order_create",
        entity_type: "lab_order",
        entity_id: labOrder.id,
        details: {
          patient_id: labOrder.patient_id,
          doctor_id: labOrder.doctor_id,
          test_name: labOrder.test_name,
          status: labOrder.status,
        },
      });
      return labOrder;
    } catch (err) {
      throw toServiceError(err, "Failed to create lab order");
    }
  },
  async update(id: string, input: LabResultUpdateInput) {
    try {
      assertAnyPermission(["manage_medical_records", "manage_laboratory"]);
      await featureAccessService.assertFeatureAccess("laboratory");
      const parsedId = uuidSchema.parse(id);
      const parsed = labResultUpdateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const existing = labResultSchema.parse(await labRepository.getById(parsedId, tenantId));
      const merged = {
        ...existing,
        ...parsed,
      };

      if (parsed.status === "completed" && !hasStructuredResultValue(merged)) {
        throw new BusinessRuleError("Completed lab results must include a structured result entry", {
          code: "LAB_RESULT_REQUIRED_FOR_COMPLETION",
        });
      }

      const normalizedUpdate: LabResultUpdateInput = {
        ...parsed,
      };
      const computedSummary = buildResultSummary(merged);
      if (computedSummary) {
        normalizedUpdate.result = computedSummary;
      }
      if (parsed.status === "completed" && existing.status !== "completed" && normalizedUpdate.resulted_at === undefined) {
        normalizedUpdate.resulted_at = new Date().toISOString();
      }

      const shouldRateLimit = hasStructuredResultValue(merged) && (
        parsed.result !== undefined ||
        parsed.result_value !== undefined ||
        parsed.result_unit !== undefined ||
        parsed.reference_range !== undefined ||
        parsed.abnormal_flag !== undefined ||
        parsed.result_notes !== undefined ||
        parsed.status === "completed"
      );
      if (shouldRateLimit) {
        await rateLimitService.assertAllowed("lab_upload", [tenantId, userId]);
      }

      const result = await labRepository.update(parsedId, normalizedUpdate, tenantId);
      const labOrder = labResultSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "lab_order_updated",
        action_type: "lab_order_update",
        entity_type: "lab_order",
        entity_id: labOrder.id,
        details: normalizedUpdate as Record<string, unknown>,
      });
      const hadStructuredResult = hasStructuredResultValue(existing);
      const hasStructuredResultNow = hasStructuredResultValue(labOrder);
      const shouldEmit =
        labOrder.status === "completed" &&
        hasStructuredResultNow &&
        (existing.status !== "completed" || !hadStructuredResult);
      if (shouldEmit) {
        await emitDomainEvent(
          "LabResultUploaded",
          {
            labOrderId: labOrder.id,
            patientId: labOrder.patient_id,
            doctorId: labOrder.doctor_id,
            status: labOrder.status,
          },
          { tenantId, userId },
        );
      }
      return labOrder;
    } catch (err) {
      throw toServiceError(err, "Failed to update lab order");
    }
  },
  async archive(id: string) {
    try {
      assertAnyPermission(["manage_medical_records", "manage_laboratory"]);
      await featureAccessService.assertFeatureAccess("laboratory");
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await labRepository.archive(parsedId, tenantId, userId);
      const labOrder = labResultSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "lab_order_archived",
        action_type: "lab_order_archive",
        entity_type: "lab_order",
        entity_id: labOrder.id,
      });
      return labOrder;
    } catch (err) {
      throw toServiceError(err, "Failed to archive lab order");
    }
  },
  async restore(id: string) {
    try {
      assertAnyPermission(["manage_medical_records", "manage_laboratory"]);
      await featureAccessService.assertFeatureAccess("laboratory");
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await labRepository.restore(parsedId, tenantId);
      const labOrder = labResultSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "lab_order_restored",
        action_type: "lab_order_restore",
        entity_type: "lab_order",
        entity_id: labOrder.id,
      });
      return labOrder;
    } catch (err) {
      throw toServiceError(err, "Failed to restore lab order");
    }
  },
};
