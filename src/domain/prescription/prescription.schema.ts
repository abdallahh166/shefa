import { z } from "zod";
import { dateStringSchema, dateTimeStringSchema } from "../shared/date.schema";
import { listParamsSchema } from "../shared/pagination.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const prescriptionStatusEnum = z.enum(["active", "completed", "discontinued"]);

export const prescriptionSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  patient_id: uuidSchema,
  doctor_id: uuidSchema,
  medication: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(200),
  route: z.string().trim().min(1).max(120).optional().nullable(),
  frequency: z.string().trim().min(1).max(120).optional().nullable(),
  quantity: z.number().int().positive().optional().nullable(),
  refills: z.number().int().min(0).max(24).optional().nullable(),
  instructions: z.string().trim().max(2000).optional().nullable(),
  status: prescriptionStatusEnum,
  prescribed_date: dateStringSchema,
  end_date: dateStringSchema.optional().nullable(),
  discontinued_reason: z.string().trim().max(500).optional().nullable(),
  deleted_at: dateTimeStringSchema.optional().nullable(),
  deleted_by: uuidSchema.optional().nullable(),
  created_at: dateTimeStringSchema,
});

export const prescriptionWithDoctorSchema = prescriptionSchema.extend({
  doctors: z.object({ full_name: z.string().trim().min(1) }).optional().nullable(),
});

export const prescriptionCreateSchema = prescriptionSchema
  .omit({
    id: true,
    tenant_id: true,
    created_at: true,
  })
  .extend({
    status: prescriptionStatusEnum.optional(),
    prescribed_date: dateStringSchema.optional(),
    route: z.string().trim().min(1).max(120),
    frequency: z.string().trim().min(1).max(120),
    quantity: z.number().int().positive(),
    refills: z.number().int().min(0).max(24).optional().nullable(),
  });

export const prescriptionUpdateSchema = prescriptionCreateSchema.partial();

export const prescriptionListParamsSchema = listParamsSchema;
