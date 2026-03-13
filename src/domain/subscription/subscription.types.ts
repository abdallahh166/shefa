import type { z } from "zod";
import { subscriptionSchema, subscriptionSummarySchema } from "./subscription.schema";

export type Subscription = z.infer<typeof subscriptionSchema>;
export type SubscriptionSummary = z.infer<typeof subscriptionSummarySchema>;
