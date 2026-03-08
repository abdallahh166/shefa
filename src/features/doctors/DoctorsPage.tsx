import { useI18n } from "@/core/i18n/i18nStore";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/core/auth/PermissionGuard";
import { UserPlus, Star } from "lucide-react";

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  patients: number;
  rating: number;
  status: "available" | "busy" | "onLeave";
  avatar: string;
}

const DEMO_DOCTORS: Doctor[] = [
  { id: "1", name: "Dr. Sarah Ahmed", specialty: "Cardiology", patients: 142, rating: 4.9, status: "available", avatar: "SA" },
  { id: "2", name: "Dr. John Smith", specialty: "Orthopedics", patients: 98, rating: 4.7, status: "busy", avatar: "JS" },
  { id: "3", name: "Dr. Layla Khalid", specialty: "Pediatrics", patients: 215, rating: 4.8, status: "available", avatar: "LK" },
  { id: "4", name: "Dr. Omar Hassan", specialty: "Dermatology", patients: 67, rating: 4.6, status: "onLeave", avatar: "OH" },
  { id: "5", name: "Dr. Amira Nasser", specialty: "Neurology", patients: 89, rating: 4.9, status: "available", avatar: "AN" },
  { id: "6", name: "Dr. Yusuf Ali", specialty: "General Surgery", patients: 156, rating: 4.5, status: "busy", avatar: "YA" },
];

const statusVariant = { available: "success", busy: "warning", onLeave: "default" } as const;

export const DoctorsPage = () => {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{t("doctors.title")}</h1>
        <PermissionGuard permission="manage_users">
          <Button>
            <UserPlus className="h-4 w-4" />
            {t("doctors.addDoctor")}
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEMO_DOCTORS.map((doc) => (
          <div key={doc.id} className="bg-card rounded-lg border p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                  {doc.avatar}
                </div>
                <div>
                  <h3 className="font-semibold">{doc.name}</h3>
                  <p className="text-sm text-muted-foreground">{doc.specialty}</p>
                </div>
              </div>
              <StatusBadge variant={statusVariant[doc.status]}>
                {t(`doctors.${doc.status}`)}
              </StatusBadge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {doc.patients} {t("doctors.patientsCount")}
              </span>
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                <span className="font-medium">{doc.rating}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
