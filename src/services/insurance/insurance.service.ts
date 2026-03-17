import { z } from "zod";
import {
  insuranceClaimCreateSchema,
  insuranceClaimListParamsSchema,
  insuranceClaimSchema,
  insuranceClaimUpdateSchema,
  insuranceClaimWithPatientSchema,
  insuranceSummarySchema,
} from "@/domain/insurance/insurance.schema";
import { uuidSchema } from "@/domain/shared/identifiers.schema";
import type { InsuranceClaimCreateInput, InsuranceClaimListParams, InsuranceClaimUpdateInput } from "@/domain/insurance/insurance.types";
import { toServiceError } from "@/services/supabase/errors";
import { getTenantContext } from "@/services/supabase/tenant";
import { insuranceRepository } from "./insurance.repository";

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["processing"],
  processing: ["approved", "denied"],
  approved: ["reimbursed"],
  denied: [],
  reimbursed: [],
};

export const insuranceService = {
  async listPaged(params: InsuranceClaimListParams) {
    try {
      const parsed = insuranceClaimListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await insuranceRepository.listPaged(parsed, tenantId);
      const data = z.array(insuranceClaimSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load insurance claims");
    }
  },
  async listPagedWithRelations(params: InsuranceClaimListParams) {
    try {
      const parsed = insuranceClaimListParamsSchema.parse(params);
      const { tenantId } = getTenantContext();
      const result = await insuranceRepository.listPagedWithRelations(parsed, tenantId);
      const data = z.array(insuranceClaimWithPatientSchema).parse(result.data);
      const count = z.number().int().nonnegative().parse(result.count);
      return { data, count };
    } catch (err) {
      throw toServiceError(err, "Failed to load insurance claims");
    }
  },
  async getSummary() {
    try {
      const { tenantId } = getTenantContext();
      const result = await insuranceRepository.getSummary(tenantId);
      return insuranceSummarySchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to load insurance summary");
    }
  },
  async create(input: InsuranceClaimCreateInput) {
    try {
      const parsed = insuranceClaimCreateSchema.parse(input);
      const { tenantId } = getTenantContext();
      const result = await insuranceRepository.create(parsed, tenantId);
      return insuranceClaimSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to create insurance claim");
    }
  },
  async update(id: string, input: InsuranceClaimUpdateInput) {
    try {
      const parsedId = uuidSchema.parse(id);
      const parsed = insuranceClaimUpdateSchema.parse(input);
      const { tenantId } = getTenantContext();
      const updates: InsuranceClaimUpdateInput = { ...parsed };
      if (updates.status) {
        const current = await insuranceRepository.getById(parsedId, tenantId);
        if (current.status !== updates.status) {
          const allowed = ALLOWED_STATUS_TRANSITIONS[current.status] ?? [];
          if (!allowed.includes(updates.status)) {
            throw new Error(`Invalid insurance claim status transition: ${current.status} -> ${updates.status}`);
          }
        }

        const now = new Date().toISOString();
        if (updates.status === "submitted" && !updates.submitted_at) {
          updates.submitted_at = now;
        }
        if (updates.status === "approved" && !updates.approved_at) {
          updates.approved_at = now;
        }
        if (updates.status === "reimbursed" && !updates.reimbursed_at) {
          updates.reimbursed_at = now;
        }
      }

      const result = await insuranceRepository.update(parsedId, updates, tenantId);
      return insuranceClaimSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to update insurance claim");
    }
  },
  async archive(id: string) {
    try {
      const parsedId = uuidSchema.parse(id);
      const { tenantId, userId } = getTenantContext();
      const result = await insuranceRepository.archive(parsedId, tenantId, userId);
      return insuranceClaimSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to archive insurance claim");
    }
  },
  async restore(id: string) {
    try {
      const parsedId = uuidSchema.parse(id);
      const { tenantId } = getTenantContext();
      const result = await insuranceRepository.restore(parsedId, tenantId);
      return insuranceClaimSchema.parse(result);
    } catch (err) {
      throw toServiceError(err, "Failed to restore insurance claim");
    }
  },
};
