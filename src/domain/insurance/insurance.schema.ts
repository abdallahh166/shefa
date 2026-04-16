import { z } from "zod";
import { dateStringSchema, dateTimeStringSchema } from "../shared/date.schema";
import { listParamsSchema } from "../shared/pagination.schema";
import { uuidSchema } from "../shared/identifiers.schema";
import { appRoleEnum } from "../settings/roles.schema";

export const insuranceStatusEnum = z.enum([
  "draft",
  "submitted",
  "processing",
  "approved",
  "denied",
  "reimbursed",
]);

export const insuranceClaimAttachmentTypeEnum = z.enum([
  "eob",
  "corrected_claim",
  "prior_authorization",
  "eligibility",
  "referral",
  "payer_letter",
  "other",
]);

const fileSchema = z.custom<File>((value) => {
  if (typeof File === "undefined") return false;
  return value instanceof File;
});

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
  processing_started_at: dateTimeStringSchema.optional().nullable(),
  approved_at: dateTimeStringSchema.optional().nullable(),
  reimbursed_at: dateTimeStringSchema.optional().nullable(),
  payer_reference: z.string().trim().min(1).max(200).optional().nullable(),
  denial_reason: z.string().trim().max(1000).optional().nullable(),
  assigned_to_user_id: uuidSchema.optional().nullable(),
  internal_notes: z.string().trim().max(4000).optional().nullable(),
  payer_notes: z.string().trim().max(4000).optional().nullable(),
  last_follow_up_at: dateTimeStringSchema.optional().nullable(),
  next_follow_up_at: dateTimeStringSchema.optional().nullable(),
  resubmission_count: z.coerce.number().int().min(0).default(0),
  deleted_at: dateTimeStringSchema.optional().nullable(),
  deleted_by: uuidSchema.optional().nullable(),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});

export const insuranceClaimWithPatientSchema = insuranceClaimSchema.extend({
  patients: z.object({ full_name: z.string().trim().min(1) }).optional().nullable(),
  assigned_profile: z.object({ full_name: z.string().trim().min(1) }).optional().nullable(),
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

export const insuranceOperationsSummarySchema = z.object({
  open_claims_count: z.coerce.number().int().min(0),
  aged_0_7_count: z.coerce.number().int().min(0),
  aged_8_14_count: z.coerce.number().int().min(0),
  aged_15_plus_count: z.coerce.number().int().min(0),
  oldest_open_claim_days: z.coerce.number().int().min(0),
  denied_follow_up_count: z.coerce.number().int().min(0),
  follow_up_due_count: z.coerce.number().int().min(0),
  unassigned_open_count: z.coerce.number().int().min(0),
  stalled_processing_count: z.coerce.number().int().min(0),
});

export const insuranceAssignableOwnerSchema = z.object({
  user_id: uuidSchema,
  full_name: z.string().trim().min(1).max(200),
  role: appRoleEnum,
});

export const insuranceClaimAttachmentSchema = z.object({
  id: uuidSchema,
  claim_id: uuidSchema,
  tenant_id: uuidSchema,
  file_name: z.string().trim().min(1).max(255),
  file_path: z.string().trim().min(1),
  file_size: z.number().int().min(0),
  file_type: z.string().trim().min(1).max(120),
  attachment_type: insuranceClaimAttachmentTypeEnum,
  uploaded_by: uuidSchema,
  notes: z.string().trim().max(500).optional().nullable(),
  deleted_at: dateTimeStringSchema.optional().nullable(),
  deleted_by: uuidSchema.optional().nullable(),
  created_at: dateTimeStringSchema,
});

export const insuranceClaimAttachmentCreateSchema = insuranceClaimAttachmentSchema.omit({
  id: true,
  tenant_id: true,
  created_at: true,
});

export const insuranceClaimAttachmentUploadSchema = z.object({
  claim_id: uuidSchema,
  attachment_type: insuranceClaimAttachmentTypeEnum,
  file: fileSchema,
  notes: z.string().trim().max(500).optional().nullable(),
});
