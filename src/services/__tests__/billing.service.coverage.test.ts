import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantId = "00000000-0000-0000-0000-000000000111";
const userId = "00000000-0000-0000-0000-000000000222";
const patientId = "00000000-0000-0000-0000-000000000333";
const invoiceId = "00000000-0000-0000-0000-000000000444";
const now = "2026-03-14T00:00:00.000Z";

const billingRepository = vi.hoisted(() => ({
  listPaged: vi.fn(),
  listPagedWithRelations: vi.fn(),
  getSummary: vi.fn(),
  countInRange: vi.fn(),
  listByDateRange: vi.fn(),
  listByPatient: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
}));

const rateLimitService = vi.hoisted(() => ({ assertAllowed: vi.fn() }));
const emitDomainEvent = vi.hoisted(() => vi.fn());

vi.mock("@/services/billing/billing.repository", () => ({ billingRepository }));
vi.mock("@/services/security/rateLimit.service", () => ({ rateLimitService }));
vi.mock("@/core/events", () => ({ emitDomainEvent }));
vi.mock("@/services/supabase/tenant", () => ({ getTenantContext: () => ({ tenantId, userId }) }));

import { billingService } from "@/services/billing/billing.service";

const invoice = {
  id: invoiceId,
  tenant_id: tenantId,
  patient_id: patientId,
  invoice_code: "INV-100",
  service: "Consult",
  amount: 120,
  invoice_date: "2026-03-10",
  status: "paid",
  deleted_at: null,
  deleted_by: null,
  created_at: now,
  updated_at: now,
};

describe("billingService coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingRepository.listPaged.mockResolvedValue({ data: [invoice], count: 1 });
    billingRepository.listPagedWithRelations.mockResolvedValue({
      data: [{ ...invoice, patients: { full_name: "Patient One" } }],
      count: 1,
    });
    billingRepository.getSummary.mockResolvedValue({
      total_count: 1,
      paid_count: 1,
      paid_amount: 120,
      pending_amount: 0,
    });
    billingRepository.countInRange.mockResolvedValue(1);
    billingRepository.listByDateRange.mockResolvedValue([invoice]);
    billingRepository.listByPatient.mockResolvedValue([invoice]);
    billingRepository.create.mockResolvedValue(invoice);
    billingRepository.update.mockResolvedValue(invoice);
    billingRepository.archive.mockResolvedValue(invoice);
    billingRepository.restore.mockResolvedValue(invoice);
    rateLimitService.assertAllowed.mockResolvedValue(undefined);
    emitDomainEvent.mockResolvedValue(undefined);
  });

  it("exercises billing service methods", async () => {
    await billingService.listPaged({ page: 1, pageSize: 10 });
    await billingService.listPagedWithRelations({ page: 1, pageSize: 10 });
    await billingService.getSummary();
    await billingService.countInRange("2026-03-01", "2026-03-31");
    await billingService.listByDateRange("2026-03-01", "2026-03-31", { limit: 10, offset: 0 });
    await billingService.listByPatient(patientId, { limit: 5, offset: 0 });
    await billingService.create({
      patient_id: patientId,
      invoice_code: "INV-101",
      service: "Exam",
      amount: 80,
      invoice_date: "2026-03-11",
      status: "pending",
    });
    await billingService.update(invoiceId, { status: "paid" });
    await billingService.archive(invoiceId);
    await billingService.restore(invoiceId);

    expect(rateLimitService.assertAllowed).toHaveBeenCalled();
    expect(emitDomainEvent).toHaveBeenCalled();
  });
});
