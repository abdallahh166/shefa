import type { z } from "zod";
import { telemedicineAgoraTokenSchema } from "./telemedicine.schema";

export type TelemedicineAgoraToken = z.infer<typeof telemedicineAgoraTokenSchema>;
