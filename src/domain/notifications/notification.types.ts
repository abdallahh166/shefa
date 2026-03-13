import type { z } from "zod";
import { notificationSchema, notificationMarkReadSchema, notificationCreateSchema } from "./notification.schema";

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationMarkReadInput = z.infer<typeof notificationMarkReadSchema>;
export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
