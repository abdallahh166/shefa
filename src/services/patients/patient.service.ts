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
import { BusinessRuleError, ConflictError, NotFoundError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { patientRepository } from "./patient.repository";

export const patientService = {
  async listPaged(params: PatientListParams) {
    try {
      assertAnyPermission(["view_patients", "manage_patients"]);
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
      assertAnyPermission(["view_patients", "manage_patients"]);
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
      assertAnyPermission(["manage_patients"]);
      const parsed = patientCreateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      if (parsed.full_name && parsed.date_of_birth) {
        const duplicates = await patientRepository.findByNameAndDOB(
          parsed.full_name,
          parsed.date_of_birth,
          tenantId,
        );
        if (duplicates.length > 0) {
          throw new ConflictError(
            `Patient "${parsed.full_name}" born on ${parsed.date_of_birth} already exists`,
            {
              code: "DUPLICATE_PATIENT",
              details: {
                possibleDuplicates: duplicates.map((item) => ({
                  id: item.id,
                  patient_code: item.patient_code,
                  full_name: item.full_name,
                  date_of_birth: item.date_of_birth,
                })),
              },
            },
          );
        }
      }
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
      assertAnyPermission(["manage_patients"]);
      const parsedId = uuidSchema.parse(id);
      const parsed = patientUpdateSchema.parse(input);
      const { tenantId } = getTenantContext();
      if (parsed.status === "inactive") {
        const hasActive = await patientRepository.hasActiveAppointments(parsedId, tenantId);
        if (hasActive) {
          throw new BusinessRuleError("Cannot deactivate patient with active appointments", {
            code: "PATIENT_HAS_ACTIVE_APPOINTMENTS",
          });
        }
      }
      const { expected_updated_at, ...updates } = parsed;
      const result = await patientRepository.update(parsedId, updates, tenantId, expected_updated_at);
      if (!result) {
        if (expected_updated_at) {
          throw new ConflictError("Patient was modified by another user", {
            code: "CONCURRENT_UPDATE",
          });
        }
        throw new NotFoundError("Patient not found");
      }
      return patientSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update patient");
    }
  },
  async deleteBulk(ids: string[]) {
    try {
      assertAnyPermission(["manage_patients"]);
      const parsed = uuidListSchema.parse(ids);
      const { tenantId, userId } = getTenantContext();
      return await patientRepository.deleteBulk(parsed, tenantId, userId);
    } catch (err) {
      throw toServiceError(err, "Failed to delete patients");
    }
  },
  async archive(id: string) {
    try {
      assertAnyPermission(["manage_patients"]);
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const hasActive = await patientRepository.hasActiveAppointments(parsedId, tenantId);
      if (hasActive) {
        throw new BusinessRuleError("Cannot archive patient with active appointments", {
          code: "PATIENT_HAS_ACTIVE_APPOINTMENTS",
        });
      }
      const result = await patientRepository.archive(parsedId, tenantId, userId);
      return patientSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to archive patient");
    }
  },
  async restore(id: string) {
    try {
      assertAnyPermission(["manage_patients"]);
      const parsedId = uuidSchema.parse(id);
      const { tenantId } = getTenantContext();
      const result = await patientRepository.restore(parsedId, tenantId);
      return patientSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to restore patient");
    }
  },
};
