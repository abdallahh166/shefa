import { z } from "zod";

export const searchEntitySchema = z.enum(["patient", "doctor", "invoice"]);

export const searchResultSchema = z.object({
  entity_type: searchEntitySchema,
  entity_id: z.string().uuid(),
  label: z.string().min(1),
  sublabel: z.string().nullable(),
  extra: z.string().nullable(),
});

export const searchResultsSchema = z.array(searchResultSchema);

export const globalSearchInputSchema = z.object({
  term: z.string().trim().min(2).max(100),
  limit: z.number().int().min(1).max(20).optional(),
});
