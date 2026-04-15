import type { TelemedicineAgoraToken } from "@/domain/telemedicine/telemedicine.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

export const telemedicineRepository = {
  async getAgoraToken(appointmentId: string) {
    const { data, error } = await supabase.functions.invoke("agora-token", {
      body: { appointment_id: appointmentId },
    });
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load telemedicine token", {
        code: error.code,
        details: error,
      });
    }
    return data as TelemedicineAgoraToken;
  },
};
