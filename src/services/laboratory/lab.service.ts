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
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { labRepository } from "./lab.repository";
import { rateLimitService } from "@/services/security/rateLimit.service";

const labStatusCountsSchema = z.object({
  pending: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
});

export const labService = {
  async listPaged(params: LabResultListParams) {
    try {
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
      const { tenantId } = getTenantContext();
      const result = await labRepository.countByStatus(tenantId);
      return labStatusCountsSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load lab order counts");
    }
  },
  async listByPatient(patientId: string, params?: LimitOffsetParams) {
    try {
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
      const parsed = labResultCreateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      await rateLimitService.assertAllowed("lab_upload", [tenantId, userId]);
      const result = await labRepository.create(parsed, tenantId);
      const labOrder = labResultSchema.parse(result);
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
      return labOrder;
    } catch (err) {
      throw toServiceError(err, "Failed to create lab order");
    }
  },
  async update(id: string, input: LabResultUpdateInput) {
    try {
      const parsedId = uuidSchema.parse(id);
      const parsed = labResultUpdateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const shouldEmit = parsed.result !== undefined || parsed.status === "completed";
      if (shouldEmit) {
        await rateLimitService.assertAllowed("lab_upload", [tenantId, userId]);
      }
      const result = await labRepository.update(parsedId, parsed, tenantId);
      const labOrder = labResultSchema.parse(result);
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
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await labRepository.archive(parsedId, tenantId, userId);
      return labResultSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to archive lab order");
    }
  },
  async restore(id: string) {
    try {
      const parsedId = uuidSchema.parse(id);
      const { tenantId } = getTenantContext();
      const result = await labRepository.restore(parsedId, tenantId);
      return labResultSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to restore lab order");
    }
  },
};
