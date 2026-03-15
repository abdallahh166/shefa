/**
 * Badge / Card / Avatar / Skeleton / Divider — MedFlow Design System Primitives
 */

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ─── Badge ────────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:   "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        success:     "border-transparent bg-success text-success-foreground",
        warning:     "border-transparent bg-warning text-warning-foreground",
        danger:      "border-transparent bg-destructive text-destructive-foreground",
        info:        "border-transparent bg-info text-info-foreground",
        outline:     "text-foreground border-border",
        // Subtle variants (soft background, coloured text)
        "success-subtle": "border-success/20 bg-success/10 text-success",
        "warning-subtle": "border-warning/20 bg-warning/10 text-warning",
        "danger-subtle":  "border-destructive/20 bg-destructive/10 text-destructive",
        "info-subtle":    "border-info/20 bg-info/10 text-info",
        "primary-subtle": "border-primary/20 bg-primary/10 text-primary",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant = "default", dot, children, ...props }: BadgeProps) {
  const dotColor: Record<string, string> = {
    default:          "bg-primary-foreground",
    secondary:        "bg-secondary-foreground",
    success:          "bg-success-foreground",
    warning:          "bg-warning-foreground",
    danger:           "bg-destructive-foreground",
    info:             "bg-info-foreground",
    "success-subtle": "bg-success",
    "warning-subtle": "bg-warning",
    "danger-subtle":  "bg-destructive",
    "info-subtle":    "bg-info",
    "primary-subtle": "bg-primary",
    outline:          "bg-foreground",
  };

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor[variant ?? "default"])}
          aria-hidden
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };

// ─── Card ─────────────────────────────────────────────────────────────────────

const cardVariants = cva("rounded-xl border bg-card text-card-foreground", {
  variants: {
    shadow: {
      none: "",
      xs:   "shadow-xs",
      sm:   "shadow-sm",
      md:   "shadow-md",
    },
    interactive: {
      true: "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-border/80",
      false: "",
    },
  },
  defaultVariants: { shadow: "none", interactive: false },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, shadow, interactive, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ shadow, interactive }), className)} {...props} />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1 p-5 pb-4", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-sm font-semibold leading-tight tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 pt-0 gap-2", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

// ─── Avatar ───────────────────────────────────────────────────────────────────

const avatarSizes = {
  xs:  "h-6 w-6 text-[0.625rem]",
  sm:  "h-8 w-8 text-xs",
  md:  "h-9 w-9 text-sm",
  lg:  "h-10 w-10 text-sm",
  xl:  "h-12 w-12 text-base",
  "2xl": "h-16 w-16 text-lg",
} as const;

type AvatarSize = keyof typeof avatarSizes;

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: AvatarSize;
  color?: string; // custom bg color class
}

const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ className, src, alt, fallback, size = "md", color, ...props }, ref) => (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn("relative flex shrink-0 overflow-hidden rounded-full", avatarSizes[size], className)}
      {...props}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          alt={alt}
          className="aspect-square h-full w-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full font-semibold uppercase",
          color ?? "bg-primary/10 text-primary",
        )}
        delayMs={src ? 400 : 0}
      >
        {fallback ?? (alt ? alt.charAt(0) : "?")}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  ),
);
Avatar.displayName = "Avatar";

export { Avatar };

// ─── Skeleton ─────────────────────────────────────────────────────────────────

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

function Skeleton({ className, shimmer = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted",
        shimmer
          ? "skeleton"         // shimmer animation from globals.css
          : "animate-pulse",   // pulse fallback
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

/** Common skeleton shapes */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 && lines > 1 ? "w-3/4" : "w-full")}
        />
      ))}
    </div>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 space-y-3", className)} aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCard };

// ─── Divider ──────────────────────────────────────────────────────────────────

interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  label?: string;
}

function Divider({ className, orientation = "horizontal", label, ...props }: DividerProps) {
  if (orientation === "vertical") {
    return <div className={cn("w-px bg-border self-stretch", className)} {...props} />;
  }

  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)} {...props}>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    );
  }

  return <div className={cn("h-px bg-border", className)} {...props} />;
}

export { Divider };

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-tooltip overflow-hidden rounded-md border border-border/50 bg-popover px-3 py-1.5",
        "text-xs text-popover-foreground shadow-md",
        "animate-scale-in",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/** Convenience wrapper — wraps any element in a tooltip */
interface SimpleTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
}

function SimpleTooltip({ content, children, side = "top", delayDuration = 400 }: SimpleTooltipProps) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SimpleTooltip };
