import { useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/primitives/Inputs";
import { toast } from "@/hooks/use-toast";
import { pharmacyService } from "@/services/pharmacy/pharmacy.service";
import type { MedicationCreateInput } from "@/domain/pharmacy/medication.types";

interface AddMedicationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  "Antihypertensive", "Antidiabetic", "Antibiotic", "Analgesic", "Antihistamine",
  "Proton Pump Inhibitor", "Statin", "NSAID", "Vitamin", "Other",
];

export const AddMedicationModal = ({ open, onClose, onSuccess }: AddMedicationModalProps) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "Other",
    stock: "",
    unit: "tablets",
    price: "",
  });

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast({ title: "Medication name required", variant: "destructive" });
      return;
    }
    setLoading(true);

    const stock = Number.parseInt(form.stock, 10) || 0;
    const status: MedicationCreateInput["status"] = stock === 0 ? "out_of_stock" : stock < 50 ? "low_stock" : "in_stock";

    try {
      await pharmacyService.create({
        name: form.name,
        category: form.category,
        stock,
        unit: form.unit,
        price: Number.parseFloat(form.price) || 0,
        status,
      });
      toast({ title: "Medication added successfully" });
      onSuccess();
      onClose();
      setForm({ name: "", category: "Other", stock: "", unit: "tablets", price: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pharmacy.addMedication")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("pharmacy.addMedication")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("pharmacy.medication")} *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lisinopril 10mg" />
          </div>
          <div className="space-y-2">
            <Label>{t("common.category")}</Label>
            <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t("common.category")} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("common.stock")}</Label>
              <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="100" />
            </div>
            <div className="space-y-2">
              <Label>{t("pharmacy.unit")}</Label>
              <Select value={form.unit} onValueChange={(value) => setForm({ ...form, unit: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("pharmacy.unit")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tablets">{t("pharmacy.units.tablets")}</SelectItem>
                  <SelectItem value="capsules">{t("pharmacy.units.capsules")}</SelectItem>
                  <SelectItem value="ml">{t("pharmacy.units.ml")}</SelectItem>
                  <SelectItem value="mg">{t("pharmacy.units.mg")}</SelectItem>
                  <SelectItem value="units">{t("pharmacy.units.units")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("common.price")} ($)</Label>
            <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="12.50" />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" loading={loading}>{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

