import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const AVATAR_BUCKET = "avatars";

export interface ProfileStorageRepository {
  upload(path: string, file: File): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
  remove(paths: string[]): Promise<void>;
}

export const profileStorageRepository: ProfileStorageRepository = {
  async upload(path, file) {
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to upload avatar", {
        code: error.name,
        details: error,
      });
    }
  },
  async createSignedUrl(path, expiresInSeconds) {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new ServiceError(error?.message ?? "Failed to create signed avatar URL", {
        code: error?.name,
        details: error,
      });
    }
    return data.signedUrl;
  },
  async remove(paths) {
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove(paths);
    if (error) {
      throw new ServiceError(error.message ?? "Failed to remove avatar", {
        code: error.name,
        details: error,
      });
    }
  },
};
