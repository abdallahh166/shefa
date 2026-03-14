import { z } from "zod";
import {
  medicalRecordCreateSchema,
  medicalRecordUpdateSchema,
  medicalRecordWithDoctorSchema,
} from "@/domain/patient/patient.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import type { MedicalRecordCreateInput, MedicalRecordUpdateInput } from "@/domain/patient/patient.types";
import { limitOffsetSchema } from "@/domain/shared/pagination.schema";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { medicalRecordsRepository } from "./medicalRecords.repository";

export const medicalRecordsService = {
  async listByPatient(patientId: string, params?: LimitOffsetParams) {
    try {
      assertAnyPermission(["view_medical_records", "manage_medical_records"]);
      const parsedId = uuidSchema.parse(patientId);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const result = await medicalRecordsRepository.listByPatient(parsedId, tenantId, paging);
      return z.array(medicalRecordWithDoctorSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load medical records");
    }
  },
  async create(input: MedicalRecordCreateInput) {
    try {
      assertAnyPermission(["manage_medical_records"]);
      const parsed = medicalRecordCreateSchema.parse(input);
      const { tenantId } = getTenantContext();
      const result = await medicalRecordsRepository.create(parsed, tenantId);
      return medicalRecordWithDoctorSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to create medical record");
    }
  },
  async update(id: string, input: MedicalRecordUpdateInput) {
    try {
      assertAnyPermission(["manage_medical_records"]);
      const parsedId = uuidSchema.parse(id);
      const parsed = medicalRecordUpdateSchema.parse(input);
      const { tenantId } = getTenantContext();
      const result = await medicalRecordsRepository.update(parsedId, parsed, tenantId);
      return medicalRecordWithDoctorSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update medical record");
    }
  },
  async remove(id: string) {
    try {
      assertAnyPermission(["manage_medical_records"]);
      const parsedId = uuidSchema.parse(id);
      const { tenantId } = getTenantContext();
      return await medicalRecordsRepository.remove(parsedId, tenantId);
    } catch (err) {
      throw toServiceError(err, "Failed to delete medical record");
    }
  },
};
