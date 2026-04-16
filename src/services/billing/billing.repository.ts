import type {
  Invoice,
  InvoiceCreateInput,
  InvoiceListParams,
  InvoicePayment,
  InvoicePaymentCreateInput,
  InvoiceSummary,
  InvoiceUpdateInput,
  InvoiceWithPatient,
} from "@/domain/billing/billing.types";
import type { LimitOffsetParams, PagedResult } from "@/domain/shared/pagination.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";
import { assertOk } from "@/services/supabase/query";

const INVOICE_COLUMNS =
  "id, tenant_id, patient_id, invoice_code, service, amount, amount_paid, balance_due, invoice_date, due_date, paid_at, voided_at, void_reason, status, deleted_at, deleted_by, created_at, updated_at";
const INVOICE_WITH_PATIENT_COLUMNS = `${INVOICE_COLUMNS}, patients(full_name)`;
const PAYMENT_COLUMNS =
  "id, tenant_id, invoice_id, patient_id, amount, payment_method, paid_at, reference, notes, created_at, created_by";

const SEARCH_COLUMNS = ["invoice_code", "service", "status"];
const SEARCH_COLUMNS_WITH_RELATIONS = [...SEARCH_COLUMNS, "patients.full_name"];
const SORTABLE_COLUMNS = new Set([
  "invoice_date",
  "due_date",
  "created_at",
  "updated_at",
  "status",
  "balance_due",
]);

function escapeSearchTerm(term: string) {
  return term.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,");
}

export interface BillingRepository {
  listPaged(params: InvoiceListParams, tenantId: string): Promise<PagedResult<Invoice>>;
  listPagedWithRelations(params: InvoiceListParams, tenantId: string): Promise<PagedResult<InvoiceWithPatient>>;
  getById(id: string, tenantId: string): Promise<Invoice>;
  getSummary(tenantId: string): Promise<InvoiceSummary>;
  countInRange(start: string, end: string, tenantId: string): Promise<number>;
  listByDateRange(start: string, end: string, tenantId: string, params?: LimitOffsetParams): Promise<Invoice[]>;
  listByPatient(patientId: string, tenantId: string, params?: LimitOffsetParams): Promise<Invoice[]>;
  listPayments(invoiceId: string, tenantId: string): Promise<InvoicePayment[]>;
  create(input: InvoiceCreateInput, tenantId: string): Promise<Invoice>;
  update(id: string, input: InvoiceUpdateInput, tenantId: string): Promise<Invoice>;
  createPayment(invoiceId: string, patientId: string, input: InvoicePaymentCreateInput, tenantId: string, userId?: string | null): Promise<InvoicePayment>;
  archive(id: string, tenantId: string, userId: string): Promise<Invoice>;
  restore(id: string, tenantId: string): Promise<Invoice>;
}

