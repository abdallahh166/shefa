import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantId = "00000000-0000-0000-0000-000000000111";
const actorUserId = "00000000-0000-0000-0000-000000000222";
const targetUserId = "00000000-0000-0000-0000-000000000333";

const notificationRepository = vi.hoisted(() => ({
  listByUserPaged: vi.fn(),
  markRead: vi.fn(),
  markManyRead: vi.fn(),
  create: vi.fn(),
  subscribeToUser: vi.fn(),
}));

vi.mock("@/services/notifications/notification.repository", () => ({ notificationRepository }));
vi.mock("@/services/supabase/tenant", () => ({
  getTenantContext: () => ({
    tenantId,
    userId: actorUserId,
  }),
}));

import { notificationService } from "@/services/notifications/notification.service";

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationRepository.create.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000444",
      tenant_id: tenantId,
      user_id: targetUserId,
      title: "Job complete",
      body: "Sent 3, failed 0, skipped 1.",
      type: "billing_email_job",
      read: false,
      created_at: "2026-04-25T18:30:00.000Z",
    });
  });

  it("creates notifications for the explicit target user instead of the actor", async () => {
    await notificationService.create({
      tenant_id: tenantId,
      user_id: targetUserId,
      title: "Job complete",
      body: "Sent 3, failed 0, skipped 1.",
      type: "billing_email_job",
      read: false,
    });

    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: tenantId,
        user_id: targetUserId,
      }),
    );
  });

  it("rejects notification creation when the tenant does not match context", async () => {
    await expect(notificationService.create({
      tenant_id: "00000000-0000-0000-0000-000000000999",
      user_id: targetUserId,
      title: "Wrong tenant",
      body: null,
      type: "billing_email_job",
      read: false,
    })).rejects.toThrow("Notification tenant does not match the current tenant context");

    expect(notificationRepository.create).not.toHaveBeenCalled();
  });
});
