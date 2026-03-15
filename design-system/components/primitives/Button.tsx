/**
 * Button — MedFlow Design System Primitive
 *
 * Variants: default | secondary | outline | ghost | danger | success | link
 * Sizes:    sm | default | lg | icon | icon-sm
 *
 * Usage:
 *   <Button>Save</Button>
 *   <Button variant="danger" size="sm" loading>Deleting…</Button>
 *   <Button variant="outline" asChild><Link to="/somewhere">Go</Link></Button>
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base — applies to every variant
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-md text-sm font-medium",
    "ring-offset-background transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        // ── Primary — main CTAs ──
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",

        // ── Secondary — secondary actions ──
        secondary:
          "bg-secondary text-secondary-foreground border border-border shadow-xs hover:bg-muted active:bg-muted/80",

        // ── Outline — low-emphasis, bordered ──
        outline:
          "border border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent/80",

        // ── Ghost — minimal, inline actions ──
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",

        // ── Danger — destructive actions ──
        danger:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:bg-destructive/80",

        // ── Success — confirm / complete ──
        success:
          "bg-success text-success-foreground shadow-xs hover:bg-success/90 active:bg-success/80",

        // ── Link — inline link style ──
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto font-normal",
      },

      size: {
        sm:      "h-8 rounded-md px-3 text-xs gap-1.5 [&_svg]:size-3.5",
        default: "h-9 px-4 py-2",
        lg:      "h-10 rounded-md px-6 text-base",
        icon:    "h-9 w-9",
        "icon-sm": "h-7 w-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as a child element (e.g. <Link>) */
  asChild?: boolean;
  /** Show spinner and disable interaction */
  loading?: boolean;
  /** Text shown alongside the spinner (defaults to children) */
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            <span>{loadingText ?? children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
