import { z } from "zod";
import {
  patientCreateSchema,
  patientListParamsSchema,
  patientSchema,
  patientUpdateSchema,
} from "@/domain/patient/patient.schema";
import { uuidListSchema, uuidSchema } from "@/domain/shared/identifiers.schema";
import type { PatientCreateInput, PatientListParams, PatientUpdateInput } from "@/domain/patient/patient.types";
import { emitDomainEvent } from "@/core/events";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { patientRepository } from "./patient.repository";

export const patientService = {
  async listPaged(params: PatientListParams) {
    try {
      const parsed = patientListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await patientRepository.listPaged(parsed, tenantId);
      const data = z.array(patientSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load patients");
    }
  },
  async getById(id: string) {
    try {
      const parsedId = uuidSchema.parse(id);
      const { tenantId } = getTenantContext();
      const result = await patientRepository.getById(parsedId, tenantId);
      return patientSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load patient");
    }
  },
  async create(input: PatientCreateInput) {
    try {
      const parsed = patientCreateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const result = await patientRepository.create(parsed, tenantId);
      const patient = patientSchema.parse(result);
      await emitDomainEvent(
        "PatientRegistered",
        { patientId: patient.id, fullName: patient.full_name },
        { tenantId, userId },
      );
      return patient;
    } catch (err) {
      throw toServiceError(err, "Failed to create patient");
    }
  },
  async update(id: string, input: PatientUpdateInput) {
    try {
      const parsedId = uuidSchema.parse(id);
      const parsed = patientUpdateSchema.parse(input);
      const { tenantId } = getTenantContext();
      const result = await patientRepository.update(parsedId, parsed, tenantId);
      return patientSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update patient");
    }
  },
  async deleteBulk(ids: string[]) {
    try {
      const parsed = uuidListSchema.parse(ids);
      const { tenantId, userId } = getTenantContext();
      return await patientRepository.deleteBulk(parsed, tenantId, userId);
    } catch (err) {
      throw toServiceError(err, "Failed to delete patients");
    }
  },
  async archive(id: string) {
    try {
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await patientRepository.archive(parsedId, tenantId, userId);
      return patientSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to archive patient");
    }
  },
  async restore(id: string) {
    try {
      const parsedId = uuidSchema.parse(id);
      const { tenantId } = getTenantContext();
      const result = await patientRepository.restore(parsedId, tenantId);
      return patientSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to restore patient");
    }
  },
};
