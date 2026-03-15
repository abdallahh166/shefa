/**
 * MedFlow Design System — tailwind.config.ts
 *
 * Drop-in replacement for the project's existing tailwind.config.ts.
 * - Adds semantic color tokens derived from CSS variables
 * - Extends shadow, radius, z-index, font-size, and animation scales
 * - Maintains full backward compatibility with existing shadcn/ui components
 * - Removes hard-coded A4 defaults in favour of explicit values
 */

import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import tailwindTypography from "@tailwindcss/typography";

export default {
  darkMode: ["class"],

  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],

  prefix: "",

  theme: {
    // ── Container ─────────────────────────────────────────────────────────
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        sm:   "640px",
        md:   "768px",
        lg:   "1024px",
        xl:   "1280px",
        "2xl":"1400px",
      },
    },

    extend: {
      // ── Font families ──────────────────────────────────────────────────
      fontFamily: {
        sans:   ["var(--font-sans)",   { fontFeatureSettings: '"cv02","cv03","cv04","cv11"' }],
        arabic: ["var(--font-arabic)", { fontFeatureSettings: "normal" }],
        mono:   ["var(--font-mono)",   { fontFeatureSettings: "normal" }],
      },

      // ── Font sizes (extends Tailwind's default scale) ──────────────────
      fontSize: {
        "2xs": ["0.625rem",  { lineHeight: "0.875rem" }], // 10/14
        // Tailwind's defaults cover xs–9xl; no need to repeat them
      },

      // ── Colors (all reference CSS variables for theming) ──────────────
      colors: {
        // ── Surfaces ──────────────────────────────────────────────────
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // ── Brand ─────────────────────────────────────────────────────
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          subtle:     "hsl(var(--primary) / 0.1)",
        },

        // ── Secondary ─────────────────────────────────────────────────
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },

        // ── Destructive / Danger ──────────────────────────────────────
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          subtle:     "hsl(var(--destructive) / 0.1)",
        },

        // ── Semantic ──────────────────────────────────────────────────
        success: {
          DEFAULT:    "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          subtle:     "hsl(var(--success) / 0.1)",
          border:     "hsl(var(--success) / 0.2)",
        },
        warning: {
          DEFAULT:    "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          subtle:     "hsl(var(--warning) / 0.1)",
          border:     "hsl(var(--warning) / 0.2)",
        },
        danger: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          subtle:     "hsl(var(--destructive) / 0.1)",
          border:     "hsl(var(--destructive) / 0.2)",
        },
        info: {
          DEFAULT:    "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          subtle:     "hsl(var(--info) / 0.1)",
          border:     "hsl(var(--info) / 0.2)",
        },

        // ── Surfaces ──────────────────────────────────────────────────
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── Sidebar ───────────────────────────────────────────────────
        sidebar: {
          DEFAULT:              "hsl(var(--sidebar-background))",
          foreground:           "hsl(var(--sidebar-foreground))",
          primary:              "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:               "hsl(var(--sidebar-accent))",
          "accent-foreground":  "hsl(var(--sidebar-accent-foreground))",
          border:               "hsl(var(--sidebar-border))",
          ring:                 "hsl(var(--sidebar-ring))",
        },

        // ── Charts ────────────────────────────────────────────────────
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },

      // ── Border Radius ─────────────────────────────────────────────────
      borderRadius: {
        none:    "0",
        sm:      "calc(var(--radius) - 4px)",   //  2px
        DEFAULT: "calc(var(--radius) - 2px)",   //  4px
        md:      "var(--radius)",               //  6px
        lg:      "calc(var(--radius) + 2px)",   //  8px  — cards
        xl:      "calc(var(--radius) + 6px)",   // 12px  — large cards
        "2xl":   "calc(var(--radius) + 10px)",  // 16px  — overlays
        full:    "9999px",
      },

      // ── Box Shadows ───────────────────────────────────────────────────
      boxShadow: {
        xs:      "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        sm:      "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
        DEFAULT: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)",
        md:      "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)",
        lg:      "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)",
        xl:      "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.06)",
        "2xl":   "0 25px 50px -12px rgb(0 0 0 / 0.16)",
        inner:   "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
        none:    "none",
      },

      // ── z-index ───────────────────────────────────────────────────────
      zIndex: {
        base:         "0",
        raised:       "1",
        dropdown:     "50",
        sticky:       "60",
        overlay:      "70",
        modal:        "80",
        notification: "90",
        tooltip:      "100",
      },

      // ── Keyframes ─────────────────────────────────────────────────────
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          from: { opacity: "1", transform: "translateY(0)" },
          to:   { opacity: "0", transform: "translateY(4px)" },
        },
        "slide-in-from-left": {
          from: { transform: "translateX(-100%)" },
          to:   { transform: "translateX(0)" },
        },
        "slide-in-from-right": {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(100%)", opacity: "0" },
          to:   { transform: "translateY(0)",    opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.6" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },

      // ── Animations ────────────────────────────────────────────────────
      animation: {
        "accordion-down":    "accordion-down 0.2s ease-out",
        "accordion-up":      "accordion-up 0.2s ease-out",
        "fade-in":           "fade-in 0.2s ease-out",
        "fade-out":          "fade-out 0.15s ease-in",
        "slide-in-left":     "slide-in-from-left 0.25s cubic-bezier(0,0,0.2,1)",
        "slide-in-right":    "slide-in-from-right 0.25s cubic-bezier(0,0,0.2,1)",
        "slide-in-bottom":   "slide-in-from-bottom 0.3s cubic-bezier(0,0,0.2,1)",
        "scale-in":          "scale-in 0.15s cubic-bezier(0,0,0.2,1)",
        "pulse-subtle":      "pulse-subtle 2s ease-in-out infinite",
        "shimmer":           "shimmer 2s linear infinite",
        "spin-slow":         "spin 3s linear infinite",
      },

      // ── Transitions ───────────────────────────────────────────────────
      transitionTimingFunction: {
        spring:     "cubic-bezier(0.34, 1.56, 0.64, 1)",
        decelerate: "cubic-bezier(0.0, 0.0, 0.2, 1)",
      },
    },
  },

  plugins: [
    tailwindcssAnimate,
    tailwindTypography,
  ],
} satisfies Config;
