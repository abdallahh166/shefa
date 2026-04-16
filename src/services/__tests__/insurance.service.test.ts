import { beforeEach, describe, expect, it, vi } from "vitest";
import { insuranceRepository } from "@/services/insurance/insurance.repository";

const tenantId = "00000000-0000-0000-0000-000000000111";
const userId = "00000000-0000-0000-0000-000000000222";
const patientId = "00000000-0000-0000-0000-000000000333";
const claimId = "00000000-0000-0000-0000-000000000444";

vi.mock("@/services/insurance/insurance.repository", () => ({
  insuranceRepository: {
    listPaged: vi.fn(),
    listPagedWithRelations: vi.fn(),
    getSummary: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock("@/services/supabase/tenant", () => ({
  getTenantContext: () => ({
    tenantId,
    userId,
  }),
}));

vi.mock("@/services/settings/audit.service", () => ({
  auditLogService: {
    logEvent: vi.fn(),
  },
}));

const buildClaim = (overrides: Record<string, unknown> = {}) => ({
  id: claimId,
  tenant_id: tenantId,
  patient_id: patientId,
  provider: "National Health Co.",
  service: "Cardiology consultation",
  amount: 250,
  claim_date: "2026-04-16",
  status: "draft",
  submitted_at: null,
  processing_started_at: null,
  approved_at: null,
  reimbursed_at: null,
  payer_reference: null,
  denial_reason: null,
  deleted_at: null,
  deleted_by: null,
  created_at: "2026-04-16T08:00:00.000Z",
  updated_at: "2026-04-16T08:00:00.000Z",
  ...overrides,
});

describe("insuranceService workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("blocks list when lacking billing permissions", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => false }),
      },
    }));
    const { insuranceService } = await import("@/services/insurance/insurance.service");

    await expect(
      insuranceService.listPaged({ page: 1, pageSize: 10 }),
    ).rejects.toThrow("Not authorized");
  });

  it("creates draft claims by default", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(insuranceRepository, true);
    repo.create.mockResolvedValue(buildClaim());

    const { insuranceService } = await import("@/services/insurance/insurance.service");

    await insuranceService.create({
      patient_id: patientId,
      provider: "National Health Co.",
      service: "Cardiology consultation",
      amount: 250,
      claim_date: "2026-04-16",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        submitted_at: null,
        processing_started_at: null,
        denial_reason: null,
      }),
      tenantId,
    );
  });

  it("sets submitted_at when a draft claim is submitted", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(insuranceRepository, true);
    repo.getById.mockResolvedValue(buildClaim());
    repo.update.mockResolvedValue(buildClaim({
      status: "submitted",
      submitted_at: "2026-04-16T09:00:00.000Z",
    }));

    const { insuranceService } = await import("@/services/insurance/insurance.service");

    await insuranceService.update(claimId, { status: "submitted" });

    expect(repo.update).toHaveBeenCalledWith(
      claimId,
      expect.objectContaining({
        status: "submitted",
        submitted_at: expect.any(String),
        denial_reason: null,
      }),
      tenantId,
    );
  });

  it("requires a denial reason when denying a claim", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(insuranceRepository, true);
    repo.getById.mockResolvedValue(buildClaim({
      status: "processing",
      submitted_at: "2026-04-16T09:00:00.000Z",
      processing_started_at: "2026-04-16T10:00:00.000Z",
    }));

    const { insuranceService } = await import("@/services/insurance/insurance.service");

    await expect(
      insuranceService.update(claimId, { status: "denied" }),
    ).rejects.toThrow("Denied claims require a denial reason");
  });

  it("requires a payer reference before reimbursement", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(insuranceRepository, true);
    repo.getById.mockResolvedValue(buildClaim({
      status: "approved",
      submitted_at: "2026-04-16T09:00:00.000Z",
      processing_started_at: "2026-04-16T10:00:00.000Z",
      approved_at: "2026-04-16T12:00:00.000Z",
    }));

    const { insuranceService } = await import("@/services/insurance/insurance.service");

    await expect(
      insuranceService.update(claimId, { status: "reimbursed" }),
    ).rejects.toThrow("Reimbursed claims require a payer reference");
  });

  it("blocks skipping straight from submitted to approved", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    const repo = vi.mocked(insuranceRepository, true);
    repo.getById.mockResolvedValue(buildClaim({
      status: "submitted",
      submitted_at: "2026-04-16T09:00:00.000Z",
    }));

    const { insuranceService } = await import("@/services/insurance/insurance.service");

    await expect(
      insuranceService.update(claimId, { status: "approved" }),
    ).rejects.toThrow("Invalid insurance claim status transition: submitted -> approved");
  });
});
