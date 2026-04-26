import { useEffect, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { Input, Textarea } from "@/components/primitives/Inputs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface JobRetryDialogProps {
  open: boolean;
  jobCount: number;
  tenantName?: string | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
}

export const JobRetryDialog = ({
  open,
  jobCount,
  tenantName,
  loading,
  onClose,
  onSubmit,
}: JobRetryDialogProps) => {
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const requiresTypedConfirmation = jobCount > 1;

  useEffect(() => {
    if (!open) return;
    setReason("");
    setConfirmation("");
  }, [open, jobCount, tenantName]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{jobCount > 1 ? "Retry failed jobs" : "Retry failed job"}</DialogTitle>
          <DialogDescription>
            {jobCount > 1
              ? `This will requeue ${jobCount} failed jobs${tenantName ? ` for ${tenantName}` : ""}. Only retry idempotent jobs that are safe to run again.`
              : `This will requeue the selected failed job${tenantName ? ` for ${tenantName}` : ""}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="job-retry-reason">Reason</Label>
          <Textarea
            id="job-retry-reason"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why this retry is safe and necessary."
          />
        </div>

        {requiresTypedConfirmation ? (
          <div className="space-y-2">
            <Label htmlFor="job-retry-confirmation">Type RETRY to confirm</Label>
            <Input
              id="job-retry-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="RETRY"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void onSubmit(reason.trim())}
            disabled={loading || reason.trim().length < 3 || (requiresTypedConfirmation && confirmation.trim() !== "RETRY")}
          >
            {loading ? "Retrying..." : jobCount > 1 ? "Retry jobs" : "Retry job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
