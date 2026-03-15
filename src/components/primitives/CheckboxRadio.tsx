/**
 * Checkbox & Radio — MedFlow Design System Primitives
 *
 * Both components:
 *  - Use Radix UI for full accessibility (keyboard, focus, ARIA)
 *  - Support indeterminate state (Checkbox)
 *  - Support disabled, error, and description states
 *  - Are RTL-aware
 *  - Work inside FormField (aria-required / aria-invalid injected by FormField)
 *
 * Usage — Checkbox:
 *   <Checkbox
 *     id="terms"
 *     checked={form.terms}
 *     onCheckedChange={(v) => setForm({ ...form, terms: !!v })}
 *     label="I agree to the terms and conditions"
 *     description="You must accept to continue."
 *     required
 *   />
 *
 * Usage — CheckboxGroup:
 *   <CheckboxGroup label="Permissions" error={errors.permissions}>
 *     {permissions.map((p) => (
 *       <Checkbox key={p.id} id={p.id} label={p.label}
 *         checked={selected.includes(p.id)}
 *         onCheckedChange={(v) => toggle(p.id, !!v)} />
 *     ))}
 *   </CheckboxGroup>
 *
 * Usage — Radio:
 *   <RadioGroup value={form.gender} onValueChange={(v) => set("gender")(v)}>
 *     <RadioItem value="male"   label="Male"   />
 *     <RadioItem value="female" label="Female" />
 *     <RadioItem value="other"  label="Other"  />
 *   </RadioGroup>
 */

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Check, Minus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /** Visible label text rendered beside the checkbox */
  label?: string;
  /** Secondary description shown below the label */
  description?: string;
  /** Error message — renders below description */
  error?: string;
  /** Indeterminate state (some but not all children selected) */
  indeterminate?: boolean;
  /** Size variant */
  size?: "sm" | "default";
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({
  className,
  label,
  description,
  error,
  indeterminate,
  size = "default",
  id,
  disabled,
  required,
  ...props
}, ref) => {
  const uid = id ?? React.useId();
  const descId = description ? `${uid}-desc` : undefined;
  const errId  = error       ? `${uid}-err`  : undefined;
  const ariaDescBy = [descId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex items-start gap-3">
      {/* ── The checkbox control ── */}
      <CheckboxPrimitive.Root
        ref={ref}
        id={uid}
        disabled={disabled}
        required={required}
        aria-describedby={ariaDescBy}
        aria-invalid={error ? true : undefined}
        aria-required={required ? true : undefined}
        data-indeterminate={indeterminate ? "" : undefined}
        className={cn(
          // Layout
          "peer flex shrink-0 items-center justify-center rounded",
          "border border-input shadow-xs",
          // Colors
          "bg-background text-primary-foreground",
          // States
          "transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
          "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20",
          // Size
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
          // Push top-aligned for multi-line labels
          "mt-0.5",
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
          {indeterminate
            ? <Minus className={cn("stroke-[3]", size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5")} aria-hidden />
            : <Check  className={cn("stroke-[3]", size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5")} aria-hidden />
          }
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>

      {/* ── Label + description ── */}
      {(label || description || error) && (
        <div className="space-y-0.5 leading-none">
          {label && (
            <label
              htmlFor={uid}
              className={cn(
                "font-medium leading-snug cursor-pointer select-none",
                size === "sm" ? "text-xs" : "text-sm",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {label}
              {required && <span className="text-destructive ms-0.5" aria-hidden>*</span>}
            </label>
          )}
          {description && (
            <p
              id={descId}
              className={cn("text-muted-foreground", size === "sm" ? "text-2xs" : "text-xs")}
            >
              {description}
            </p>
          )}
          {error && (
            <p
              id={errId}
              role="alert"
              className="text-xs text-destructive flex items-center gap-1"
            >
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };

// ─── CheckboxGroup ────────────────────────────────────────────────────────────

interface CheckboxGroupProps extends React.HTMLAttributes<HTMLFieldSetElement> {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  /** Arrange items horizontally */
  horizontal?: boolean;
}

function CheckboxGroup({
  label, description, error, required,
  horizontal = false, className, children, ...props
}: CheckboxGroupProps) {
  return (
    <fieldset className={cn("space-y-3 border-0 p-0 m-0", className)} {...props}>
      {label && (
        <legend className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ms-0.5" aria-hidden>*</span>}
        </legend>
      )}
      {description && (
        <p className="text-xs text-muted-foreground -mt-1">{description}</p>
      )}
      <div className={cn(
        horizontal ? "flex flex-wrap gap-4" : "space-y-3",
      )}>
        {children}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </fieldset>
  );
}

export { CheckboxGroup };

// ─── RadioGroup ───────────────────────────────────────────────────────────────

interface RadioGroupProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  label?: string;
  description?: string;
  error?: string;
  /** Arrange items horizontally */
  horizontal?: boolean;
}

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ label, description, error, horizontal = false, className, children, required, ...props }, ref) => {
  const errId = error ? React.useId() : undefined;

  return (
    <fieldset className="space-y-3 border-0 p-0 m-0">
      {label && (
        <legend className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ms-0.5" aria-hidden>*</span>}
        </legend>
      )}
      {description && (
        <p className="text-xs text-muted-foreground -mt-1">{description}</p>
      )}
      <RadioGroupPrimitive.Root
        ref={ref}
        aria-describedby={errId}
        aria-invalid={error ? true : undefined}
        aria-required={required}
        className={cn(
          horizontal ? "flex flex-wrap gap-4" : "space-y-2.5",
          className,
        )}
        {...props}
      >
        {children}
      </RadioGroupPrimitive.Root>
      {error && (
        <p id={errId} role="alert" className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </fieldset>
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

export { RadioGroup };

// ─── RadioItem ────────────────────────────────────────────────────────────────

interface RadioItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  /** Visible label text */
  label: string;
  /** Secondary description shown below the label */
  description?: string;
  /** Size variant */
  size?: "sm" | "default";
}

const RadioItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioItemProps
>(({ className, label, description, size = "default", value, id, disabled, ...props }, ref) => {
  const uid = id ?? React.useId();

  return (
    <div className="flex items-start gap-3">
      <RadioGroupPrimitive.Item
        ref={ref}
        id={uid}
        value={value}
        disabled={disabled}
        className={cn(
          // Layout
          "peer flex shrink-0 items-center justify-center rounded-full",
          "border border-input shadow-xs",
          "bg-background text-primary",
          // States
          "transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "data-[state=checked]:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Size
          size === "sm" ? "h-3.5 w-3.5 mt-0.5" : "h-4 w-4 mt-0.5",
          className,
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          {/* Inner filled dot */}
          <div
            className={cn(
              "rounded-full bg-primary",
              size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
            )}
            aria-hidden
          />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>

      <div className="space-y-0.5 leading-none">
        <label
          htmlFor={uid}
          className={cn(
            "font-medium leading-snug cursor-pointer select-none",
            size === "sm" ? "text-xs" : "text-sm",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {label}
        </label>
        {description && (
          <p className={cn(
            "text-muted-foreground",
            size === "sm" ? "text-2xs" : "text-xs",
          )}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
});
RadioItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioItem };

// ─── RadioCard (visual card variant for radio selections) ─────────────────────

/**
 * RadioCard — larger visual radio item styled as a selectable card.
 * Ideal for plan selection, appointment type selection, etc.
 *
 * Usage:
 *   <RadioGroup value={plan} onValueChange={setPlan} horizontal>
 *     <RadioCard value="free"  label="Free"  description="Up to 50 patients" />
 *     <RadioCard value="pro"   label="Pro"   description="Unlimited patients" badge="Popular" />
 *   </RadioGroup>
 */

interface RadioCardProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  label: string;
  description?: string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const RadioCard = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioCardProps
>(({ className, label, description, badge, icon: Icon, value, id, disabled, ...props }, ref) => {
  const uid = id ?? React.useId();

  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      id={uid}
      value={value}
      disabled={disabled}
      className={cn(
        // Layout
        "relative flex flex-col gap-1.5 rounded-lg border p-4 text-start",
        "min-w-[160px] cursor-pointer",
        // Colors
        "border-border bg-card",
        // States
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary/5 data-[state=checked]:ring-1 data-[state=checked]:ring-primary",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        "hover:border-border/80 hover:bg-muted/40",
        className,
      )}
      {...props}
    >
      {/* Selected indicator dot */}
      <RadioGroupPrimitive.Indicator className="absolute top-3 end-3">
        <div className="h-2 w-2 rounded-full bg-primary" aria-hidden />
      </RadioGroupPrimitive.Indicator>

      {/* Badge (e.g. "Popular") */}
      {badge && (
        <span className="absolute top-2 start-2 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-2xs font-semibold text-primary">
          {badge}
        </span>
      )}

      {Icon && <Icon className="h-5 w-5 text-muted-foreground mb-0.5" aria-hidden />}
      <label
        htmlFor={uid}
        className="text-sm font-semibold text-foreground cursor-pointer"
      >
        {label}
      </label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </RadioGroupPrimitive.Item>
  );
});
RadioCard.displayName = "RadioCard";

export { RadioCard };
