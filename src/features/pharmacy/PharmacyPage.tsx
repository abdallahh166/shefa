import { useI18n } from "@/core/i18n/i18nStore";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { StatCard } from "@/shared/components/StatCard";
import { Button } from "@/components/ui/button";
import { Pill, Package, AlertTriangle, Plus } from "lucide-react";

interface Medication {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  price: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
}

const DEMO_MEDS: Medication[] = [
  { id: "MED-001", name: "Lisinopril 10mg", category: "Antihypertensive", stock: 450, unit: "tablets", price: 12.50, status: "in_stock" },
  { id: "MED-002", name: "Metformin 500mg", category: "Antidiabetic", stock: 380, unit: "tablets", price: 8.00, status: "in_stock" },
  { id: "MED-003", name: "Amoxicillin 500mg", category: "Antibiotic", stock: 25, unit: "capsules", price: 15.00, status: "low_stock" },
  { id: "MED-004", name: "Omeprazole 20mg", category: "Proton Pump Inhibitor", stock: 200, unit: "capsules", price: 10.00, status: "in_stock" },
  { id: "MED-005", name: "Atorvastatin 20mg", category: "Statin", stock: 0, unit: "tablets", price: 18.00, status: "out_of_stock" },
  { id: "MED-006", name: "Ibuprofen 400mg", category: "NSAID", stock: 520, unit: "tablets", price: 6.50, status: "in_stock" },
];

const statusKey = { in_stock: "inStock", low_stock: "lowStock", out_of_stock: "outOfStock" } as const;
const statusVariant = { in_stock: "success", low_stock: "warning", out_of_stock: "destructive" } as const;

export const PharmacyPage = () => {
  const { t } = useI18n();

  const columns: Column<Medication>[] = [
    { key: "id", header: "ID" },
    { key: "name", header: t("pharmacy.medication"), render: (m) => <span className="font-medium">{m.name}</span> },
    { key: "category", header: t("common.category") },
    { key: "stock", header: t("common.stock"), render: (m) => `${m.stock} ${m.unit}` },
    { key: "price", header: t("common.price"), render: (m) => `$${m.price.toFixed(2)}` },
    { key: "status", header: t("common.status"), render: (m) => <StatusBadge variant={statusVariant[m.status]}>{t(`pharmacy.${statusKey[m.status]}`)}</StatusBadge> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{t("pharmacy.title")}</h1>
        <Button><Plus className="h-4 w-4" /> {t("pharmacy.addMedication")}</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title={t("pharmacy.totalMedications")} value="124" icon={Pill} />
        <StatCard title={t("pharmacy.lowStockItems")} value="8" icon={AlertTriangle} />
        <StatCard title={t("pharmacy.inventoryValue")} value="$34,580" icon={Package} />
      </div>

      <DataTable columns={columns} data={DEMO_MEDS} keyExtractor={(m) => m.id} />
    </div>
  );
};
