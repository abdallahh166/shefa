import { portalLoginInputSchema, portalLoginMetadataSchema } from "@/domain/portal/portal.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
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
      const parsedUserId = uuidSchema.parse(userId);
      return await portalRepository.getAccountByAuthUserId(parsedUserId);
    } catch (err) {
      throw toServiceError(err, "Failed to load portal account");
    }
  },
  async listAppointments(patientId: string) {
    try {
      const parsedPatientId = uuidSchema.parse(patientId);
      return await portalRepository.listAppointments(parsedPatientId);
    } catch (err) {
      throw toServiceError(err, "Failed to load appointments");
    }
  },
  async listPrescriptions(patientId: string) {
    try {
      const parsedPatientId = uuidSchema.parse(patientId);
      return await portalRepository.listPrescriptions(parsedPatientId);
    } catch (err) {
      throw toServiceError(err, "Failed to load prescriptions");
    }
  },
  async listLabOrders(patientId: string) {
    try {
      const parsedPatientId = uuidSchema.parse(patientId);
      return await portalRepository.listLabOrders(parsedPatientId);
    } catch (err) {
      throw toServiceError(err, "Failed to load lab orders");
    }
  },
  async listDocuments(patientId: string) {
    try {
      const parsedPatientId = uuidSchema.parse(patientId);
      return await portalRepository.listDocuments(parsedPatientId);
    } catch (err) {
      throw toServiceError(err, "Failed to load documents");
    }
  },
  async listInvoices(patientId: string) {
    try {
      const parsedPatientId = uuidSchema.parse(patientId);
      return await portalRepository.listInvoices(parsedPatientId);
    } catch (err) {
      throw toServiceError(err, "Failed to load invoices");
    }
  },
};