export const billingRepository: BillingRepository = {
  async listPaged(params, tenantId) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const searchTerm = params.search?.trim() ?? "";

    let query = supabase
      .from("invoices")
      .select(INVOICE_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    const filters = params.filters ?? {};
    if (typeof filters.status === "string" && filters.status.length > 0) {
      query = query.eq("status", filters.status);
    }
    if (typeof filters.patient_id === "string" && filters.patient_id.length > 0) {
      query = query.eq("patient_id", filters.patient_id);
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
      : "invoice_date";
    const sortAscending = params.sort?.ascending ?? false;

    query = query.order(sortColumn, { ascending: sortAscending }).range(from, to);

    const { data, error, count } = await query;
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load invoices", {
        code: error.code,
        details: error,
      });
    }

    return { data: (data ?? []) as Invoice[], count: count ?? 0 };
  },
  async listPagedWithRelations(params, tenantId) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const searchTerm = params.search?.trim() ?? "";

    let query = supabase
      .from("invoices")
      .select(INVOICE_WITH_PATIENT_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    const filters = params.filters ?? {};
    if (typeof filters.status === "string" && filters.status.length > 0) {
      query = query.eq("status", filters.status);
    }
    if (typeof filters.patient_id === "string" && filters.patient_id.length > 0) {
      query = query.eq("patient_id", filters.patient_id);
    }

    if (searchTerm) {
      const escaped = escapeSearchTerm(searchTerm);
      const orFilter = SEARCH_COLUMNS_WITH_RELATIONS
        .map((col) => `${col}.ilike.%${escaped}%`)
        .join(",");
      query = query.or(orFilter);
    }

    const sortColumn = params.sort?.column && SORTABLE_COLUMNS.has(params.sort.column)
      ? params.sort.column
      : "invoice_date";
    const sortAscending = params.sort?.ascending ?? false;

    query = query.order(sortColumn, { ascending: sortAscending }).range(from, to);

    const { data, error, count } = await query;
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load invoices", {
        code: error.code,
        details: error,
      });
    }

    return { data: (data ?? []) as InvoiceWithPatient[], count: count ?? 0 };
  },
  async getById(id, tenantId) {
    const result = await supabase
      .from("invoices")
      .select(INVOICE_COLUMNS)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single();

    return assertOk(result) as Invoice;
  },
  async getSummary(_tenantId) {
    const { data, error } = await (supabase.rpc as any)("get_invoice_summary");
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load invoice summary", {
        code: error.code,
        details: error,
      });
    }

    return ((data as any)?.[0] ?? { total_count: 0, paid_count: 0, paid_amount: 0, pending_amount: 0 }) as InvoiceSummary;
  },
  async countInRange(start, end, tenantId) {
    const { count, error } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .gte("invoice_date", start)
      .lt("invoice_date", end);

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load invoices", {
        code: error.code,
        details: error,
      });
    }

    return count ?? 0;
  },
  async listByDateRange(start, end, tenantId, params) {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const { data, error } = await supabase
      .from("invoices")
      .select(INVOICE_COLUMNS)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .gte("invoice_date", start)
      .lte("invoice_date", end)
      .order("invoice_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load invoices", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? []) as Invoice[];
  },
  async listByPatient(patientId, tenantId, params) {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const { data, error } = await supabase
      .from("invoices")
      .select(INVOICE_COLUMNS)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .eq("patient_id", patientId)
      .order("invoice_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load patient invoices", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? []) as Invoice[];
  },
  async listPayments(invoiceId, tenantId) {
    const { data, error } = await supabase
      .from("invoice_payments")
      .select(PAYMENT_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("invoice_id", invoiceId)
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load invoice payments", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? []) as InvoicePayment[];
  },
  async create(input, tenantId) {
    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      patient_id: input.patient_id,
      invoice_code: input.invoice_code,
      service: input.service,
      amount: input.amount,
    };

    if (input.invoice_date !== undefined) payload.invoice_date = input.invoice_date;
    if (input.due_date !== undefined) payload.due_date = input.due_date;
    if (input.status !== undefined) payload.status = input.status;
    if (input.amount_paid !== undefined) payload.amount_paid = input.amount_paid;
    if (input.balance_due !== undefined) payload.balance_due = input.balance_due;
    if (input.paid_at !== undefined) payload.paid_at = input.paid_at;
    if (input.voided_at !== undefined) payload.voided_at = input.voided_at;
    if (input.void_reason !== undefined) payload.void_reason = input.void_reason;

    const result = await supabase
      .from("invoices")
      .insert(payload as never)
      .select(INVOICE_COLUMNS)
      .single();

    return assertOk(result) as Invoice;
  },
  async update(id, input, tenantId) {
    const payload: Record<string, unknown> = {};

    if (input.patient_id !== undefined) payload.patient_id = input.patient_id;
    if (input.invoice_code !== undefined) payload.invoice_code = input.invoice_code;
    if (input.service !== undefined) payload.service = input.service;
    if (input.amount !== undefined) payload.amount = input.amount;
    if (input.amount_paid !== undefined) payload.amount_paid = input.amount_paid;
    if (input.balance_due !== undefined) payload.balance_due = input.balance_due;
    if (input.invoice_date !== undefined) payload.invoice_date = input.invoice_date;
    if (input.due_date !== undefined) payload.due_date = input.due_date;
    if (input.paid_at !== undefined) payload.paid_at = input.paid_at;
    if (input.voided_at !== undefined) payload.voided_at = input.voided_at;
    if (input.void_reason !== undefined) payload.void_reason = input.void_reason;
    if (input.status !== undefined) payload.status = input.status;

    if (Object.keys(payload).length === 0) {
      const result = await supabase
        .from("invoices")
        .select(INVOICE_COLUMNS)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .single();
      return assertOk(result) as Invoice;
    }

    const result = await supabase
      .from("invoices")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(INVOICE_COLUMNS)
      .single();

    return assertOk(result) as Invoice;
  },
  async createPayment(invoiceId, patientId, input, tenantId, userId) {
    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      invoice_id: invoiceId,
      patient_id: patientId,
      amount: input.amount,
      payment_method: input.payment_method,
      created_by: userId ?? null,
    };

    if (input.paid_at !== undefined) payload.paid_at = input.paid_at;
    if (input.reference !== undefined) payload.reference = input.reference;
    if (input.notes !== undefined) payload.notes = input.notes;

    const result = await supabase
      .from("invoice_payments")
      .insert(payload as never)
      .select(PAYMENT_COLUMNS)
      .single();

    return assertOk(result) as InvoicePayment;
  },
  async archive(id, tenantId, userId) {
    const result = await supabase
      .from("invoices")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(INVOICE_COLUMNS)
      .single();

    return assertOk(result) as Invoice;
  },
  async restore(id, tenantId) {
    const result = await supabase
      .from("invoices")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(INVOICE_COLUMNS)
      .single();

    return assertOk(result) as Invoice;
  },
};
