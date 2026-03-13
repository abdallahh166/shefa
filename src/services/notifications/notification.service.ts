import { z } from "zod";
import { notificationSchema } from "@/domain/notifications/notification.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { toServiceError } from "@/services/supabase/errors";
import { notificationRepository } from "./notification.repository";

export const notificationService = {
  async listRecent(userId: string, limit = 20) {
    try {
      const parsedUserId = uuidSchema.parse(userId);
      const result = await notificationRepository.listByUser(parsedUserId, limit);
      return z.array(notificationSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load notifications");
    }
  },
  async markRead(userId: string, notificationId: string) {
    try {
      const parsedUserId = uuidSchema.parse(userId);
      const parsedId = uuidSchema.parse(notificationId);
      await notificationRepository.markRead(parsedId, parsedUserId);
    } catch (err) {
      throw toServiceError(err, "Failed to update notification");
    }
  },
  async markAllRead(userId: string, ids: string[]) {
    try {
      const parsedUserId = uuidSchema.parse(userId);
      const parsedIds = z.array(uuidSchema).parse(ids);
      await notificationRepository.markManyRead(parsedIds, parsedUserId);
    } catch (err) {
      throw toServiceError(err, "Failed to update notifications");
    }
  },
  subscribe(userId: string, onInsert: (notification: any) => void) {
    const parsedUserId = uuidSchema.parse(userId);
    return notificationRepository.subscribeToUser(parsedUserId, (payload) => {
      const parsed = notificationSchema.parse(payload);
      onInsert(parsed);
    });
  },
};
