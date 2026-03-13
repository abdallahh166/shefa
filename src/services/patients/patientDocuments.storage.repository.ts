import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const BUCKET = "patient-documents";

export interface PatientDocumentsStorageRepository {
  upload(filePath: string, file: File, contentType: string): Promise<void>;
  download(filePath: string): Promise<Blob>;
  remove(filePath: string): Promise<void>;
}

export const patientDocumentsStorageRepository: PatientDocumentsStorageRepository = {
  async upload(filePath, file, contentType) {
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, {
      contentType,
      upsert: false,
    });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to upload document", {
        code: error.code,
        details: error,
      });
    }
  },
  async download(filePath) {
    const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
    if (error || !data) {
      throw new ServiceError(error?.message ?? "Failed to download document", {
        code: error?.code,
        details: error,
      });
    }
    return data;
  },
  async remove(filePath) {
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) {
      throw new ServiceError(error.message ?? "Failed to delete document", {
        code: error.code,
        details: error,
      });
    }
  },
};
