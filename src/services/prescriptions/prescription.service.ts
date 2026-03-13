import { z } from "zod";
import {
  prescriptionCreateSchema,
  prescriptionListParamsSchema,
  prescriptionSchema,
  prescriptionUpdateSchema,
  prescriptionWithDoctorSchema,
} from "@/domain/prescription/prescription.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { PrescriptionCreateInput, PrescriptionListParams, PrescriptionUpdateInput } from "@/domain/prescription/prescription.types";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { limitOffsetSchema } from "@/domain/shared/pagination.schema";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { prescriptionRepository } from "./prescription.repository";

export const prescriptionService = {
  async listPaged(params: PrescriptionListParams) {
    try {
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
      const parsed = prescriptionCreateSchema.parse(input);
      const { tenantId } = getTenantContext();
      const result = await prescriptionRepository.create(parsed, tenantId);
      return prescriptionSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to create prescription");
    }
  },
  async update(id: string, input: PrescriptionUpdateInput) {
    try {
      const parsedId = uuidSchema.parse(id);
      const parsed = prescriptionUpdateSchema.parse(input);
      const { tenantId } = getTenantContext();
      const result = await prescriptionRepository.update(parsedId, parsed, tenantId);
      return prescriptionSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update prescription");
    }
  },
  async archive(id: string) {
    try {
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await prescriptionRepository.archive(parsedId, tenantId, userId);
      return prescriptionSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to archive prescription");
    }
  },
  async restore(id: string) {
    try {
      const parsedId = uuidSchema.parse(id);
      const { tenantId } = getTenantContext();
      const result = await prescriptionRepository.restore(parsedId, tenantId);
      return prescriptionSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to restore prescription");
    }
  },
};
