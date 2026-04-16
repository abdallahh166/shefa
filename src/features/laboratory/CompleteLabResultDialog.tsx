import { useEffect, useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { Button } from "@/components/primitives/Button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/primitives/Inputs";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { labService } from "@/services/laboratory/lab.service";
import type { LabOrderWithPatientDoctor } from "@/domain/lab/lab.types";

type LabAbnormalFlag = "normal" | "abnormal" | "high" | "low" | "critical";

interface CompleteLabResultDialogProps {
  labOrder: LabOrderWithPatientDoctor | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const defaultForm = () => ({
  result_value: "",
  result_unit: "",
  reference_range: "",
  abnormal_flag: "normal" as LabAbnormalFlag,
  result_notes: "",
});

export const CompleteLabResultDialog = ({
  labOrder,
  open,
  onClose,
  onSuccess,
}: CompleteLabResultDialogProps) => {
  const { t } = useI18n();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const isEditingCompletedResult = labOrder?.status === "completed";

  useEffect(() => {
    if (!open || !labOrder) return;
    setForm({
      result_value: labOrder.result_value ?? "",
      result_unit: labOrder.result_unit ?? "",
      reference_range: labOrder.reference_range ?? "",
      abnormal_flag: labOrder.abnormal_flag ?? "normal",
      result_notes: labOrder.result_notes ?? "",
    });
  }, [open, labOrder]);

  const handleSave = async () => {
    if (!labOrder) return;
    if (!form.result_value.trim()) {
      toast({
        title: t("common.missingFields"),
        description: t("common.pleaseFillAllRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await labService.update(labOrder.id, {
        status: "completed",
        result_value: form.result_value,
        result_unit: form.result_unit || null,
        reference_range: form.reference_range || null,
        abnormal_flag: form.abnormal_flag,
        result_notes: form.result_notes || null,
      });
      toast({ title: "Lab result completed" });
      onSuccess();
      onClose();
      setForm(defaultForm());
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditingCompletedResult ? "Edit lab result" : "Complete lab result"}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEditingCompletedResult
              ? `Update the structured result for ${labOrder?.test_name ?? "this test"}.`
              : `Enter the structured result for ${labOrder?.test_name ?? "this test"} before marking it completed.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Result value *</Label>
            <Input
              value={form.result_value}
              onChange={(e) => setForm((prev) => ({ ...prev, result_value: e.target.value }))}
              placeholder="e.g. 11.2 or Positive"
            />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <Input
              value={form.result_unit}
              onChange={(e) => setForm((prev) => ({ ...prev, result_unit: e.target.value }))}
              placeholder="e.g. g/dL"
            />
          </div>

          <div className="space-y-2">
            <Label>Reference range</Label>
            <Input
              value={form.reference_range}
              onChange={(e) => setForm((prev) => ({ ...prev, reference_range: e.target.value }))}
              placeholder="e.g. 12.0 - 16.0"
            />
          </div>

          <div className="space-y-2">
            <Label>Flag</Label>
            <Select
              value={form.abnormal_flag}
              onValueChange={(value) => setForm((prev) => ({ ...prev, abnormal_flag: value as LabAbnormalFlag }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select flag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="abnormal">Abnormal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Result notes</Label>
            <Textarea
              rows={4}
              value={form.result_notes}
              onChange={(e) => setForm((prev) => ({ ...prev, result_notes: e.target.value }))}
              placeholder="Interpretation, specimen notes, or follow-up guidance."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? t("common.loading") : isEditingCompletedResult ? "Update result" : "Save result"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
