import { z } from "zod";
import { dateTimeStringSchema } from "../shared/date.schema";
import { uuidSchema } from "../shared/identifiers.schema";

export const auditLogSchema = z.object({
  id: uuidSchema,
  tenant_id: uuidSchema,
  user_id: uuidSchema,
  action: z.string().min(1),
  action_type: z.string().min(1).optional().nullable(),
  request_id: uuidSchema.optional().nullable(),
  entity_type: z.string().min(1),
  resource_type: z.string().min(1).optional().nullable(),
  entity_id: uuidSchema.optional().nullable(),
  details: z.record(z.unknown()).optional().nullable(),
  ip_address: z.string().optional().nullable(),
  created_at: dateTimeStringSchema,
});
