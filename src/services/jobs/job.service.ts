import { toServiceError } from "@/services/supabase/errors";
import { jobRepository } from "./job.repository";

export const jobService = {
  async invoke(functionName: string, payload: Record<string, unknown>) {
    try {
      await jobRepository.enqueue(functionName, payload);
    } catch (err) {
      throw toServiceError(err, `Failed to invoke job ${functionName}`);
    }
  },
};
