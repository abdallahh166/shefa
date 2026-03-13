import type { z } from "zod";
import { notificationSchema, notificationMarkReadSchema } from "./notification.schema";

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationMarkReadInput = z.infer<typeof notificationMarkReadSchema>;
