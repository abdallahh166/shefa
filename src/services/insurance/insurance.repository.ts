import type {
  InsuranceClaim,
  InsuranceClaimCreateInput,
  InsuranceAssignableOwner,
  InsuranceClaimListParams,
  InsuranceClaimUpdateInput,
  InsuranceClaimWithPatient,
  InsuranceOperationsSummary,
  InsuranceSummary,
} from "@/domain/insurance/insurance.types";
import type { PagedResult } from "@/domain/shared/pagination.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";
import { assertOk } from "@/services/supabase/query";

const CLAIM_COLUMNS =
  "id, tenant_id, patient_id, provider, service, amount, claim_date, status, submitted_at, processing_started_at, approved_at, reimbursed_at, payer_reference, denial_reason, assigned_to_user_id, internal_notes, payer_notes, last_follow_up_at, next_follow_up_at, resubmission_count, deleted_at, deleted_by, created_at, updated_at";
const CLAIM_WITH_PATIENT_COLUMNS = `${CLAIM_COLUMNS}, patients(full_name), assigned_profile:profiles!insurance_claims_assigned_to_user_id_fkey(full_name)`;

const SEARCH_COLUMNS = ["provider", "service", "status", "denial_reason", "payer_notes", "internal_notes"];
const SEARCH_COLUMNS_WITH_RELATIONS = [...SEARCH_COLUMNS, "patients.full_name"];
const SORTABLE_COLUMNS = new Set([
  "claim_date",
  "created_at",
  "updated_at",
  "status",
  "submitted_at",
  "processing_started_at",
  "next_follow_up_at",
  "last_follow_up_at",
]);

const OPEN_CLAIM_STATUSES = ["submitted", "processing", "approved"];

function escapeSearchTerm(term: string) {
  return term.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,");
}

function applyQueueFilter(query: any, queue: unknown) {
  const nowIso = new Date().toISOString();
  const agedOpenCutoffDate = new Date(Date.now() - (15 * 86400000)).toISOString().slice(0, 10);
  const stalledProcessingCutoffIso = new Date(Date.now() - (7 * 86400000)).toISOString();

  if (queue === "denied_follow_up") {
    return query.eq("status", "denied");
  }

  if (queue === "aged_open") {
    return query
      .in("status", OPEN_CLAIM_STATUSES)
      .or(`submitted_at.lte.${agedOpenCutoffDate},and(submitted_at.is.null,claim_date.lte.${agedOpenCutoffDate})`);
  }

  if (queue === "stalled_processing") {
    return query
      .eq("status", "processing")
      .not("processing_started_at", "is", null)
      .lte("processing_started_at", stalledProcessingCutoffIso);
  }

  if (queue === "follow_up_due") {
    return query
      .neq("status", "reimbursed")
      .not("next_follow_up_at", "is", null)
      .lte("next_follow_up_at", nowIso);
  }

  if (queue === "unassigned_open") {
    return query
      .in("status", OPEN_CLAIM_STATUSES)
      .is("assigned_to_user_id", null);
  }

  return query;
}

export interface InsuranceRepository {
  listPaged(params: InsuranceClaimListParams, tenantId: string): Promise<PagedResult<InsuranceClaim>>;
  listPagedWithRelations(params: InsuranceClaimListParams, tenantId: string): Promise<PagedResult<InsuranceClaimWithPatient>>;
  getSummary(tenantId: string): Promise<InsuranceSummary>;
  getOperationsSummary(tenantId: string): Promise<InsuranceOperationsSummary>;
  listAssignableOwners(tenantId: string): Promise<InsuranceAssignableOwner[]>;
  getById(id: string, tenantId: string): Promise<InsuranceClaim>;
  create(input: InsuranceClaimCreateInput, tenantId: string): Promise<InsuranceClaim>;
  update(id: string, input: InsuranceClaimUpdateInput, tenantId: string): Promise<InsuranceClaim>;
  archive(id: string, tenantId: string, userId: string): Promise<InsuranceClaim>;
  restore(id: string, tenantId: string): Promise<InsuranceClaim>;
}

