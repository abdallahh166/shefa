import { clinicSlugCheckInputSchema, clinicSlugCheckResultSchema } from "@/domain/auth/clinicSlug.schema";
import type { ClinicSlugCheckInput } from "@/domain/auth/clinicSlug.types";
import { toServiceError } from "@/services/supabase/errors";
import { clinicSlugRepository } from "./clinicSlug.repository";
import { env } from "@/core/env/env";

export const clinicSlugService = {
  async checkSlug(input: ClinicSlugCheckInput) {
    try {
      const parsed = clinicSlugCheckInputSchema.parse(input);
      const captchaRequired = Boolean(env.VITE_CAPTCHA_SITE_KEY);
      if (captchaRequired && !parsed.captchaToken) {
        throw new Error("Captcha verification required");
      }
      const result = await clinicSlugRepository.checkSlug(parsed);
      return clinicSlugCheckResultSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to check clinic slug");
    }
  },
};
