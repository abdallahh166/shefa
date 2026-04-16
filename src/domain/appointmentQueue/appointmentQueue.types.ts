import type { z } from "zod";
import {
  appointmentQueueSchema,
  appointmentQueueStatusEnum,
  appointmentQueueWithRelationsSchema,
} from "./appointmentQueue.schema";

export type AppointmentQueue = z.infer<typeof appointmentQueueSchema>;
export type AppointmentQueueStatus = z.infer<typeof appointmentQueueStatusEnum>;
export type AppointmentQueueWithRelations = z.infer<typeof appointmentQueueWithRelationsSchema>;
