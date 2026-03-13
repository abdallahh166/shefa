import { z } from "zod";
import { medicalRecordWithDoctorSchema } from "@/domain/patient/patient.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { limitOffsetSchema } from "@/domain/shared/pagination.schema";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { medicalRecordsRepository } from "./medicalRecords.repository";

export const medicalRecordsService = {
  async listByPatient(patientId: string, params?: LimitOffsetParams) {
    try {
      const parsedId = uuidSchema.parse(patientId);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const result = await medicalRecordsRepository.listByPatient(parsedId, tenantId, paging);
      return z.array(medicalRecordWithDoctorSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load medical records");
    }
  },
};
