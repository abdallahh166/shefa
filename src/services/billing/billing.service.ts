import { z } from "zod";
import {
  invoiceCreateSchema,
  invoiceListParamsSchema,
  invoicePaymentCreateSchema,
  invoicePaymentSchema,
  invoiceSchema,
  invoiceSummarySchema,
  invoiceUpdateSchema,
  invoiceWithPatientSchema,
} from "@/domain/billing/billing.schema";
import { dateStringSchema } from "@/domain/shared/date.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type {
  Invoice,
  InvoiceCreateInput,
  InvoiceListParams,
  InvoicePaymentCreateInput,
  InvoiceUpdateInput,
} from "@/domain/billing/billing.types";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { limitOffsetSchema } from "@/domain/shared/pagination.schema";
import { emitDomainEvent } from "@/core/events";
import { assertAnyPermission } from "@/services/supabase/permissions";
import { featureAccessService } from "@/services/subscription/featureAccess.service";
import { BusinessRuleError, toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { auditLogService } from "@/services/settings/audit.service";
import { rateLimitService } from "@/services/security/rateLimit.service";
import { billingRepository } from "./billing.repository";

const INVOICE_STATUS_TRANSITIONS: Record<
  Invoice["status"],
  Array<Invoice["status"]>
> = {
  pending: ["overdue", "void"],
  overdue: ["pending", "void"],
  partially_paid: ["overdue", "void"],
  paid: [],
  void: [],
};

const todayDateKey = () => new Date().toISOString().slice(0, 10);

function toMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function deriveInvoiceStatus(totalAmount: number, amountPaid: number, dueDate?: string | null, voidedAt?: string | null): Invoice["status"] {
  if (voidedAt) return "void";
  if (amountPaid >= totalAmount) return "paid";
  if (amountPaid > 0) return "partially_paid";
  if (dueDate && dueDate < todayDateKey()) return "overdue";
  return "pending";
}

function normalizeInvoiceAmounts(totalAmount: number, amountPaid: number) {
  const safeTotal = toMoney(totalAmount);
  const safePaid = toMoney(amountPaid);
  const safeBalance = toMoney(Math.max(0, safeTotal - safePaid));
  return {
    totalAmount: safeTotal,
    amountPaid: safePaid,
    balanceDue: safeBalance,
  };
}

function assertInvoiceStatusTransition(current: Invoice["status"], next: Invoice["status"], existing: Invoice, input: InvoiceUpdateInput) {
  if (current === next) return;

  if (!INVOICE_STATUS_TRANSITIONS[current].includes(next)) {
    throw new BusinessRuleError(`Cannot move invoice from ${current} to ${next}`, {
      code: "INVOICE_STATUS_TRANSITION_INVALID",
      details: { currentStatus: current, nextStatus: next },
    });
  }

  if (next === "void") {
    if ((existing.amount_paid ?? 0) > 0) {
      throw new BusinessRuleError("Invoices with posted payments cannot be voided", {
        code: "INVOICE_VOID_WITH_PAYMENTS_FORBIDDEN",
      });
    }
    if (!input.void_reason?.trim()) {
      throw new BusinessRuleError("Voided invoices require a reason", {
        code: "INVOICE_VOID_REASON_REQUIRED",
      });
    }
  }
}

export const billingService = {
  async listPaged(params: InvoiceListParams) {
    try {
      assertAnyPermission(["view_billing", "manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsed = invoiceListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await billingRepository.listPaged(parsed, tenantId);
      const data = z.array(invoiceSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load invoices");
    }
  },
  async listPagedWithRelations(params: InvoiceListParams) {
    try {
      assertAnyPermission(["view_billing", "manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsed = invoiceListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await billingRepository.listPagedWithRelations(parsed, tenantId);
      const data = z.array(invoiceWithPatientSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load invoices");
    }
  },
  async getSummary() {
    try {
      assertAnyPermission(["view_billing", "manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const { tenantId } = getTenantContext();
      const result = await billingRepository.getSummary(tenantId);
      return invoiceSummarySchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load invoice summary");
    }
  },
  async countInRange(start: string, end: string) {
    try {
      assertAnyPermission(["view_billing", "manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const { tenantId } = getTenantContext();
      const result = await billingRepository.countInRange(start, end, tenantId);
      return z.number().int().nonnegative().parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load invoices");
    }
  },
  async listByDateRange(start: string, end: string, params?: LimitOffsetParams) {
    try {
      assertAnyPermission(["view_billing", "manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsedStart = dateStringSchema.parse(start);
      const parsedEnd = dateStringSchema.parse(end);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const result = await billingRepository.listByDateRange(parsedStart, parsedEnd, tenantId, paging);
      return z.array(invoiceSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load invoices");
    }
  },
  async listByPatient(patientId: string, params?: LimitOffsetParams) {
    try {
      assertAnyPermission(["view_billing", "manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsedId = uuidSchema.parse(patientId);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const result = await billingRepository.listByPatient(parsedId, tenantId, paging);
      return z.array(invoiceSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load patient invoices");
    }
  },
  async listPayments(invoiceId: string) {
    try {
      assertAnyPermission(["view_billing", "manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsedId = uuidSchema.parse(invoiceId);
      const { tenantId } = getTenantContext();
      const result = await billingRepository.listPayments(parsedId, tenantId);
      return z.array(invoicePaymentSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load invoice payments");
    }
  },
  async create(input: InvoiceCreateInput) {
    try {
      assertAnyPermission(["manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsed = invoiceCreateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      await rateLimitService.assertAllowed("invoice_create", [tenantId, userId]);

      const totalAmount = toMoney(Number(parsed.amount));
      const amountPaid = parsed.status === "paid" ? totalAmount : 0;
      const { balanceDue } = normalizeInvoiceAmounts(totalAmount, amountPaid);
      const normalizedStatus = deriveInvoiceStatus(totalAmount, amountPaid, parsed.due_date ?? null, null);
      const paidAt = normalizedStatus === "paid" ? new Date().toISOString() : null;

      const result = await billingRepository.create({
        ...parsed,
        amount: totalAmount,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        paid_at: paidAt,
        status: normalizedStatus,
      }, tenantId);
      const invoice = invoiceSchema.parse(result);

      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "invoice_created",
        action_type: "invoice_create",
        entity_type: "invoice",
        entity_id: invoice.id,
        details: {
          patient_id: invoice.patient_id,
          invoice_code: invoice.invoice_code,
          amount: invoice.amount,
          due_date: invoice.due_date,
          status: invoice.status,
        },
      });

      if (invoice.status === "paid") {
        await emitDomainEvent(
          "InvoicePaid",
          {
            invoiceId: invoice.id,
            patientId: invoice.patient_id,
            amount: Number(invoice.amount),
          },
          { tenantId, userId },
        );
      }

      return invoice;
    } catch (err) {
      throw toServiceError(err, "Failed to create invoice");
    }
  },
  async update(id: string, input: InvoiceUpdateInput) {
    try {
      assertAnyPermission(["manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsedId = uuidSchema.parse(id);
      const parsed = invoiceUpdateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const existing = invoiceSchema.parse(await billingRepository.getById(parsedId, tenantId));

      if (parsed.status !== undefined) {
        assertInvoiceStatusTransition(existing.status, parsed.status, existing, parsed);
      }

      const totalAmount = parsed.amount !== undefined ? toMoney(Number(parsed.amount)) : Number(existing.amount);
      const amountPaid = parsed.amount_paid !== undefined ? toMoney(Number(parsed.amount_paid)) : Number(existing.amount_paid);
      if (amountPaid > totalAmount) {
        throw new BusinessRuleError("Amount paid cannot exceed the invoice total", {
          code: "INVOICE_AMOUNT_PAID_EXCEEDS_TOTAL",
        });
      }

      const { balanceDue } = normalizeInvoiceAmounts(totalAmount, amountPaid);
      const voidedAt = parsed.status === "void"
        ? (parsed.voided_at ?? existing.voided_at ?? new Date().toISOString())
        : parsed.voided_at ?? existing.voided_at ?? null;

      const normalizedStatus = parsed.status === "void"
        ? "void"
        : deriveInvoiceStatus(totalAmount, amountPaid, parsed.due_date ?? existing.due_date ?? null, null);

      const normalizedUpdate: InvoiceUpdateInput = {
        ...parsed,
        amount: totalAmount,
        amount_paid: amountPaid,
        balance_due: normalizedStatus === "void" ? 0 : balanceDue,
        status: normalizedStatus,
        paid_at: normalizedStatus === "paid"
          ? parsed.paid_at ?? existing.paid_at ?? new Date().toISOString()
          : normalizedStatus === "void"
            ? null
            : parsed.paid_at ?? existing.paid_at ?? null,
        voided_at: normalizedStatus === "void" ? voidedAt : null,
      };

      const result = await billingRepository.update(parsedId, normalizedUpdate, tenantId);
      const invoice = invoiceSchema.parse(result);

      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "invoice_updated",
        action_type: "invoice_update",
        entity_type: "invoice",
        entity_id: invoice.id,
        details: normalizedUpdate as Record<string, unknown>,
      });

      if (existing.status !== "paid" && invoice.status === "paid") {
        await emitDomainEvent(
          "InvoicePaid",
          {
            invoiceId: invoice.id,
            patientId: invoice.patient_id,
            amount: Number(invoice.amount),
          },
          { tenantId, userId },
        );
      }

      return invoice;
    } catch (err) {
      throw toServiceError(err, "Failed to update invoice");
    }
  },
  async postPayment(invoiceId: string, input: InvoicePaymentCreateInput) {
    try {
      assertAnyPermission(["manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsedId = uuidSchema.parse(invoiceId);
      const parsed = invoicePaymentCreateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const existing = invoiceSchema.parse(await billingRepository.getById(parsedId, tenantId));

      if (existing.status === "void") {
        throw new BusinessRuleError("Voided invoices cannot accept payments", {
          code: "INVOICE_VOID_PAYMENT_FORBIDDEN",
        });
      }
      if (existing.status === "paid" || Number(existing.balance_due) <= 0) {
        throw new BusinessRuleError("Paid invoices cannot accept additional payments", {
          code: "INVOICE_ALREADY_PAID",
        });
      }

      const paymentAmount = toMoney(Number(parsed.amount));
      if (paymentAmount > Number(existing.balance_due)) {
        throw new BusinessRuleError("Payment amount cannot exceed the outstanding balance", {
          code: "PAYMENT_EXCEEDS_BALANCE",
        });
      }

      await rateLimitService.assertAllowed("invoice_payment_post", [tenantId, userId]);

      const payment = invoicePaymentSchema.parse(
        await billingRepository.createPayment(parsedId, existing.patient_id, {
          ...parsed,
          amount: paymentAmount,
          paid_at: parsed.paid_at ?? new Date().toISOString(),
        }, tenantId, userId),
      );

      const amountPaid = toMoney(Number(existing.amount_paid) + paymentAmount);
      const { balanceDue } = normalizeInvoiceAmounts(Number(existing.amount), amountPaid);
      const nextStatus = deriveInvoiceStatus(Number(existing.amount), amountPaid, existing.due_date ?? null, null);

      const invoice = invoiceSchema.parse(
        await billingRepository.update(parsedId, {
          amount_paid: amountPaid,
          balance_due: balanceDue,
          status: nextStatus,
          paid_at: nextStatus === "paid" ? payment.paid_at : existing.paid_at ?? null,
        }, tenantId),
      );

      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "invoice_payment_posted",
        action_type: "invoice_payment_create",
        entity_type: "invoice_payment",
        entity_id: payment.id,
        details: {
          invoice_id: invoice.id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          balance_due: invoice.balance_due,
          status: invoice.status,
        },
      });

      if (existing.status !== "paid" && invoice.status === "paid") {
        await emitDomainEvent(
          "InvoicePaid",
          {
            invoiceId: invoice.id,
            patientId: invoice.patient_id,
            amount: Number(payment.amount),
          },
          { tenantId, userId },
        );
      }

      return { invoice, payment };
    } catch (err) {
      throw toServiceError(err, "Failed to post invoice payment");
    }
  },
  async voidInvoice(id: string, reason: string) {
    try {
      assertAnyPermission(["manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsedId = uuidSchema.parse(id);
      const safeReason = z.string().trim().min(3).max(500).parse(reason);
      const { tenantId } = getTenantContext();
      return await this.update(parsedId, {
        status: "void",
        void_reason: safeReason,
        voided_at: new Date().toISOString(),
      });
    } catch (err) {
      throw toServiceError(err, "Failed to void invoice");
    }
  },
  async archive(id: string) {
    try {
      assertAnyPermission(["manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await billingRepository.archive(parsedId, tenantId, userId);
      const invoice = invoiceSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "invoice_archived",
        action_type: "invoice_archive",
        entity_type: "invoice",
        entity_id: invoice.id,
      });
      return invoice;
    } catch (err) {
      throw toServiceError(err, "Failed to archive invoice");
    }
  },
  async restore(id: string) {
    try {
      assertAnyPermission(["manage_billing"]);
      await featureAccessService.assertFeatureAccess("billing");
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await billingRepository.restore(parsedId, tenantId);
      const invoice = invoiceSchema.parse(result);
      await auditLogService.logEvent({
        tenant_id: tenantId,
        user_id: userId,
        action: "invoice_restored",
        action_type: "invoice_restore",
        entity_type: "invoice",
        entity_id: invoice.id,
      });
      return invoice;
    } catch (err) {
      throw toServiceError(err, "Failed to restore invoice");
    }
  },
};
