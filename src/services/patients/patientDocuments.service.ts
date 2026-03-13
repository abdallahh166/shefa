import { z } from "zod";
import {
  patientDocumentCreateSchema,
  patientDocumentSchema,
  patientDocumentUploadSchema,
} from "@/domain/patient/patient.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { PatientDocumentCreateInput, PatientDocumentUploadInput } from "@/domain/patient/patient.types";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { limitOffsetSchema } from "@/domain/shared/pagination.schema";
import { ValidationError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { patientDocumentsRepository } from "./patientDocuments.repository";
import {
  downloadPatientDocument,
  removePatientDocument,
  uploadPatientDocument,
} from "./patientDocuments.storage";
import { rateLimitService } from "@/services/security/rateLimit.service";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function assertDocumentAllowed(file: File) {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new ValidationError("Document exceeds 10 MB limit");
  }
  const type = file.type?.toLowerCase().trim();
  if (type && !ALLOWED_DOCUMENT_TYPES.has(type)) {
    throw new ValidationError("Unsupported document type");
  }
}

export const patientDocumentsService = {
  async upload(input: PatientDocumentUploadInput) {
    try {
      assertAnyPermission(["manage_patients", "manage_medical_records"]);
      const parsed = patientDocumentUploadSchema.parse(input);
      assertDocumentAllowed(parsed.file);
      const { tenantId, userId } = getTenantContext();
      await rateLimitService.assertAllowed("document_upload", [tenantId, userId]);
      const uploadResult = await uploadPatientDocument({
        tenantId,
        patientId: parsed.patient_id,
        file: parsed.file,
      });

      try {
        const metadata: PatientDocumentCreateInput = {
          patient_id: parsed.patient_id,
          file_name: uploadResult.fileName,
          file_path: uploadResult.filePath,
          file_size: uploadResult.fileSize,
          file_type: uploadResult.fileType,
          uploaded_by: userId,
          notes: parsed.notes ?? null,
        };
        const validated = patientDocumentCreateSchema.parse(metadata);
        const created = await patientDocumentsRepository.createMetadata(validated, tenantId);
        return patientDocumentSchema.parse(created);
      } catch (err) {
        await removePatientDocument(tenantId, uploadResult.filePath).catch(() => undefined);
        throw err;
      }
    } catch (err) {
      throw toServiceError(err, "Failed to upload patient document");
    }
  },
  async listByPatient(patientId: string, params?: LimitOffsetParams) {
    try {
      assertAnyPermission(["view_patients", "manage_patients", "view_medical_records", "manage_medical_records"]);
      const parsedId = uuidSchema.parse(patientId);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const docs = await patientDocumentsRepository.listByPatient(parsedId, tenantId, paging);
      return z.array(patientDocumentSchema).parse(docs);
    } catch (err) {
      throw toServiceError(err, "Failed to load patient documents");
    }
  },
  async download(document: { file_path: string }) {
    try {
      assertAnyPermission(["view_patients", "manage_patients", "view_medical_records", "manage_medical_records"]);
      const parsed = patientDocumentSchema.pick({ file_path: true }).parse(document);
      const { tenantId } = getTenantContext();
      return await downloadPatientDocument(tenantId, parsed.file_path);
    } catch (err) {
      throw toServiceError(err, "Failed to download patient document");
    }
  },
  async remove(documentId: string) {
    try {
      assertAnyPermission(["manage_patients", "manage_medical_records"]);
      const parsedId = uuidSchema.parse(documentId);
      const { tenantId, userId } = getTenantContext();
      const deleted = await patientDocumentsRepository.remove(parsedId, tenantId, userId);
      const parsedDeleted = deleted
        ? patientDocumentSchema.pick({ file_path: true }).parse(deleted)
        : null;
      if (parsedDeleted?.file_path) {
        try {
          await removePatientDocument(tenantId, parsedDeleted.file_path);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Storage cleanup failed";
          return { storageError: message };
        }
      }
      return {};
    } catch (err) {
      throw toServiceError(err, "Failed to delete patient document");
    }
  },
  async archive(documentId: string) {
    try {
      assertAnyPermission(["manage_patients", "manage_medical_records"]);
      const parsedId = uuidSchema.parse(documentId);
      const { tenantId, userId } = getTenantContext();
      const result = await patientDocumentsRepository.archive(parsedId, tenantId, userId);
      return result ? patientDocumentSchema.parse(result) : null;
    } catch (err) {
      throw toServiceError(err, "Failed to archive patient document");
    }
  },
  async restore(documentId: string) {
    try {
      assertAnyPermission(["manage_patients", "manage_medical_records"]);
      const parsedId = uuidSchema.parse(documentId);
      const { tenantId } = getTenantContext();
      const result = await patientDocumentsRepository.restore(parsedId, tenantId);
      return result ? patientDocumentSchema.parse(result) : null;
    } catch (err) {
      throw toServiceError(err, "Failed to restore patient document");
    }
  },
};