export const insuranceRepository: InsuranceRepository = {
  async listPaged(params, tenantId) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const searchTerm = params.search?.trim() ?? "";

    let query = supabase
      .from("insurance_claims")
      .select(CLAIM_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    const filters = params.filters ?? {};
    if (typeof filters.status === "string" && filters.status.length > 0) {
      query = query.eq("status", filters.status);
    }
    if (typeof filters.patient_id === "string" && filters.patient_id.length > 0) {
      query = query.eq("patient_id", filters.patient_id);
    }
    if (typeof filters.assigned_to_user_id === "string" && filters.assigned_to_user_id.length > 0) {
      query = query.eq("assigned_to_user_id", filters.assigned_to_user_id);
    }
    query = applyQueueFilter(query, filters.queue);

    if (searchTerm) {
      const escaped = escapeSearchTerm(searchTerm);
      const orFilter = SEARCH_COLUMNS
        .map((col) => `${col}.ilike.%${escaped}%`)
        .join(",");
      query = query.or(orFilter);
    }

    const sortColumn = params.sort?.column && SORTABLE_COLUMNS.has(params.sort.column)
      ? params.sort.column
      : "claim_date";
    const sortAscending = params.sort?.ascending ?? false;

    query = query.order(sortColumn, { ascending: sortAscending }).range(from, to);

    const { data, error, count } = await query;
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load insurance claims", {
        code: error.code,
        details: error,
      });
    }

    return { data: (data ?? []) as InsuranceClaim[], count: count ?? 0 };
  },
  async listPagedWithRelations(params, tenantId) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const searchTerm = params.search?.trim() ?? "";

    let query = supabase
      .from("insurance_claims")
      .select(CLAIM_WITH_PATIENT_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    const filters = params.filters ?? {};
    if (typeof filters.status === "string" && filters.status.length > 0) {
      query = query.eq("status", filters.status);
    }
    if (typeof filters.patient_id === "string" && filters.patient_id.length > 0) {
      query = query.eq("patient_id", filters.patient_id);
    }
    if (typeof filters.assigned_to_user_id === "string" && filters.assigned_to_user_id.length > 0) {
      query = query.eq("assigned_to_user_id", filters.assigned_to_user_id);
    }
    query = applyQueueFilter(query, filters.queue);

    if (searchTerm) {
      const escaped = escapeSearchTerm(searchTerm);
      const orFilter = SEARCH_COLUMNS_WITH_RELATIONS
        .map((col) => `${col}.ilike.%${escaped}%`)
        .join(",");
      query = query.or(orFilter);
    }

    const sortColumn = params.sort?.column && SORTABLE_COLUMNS.has(params.sort.column)
      ? params.sort.column
      : "claim_date";
    const sortAscending = params.sort?.ascending ?? false;

    query = query.order(sortColumn, { ascending: sortAscending }).range(from, to);

    const { data, error, count } = await query;
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load insurance claims", {
        code: error.code,
        details: error,
      });
    }

    return { data: (data ?? []) as InsuranceClaimWithPatient[], count: count ?? 0 };
  },
  async getSummary(_tenantId) {
    const { data, error } = await (supabase.rpc as any)("get_insurance_summary");
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load insurance summary", {
        code: error.code,
        details: error,
      });
    }

    return ((data as any)?.[0] ?? {
      total_count: 0,
      draft_count: 0,
      submitted_count: 0,
      processing_count: 0,
      approved_count: 0,
      denied_count: 0,
      reimbursed_count: 0,
      providers_count: 0,
    }) as InsuranceSummary;
  },
  async getOperationsSummary(_tenantId) {
    const { data, error } = await (supabase.rpc as any)("get_insurance_operations_summary");
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load insurance operations summary", {
        code: error.code,
        details: error,
      });
    }

    return ((data as any)?.[0] ?? {
      open_claims_count: 0,
      aged_0_7_count: 0,
      aged_8_14_count: 0,
      aged_15_plus_count: 0,
      oldest_open_claim_days: 0,
      denied_follow_up_count: 0,
      follow_up_due_count: 0,
      unassigned_open_count: 0,
      stalled_processing_count: 0,
    }) as InsuranceOperationsSummary;
  },
  async listAssignableOwners(tenantId) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("tenant_id", tenantId)
      .order("full_name", { ascending: true });

    if (profilesError) {
      throw new ServiceError(profilesError.message ?? "Failed to load insurance claim owners", {
        code: profilesError.code,
        details: profilesError,
      });
    }

    if (!profiles?.length) return [];

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", profiles.map((profile) => profile.user_id));

    if (rolesError) {
      throw new ServiceError(rolesError.message ?? "Failed to load insurance claim owner roles", {
        code: rolesError.code,
        details: rolesError,
      });
    }

    const allowedRoles = new Set(["clinic_admin", "accountant"]);
    const roleByUserId = new Map<string, string>();
    for (const role of roles ?? []) {
      if (allowedRoles.has(role.role)) {
        roleByUserId.set(role.user_id, role.role);
      }
    }

    return profiles
      .map((profile) => {
        const role = roleByUserId.get(profile.user_id);
        if (!role) return null;
        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          role,
        } as InsuranceAssignableOwner;
      })
      .filter((profile): profile is InsuranceAssignableOwner => profile !== null);
  },
  async getById(id, tenantId) {
    const result = await supabase
      .from("insurance_claims")
      .select(CLAIM_COLUMNS)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single();
    return assertOk(result) as InsuranceClaim;
  },
  async create(input, tenantId) {
    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      patient_id: input.patient_id,
      provider: input.provider,
      service: input.service,
      amount: input.amount,
    };

    if (input.claim_date !== undefined) payload.claim_date = input.claim_date;
    if (input.status !== undefined) payload.status = input.status;
    if (input.submitted_at !== undefined) payload.submitted_at = input.submitted_at;
    if (input.processing_started_at !== undefined) payload.processing_started_at = input.processing_started_at;
    if (input.approved_at !== undefined) payload.approved_at = input.approved_at;
    if (input.reimbursed_at !== undefined) payload.reimbursed_at = input.reimbursed_at;
    if (input.payer_reference !== undefined) payload.payer_reference = input.payer_reference;
    if (input.denial_reason !== undefined) payload.denial_reason = input.denial_reason;
    if (input.assigned_to_user_id !== undefined) payload.assigned_to_user_id = input.assigned_to_user_id;
    if (input.internal_notes !== undefined) payload.internal_notes = input.internal_notes;
    if (input.payer_notes !== undefined) payload.payer_notes = input.payer_notes;
    if (input.last_follow_up_at !== undefined) payload.last_follow_up_at = input.last_follow_up_at;
    if (input.next_follow_up_at !== undefined) payload.next_follow_up_at = input.next_follow_up_at;
    if (input.resubmission_count !== undefined) payload.resubmission_count = input.resubmission_count;

    const result = await supabase
      .from("insurance_claims")
      .insert(payload as any)
      .select(CLAIM_COLUMNS)
      .single();

    return assertOk(result) as InsuranceClaim;
  },
  async update(id, input, tenantId) {
    const payload: Record<string, unknown> = {};

    if (input.patient_id !== undefined) payload.patient_id = input.patient_id;
    if (input.provider !== undefined) payload.provider = input.provider;
    if (input.service !== undefined) payload.service = input.service;
    if (input.amount !== undefined) payload.amount = input.amount;
    if (input.claim_date !== undefined) payload.claim_date = input.claim_date;
    if (input.status !== undefined) payload.status = input.status;
    if (input.submitted_at !== undefined) payload.submitted_at = input.submitted_at;
    if (input.processing_started_at !== undefined) payload.processing_started_at = input.processing_started_at;
    if (input.approved_at !== undefined) payload.approved_at = input.approved_at;
    if (input.reimbursed_at !== undefined) payload.reimbursed_at = input.reimbursed_at;
    if (input.payer_reference !== undefined) payload.payer_reference = input.payer_reference;
    if (input.denial_reason !== undefined) payload.denial_reason = input.denial_reason;
    if (input.assigned_to_user_id !== undefined) payload.assigned_to_user_id = input.assigned_to_user_id;
    if (input.internal_notes !== undefined) payload.internal_notes = input.internal_notes;
    if (input.payer_notes !== undefined) payload.payer_notes = input.payer_notes;
    if (input.last_follow_up_at !== undefined) payload.last_follow_up_at = input.last_follow_up_at;
    if (input.next_follow_up_at !== undefined) payload.next_follow_up_at = input.next_follow_up_at;
    if (input.resubmission_count !== undefined) payload.resubmission_count = input.resubmission_count;

    if (Object.keys(payload).length === 0) {
      const result = await supabase
        .from("insurance_claims")
        .select(CLAIM_COLUMNS)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .single();
      return assertOk(result) as InsuranceClaim;
    }

    const result = await supabase
      .from("insurance_claims")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(CLAIM_COLUMNS)
      .single();

    return assertOk(result) as InsuranceClaim;
  },
  async archive(id, tenantId, userId) {
    const result = await supabase
      .from("insurance_claims")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(CLAIM_COLUMNS)
      .single();

    return assertOk(result) as InsuranceClaim;
  },
  async restore(id, tenantId) {
    const result = await supabase
      .from("insurance_claims")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(CLAIM_COLUMNS)
      .single();

    return assertOk(result) as InsuranceClaim;
  },
};
