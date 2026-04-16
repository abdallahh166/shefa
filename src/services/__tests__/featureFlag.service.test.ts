import { beforeEach, describe, expect, it, vi } from "vitest";
import { featureFlagService } from "@/services/featureFlags/featureFlag.service";
import { featureFlagRepository } from "@/services/featureFlags/featureFlag.repository";
import { auditLogService } from "@/services/settings/audit.service";
import { AuthorizationError } from "@/services/supabase/errors";

const permissions = vi.hoisted(() => ({
  assertAnyPermission: vi.fn(),
}));

vi.mock("@/services/supabase/tenant", () => ({
  getTenantContext: () => ({
    tenantId: "00000000-0000-0000-0000-000000000111",
    userId: "00000000-0000-0000-0000-000000000222",
  }),
}));

vi.mock("@/services/featureFlags/featureFlag.repository", () => ({
  featureFlagRepository: {
    listByTenant: vi.fn(),
    get: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/services/settings/audit.service", () => ({
  auditLogService: {
    logEvent: vi.fn(),
  },
}));

vi.mock("@/services/supabase/permissions", () => permissions);

const repo = vi.mocked(featureFlagRepository, true);
const audit = vi.mocked(auditLogService, true);

describe("featureFlagService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.assertAnyPermission.mockReturnValue(undefined);
  });

  it("lists feature flags for the tenant", async () => {
    const now = new Date().toISOString();
    repo.listByTenant.mockResolvedValue([
      {
        id: "00000000-0000-0000-0000-000000000333",
        tenant_id: "00000000-0000-0000-0000-000000000111",
        feature_key: "pharmacy_module",
        enabled: true,
        created_at: now,
      },
    ] as any);

    const result = await featureFlagService.list();

    expect(result).toHaveLength(1);
    expect(result[0].feature_key).toBe("pharmacy_module");
  });

  it("returns true for missing flags", async () => {
    repo.get.mockResolvedValue(null);

    const enabled = await featureFlagService.isEnabled("advanced_reports");

    expect(enabled).toBe(true);
  });

  it("returns flag state when present", async () => {
    const now = new Date().toISOString();
    repo.get.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000444",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      feature_key: "lab_module",
      enabled: false,
      created_at: now,
    } as any);

    const enabled = await featureFlagService.isEnabled("lab_module");

    expect(enabled).toBe(false);
  });

  it("logs audit events when updating flags", async () => {
    const now = new Date().toISOString();
    repo.upsert.mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000555",
      tenant_id: "00000000-0000-0000-0000-000000000111",
      feature_key: "insurance_module",
      enabled: true,
      created_at: now,
    } as any);

    const result = await featureFlagService.setFlag({
      feature_key: "insurance_module",
      enabled: true,
    });

    expect(result.feature_key).toBe("insurance_module");
    expect(audit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "00000000-0000-0000-0000-000000000111",
        user_id: "00000000-0000-0000-0000-000000000222",
        action: "feature_flag_updated",
        entity_type: "feature_flags",
        entity_id: "00000000-0000-0000-0000-000000000555",
        details: expect.objectContaining({ feature_key: "insurance_module", enabled: true }),
      })
    );
  });

  it("blocks updates when the caller cannot manage clinic settings", async () => {
    permissions.assertAnyPermission.mockImplementation(() => {
      throw new AuthorizationError("Not authorized");
    });

    await expect(
      featureFlagService.setFlag({
        feature_key: "insurance_module",
        enabled: false,
      })
    ).rejects.toMatchObject({
      name: "AuthorizationError",
      message: "Not authorized",
    });

    expect(repo.upsert).not.toHaveBeenCalled();
    expect(audit.logEvent).not.toHaveBeenCalled();
  });
});
