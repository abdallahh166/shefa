import { telemedicineAgoraTokenSchema } from "@/domain/telemedicine/telemedicine.schema";
import { toServiceError } from "@/services/supabase/errors";
import { telemedicineRepository } from "./telemedicine.repository";

export const telemedicineService = {
  async getAgoraToken(appointmentId: string) {
    try {
      const result = await telemedicineRepository.getAgoraToken(appointmentId);
      return telemedicineAgoraTokenSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load telemedicine token");
    }
  },
};
