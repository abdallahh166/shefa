import { z } from "zod";
import {
  insuranceClaimAttachmentCreateSchema,
  insuranceClaimAttachmentSchema,
  insuranceClaimAttachmentUploadSchema,
} from "@/domain/insurance/insurance.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { InsuranceClaimAttachmentCreateInput, InsuranceClaimAttachmentUploadInput } from "@/domain/insurance/insurance.types";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { limitOffsetSchema } from "@/domain/shared/pagination.schema";
import { ValidationError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { rateLimitService } from "@/services/security/rateLimit.service";
import { insuranceAttachmentsRepository } from "./insuranceAttachments.repository";
import {
  downloadInsuranceAttachment,
  removeInsuranceAttachment,
  uploadInsuranceAttachment,
} from "./insuranceAttachments.storage";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function assertAttachmentAllowed(file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ValidationError("Attachment exceeds 10 MB limit");
  }
  const type = file.type?.toLowerCase().trim();
  if (type && !ALLOWED_ATTACHMENT_TYPES.has(type)) {
    throw new ValidationError("Unsupported attachment type");
  }
}

export const insuranceAttachmentsService = {
  async upload(input: InsuranceClaimAttachmentUploadInput) {
    try {
      assertAnyPermission(["manage_billing"]);
      const parsed = insuranceClaimAttachmentUploadSchema.parse(input);
      assertAttachmentAllowed(parsed.file);
      const { tenantId, userId } = getTenantContext();
      await rateLimitService.assertAllowed("document_upload", [tenantId, userId]);
      const uploadResult = await uploadInsuranceAttachment({
        tenantId,
        claimId: parsed.claim_id,
        file: parsed.file,
      });

      try {
        const metadata: InsuranceClaimAttachmentCreateInput = {
          claim_id: parsed.claim_id,
          file_name: uploadResult.fileName,
          file_path: uploadResult.filePath,
          file_size: uploadResult.fileSize,
          file_type: uploadResult.fileType,
          attachment_type: parsed.attachment_type,
          uploaded_by: userId,
          notes: parsed.notes ?? null,
        };
        const validated = insuranceClaimAttachmentCreateSchema.parse(metadata);
        const created = await insuranceAttachmentsRepository.createMetadata(validated, tenantId);
        return insuranceClaimAttachmentSchema.parse(created);
      } catch (err) {
        await removeInsuranceAttachment(tenantId, uploadResult.filePath).catch(() => undefined);
        throw err;
      }
    } catch (err) {
      throw toServiceError(err, "Failed to upload insurance attachment");
    }
  },
  async listByClaim(claimId: string, params?: LimitOffsetParams) {
    try {
      assertAnyPermission(["view_billing", "manage_billing"]);
      const parsedId = uuidSchema.parse(claimId);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const attachments = await insuranceAttachmentsRepository.listByClaim(parsedId, tenantId, paging);
      return z.array(insuranceClaimAttachmentSchema).parse(attachments);
    } catch (err) {
      throw toServiceError(err, "Failed to load insurance attachments");
    }
  },
  async download(document: { file_path: string }) {
    try {
      assertAnyPermission(["view_billing", "manage_billing"]);
      const parsed = insuranceClaimAttachmentSchema.pick({ file_path: true }).parse(document);
      const { tenantId } = getTenantContext();
      return await downloadInsuranceAttachment(tenantId, parsed.file_path);
    } catch (err) {
      throw toServiceError(err, "Failed to download insurance attachment");
    }
  },
  async remove(attachmentId: string) {
    try {
      assertAnyPermission(["manage_billing"]);
      const parsedId = uuidSchema.parse(attachmentId);
      const { tenantId, userId } = getTenantContext();
      const deleted = await insuranceAttachmentsRepository.remove(parsedId, tenantId, userId);
      const parsedDeleted = deleted
        ? insuranceClaimAttachmentSchema.pick({ file_path: true }).parse(deleted)
        : null;
      if (parsedDeleted?.file_path) {
        try {
          await removeInsuranceAttachment(tenantId, parsedDeleted.file_path);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Storage cleanup failed";
          return { storageError: message };
        }
      }
      return {};
    } catch (err) {
      throw toServiceError(err, "Failed to delete insurance attachment");
    }
  },
};
