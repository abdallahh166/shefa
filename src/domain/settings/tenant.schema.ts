import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const tenantStatusEnum = z.enum(["active", "suspended", "deactivated"]);

export const tenantSchema = z.object({
  id: uuidSchema,
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(3).max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().min(1).max(300).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  pending_owner_email: z.string().trim().email().optional().nullable(),
  status: tenantStatusEnum,
  status_reason: z.string().trim().max(500).optional().nullable(),
  status_changed_at: dateTimeStringSchema.optional().nullable(),
  created_at: dateTimeStringSchema,
  updated_at: dateTimeStringSchema,
});

export const tenantUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(3).max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().min(1).max(300).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  pending_owner_email: z.string().trim().email().optional().nullable(),
});
