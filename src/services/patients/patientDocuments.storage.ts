import { ServiceError } from "@/services/supabase/errors";
import { patientDocumentsStorageRepository } from "./patientDocuments.storage.repository";

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[\\/]+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .trim();
  return cleaned.length > 0 ? cleaned : "document";
}

function assertTenantPath(tenantId: string, filePath: string) {
  if (!filePath.startsWith(`${tenantId}/`)) {
    throw new ServiceError("Invalid document path for tenant");
  }
}

export async function uploadPatientDocument(options: {
  tenantId: string;
  patientId: string;
  file: File;
}) {
  const safeName = sanitizeFileName(options.file.name);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "");
  const filePath = `${options.tenantId}/patients/${options.patientId}/${timestamp}-${safeName}`;

  await patientDocumentsStorageRepository.upload(
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

export async function downloadPatientDocument(tenantId: string, filePath: string) {
  assertTenantPath(tenantId, filePath);
  return patientDocumentsStorageRepository.download(filePath);
}

export async function removePatientDocument(tenantId: string, filePath: string) {
  assertTenantPath(tenantId, filePath);
  await patientDocumentsStorageRepository.remove(filePath);
}
