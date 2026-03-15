/**
 * MedFlow Design System — Spacing Tokens
 *
 * Spacing follows Tailwind's default 4px (0.25rem) base unit.
 * These named aliases make intention explicit at the component level.
 */

/** Raw spacing scale (extends Tailwind defaults — no overrides needed) */
export const spacingScale = {
  px:   "1px",
  0:    "0",
  0.5:  "0.125rem",  //  2px
  1:    "0.25rem",   //  4px
  1.5:  "0.375rem",  //  6px
  2:    "0.5rem",    //  8px
  2.5:  "0.625rem",  // 10px
  3:    "0.75rem",   // 12px
  3.5:  "0.875rem",  // 14px
  4:    "1rem",      // 16px
  5:    "1.25rem",   // 20px
  6:    "1.5rem",    // 24px
  7:    "1.75rem",   // 28px
  8:    "2rem",      // 32px
  9:    "2.25rem",   // 36px
  10:   "2.5rem",    // 40px
  11:   "2.75rem",   // 44px
  12:   "3rem",      // 48px
  14:   "3.5rem",    // 56px
  16:   "4rem",      // 64px
  20:   "5rem",      // 80px
  24:   "6rem",      // 96px
} as const;

/**
 * Semantic spacing aliases used in component APIs.
 * Import these when hardcoding Tailwind classes isn't possible.
 */
export const spacing = {
  // Icon-to-text / inline gaps
  iconGapSm:  "gap-1.5",   //  6px
  iconGap:    "gap-2",     //  8px
  iconGapLg:  "gap-2.5",   // 10px

  // Internal component padding
  paddingXs:  "p-1.5",     //  6px — compact chips, small badges
  paddingSm:  "p-2",       //  8px — table action buttons
  paddingMd:  "p-3",       // 12px — filter strips, small cards
  paddingLg:  "p-4",       // 16px — standard card padding (mobile)
  paddingXl:  "p-5",       // 20px — standard card padding (desktop)
  padding2xl: "p-6",       // 24px — page padding (desktop)

  // Vertical section rhythm
  sectionGap: "space-y-5", // 20px between page sections
  cardGap:    "gap-4",     // 16px between sibling cards
  formGap:    "space-y-4", // 16px between form fields
  fieldGap:   "space-y-2", //  8px between label and input

  // Page layout
  pageX:      "px-4 lg:px-6",
  pageY:      "py-4 lg:py-6",
  headerH:    "h-14",       // 56px topbar height
  sidebarW:   "w-[240px]",  // sidebar width
  sidebarWIcon: "w-12",     // icon-only collapse width
} as const;

/** z-index scale — prevents z-index wars */
export const zIndex = {
  base:       0,
  raised:     1,      // raised cards, sticky headers
  dropdown:   50,     // dropdowns, popovers
  sticky:     60,     // sticky table headers
  overlay:    70,     // modal backdrops
  modal:      80,     // modal dialogs
  notification: 90,   // toasts, alerts
  tooltip:    100,    // tooltips (always on top)
} as const;
