import { z } from "zod";
import { dateStringSchema, dateTimeStringSchema } from "../shared/date.schema";
import { listParamsSchema } from "../shared/pagination.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const insuranceStatusEnum = z.enum([
  "draft",
  "submitted",
  "processing",
  "approved",
  "denied",
  "reimbursed",
]);

export const insuranceClaimSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  patient_id: uuidSchema,
  provider: z.string().trim().min(2).max(120),
  service: z.string().trim().min(1).max(200),
  amount: z.coerce.number().min(0),
  claim_date: dateStringSchema,
  status: insuranceStatusEnum,
  submitted_at: dateTimeStringSchema.optional().nullable(),
  approved_at: dateTimeStringSchema.optional().nullable(),
  reimbursed_at: dateTimeStringSchema.optional().nullable(),
  payer_reference: z.string().trim().min(1).max(200).optional().nullable(),
  deleted_at: dateTimeStringSchema.optional().nullable(),
  deleted_by: uuidSchema.optional().nullable(),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});

export const insuranceClaimWithPatientSchema = insuranceClaimSchema.extend({
  patients: z.object({ full_name: z.string().trim().min(1) }).optional().nullable(),
});

export const insuranceClaimCreateSchema = insuranceClaimSchema
  .omit({
    id: true,
    tenant_id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    status: insuranceStatusEnum.optional(),
    claim_date: dateStringSchema.optional(),
  });

export const insuranceClaimUpdateSchema = insuranceClaimCreateSchema.partial();

export const insuranceClaimListParamsSchema = listParamsSchema;

export const insuranceSummarySchema = z.object({
  total_count: z.coerce.number().int().min(0),
  draft_count: z.coerce.number().int().min(0),
  submitted_count: z.coerce.number().int().min(0),
  processing_count: z.coerce.number().int().min(0),
  approved_count: z.coerce.number().int().min(0),
  denied_count: z.coerce.number().int().min(0),
  reimbursed_count: z.coerce.number().int().min(0),
  providers_count: z.coerce.number().int().min(0),
});
