import { useEffect, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { Input, Textarea } from "@/components/primitives/Inputs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/core/i18n/i18nStore";

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
  const { t } = useI18n(["admin"]);
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
          <DialogTitle>{jobCount > 1 ? t("admin.jobRetry.titleMany") : t("admin.jobRetry.titleOne")}</DialogTitle>
          <DialogDescription>
            {jobCount > 1
              ? t("admin.jobRetry.descriptionMany", {
                count: jobCount,
                tenantName: tenantName ? t("admin.jobRetry.forTenant", { tenantName }) : "",
              })
              : t("admin.jobRetry.descriptionOne", {
                tenantName: tenantName ? t("admin.jobRetry.forTenant", { tenantName }) : "",
              })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="job-retry-reason">{t("admin.jobRetry.reason")}</Label>
          <Textarea
            id="job-retry-reason"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("admin.jobRetry.reasonPlaceholder")}
          />
        </div>

        {requiresTypedConfirmation ? (
          <div className="space-y-2">
            <Label htmlFor="job-retry-confirmation">{t("admin.jobRetry.confirmationLabel")}</Label>
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
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={() => void onSubmit(reason.trim())}
            disabled={loading || reason.trim().length < 3 || (requiresTypedConfirmation && confirmation.trim() !== "RETRY")}
          >
            {loading ? t("admin.jobRetry.retrying") : jobCount > 1 ? t("admin.jobRetry.actionMany") : t("admin.jobRetry.actionOne")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
