import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const ACCOUNT_COLUMNS = "id, tenant_id, patient_id, status, auth_user_id, patients(full_name), tenants:tenant_id(name, slug)";

export const portalRepository = {
  async getAccountByAuthUserId(userId: string) {
    const { data, error } = await supabase
      .from("patient_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load portal account", {
        code: error.code,
        details: error,
      });
    }
    return data;
  },
  async listAppointments(patientId: string) {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, appointment_date, status, type, doctors(full_name)")
      .eq("patient_id", patientId)
      .order("appointment_date", { ascending: false });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load appointments", { code: error.code, details: error });
    }
    return data ?? [];
  },
  async listPrescriptions(patientId: string) {
    const { data, error } = await supabase
      .from("prescriptions")
      .select("id, medication, dosage, status, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load prescriptions", { code: error.code, details: error });
    }
    return data ?? [];
  },
  async listLabOrders(patientId: string) {
    const { data, error } = await supabase
      .from("lab_orders")
      .select("id, test_name, status, result, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load lab results", { code: error.code, details: error });
    }
    return data ?? [];
  },
  async listDocuments(patientId: string) {
    const { data, error } = await supabase
      .from("patient_documents")
      .select("id, file_name, file_type, file_size, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load documents", { code: error.code, details: error });
    }
    return data ?? [];
  },
  async listInvoices(patientId: string) {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, invoice_code, service, amount, status, invoice_date")
      .eq("patient_id", patientId)
      .order("invoice_date", { ascending: false });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load invoices", { code: error.code, details: error });
    }
    return data ?? [];
  },
};
