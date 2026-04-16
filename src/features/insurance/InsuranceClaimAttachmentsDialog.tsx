import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUpload } from "@/components/primitives/FileUpload";
import { Button } from "@/components/primitives/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/primitives/Inputs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { DataTable, Column } from "@/shared/components/DataTable";
import { Download, File, FileSpreadsheet, FileText, Image, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/core/auth/authStore";
import { useI18n } from "@/core/i18n/i18nStore";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/shared/utils/formatDate";
import { insuranceAttachmentsService } from "@/services/insurance/insuranceAttachments.service";
import { queryKeys } from "@/services/queryKeys";
import type { InsuranceClaimAttachment, InsuranceClaimWithPatient } from "@/domain/insurance/insurance.types";

const FILE_ICONS: Record<string, typeof FileText> = {
  "application/pdf": FileText,
  "image/jpeg": Image,
  "image/png": Image,
  "image/webp": Image,
  "text/csv": FileSpreadsheet,
  "application/vnd.ms-excel": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
};

const attachmentTypeOptions = [
  { value: "eob", label: "EOB / remittance" },
  { value: "corrected_claim", label: "Corrected claim" },
  { value: "prior_authorization", label: "Prior authorization" },
  { value: "eligibility", label: "Eligibility proof" },
  { value: "referral", label: "Referral" },
  { value: "payer_letter", label: "Payer letter" },
  { value: "other", label: "Other" },
] as const;

const MAX_SIZE = 10 * 1024 * 1024;

const getAttachmentTypeLabel = (value: InsuranceClaimAttachment["attachment_type"]) =>
  attachmentTypeOptions.find((option) => option.value === value)?.label ?? value;

interface InsuranceClaimAttachmentsDialogProps {
  open: boolean;
  claim: InsuranceClaimWithPatient | null;
  onClose: () => void;
}

export const InsuranceClaimAttachmentsDialog = ({
  open,
  claim,
  onClose,
}: InsuranceClaimAttachmentsDialogProps) => {
  const { t, locale, calendarType } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachmentType, setAttachmentType] = useState<InsuranceClaimAttachment["attachment_type"]>("eob");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: attachments = [], isLoading } = useQuery<InsuranceClaimAttachment[]>({
    queryKey: queryKeys.insurance.attachments(claim?.id ?? "", user?.tenantId),
    queryFn: () => insuranceAttachmentsService.listByClaim(claim?.id ?? ""),
    enabled: open && !!claim?.id && !!user?.tenantId,
  });

  const resetUploadFields = () => {
    setAttachmentType("eob");
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !claim) return;

    if (file.size > MAX_SIZE) {
      toast({ title: t("common.error"), description: "File must be under 10 MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      await insuranceAttachmentsService.upload({
        claim_id: claim.id,
        attachment_type: attachmentType,
        file,
        notes: notes || null,
      });
      toast({ title: t("common.saved") });
      queryClient.invalidateQueries({ queryKey: queryKeys.insurance.attachments(claim.id, user?.tenantId) });
      resetUploadFields();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err?.message ?? "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: InsuranceClaimAttachment) => {
    try {
      const blob = await insuranceAttachmentsService.download({ file_path: attachment.file_path });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err?.message ?? "Download failed", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !claim) return;
    setDeleting(true);
    try {
      const result = await insuranceAttachmentsService.remove(deleteId);
      queryClient.invalidateQueries({ queryKey: queryKeys.insurance.attachments(claim.id, user?.tenantId) });
      toast({ title: t("common.saved") });
      if (result?.storageError) {
        toast({
          title: t("common.error"),
          description: `Attachment record deleted, but file cleanup failed: ${result.storageError}`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: err?.message ?? "Delete failed", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const columns: Column<InsuranceClaimAttachment>[] = [
    {
      key: "file_name",
      header: t("common.name"),
      searchable: true,
      render: (attachment) => {
        const Icon = FILE_ICONS[attachment.file_type] || File;
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium truncate max-w-[220px]">{attachment.file_name}</div>
              <div className="text-xs text-muted-foreground">{getAttachmentTypeLabel(attachment.attachment_type)}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: "created_at",
      header: t("common.date"),
      render: (attachment) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {formatDate(attachment.created_at, locale, "datetime", calendarType)}
        </span>
      ),
    },
    {
      key: "file_size",
      header: t("common.size") || "Size",
      render: (attachment) => <span className="text-muted-foreground">{formatSize(attachment.file_size)}</span>,
    },
    {
      key: "notes",
      header: "Notes",
      render: (attachment) => (
        attachment.notes
          ? <span className="block max-w-xs truncate text-sm text-muted-foreground">{attachment.notes}</span>
          : <span className="text-muted-foreground">-</span>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (attachment) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleDownload(attachment)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("common.download")}
            title={t("common.download")}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleteId(attachment.id)}
            className="text-muted-foreground hover:text-destructive"
            aria-label={t("common.delete")}
            title={t("common.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Claim attachments
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {claim ? `${claim.provider} - ${claim.patients?.full_name ?? "-"}` : "Upload payer-facing documents for claim follow-up."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto]">
              <div className="space-y-2">
                <Label>Attachment type</Label>
                <Select value={attachmentType} onValueChange={(value) => setAttachmentType(value as InsuranceClaimAttachment["attachment_type"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {attachmentTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Appeal packet, corrected CPT coding, payer fax confirmation, etc."
                />
              </div>
              <div className="flex items-end">
                <FileUpload
                  variant="button"
                  inputRef={fileRef}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv,.doc,.docx,.xls,.xlsx"
                  onChange={handleUpload}
                  disabled={uploading || !claim}
                  loading={uploading}
                  buttonLabel="Upload attachment"
                  icon={<Upload className="h-4 w-4" />}
                  className="shrink-0"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : attachments.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <Paperclip className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No claim attachments uploaded yet.</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={attachments}
              keyExtractor={(attachment) => attachment.id}
              searchable
              exportFileName="insurance-claim-attachments"
              tableLabel="Claim attachments"
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title={t("common.delete")}
        message="Are you sure you want to delete this attachment?"
        confirmLabel={t("common.delete")}
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
};
