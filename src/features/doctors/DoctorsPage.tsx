import { useI18n } from "@/core/i18n/i18nStore";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/core/auth/PermissionGuard";
import { UserPlus, Star, Search } from "lucide-react";
import { useSupabaseTable } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/core/auth/authStore";
import { Tables } from "@/integrations/supabase/types";
import { useState, useMemo } from "react";

type Doctor = Tables<"doctors">;

const DEMO_DOCTORS: Partial<Doctor>[] = [
  { id: "1", full_name: "Dr. Sarah Ahmed", specialty: "Cardiology", rating: 4.9, status: "available" },
  { id: "2", full_name: "Dr. John Smith", specialty: "Orthopedics", rating: 4.7, status: "busy" },
  { id: "3", full_name: "Dr. Layla Khalid", specialty: "Pediatrics", rating: 4.8, status: "available" },
  { id: "4", full_name: "Dr. Omar Hassan", specialty: "Dermatology", rating: 4.6, status: "on_leave" },
  { id: "5", full_name: "Dr. Amira Nasser", specialty: "Neurology", rating: 4.9, status: "available" },
];

const statusVariant: Record<string, "success" | "warning" | "default"> = { available: "success", busy: "warning", on_leave: "default", onLeave: "default" };

export const DoctorsPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const isDemo = user?.tenantId === "demo";
  const [search, setSearch] = useState("");

  const { data: liveDoctors = [], isLoading } = useSupabaseTable<Doctor>("doctors");

  const doctors = isDemo ? DEMO_DOCTORS as Doctor[] : liveDoctors;

  const filtered = useMemo(() => {
    if (!search) return doctors;
    const q = search.toLowerCase();
    return doctors.filter((d) =>
      d.full_name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q)
    );
  }, [doctors, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{t("doctors.title")}</h1>
        <PermissionGuard permission="manage_users">
          <Button><UserPlus className="h-4 w-4" />{t("doctors.addDoctor")}</Button>
        </PermissionGuard>
      </div>

      <div className="flex items-center gap-2 bg-card rounded-lg border px-4 py-2 max-w-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("common.search")}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {!isDemo && isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <div key={doc.id} className="bg-card rounded-lg border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                    {doc.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{doc.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{doc.specialty}</p>
                  </div>
                </div>
                <StatusBadge variant={statusVariant[doc.status] ?? "default"}>
                  {doc.status.replace("_", " ")}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-end text-sm">
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  <span className="font-medium">{doc.rating ?? "—"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
