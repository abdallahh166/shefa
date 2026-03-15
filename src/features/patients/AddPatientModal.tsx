import { useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/primitives/Inputs";
import { toast } from "@/hooks/use-toast";
import { patientService } from "@/services/patients/patient.service";

interface AddPatientModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddPatientModal = ({ open, onClose, onSuccess }: AddPatientModalProps) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    date_of_birth: "",
    gender: "male",
    blood_type: "",
    phone: "",
    email: "",
    insurance_provider: "",
  });

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      await patientService.create({
        full_name: form.full_name,
        date_of_birth: form.date_of_birth || null,
        gender: (form.gender || undefined) as "male" | "female" | undefined,
        blood_type: (form.blood_type || undefined) as "A+" | "A-" | "AB+" | "AB-" | "B+" | "B-" | "O+" | "O-" | undefined,
        phone: form.phone || null,
        email: form.email || null,
        insurance_provider: form.insurance_provider || null,
      });
      toast({ title: t("patients.addPatient"), description: "Patient added successfully" });
      onSuccess();
      onClose();
      setForm({ full_name: "", date_of_birth: "", gender: "male", blood_type: "", phone: "", email: "", insurance_provider: "" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to add patient", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("patients.addPatient")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("patients.addPatient")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>{t("patients.fullName")} *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                data-testid="patient-full-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("patients.dateOfBirth")}</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("patients.gender")}</Label>
              <Select value={form.gender} onValueChange={(value) => setForm({ ...form, gender: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("patients.gender")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t("patients.male")}</SelectItem>
                  <SelectItem value="female">{t("patients.female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("patients.bloodType")}</Label>
              <Input value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })} placeholder="A+" />
            </div>
            <div className="space-y-2">
              <Label>{t("common.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("patients.insuranceProvider")}</Label>
              <Input value={form.insurance_provider} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" loading={loading} data-testid="patient-save">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

