import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const clientErrorLogSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  user_id: uuidSchema,
  request_id: uuidSchema.optional().nullable(),
  action_type: z.string().trim().max(100).optional().nullable(),
  resource_type: z.string().trim().max(100).optional().nullable(),
  message: z.string().trim().min(1).max(5000),
  stack: z.string().trim().max(10000).optional().nullable(),
  component_stack: z.string().trim().max(10000).optional().nullable(),
  url: z.string().trim().max(500).optional().nullable(),
  user_agent: z.string().trim().max(500).optional().nullable(),
  created_at: dateTimeStringSchema,
});

export const clientErrorLogCreateSchema = clientErrorLogSchema.omit({
  id: true,
  created_at: true,
});
