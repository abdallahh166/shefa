import { z } from "zod";
import { featureFlagSchema, featureFlagUpsertSchema } from "./featureFlag.schema";

export type FeatureFlag = z.infer<typeof featureFlagSchema>;
export type FeatureFlagKey = FeatureFlag["feature_key"];
export type FeatureFlagUpsertInput = z.infer<typeof featureFlagUpsertSchema>;
