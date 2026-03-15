/**
 * Input / Textarea / Select — MedFlow Design System Primitives
 *
 * All inputs:
 *  - Use .input-base CSS class for consistent styling
 *  - Support aria-invalid for error state
 *  - Support size variants
 *  - Are RTL-aware
 */

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ─── Input ───────────────────────────────────────────────────────────────────

const inputVariants = cva(
  [
    "flex w-full rounded-md border bg-transparent text-sm shadow-xs",
    "transition-colors duration-150",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
  ].join(" "),
  {
    variants: {
      size: {
        sm:      "h-8 px-2.5 py-1 text-xs",
        default: "h-9 px-3 py-1.5",
        lg:      "h-10 px-4 py-2 text-base",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Leading icon element */
  leadingIcon?: React.ReactNode;
  /** Trailing icon or element */
  trailingIcon?: React.ReactNode;
  /** Convenience error state (applies aria-invalid) */
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, leadingIcon, trailingIcon, error, type, ...props }, ref) => {
    if (!leadingIcon && !trailingIcon) {
      return (
        <input
          ref={ref}
          type={type}
          aria-invalid={error ? true : undefined}
          className={cn(inputVariants({ size }), "border-input", className)}
          {...props}
        />
      );
    }

    return (
      <div className="relative flex items-center">
        {leadingIcon && (
          <span className="pointer-events-none absolute start-2.5 flex items-center text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          type={type}
          aria-invalid={error ? true : undefined}
          className={cn(
            inputVariants({ size }),
            "border-input",
            leadingIcon && "ps-9",
            trailingIcon && "pe-9",
            className,
          )}
          {...props}
        />
        {trailingIcon && (
          <span className="pointer-events-none absolute end-2.5 flex items-center text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
            {trailingIcon}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

// ─── Textarea ─────────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  /** Auto-grow to fit content */
  autoResize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, autoResize, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null);
    const combinedRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? innerRef;

    const handleInput = React.useCallback(() => {
      const el = (combinedRef as React.RefObject<HTMLTextAreaElement>).current;
      if (el && autoResize) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    }, [autoResize, combinedRef]);

    return (
      <textarea
        ref={combinedRef}
        aria-invalid={error ? true : undefined}
        onInput={handleInput}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2",
          "text-sm shadow-xs resize-y",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20",
          "transition-colors duration-150",
          autoResize && "resize-none overflow-hidden",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

// ─── Select ───────────────────────────────────────────────────────────────────

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { error?: boolean; size?: "sm" | "default" | "lg" }
>(({ className, children, error, size = "default", ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    aria-invalid={error ? true : undefined}
    className={cn(
      "flex items-center justify-between rounded-md border border-input bg-transparent",
      "text-sm shadow-xs ring-offset-background",
      "placeholder:text-muted-foreground",
      "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-[invalid=true]:border-destructive",
      "transition-colors duration-150",
      "[&>span]:line-clamp-1",
      size === "sm" && "h-8 px-2.5 text-xs",
      size === "default" && "h-9 px-3 py-2",
      size === "lg" && "h-10 px-4 text-base",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" aria-hidden />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" aria-hidden />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-dropdown max-h-96 min-w-[8rem] overflow-hidden",
        "rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
        "data-[state=open]:animate-scale-in data-[state=closed]:animate-fade-out",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm",
      "outline-none focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-primary" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Input, inputVariants,
  Textarea,
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent,
  SelectLabel, SelectItem, SelectSeparator,
  SelectScrollUpButton, SelectScrollDownButton,
};
