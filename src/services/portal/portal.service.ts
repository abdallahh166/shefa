import { portalRepository } from "./portal.repository";
import { toServiceError } from "@/services/supabase/errors";

export const portalService = {
  async getAccountByAuthUserId(userId: string) {
    try {
      return await portalRepository.getAccountByAuthUserId(userId);
    } catch (err) {
      throw toServiceError(err, "Failed to load portal account");
    }
  },
  async listAppointments(patientId: string) {
    try {
      return await portalRepository.listAppointments(patientId);
    } catch (err) {
      throw toServiceError(err, "Failed to load appointments");
    }
  },
  async listPrescriptions(patientId: string) {
    try {
      return await portalRepository.listPrescriptions(patientId);
    } catch (err) {
      throw toServiceError(err, "Failed to load prescriptions");
    }
  },
  async listLabOrders(patientId: string) {
    try {
      return await portalRepository.listLabOrders(patientId);
    } catch (err) {
      throw toServiceError(err, "Failed to load lab orders");
    }
  },
  async listDocuments(patientId: string) {
    try {
      return await portalRepository.listDocuments(patientId);
    } catch (err) {
      throw toServiceError(err, "Failed to load documents");
    }
  },
  async listInvoices(patientId: string) {
    try {
      return await portalRepository.listInvoices(patientId);
    } catch (err) {
      throw toServiceError(err, "Failed to load invoices");
    }
  },
};
