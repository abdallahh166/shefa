import { z } from "zod";

export const telemedicineAgoraTokenSchema = z.object({
  appId: z.string().trim().min(1),
  channel: z.string().trim().min(1),
  token: z.string().trim().min(1),
  uid: z.coerce.number().int().nonnegative(),
});
