/**
 * MedFlow Design System — Typography Tokens
 *
 * Scales follow a modular type ramp.
 * All sizes in rem; line-heights are unitless multipliers or rem values.
 */

export const fontFamilies = {
  sans:    "var(--font-sans)",    // Inter for LTR
  arabic:  "var(--font-arabic)",  // IBM Plex Sans Arabic for RTL
  mono:    "var(--font-mono)",    // used for IDs, codes, tabular numbers
} as const;

/** px → rem map for reference (base 16px) */
export const typeScale = {
  "2xs":  ["0.625rem",  { lineHeight: "0.875rem" }], // 10px / 14px  — sidebar role labels
  xs:     ["0.75rem",   { lineHeight: "1rem"     }], // 12px / 16px  — table headers, timestamps
  sm:     ["0.875rem",  { lineHeight: "1.25rem"  }], // 14px / 20px  — body default, table cells
  base:   ["1rem",      { lineHeight: "1.5rem"   }], // 16px / 24px  — form inputs, paragraphs
  lg:     ["1.125rem",  { lineHeight: "1.75rem"  }], // 18px / 28px  — card titles, section labels
  xl:     ["1.25rem",   { lineHeight: "1.75rem"  }], // 20px / 28px  — page titles
  "2xl":  ["1.5rem",    { lineHeight: "2rem"     }], // 24px / 32px  — modal headings
  "3xl":  ["1.875rem",  { lineHeight: "2.25rem"  }], // 30px / 36px  — KPI values
  "4xl":  ["2.25rem",   { lineHeight: "2.5rem"   }], // 36px / 40px  — landing hero
} as const;

export const fontWeights = {
  light:    "300",
  regular:  "400",
  medium:   "500",
  semibold: "600",
  bold:     "700",
} as const;

/**
 * Semantic typography roles.
 * Each role maps to a (size, weight, lineHeight) triple.
 * Use these in components rather than raw scale values.
 */
export const typographyRoles = {
  // Page & section headings
  pageTitle:     { size: "xl",   weight: "semibold", tracking: "tight"  },
  sectionTitle:  { size: "base", weight: "semibold", tracking: "normal" },
  cardTitle:     { size: "sm",   weight: "semibold", tracking: "normal" },

  // Body text
  bodyLg:        { size: "base", weight: "regular",  tracking: "normal" },
  body:          { size: "sm",   weight: "regular",  tracking: "normal" },
  bodySm:        { size: "xs",   weight: "regular",  tracking: "normal" },

  // Labels & metadata
  label:         { size: "sm",   weight: "medium",   tracking: "normal" },
  labelSm:       { size: "xs",   weight: "medium",   tracking: "normal" },
  caption:       { size: "xs",   weight: "regular",  tracking: "wide"   },
  overline:      { size: "2xs",  weight: "semibold", tracking: "widest" },

  // Data & numeric
  kpiValue:      { size: "2xl",  weight: "semibold", tracking: "tight",    mono: false },
  kpiValueLg:    { size: "3xl",  weight: "semibold", tracking: "tight",    mono: false },
  tableHeader:   { size: "xs",   weight: "medium",   tracking: "wide"   },
  tableCell:     { size: "sm",   weight: "regular",  tracking: "normal" },
  code:          { size: "sm",   weight: "regular",  tracking: "normal",   mono: true  },
} as const;
