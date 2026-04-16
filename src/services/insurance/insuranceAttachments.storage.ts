import { ServiceError } from "@/services/supabase/errors";
import { insuranceAttachmentsStorageRepository } from "./insuranceAttachments.storage.repository";

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[\\/]+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .trim();
  return cleaned.length > 0 ? cleaned : "attachment";
}

function assertTenantPath(tenantId: string, filePath: string) {
  if (!filePath.startsWith(`${tenantId}/`)) {
    throw new ServiceError("Invalid insurance attachment path for tenant");
  }
}

export async function uploadInsuranceAttachment(options: {
  tenantId: string;
  claimId: string;
  file: File;
}) {
  const safeName = sanitizeFileName(options.file.name);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "");
  const filePath = `${options.tenantId}/insurance-claims/${options.claimId}/${timestamp}-${safeName}`;

  await insuranceAttachmentsStorageRepository.upload(
    filePath,
    options.file,
    options.file.type || "application/octet-stream",
  );

  return {
    filePath,
    fileName: options.file.name,
    fileSize: options.file.size,
    fileType: options.file.type || "application/octet-stream",
  };
}

export async function downloadInsuranceAttachment(tenantId: string, filePath: string) {
  assertTenantPath(tenantId, filePath);
  return insuranceAttachmentsStorageRepository.download(filePath);
}

export async function removeInsuranceAttachment(tenantId: string, filePath: string) {
  assertTenantPath(tenantId, filePath);
  await insuranceAttachmentsStorageRepository.remove(filePath);
}
