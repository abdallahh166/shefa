import type { Notification } from "@/domain/notifications/notification.types";
import { supabase } from "@/services/supabase/client";
import { ServiceError } from "@/services/supabase/errors";

const NOTIFICATION_COLUMNS = "id, tenant_id, user_id, title, body, type, read, created_at";

export interface NotificationRepository {
  listByUser(userId: string, limit?: number): Promise<Notification[]>;
  markRead(id: string, userId: string): Promise<void>;
  markManyRead(ids: string[], userId: string): Promise<void>;
  subscribeToUser(
    userId: string,
    onInsert: (payload: Notification) => void,
  ): { unsubscribe: () => void };
}

export const notificationRepository: NotificationRepository = {
  async listByUser(userId, limit = 20) {
    const { data, error } = await supabase
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      throw new ServiceError(error.message ?? "Failed to load notifications", { code: error.code, details: error });
    }
    return (data ?? []) as Notification[];
  },
  async markRead(id, userId) {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      throw new ServiceError(error.message ?? "Failed to update notification", { code: error.code, details: error });
    }
  },
  async markManyRead(ids, userId) {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", ids)
      .eq("user_id", userId);
    if (error) {
      throw new ServiceError(error.message ?? "Failed to update notifications", { code: error.code, details: error });
    }
  },
  subscribeToUser(userId, onInsert) {
    const channel = supabase
      .channel(`user-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onInsert(payload.new as Notification);
        },
      )
      .subscribe();
    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};
