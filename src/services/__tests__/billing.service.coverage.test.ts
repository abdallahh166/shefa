import { beforeEach, describe, expect, it, vi } from "vitest";
import { billingRepository } from "@/services/billing/billing.repository";
import { featureAccessService } from "@/services/subscription/featureAccess.service";

const tenantId = "00000000-0000-0000-0000-000000000111";
const userId = "00000000-0000-0000-0000-000000000222";
const patientId = "00000000-0000-0000-0000-000000000333";
const invoiceId = "00000000-0000-0000-0000-000000000444";
const paymentId = "00000000-0000-0000-0000-000000000555";
const futureDueDate = "2099-04-20";

const emitDomainEvent = vi.hoisted(() => vi.fn());

vi.mock("@/services/billing/billing.repository", () => ({
  billingRepository: {
    listPaged: vi.fn(),
    listPagedWithRelations: vi.fn(),
    getSummary: vi.fn(),
    countInRange: vi.fn(),
    listByDateRange: vi.fn(),
    listByPatient: vi.fn(),
    getById: vi.fn(),
    listPayments: vi.fn(),
    create: vi.fn(),
    createPayment: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock("@/core/events", () => ({
  emitDomainEvent,
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

vi.mock("@/services/security/rateLimit.service", () => ({
  rateLimitService: {
    assertAllowed: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/services/subscription/featureAccess.service", () => ({
  featureAccessService: {
    assertFeatureAccess: vi.fn().mockResolvedValue(undefined),
  },
}));

const buildInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: invoiceId,
  tenant_id: tenantId,
  patient_id: patientId,
  invoice_code: "INV-100",
  service: "Consultation",
  amount: 120,
  amount_paid: 0,
  balance_due: 120,
  invoice_date: "2026-04-16",
  due_date: "2026-04-20",
  paid_at: null,
  voided_at: null,
  void_reason: null,
  status: "pending",
  deleted_at: null,
  deleted_by: null,
  created_at: "2026-04-16T08:00:00.000Z",
  updated_at: "2026-04-16T08:00:00.000Z",
  ...overrides,
});

describe("billingService permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    emitDomainEvent.mockResolvedValue(undefined);
    vi.mocked(featureAccessService, true).assertFeatureAccess.mockResolvedValue(undefined);
  });

  it("blocks list when lacking billing permissions", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => false }),
      },
    }));
    const { billingService } = await import("@/services/billing/billing.service");

    await expect(
      billingService.listPaged({ page: 1, pageSize: 10 }),
    ).rejects.toThrow("Not authorized");
  });

  it("blocks billing access when the subscription does not include billing", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));
    vi.mocked(featureAccessService, true).assertFeatureAccess.mockRejectedValue(
      new Error("Billing is not available on the current subscription."),
    );

    const { billingService } = await import("@/services/billing/billing.service");

    await expect(
      billingService.listPaged({ page: 1, pageSize: 10 }),
    ).rejects.toThrow("Billing is not available on the current subscription.");

    expect(vi.mocked(billingRepository, true).listPaged).not.toHaveBeenCalled();
  });

  it("creates a pending invoice with derived balances", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));

    const repo = vi.mocked(billingRepository, true);
    repo.create.mockResolvedValue(buildInvoice());

    const { billingService } = await import("@/services/billing/billing.service");

    await billingService.create({
      patient_id: patientId,
      invoice_code: "INV-101",
      service: "ECG",
      amount: 120,
      due_date: futureDueDate,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 120,
        amount_paid: 0,
        balance_due: 120,
        status: "pending",
        due_date: futureDueDate,
      }),
      tenantId,
    );
    expect(emitDomainEvent).not.toHaveBeenCalled();
  });

  it("posts a partial payment and keeps the invoice partially paid", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));

    const repo = vi.mocked(billingRepository, true);
    repo.getById.mockResolvedValue(buildInvoice());
    repo.createPayment.mockResolvedValue({
      id: paymentId,
      tenant_id: tenantId,
      invoice_id: invoiceId,
      patient_id: patientId,
      amount: 40,
      payment_method: "cash",
      paid_at: "2026-04-16T09:00:00.000Z",
      reference: "RCPT-1",
      notes: "Front desk collected cash",
      created_at: "2026-04-16T09:00:00.000Z",
      created_by: userId,
    });
    repo.update.mockResolvedValue(buildInvoice({
      amount_paid: 40,
      balance_due: 80,
      status: "partially_paid",
      paid_at: null,
    }));

    const { billingService } = await import("@/services/billing/billing.service");
    const result = await billingService.postPayment(invoiceId, {
      amount: 40,
      payment_method: "cash",
      paid_at: "2026-04-16T09:00:00.000Z",
      reference: "RCPT-1",
    });

    expect(repo.createPayment).toHaveBeenCalledWith(
      invoiceId,
      patientId,
      expect.objectContaining({
        amount: 40,
        payment_method: "cash",
      }),
      tenantId,
      userId,
    );
    expect(result.invoice.status).toBe("partially_paid");
    expect(result.invoice.balance_due).toBe(80);
    expect(emitDomainEvent).not.toHaveBeenCalled();
  });

  it("emits InvoicePaid when a posted payment settles the invoice", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));

    const repo = vi.mocked(billingRepository, true);
    repo.getById.mockResolvedValue(buildInvoice({
      amount_paid: 30,
      balance_due: 90,
      status: "partially_paid",
    }));
    repo.createPayment.mockResolvedValue({
      id: paymentId,
      tenant_id: tenantId,
      invoice_id: invoiceId,
      patient_id: patientId,
      amount: 90,
      payment_method: "card",
      paid_at: "2026-04-16T10:00:00.000Z",
      reference: "CARD-100",
      notes: null,
      created_at: "2026-04-16T10:00:00.000Z",
      created_by: userId,
    });
    repo.update.mockResolvedValue(buildInvoice({
      amount_paid: 120,
      balance_due: 0,
      status: "paid",
      paid_at: "2026-04-16T10:00:00.000Z",
    }));

    const { billingService } = await import("@/services/billing/billing.service");
    const result = await billingService.postPayment(invoiceId, {
      amount: 90,
      payment_method: "card",
      paid_at: "2026-04-16T10:00:00.000Z",
      reference: "CARD-100",
    });

    expect(result.invoice.status).toBe("paid");
    expect(result.invoice.balance_due).toBe(0);
    expect(emitDomainEvent).toHaveBeenCalledWith(
      "InvoicePaid",
      expect.objectContaining({
        invoiceId,
        patientId,
        amount: 90,
      }),
      expect.any(Object),
    );
  });

  it("blocks voiding an invoice that already has posted payments", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));

    const repo = vi.mocked(billingRepository, true);
    repo.getById.mockResolvedValue(buildInvoice({
      amount_paid: 10,
      balance_due: 110,
      status: "partially_paid",
    }));

    const { billingService } = await import("@/services/billing/billing.service");

    await expect(
      billingService.update(invoiceId, {
        status: "void",
        void_reason: "Entered for the wrong patient",
      }),
    ).rejects.toThrow("Invoices with posted payments cannot be voided");
  });

  it("voids an unpaid invoice when a reason is provided", async () => {
    vi.doMock("@/core/auth/authStore", () => ({
      useAuth: {
        getState: () => ({ hasPermission: () => true }),
      },
    }));

    const repo = vi.mocked(billingRepository, true);
    repo.getById.mockResolvedValue(buildInvoice({
      status: "pending",
      amount_paid: 0,
      balance_due: 120,
    }));
    repo.update.mockResolvedValue(buildInvoice({
      status: "void",
      amount_paid: 0,
      balance_due: 0,
      void_reason: "Duplicate invoice created at reception",
      voided_at: "2026-04-16T11:00:00.000Z",
    }));

    const { billingService } = await import("@/services/billing/billing.service");
    const result = await billingService.voidInvoice(
      invoiceId,
      "Duplicate invoice created at reception",
    );

    expect(repo.update).toHaveBeenCalledWith(
      invoiceId,
      expect.objectContaining({
        status: "void",
        balance_due: 0,
        void_reason: "Duplicate invoice created at reception",
      }),
      tenantId,
    );
    expect(result.status).toBe("void");
    expect(result.balance_due).toBe(0);
  });
});
