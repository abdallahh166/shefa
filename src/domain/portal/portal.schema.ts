import { z } from "zod";
import { uuidSchema } from "../shared/identifiers.schema";

export const portalLoginInputSchema = z.object({
  clinicSlug: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  redirectTo: z.string().trim().url(),
});

export const portalLoginMetadataSchema = z.object({
  tenant_id: uuidSchema,
  patient_id: uuidSchema,
});
