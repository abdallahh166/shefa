import type { MedicalRecordWithDoctor } from "@/domain/patient/patient.types";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const MEDICAL_RECORD_COLUMNS =
  "id, tenant_id, patient_id, doctor_id, record_date, diagnosis, notes, record_type, created_at, doctors(full_name)";

export interface MedicalRecordsRepository {
  listByPatient(patientId: string, tenantId: string, params?: LimitOffsetParams): Promise<MedicalRecordWithDoctor[]>;
}

export const medicalRecordsRepository: MedicalRecordsRepository = {
  async listByPatient(patientId, tenantId, params) {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const { data, error } = await supabase
      .from("medical_records")
      .select(MEDICAL_RECORD_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .order("record_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load medical records", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? []) as MedicalRecordWithDoctor[];
  },
};
