import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const notificationSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  user_id: uuidSchema,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional().nullable(),
  type: z.string().trim().min(1).max(50),
  read: z.boolean(),
  created_at: dateTimeStringSchema,
});

export const notificationMarkReadSchema = z.object({
  id: uuidSchema,
});

export const notificationCreateSchema = z.object({
  tenant_id: uuidSchema,
  user_id: uuidSchema,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional().nullable(),
  type: z.string().trim().min(1).max(50),
  read: z.boolean().optional(),
});
