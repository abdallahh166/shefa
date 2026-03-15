/**
 * Form System — MedFlow Design System
 *
 * Components:
 *   FormSection  — top-level grouping with title + description
 *   FormGroup    — horizontal or vertical field group
 *   FormField    — single field wrapper (label + input + hint + error)
 *   FormLabel    — accessible label with optional required indicator
 *   FormHint     — helper text below input
 *   FormError    — error message (with icon)
 *
 * Usage with React Hook Form + Zod (existing shadcn form.tsx pattern):
 *   <FormSection title="Patient Information">
 *     <FormGroup cols={2}>
 *       <FormField name="full_name" label="Full Name" required>
 *         <Input {...register("full_name")} error={!!errors.full_name} />
 *         <FormError>{errors.full_name?.message}</FormError>
 *       </FormField>
 *       <FormField name="dob" label="Date of Birth">
 *         <Input type="date" {...register("date_of_birth")} />
 *       </FormField>
 *     </FormGroup>
 *   </FormSection>
 *
 * Usage standalone (uncontrolled forms):
 *   <FormField label="Email" hint="We'll never share your email." required>
 *     <Input type="email" placeholder="john@example.com" />
 *   </FormField>
 */

import * as React from "react";
import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── FormSection ──────────────────────────────────────────────────────────────

interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  /** Show a horizontal divider below the header */
  divider?: boolean;
}

function FormSection({ title, description, divider = false, className, children, ...props }: FormSectionProps) {
  return (
    <div className={cn("space-y-5", className)} {...props}>
      {(title || description) && (
        <div className={cn(divider && "pb-4 border-b border-border")}>
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── FormGroup ────────────────────────────────────────────────────────────────

interface FormGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns (1–4). Defaults to 1. */
  cols?: 1 | 2 | 3 | 4;
  /** Gap between fields */
  gap?: "sm" | "md" | "lg";
}

const colsClass: Record<1 | 2 | 3 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

const gapClass = { sm: "gap-3", md: "gap-4", lg: "gap-5" } as const;

function FormGroup({ cols = 1, gap = "md", className, children, ...props }: FormGroupProps) {
  return (
    <div
      className={cn("grid", colsClass[cols], gapClass[gap], className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** For accessibility: links label to input. Pass the input's id. */
  name?: string;
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** Make field span full width in a FormGroup */
  colSpan?: "full" | 2 | 3;
}

const colSpanClass: Record<string, string> = {
  full: "col-span-full",
  "2":  "sm:col-span-2",
  "3":  "sm:col-span-3",
};

function FormField({
  name,
  label,
  required,
  hint,
  error,
  colSpan,
  className,
  children,
  ...props
}: FormFieldProps) {
  const id = name ?? React.useId();

  // Clone children to inject id and aria-describedby
  const ariaDescribedBy = [
    hint  && `${id}-hint`,
    error && `${id}-error`,
  ].filter(Boolean).join(" ") || undefined;

  const enhancedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
      id,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": error ? true : undefined,
      "aria-required": required ? true : undefined,
    });
  });

  return (
    <div
      className={cn(
        "space-y-2",
        colSpan && colSpanClass[String(colSpan)],
        className,
      )}
      {...props}
    >
      {label && (
        <FormLabel htmlFor={id} required={required}>
          {label}
        </FormLabel>
      )}
      {enhancedChildren}
      {hint && !error && <FormHint id={`${id}-hint`}>{hint}</FormHint>}
      {error && <FormError id={`${id}-error`}>{error}</FormError>}
    </div>
  );
}

// ─── FormLabel ────────────────────────────────────────────────────────────────

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

function FormLabel({ className, required, children, ...props }: FormLabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium text-foreground leading-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-destructive ms-0.5" aria-hidden="true">*</span>
      )}
    </label>
  );
}

// ─── FormHint ─────────────────────────────────────────────────────────────────

interface FormHintProps extends React.HTMLAttributes<HTMLParagraphElement> {}

function FormHint({ className, children, ...props }: FormHintProps) {
  return (
    <p className={cn("text-xs text-muted-foreground flex items-start gap-1", className)} {...props}>
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

// ─── FormError ────────────────────────────────────────────────────────────────

interface FormErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {}

function FormError({ className, children, ...props }: FormErrorProps) {
  if (!children) return null;

  return (
    <p
      role="alert"
      className={cn("text-xs font-medium text-destructive flex items-start gap-1", className)}
      {...props}
    >
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

// ─── FormActions ──────────────────────────────────────────────────────────────

/** Standard form footer with action buttons */
interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "left" | "right" | "between";
}

function FormActions({ align = "right", className, children, ...props }: FormActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 pt-4 border-t border-border",
        align === "right" && "justify-end",
        align === "left" && "justify-start",
        align === "between" && "justify-between",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { FormSection, FormGroup, FormField, FormLabel, FormHint, FormError, FormActions };
