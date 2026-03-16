import { Button } from "@/components/primitives/Button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  if (!open) return null;

  const iconColor =
    variant === "danger"
      ? "text-destructive bg-destructive/10"
      : variant === "warning"
        ? "text-warning bg-warning/10"
        : "text-primary bg-primary/10";
  const buttonVariant = variant === "danger" ? "danger" : "default";

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}>
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="font-semibold text-sm text-foreground">{title}</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
                {message}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel asChild>
            <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant={buttonVariant} size="sm" onClick={onConfirm} disabled={loading}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
