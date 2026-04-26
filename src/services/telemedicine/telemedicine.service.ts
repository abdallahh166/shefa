import { telemedicineAgoraTokenSchema } from "@/domain/telemedicine/telemedicine.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { toServiceError } from "@/services/supabase/errors";
import { telemedicineRepository } from "./telemedicine.repository";

export const telemedicineService = {
  async getAgoraToken(appointmentId: string) {
    try {
      const parsedAppointmentId = uuidSchema.parse(appointmentId);
      const result = await telemedicineRepository.getAgoraToken(parsedAppointmentId);
      return telemedicineAgoraTokenSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load telemedicine token");
    }
  },
};
