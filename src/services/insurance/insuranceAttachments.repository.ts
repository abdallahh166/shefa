import type { InsuranceClaimAttachment, InsuranceClaimAttachmentCreateInput } from "@/domain/insurance/insurance.types";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";
import { assertOk } from "@/services/supabase/query";

const ATTACHMENT_COLUMNS =
  "id, claim_id, tenant_id, file_name, file_path, file_size, file_type, attachment_type, uploaded_by, notes, deleted_at, deleted_by, created_at";

export interface InsuranceAttachmentsRepository {
  createMetadata(input: InsuranceClaimAttachmentCreateInput, tenantId: string): Promise<InsuranceClaimAttachment>;
  listByClaim(claimId: string, tenantId: string, params?: LimitOffsetParams): Promise<InsuranceClaimAttachment[]>;
  archive(attachmentId: string, tenantId: string, userId: string): Promise<InsuranceClaimAttachment | null>;
  restore(attachmentId: string, tenantId: string): Promise<InsuranceClaimAttachment | null>;
  remove(attachmentId: string, tenantId: string, userId: string): Promise<{ file_path: string } | null>;
}

export const insuranceAttachmentsRepository: InsuranceAttachmentsRepository = {
  async createMetadata(input, tenantId) {
    const payload = {
      claim_id: input.claim_id,
      tenant_id: tenantId,
      file_name: input.file_name,
      file_path: input.file_path,
      file_size: input.file_size ?? 0,
      file_type: input.file_type ?? "application/octet-stream",
      attachment_type: input.attachment_type,
      uploaded_by: input.uploaded_by,
      notes: input.notes ?? null,
    };

    const result = await supabase
      .from("insurance_claim_attachments")
      .insert(payload)
      .select(ATTACHMENT_COLUMNS)
      .single();

    return assertOk(result) as InsuranceClaimAttachment;
  },
  async listByClaim(claimId, tenantId, params) {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const { data, error } = await supabase
      .from("insurance_claim_attachments")
      .select(ATTACHMENT_COLUMNS)
      .eq("claim_id", claimId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new ServiceError(error.message ?? "Failed to load insurance claim attachments", {
        code: error.code,
        details: error,
      });
    }

    return (data ?? []) as InsuranceClaimAttachment[];
  },
  async archive(attachmentId, tenantId, userId) {
    const result = await supabase
      .from("insurance_claim_attachments")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", attachmentId)
      .eq("tenant_id", tenantId)
      .select(ATTACHMENT_COLUMNS)
      .single();

    return assertOk(result) as InsuranceClaimAttachment | null;
  },
  async restore(attachmentId, tenantId) {
    const result = await supabase
      .from("insurance_claim_attachments")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", attachmentId)
      .eq("tenant_id", tenantId)
      .select(ATTACHMENT_COLUMNS)
      .single();

    return assertOk(result) as InsuranceClaimAttachment | null;
  },
  async remove(attachmentId, tenantId, userId) {
    const archived = await insuranceAttachmentsRepository.archive(attachmentId, tenantId, userId);
    return archived ? { file_path: archived.file_path } : null;
  },
};
