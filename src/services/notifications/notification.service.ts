import { z } from "zod";
import { notificationCreateSchema, notificationSchema } from "@/domain/notifications/notification.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { notificationRepository } from "./notification.repository";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});

export const notificationService = {
  async listRecent(userId: string, limit = 20) {
    try {
      const parsedUserId = uuidSchema.parse(userId);
      const { tenantId } = getTenantContext();
      const { data } = await notificationRepository.listByUserPaged(tenantId, parsedUserId, limit, 0);
      return z.array(notificationSchema).parse(data);
    } catch (err) {
      throw toServiceError(err, "Failed to load notifications");
    }
  },
  async listPaged(userId: string, input?: { page?: number; pageSize?: number }) {
    try {
      const parsedUserId = uuidSchema.parse(userId);
      const parsed = paginationSchema.parse(input ?? {});
      const { tenantId } = getTenantContext();
      const { data, count } = await notificationRepository.listByUserPaged(
        tenantId,
        parsedUserId,
        parsed.pageSize,
        (parsed.page - 1) * parsed.pageSize
      );
      return { data: z.array(notificationSchema).parse(data), total: count };
    } catch (err) {
      throw toServiceError(err, "Failed to load notifications");
    }
  },
  async markRead(userId: string, notificationId: string) {
    try {
      const parsedUserId = uuidSchema.parse(userId);
      const parsedId = uuidSchema.parse(notificationId);
      const { tenantId } = getTenantContext();
      await notificationRepository.markRead(parsedId, tenantId, parsedUserId);
    } catch (err) {
      throw toServiceError(err, "Failed to update notification");
    }
  },
  async markAllRead(userId: string, ids: string[]) {
    try {
      const parsedUserId = uuidSchema.parse(userId);
      const parsedIds = z.array(uuidSchema).parse(ids);
      const { tenantId } = getTenantContext();
      await notificationRepository.markManyRead(parsedIds, tenantId, parsedUserId);
    } catch (err) {
      throw toServiceError(err, "Failed to update notifications");
    }
  },
  async create(input: {
    tenant_id: string;
    user_id: string;
    title: string;
    body?: string | null;
    type: string;
    read?: boolean;
  }) {
    try {
      const parsed = notificationCreateSchema.parse(input);
      const { tenantId } = getTenantContext();
      if (parsed.tenant_id !== tenantId) {
        throw new Error("Tenant mismatch");
      }
      const result = await notificationRepository.create(parsed);
      return notificationSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to create notification");
    }
  },
  subscribe(userId: string, onInsert: (notification: any) => void) {
    const parsedUserId = uuidSchema.parse(userId);
    const { tenantId } = getTenantContext();
    return notificationRepository.subscribeToUser(tenantId, parsedUserId, (payload) => {
      const parsed = notificationSchema.parse(payload);
      onInsert(parsed);
    });
  },
};
