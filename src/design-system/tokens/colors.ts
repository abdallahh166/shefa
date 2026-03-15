/**
 * MedFlow Design System — Color Tokens
 *
 * All colors are expressed as HSL component strings (no `hsl()` wrapper)
 * so they compose with Tailwind's opacity modifier syntax:
 *   bg-primary/10  →  background: hsl(var(--primary) / 0.1)
 *
 * Naming convention:
 *   --color-{role}          → base color
 *   --color-{role}-fg       → foreground on that color
 *   --color-{role}-subtle   → 10% tint background
 *   --color-{role}-border   → 20% tint border
 */

export const colorTokens = {
  // ── Brand ──────────────────────────────────────────────────────────────
  primary:         "221 83% 53%",   // #2563eb  blue-600
  primaryFg:       "0 0% 100%",
  primarySubtle:   "221 83% 97%",   // blue-50
  primaryBorder:   "221 83% 88%",   // blue-200

  // ── Surfaces ───────────────────────────────────────────────────────────
  background:      "220 14% 96%",   // slate-100 — page canvas
  surface:         "0 0% 100%",     // white — card / panel
  surfaceRaised:   "0 0% 100%",     // white — modals / popovers (same, shadow differentiates)
  overlay:         "220 14% 93%",   // slate-200 — hover fills, tag backgrounds

  // ── Foreground ─────────────────────────────────────────────────────────
  textPrimary:     "220 20% 10%",   // near-black — headings, body
  textSecondary:   "220 9% 40%",    // slate-500 — labels, subtext
  textMuted:       "220 9% 58%",    // slate-400 — placeholders, timestamps
  textDisabled:    "220 9% 70%",    // slate-300 — disabled

  // ── Semantic ───────────────────────────────────────────────────────────
  success:         "160 84% 39%",   // emerald-600
  successFg:       "0 0% 100%",
  successSubtle:   "160 84% 95%",
  successBorder:   "160 60% 75%",

  warning:         "38 92% 50%",    // amber-500
  warningFg:       "0 0% 100%",
  warningSubtle:   "38 92% 95%",
  warningBorder:   "38 92% 80%",

  danger:          "0 84% 60%",     // red-500
  dangerFg:        "0 0% 100%",
  dangerSubtle:    "0 84% 96%",
  dangerBorder:    "0 84% 82%",

  info:            "199 89% 48%",   // sky-500
  infoFg:          "0 0% 100%",
  infoSubtle:      "199 89% 95%",
  infoBorder:      "199 89% 78%",

  // ── Border & Input ─────────────────────────────────────────────────────
  border:          "220 13% 91%",   // slate-200
  borderStrong:    "220 13% 82%",   // slate-300 — focus-adjacent
  input:           "220 13% 91%",
  ring:            "221 83% 53%",   // matches primary

  // ── Sidebar ────────────────────────────────────────────────────────────
  sidebarBg:       "0 0% 100%",
  sidebarFg:       "220 9% 40%",
  sidebarPrimary:  "221 83% 53%",
  sidebarPrimaryFg:"0 0% 100%",
  sidebarAccent:   "220 14% 96%",
  sidebarAccentFg: "220 20% 10%",
  sidebarBorder:   "220 13% 91%",

  // ── Chart palette ──────────────────────────────────────────────────────
  chart1: "221 83% 53%",  // primary blue
  chart2: "160 84% 39%",  // emerald
  chart3: "38 92% 50%",   // amber
  chart4: "199 89% 48%",  // sky
  chart5: "262 83% 58%",  // violet

  // ── Dark mode overrides (applied on .dark) ─────────────────────────────
  dark: {
    background:    "224 20%  7%",   // slate-950
    surface:       "224 20% 10%",   // slate-900
    surfaceRaised: "224 20% 13%",   // slate-800/900
    overlay:       "224 20% 16%",   // hover fills
    textPrimary:   "220 14% 93%",
    textSecondary: "220  9% 65%",
    textMuted:     "220  9% 48%",
    textDisabled:  "220  9% 35%",
    border:        "224 20% 18%",
    borderStrong:  "224 20% 24%",
    input:         "224 20% 18%",
    sidebarBg:     "224 20% 10%",
    sidebarFg:     "220  9% 55%",
    sidebarAccent: "224 20% 14%",
    sidebarBorder: "224 20% 18%",
    // Semantic colors stay the same in dark; only bg usage changes
    successSubtle: "160 30% 12%",
    warningSubtle: "38  30% 12%",
    dangerSubtle:  "0   30% 12%",
    infoSubtle:    "199 30% 12%",
  },
} as const;

export type ColorToken = keyof typeof colorTokens;
