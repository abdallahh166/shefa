import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchService } from "@/services/search/search.service";
import { searchRepository } from "@/services/search/search.repository";

vi.mock("@/services/supabase/tenant", () => ({
  getTenantContext: () => ({
    tenantId: "00000000-0000-0000-0000-000000000111",
    userId: "00000000-0000-0000-0000-000000000222",
  }),
}));

vi.mock("@/services/search/search.repository", () => ({
  searchRepository: {
    searchGlobal: vi.fn(),
  },
}));

vi.mock("@/core/auth/authStore", () => ({
  useAuth: {
    getState: () => ({
      hasPermission: (perm: string) => perm === "view_patients",
    }),
  },
}));

const repo = vi.mocked(searchRepository, true);

describe("searchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters out entities the user cannot view", async () => {
    repo.searchGlobal.mockResolvedValue([
      { entity_type: "patient", entity_id: "00000000-0000-0000-0000-000000000001", label: "Patient A", sublabel: "PT-001", extra: null },
      { entity_type: "doctor", entity_id: "00000000-0000-0000-0000-000000000002", label: "Dr X", sublabel: "General", extra: null },
      { entity_type: "invoice", entity_id: "00000000-0000-0000-0000-000000000003", label: "INV-1", sublabel: "Consult", extra: null },
    ] as any);

    const result = await searchService.globalSearch({ term: "pa", limit: 8 });

    expect(result).toHaveLength(1);
    expect(result[0].entity_type).toBe("patient");
  });
});
