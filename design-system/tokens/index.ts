/**
 * MedFlow Design System — Token Index
 *
 * Single import point for all design tokens.
 * Usage:
 *   import { tokens } from "@/design-system/tokens"
 *   import { colorTokens, shadows, iconSizes } from "@/design-system/tokens"
 */

export * from "./colors";
export * from "./typography";
export * from "./spacing";
export * from "./shadows";

import { colorTokens } from "./colors";
import { fontFamilies, typeScale, fontWeights, typographyRoles } from "./typography";
import { spacingScale, spacing, zIndex } from "./spacing";
import { shadows, radii, animation, iconSizes } from "./shadows";

/** Unified token object — useful for documentation / Storybook */
export const tokens = {
  color:       colorTokens,
  font:        fontFamilies,
  typeScale,
  fontWeights,
  typographyRoles,
  spacing:     spacingScale,
  spacingAlias: spacing,
  zIndex,
  shadow:      shadows,
  radius:      radii,
  animation,
  iconSize:    iconSizes,
} as const;

export type Tokens = typeof tokens;
