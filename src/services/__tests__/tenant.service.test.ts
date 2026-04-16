import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "@/services/supabase/errors";

const tenantRepository = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
}));

const permissions = vi.hoisted(() => ({
  assertAnyPermission: vi.fn(),
}));

vi.mock("@/services/settings/tenant.repository", () => ({ tenantRepository }));
vi.mock("@/services/supabase/permissions", () => permissions);
vi.mock("@/services/supabase/tenant", () => ({
  getTenantContext: () => ({
    tenantId: "00000000-0000-0000-0000-000000000111",
    userId: "00000000-0000-0000-0000-000000000222",
  }),
}));

import { tenantService } from "@/services/settings/tenant.service";

describe("tenantService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.assertAnyPermission.mockReturnValue(undefined);
  });

  it("requires clinic-management permission before updating tenant settings", async () => {
    tenantRepository.update.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000111",
      slug: "clinic-a",
      name: "Clinic A",
      phone: null,
      email: "owner@example.com",
      address: null,
      logo_url: null,
      created_at: "2026-04-16T10:00:00.000Z",
      updated_at: "2026-04-16T10:10:00.000Z",
    });

    await tenantService.updateCurrentTenant({ name: "Clinic A" });

    expect(permissions.assertAnyPermission).toHaveBeenCalledWith(["manage_clinic", "super_admin"]);
    expect(tenantRepository.update).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000111",
      { name: "Clinic A" },
    );
  });

  it("blocks unauthorized tenant updates before repository access", async () => {
    permissions.assertAnyPermission.mockImplementation(() => {
      throw new AuthorizationError("Not authorized");
    });

    await expect(tenantService.updateCurrentTenant({ name: "Clinic A" })).rejects.toMatchObject({
      name: "AuthorizationError",
      message: "Not authorized",
    });

    expect(tenantRepository.update).not.toHaveBeenCalled();
  });
});
