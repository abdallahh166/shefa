import { useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/primitives/Inputs";
import { toast } from "@/hooks/use-toast";
import { doctorService } from "@/services/doctors/doctor.service";

interface AddDoctorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SPECIALTIES = [
  "Cardiology", "Orthopedics", "Pediatrics", "Dermatology", "Neurology",
  "General Practice", "Internal Medicine", "Surgery", "Ophthalmology", "ENT",
];

export const AddDoctorModal = ({ open, onClose, onSuccess }: AddDoctorModalProps) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    specialty: "General Practice",
    email: "",
    phone: "",
    status: "available",
  });

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.specialty) {
      toast({ title: "Name and specialty required", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      await doctorService.create({
        full_name: form.full_name,
        specialty: form.specialty,
        email: form.email || null,
        phone: form.phone || null,
        status: form.status as "available" | "busy" | "on_leave",
        rating: 0,
      });
      toast({ title: "Doctor added successfully" });
      onSuccess();
      onClose();
      setForm({ full_name: "", specialty: "General Practice", email: "", phone: "", status: "available" });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("doctors.addDoctor")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("doctors.addDoctor")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("patients.fullName")} *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Dr. John Smith" />
          </div>
          <div className="space-y-2">
            <Label>{t("doctors.specialty")} *</Label>
            <Select value={form.specialty} onValueChange={(value) => setForm({ ...form, specialty: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t("doctors.specialty")} />
              </SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("common.email")}</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.phone")}</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.status")}</Label>
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t("common.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">{t("doctors.available")}</SelectItem>
                <SelectItem value="busy">{t("doctors.busy")}</SelectItem>
                <SelectItem value="on_leave">{t("doctors.onLeave")}</SelectItem>
              </SelectContent>
            </Select>
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

