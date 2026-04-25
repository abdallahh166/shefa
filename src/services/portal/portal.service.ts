import { portalLoginInputSchema, portalLoginMetadataSchema } from "@/domain/portal/portal.schema";
import { toServiceError } from "@/services/supabase/errors";
import { portalRepository } from "./portal.repository";

export const portalService = {
  async sendMagicLink(input: { clinicSlug: string; email: string; redirectTo: string }) {
    try {
      const parsed = portalLoginInputSchema.parse(input);
      const metadata = await portalRepository.getLoginMetadata(parsed.clinicSlug, parsed.email);
      if (!metadata) {
        throw new Error("No portal invite found for this email");
      }
      portalLoginMetadataSchema.parse(metadata);
      await portalRepository.sendMagicLink(parsed.email, parsed.redirectTo);
    } catch (err) {
      throw toServiceError(err, "Failed to send magic link");
    }
  },
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
