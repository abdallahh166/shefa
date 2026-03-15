/**
 * MedFlow Design System — Shadow Tokens
 *
 * Shadows follow a 5-step elevation scale.
 * Light-mode shadows use rgba(0,0,0,alpha), dark-mode uses near-black bases.
 */
export const shadows = {
  none:   "none",
  xs:     "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  sm:     "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
  md:     "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)",
  lg:     "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)",
  xl:     "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.06)",
  "2xl":  "0 25px 50px -12px rgb(0 0 0 / 0.16)",
  // Special: border-substitute ring shadow (used instead of border on elevated surfaces)
  ring:   "0 0 0 1px hsl(var(--border))",
  // Focus ring (primary color)
  focus:  "0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring))",
} as const;

/**
 * MedFlow Design System — Border Radius Tokens
 */
export const radii = {
  none:   "0",
  sm:     "calc(var(--radius) - 4px)",  //  2px  — small tags
  md:     "calc(var(--radius) - 2px)",  //  4px  — inputs, small buttons
  DEFAULT:"var(--radius)",              //  6px  — buttons, badges
  lg:     "calc(var(--radius) + 2px)",  //  8px  — cards, modals
  xl:     "calc(var(--radius) + 6px)",  // 12px  — large cards, sidebar
  "2xl":  "calc(var(--radius) + 10px)", // 16px  — hero banners
  full:   "9999px",                      //       — pills, avatars
} as const;

/**
 * MedFlow Design System — Animation Tokens
 */
export const animation = {
  // Duration
  duration: {
    instant:  "75ms",
    fast:     "150ms",
    normal:   "200ms",
    slow:     "300ms",
    slower:   "500ms",
  },
  // Easing
  easing: {
    linear:      "linear",
    easeIn:      "cubic-bezier(0.4, 0, 1, 1)",
    easeOut:     "cubic-bezier(0, 0, 0.2, 1)",
    easeInOut:   "cubic-bezier(0.4, 0, 0.2, 1)",
    spring:      "cubic-bezier(0.34, 1.56, 0.64, 1)", // subtle bounce
    decelerate:  "cubic-bezier(0.0, 0.0, 0.2, 1)",
  },
  // Named transitions
  transitions: {
    colors:    "color, background-color, border-color, text-decoration-color, fill, stroke",
    transform: "transform",
    shadow:    "box-shadow",
    opacity:   "opacity",
    all:       "all",
  },
} as const;

/**
 * MedFlow Design System — Icon Size Tokens
 */
export const iconSizes = {
  "2xs":  "h-3 w-3",       // 12px — indicator dots, decorative
  xs:     "h-3.5 w-3.5",   // 14px — button icons (sm), topbar icons
  sm:     "h-4 w-4",       // 16px — default inline icons, table actions
  md:     "h-5 w-5",       // 20px — modal close, medium emphasis
  lg:     "h-6 w-6",       // 24px — page title icons, feature icons
  xl:     "h-8 w-8",       // 32px — empty-state icons
  "2xl":  "h-12 w-12",     // 48px — landing / hero icons
} as const;
