import { useI18n } from "@/core/i18n/i18nStore";
import { StatCard } from "@/shared/components/StatCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { DataTable, Column } from "@/shared/components/DataTable";
import { Shield, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InsuranceClaim {
  id: string;
  patient: string;
  provider: string;
  service: string;
  amount: number;
  date: string;
  status: "approved" | "pending" | "rejected";
}

const DEMO_CLAIMS: InsuranceClaim[] = [
  { id: "CLM-001", patient: "Mohammed Al-Rashid", provider: "National Health Co.", service: "Cardiology Consultation", amount: 350, date: "2026-03-08", status: "approved" },
  { id: "CLM-002", patient: "Fatima Hassan", provider: "Gulf Insurance", service: "Follow-up Visit", amount: 150, date: "2026-03-07", status: "pending" },
  { id: "CLM-003", patient: "Ali Mansour", provider: "MedCare Plus", service: "Lab Work", amount: 520, date: "2026-03-06", status: "approved" },
  { id: "CLM-004", patient: "Noor Ibrahim", provider: "National Health Co.", service: "Pediatric Check-up", amount: 200, date: "2026-03-05", status: "rejected" },
];

const statusVariant = { approved: "success", pending: "warning", rejected: "destructive" } as const;

export const InsurancePage = () => {
  const { t } = useI18n();

  const columns: Column<InsuranceClaim>[] = [
    { key: "id", header: t("insurance.claimNumber"), render: (c) => <span className="font-medium">{c.id}</span> },
    { key: "patient", header: t("appointments.patient") },
    { key: "provider", header: t("common.provider") },
    { key: "service", header: t("common.service") },
    { key: "amount", header: t("common.amount"), render: (c) => `$${c.amount}` },
    { key: "date", header: t("common.date") },
    { key: "status", header: t("common.status"), render: (c) => <StatusBadge variant={statusVariant[c.status]}>{t(`insurance.${c.status}`)}</StatusBadge> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{t("insurance.title")}</h1>
        <Button><Plus className="h-4 w-4" /> {t("insurance.newClaim")}</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t("insurance.activeProviders")} value="12" icon={Shield} />
        <StatCard title={t("insurance.pendingClaims")} value="8" icon={Shield} />
        <StatCard title={t("insurance.approvalRate")} value="87%" icon={Shield} />
      </div>

      <DataTable columns={columns} data={DEMO_CLAIMS} keyExtractor={(c) => c.id} />
    </div>
  );
};
