import type { z } from "zod";
import { portalLoginInputSchema, portalLoginMetadataSchema } from "./portal.schema";

export type PortalLoginInput = z.infer<typeof portalLoginInputSchema>;
export type PortalLoginMetadata = z.infer<typeof portalLoginMetadataSchema>;
