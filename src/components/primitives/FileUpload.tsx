/**
 * FileUpload — MedFlow Design System Primitive
 *
 * Variants:
 * - button: compact upload trigger
 * - dropzone: drag/click area with dashed border
 */

import * as React from "react";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/primitives/Button";

interface FileUploadProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  variant?: "button" | "dropzone";
  buttonLabel?: string;
  title?: string;
  description?: string;
  fileName?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  buttonVariant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function FileUpload({
  onChange,
  variant = "button",
  buttonLabel = "Upload file",
  title = "Select a file",
  description,
  fileName,
  icon,
  loading,
  disabled,
  buttonVariant = "outline",
  buttonSize = "sm",
  inputRef,
  className,
  id,
  ...inputProps
}: FileUploadProps) {
  const internalRef = React.useRef<HTMLInputElement>(null);
  const resolvedRef = inputRef ?? internalRef;
  const inputId = id ?? React.useId();

  const handleOpen = () => {
    if (disabled) return;
    resolvedRef.current?.click();
  };

  const input = (
    <input
      ref={resolvedRef}
      id={inputId}
      type="file"
      className="sr-only"
      onChange={onChange}
      disabled={disabled}
      {...inputProps}
    />
  );

  if (variant === "dropzone") {
    const displayTitle = fileName ?? title;
    return (
      <div className={className}>
        {input}
        <label
          htmlFor={inputId}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-6 text-center",
            "bg-muted/20 transition-colors hover:bg-muted/30",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            icon ?? <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
          )}
          <p className="text-sm font-medium text-foreground">{displayTitle}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </label>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {input}
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        onClick={handleOpen}
        loading={loading}
        disabled={disabled}
      >
        {icon ?? <Upload className="h-4 w-4" />}
        {buttonLabel}
      </Button>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
