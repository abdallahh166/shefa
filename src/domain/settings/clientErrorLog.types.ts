import type { z } from "zod";
import { clientErrorLogCreateSchema, clientErrorLogSchema } from "./clientErrorLog.schema";

export type ClientErrorLog = z.infer<typeof clientErrorLogSchema>;
export type ClientErrorLogCreateInput = z.infer<typeof clientErrorLogCreateSchema>;
