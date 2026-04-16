import type {
  Prescription,
  PrescriptionCreateInput,
  PrescriptionUpdateInput,
  PrescriptionListParams,
  PrescriptionWithDoctor,
} from "@/domain/prescription/prescription.types";
import type { LimitOffsetParams, PagedResult } from "@/domain/shared/pagination.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";
import { assertOk } from "@/services/supabase/query";

const PRESCRIPTION_COLUMNS =
  "id, tenant_id, patient_id, doctor_id, medication, dosage, route, frequency, quantity, refills, instructions, status, prescribed_date, end_date, discontinued_reason, deleted_at, deleted_by, created_at";
const PRESCRIPTION_WITH_DOCTOR_COLUMNS = `${PRESCRIPTION_COLUMNS}, doctors(full_name)`;

const SEARCH_COLUMNS = ["medication", "dosage", "route", "frequency", "instructions", "status"];
const SORTABLE_COLUMNS = new Set([
  "prescribed_date",
  "created_at",
  "status",
]);

function escapeSearchTerm(term: string) {
  return term.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,");
}

export interface PrescriptionRepository {
  listPaged(params: PrescriptionListParams, tenantId: string): Promise<PagedResult<Prescription>>;
  listByPatient(patientId: string, tenantId: string, params?: LimitOffsetParams): Promise<PrescriptionWithDoctor[]>;
  getById(id: string, tenantId: string): Promise<Prescription>;
  create(input: PrescriptionCreateInput, tenantId: string): Promise<Prescription>;
  update(id: string, input: PrescriptionUpdateInput, tenantId: string): Promise<Prescription>;
  archive(id: string, tenantId: string, userId: string): Promise<Prescription>;
  restore(id: string, tenantId: string): Promise<Prescription>;
}

export const prescriptionRepository: PrescriptionRepository = {
  async listPaged(params, tenantId) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const searchTerm = params.search?.trim() ?? "";

    let query = supabase
      .from("prescriptions")
      .select(PRESCRIPTION_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    const filters = params.filters ?? {};
    if (typeof filters.status === "string" && filters.status.length > 0) {
      query = query.eq("status", filters.status);
    }
    if (typeof filters.patient_id === "string" && filters.patient_id.length > 0) {
      query = query.eq("patient_id", filters.patient_id);
    }
    if (typeof filters.doctor_id === "string" && filters.doctor_id.length > 0) {
      query = query.eq("doctor_id", filters.doctor_id);
    }

    if (searchTerm) {
      const escaped = escapeSearchTerm(searchTerm);
      const orFilter = SEARCH_COLUMNS
        .map((col) => `${col}.ilike.%${escaped}%`)
        .join(",");
      query = query.or(orFilter);
    }

    const sortColumn = params.sort?.column && SORTABLE_COLUMNS.has(params.sort.column)
      ? params.sort.column
      : "prescribed_date";
    const sortAscending = params.sort?.ascending ?? false;

    query = query.order(sortColumn, { ascending: sortAscending }).range(from, to);

    const { data, error, count } = await query;
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load prescriptions", {
        code: error.code,
        details: error,
      });
    }

    return { data: (data ?? []) as Prescription[], count: count ?? 0 };
  },
  async listByPatient(patientId, tenantId, params) {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const { data, error } = await supabase
      .from("prescriptions")
      .select(PRESCRIPTION_WITH_DOCTOR_COLUMNS)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .eq("patient_id", patientId)
      .order("prescribed_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load patient prescriptions", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? []) as PrescriptionWithDoctor[];
  },
  async getById(id, tenantId) {
    const result = await supabase
      .from("prescriptions")
      .select(PRESCRIPTION_COLUMNS)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single();

    return assertOk(result) as Prescription;
  },
  async create(input, tenantId) {
    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      patient_id: input.patient_id,
      doctor_id: input.doctor_id,
      medication: input.medication,
      dosage: input.dosage,
      route: input.route,
      frequency: input.frequency,
      quantity: input.quantity,
    };

    if (input.status !== undefined) payload.status = input.status;
    if (input.prescribed_date !== undefined) payload.prescribed_date = input.prescribed_date;
    if (input.refills !== undefined) payload.refills = input.refills;
    if (input.instructions !== undefined) payload.instructions = input.instructions;
    if (input.end_date !== undefined) payload.end_date = input.end_date;
    if (input.discontinued_reason !== undefined) payload.discontinued_reason = input.discontinued_reason;

    const result = await supabase
      .from("prescriptions")
      .insert(payload as any)
      .select(PRESCRIPTION_COLUMNS)
      .single();

    return assertOk(result) as Prescription;
  },
  async update(id, input, tenantId) {
    const payload: Record<string, unknown> = {};

    if (input.patient_id !== undefined) payload.patient_id = input.patient_id;
    if (input.doctor_id !== undefined) payload.doctor_id = input.doctor_id;
    if (input.medication !== undefined) payload.medication = input.medication;
    if (input.dosage !== undefined) payload.dosage = input.dosage;
    if (input.route !== undefined) payload.route = input.route;
    if (input.frequency !== undefined) payload.frequency = input.frequency;
    if (input.quantity !== undefined) payload.quantity = input.quantity;
    if (input.refills !== undefined) payload.refills = input.refills;
    if (input.instructions !== undefined) payload.instructions = input.instructions;
    if (input.status !== undefined) payload.status = input.status;
    if (input.prescribed_date !== undefined) payload.prescribed_date = input.prescribed_date;
    if (input.end_date !== undefined) payload.end_date = input.end_date;
    if (input.discontinued_reason !== undefined) payload.discontinued_reason = input.discontinued_reason;

    if (Object.keys(payload).length === 0) {
      const result = await supabase
        .from("prescriptions")
        .select(PRESCRIPTION_COLUMNS)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single();
      return assertOk(result) as Prescription;
    }

    const result = await supabase
      .from("prescriptions")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(PRESCRIPTION_COLUMNS)
      .single();

    return assertOk(result) as Prescription;
  },
  async archive(id, tenantId, userId) {
    const result = await supabase
      .from("prescriptions")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(PRESCRIPTION_COLUMNS)
      .single();

    return assertOk(result) as Prescription;
  },
  async restore(id, tenantId) {
    const result = await supabase
      .from("prescriptions")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(PRESCRIPTION_COLUMNS)
      .single();

    return assertOk(result) as Prescription;
  },
};
