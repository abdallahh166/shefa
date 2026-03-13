import { z } from "zod";
import {
  invoiceCreateSchema,
  invoiceListParamsSchema,
  invoiceSchema,
  invoiceSummarySchema,
  invoiceUpdateSchema,
  invoiceWithPatientSchema,
} from "@/domain/billing/billing.schema";
import { dateStringSchema } from "@/domain/shared/date.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { InvoiceCreateInput, InvoiceListParams, InvoiceUpdateInput } from "@/domain/billing/billing.types";
import type { LimitOffsetParams } from "@/domain/shared/pagination.types";
import { limitOffsetSchema } from "@/domain/shared/pagination.schema";
import { emitDomainEvent } from "@/core/events";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { rateLimitService } from "@/services/security/rateLimit.service";
import { billingRepository } from "./billing.repository";

export const billingService = {
  async listPaged(params: InvoiceListParams) {
    try {
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
      const { tenantId } = getTenantContext();
      const result = await billingRepository.getSummary(tenantId);
      return invoiceSummarySchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load invoice summary");
    }
  },
  async countInRange(start: string, end: string) {
    try {
      const { tenantId } = getTenantContext();
      const result = await billingRepository.countInRange(start, end, tenantId);
      return z.number().int().nonnegative().parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load invoices");
    }
  },
  async listByDateRange(start: string, end: string, params?: LimitOffsetParams) {
    try {
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
      const parsedId = uuidSchema.parse(patientId);
      const paging = limitOffsetSchema.parse(params ?? {});
      const { tenantId } = getTenantContext();
      const result = await billingRepository.listByPatient(parsedId, tenantId, paging);
      return z.array(invoiceSchema).parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load patient invoices");
    }
  },
  async create(input: InvoiceCreateInput) {
    try {
      const parsed = invoiceCreateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      await rateLimitService.assertAllowed("invoice_create", [tenantId, userId]);
      const result = await billingRepository.create(parsed, tenantId);
      return invoiceSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to create invoice");
    }
  },
  async update(id: string, input: InvoiceUpdateInput) {
    try {
      const parsedId = uuidSchema.parse(id);
      const parsed = invoiceUpdateSchema.parse(input);
      const { tenantId, userId } = getTenantContext();
      const result = await billingRepository.update(parsedId, parsed, tenantId);
      const invoice = invoiceSchema.parse(result);
      if (parsed.status === "paid") {
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
  async archive(id: string) {
    try {
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await billingRepository.archive(parsedId, tenantId, userId);
      return invoiceSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to archive invoice");
    }
  },
  async restore(id: string) {
    try {
      const parsedId = uuidSchema.parse(id);
      const { tenantId } = getTenantContext();
      const result = await billingRepository.restore(parsedId, tenantId);
      return invoiceSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to restore invoice");
    }
  },
};
