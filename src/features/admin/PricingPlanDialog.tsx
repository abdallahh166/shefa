import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/primitives/Inputs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/core/i18n/i18nStore";
import type { AdminPricingPlan, AdminPricingPlanCreateInput, AdminPricingPlanUpdateInput } from "@/domain/admin/admin.types";

const PLAN_OPTIONS = [
  { value: "free", labelKey: "admin.common.planOptions.free" },
  { value: "starter", labelKey: "admin.common.planOptions.starter" },
  { value: "pro", labelKey: "admin.common.planOptions.pro" },
  { value: "enterprise", labelKey: "admin.common.planOptions.enterprise" },
] as const;

const BILLING_CYCLE_OPTIONS = [
  { value: "monthly", labelKey: "admin.common.billingCycleOptions.monthly" },
  { value: "annual", labelKey: "admin.common.billingCycleOptions.annual" },
] as const;

type PricingPlanDialogValue = AdminPricingPlanCreateInput | AdminPricingPlanUpdateInput;

interface PricingPlanDialogProps {
  open: boolean;
  mode: "create" | "edit";
  plan: AdminPricingPlan | null;
  availablePlanCodes: Array<AdminPricingPlan["plan_code"]>;
  saving: boolean;
  onClose: () => void;
  onSubmit: (value: PricingPlanDialogValue) => Promise<void> | void;
}

interface PricingPlanFormState {
  plan_code: AdminPricingPlan["plan_code"];
  name: string;
  description: string;
  doctor_limit_label: string;
  featuresText: string;
  monthly_price: string;
  annual_price: string;
  currency: string;
  default_billing_cycle: "monthly" | "annual";
  is_popular: boolean;
  is_public: boolean;
  is_enterprise_contact: boolean;
  display_order: string;
}

const defaultFormState: PricingPlanFormState = {
  plan_code: "free",
  name: "",
  description: "",
  doctor_limit_label: "",
  featuresText: "",
  monthly_price: "0",
  annual_price: "0",
  currency: "EGP",
  default_billing_cycle: "monthly",
  is_popular: false,
  is_public: true,
  is_enterprise_contact: false,
  display_order: "0",
};

function toFormState(plan: AdminPricingPlan | null, fallbackPlanCode?: AdminPricingPlan["plan_code"]): PricingPlanFormState {
  if (!plan) {
    return {
      ...defaultFormState,
      plan_code: fallbackPlanCode ?? "free",
    };
  }

  return {
    plan_code: plan.plan_code,
    name: plan.name,
    description: plan.description ?? "",
    doctor_limit_label: plan.doctor_limit_label,
    featuresText: plan.features.join("\n"),
    monthly_price: String(plan.monthly_price),
    annual_price: String(plan.annual_price),
    currency: plan.currency,
    default_billing_cycle: plan.default_billing_cycle,
    is_popular: plan.is_popular,
    is_public: plan.is_public,
    is_enterprise_contact: plan.is_enterprise_contact,
    display_order: String(plan.display_order),
  };
}

export const PricingPlanDialog = ({
  open,
  mode,
  plan,
  availablePlanCodes,
  saving,
  onClose,
  onSubmit,
}: PricingPlanDialogProps) => {
  const { t } = useI18n(["admin"]);
  const fallbackPlanCode = availablePlanCodes[0] ?? "free";
  const [form, setForm] = useState<PricingPlanFormState>(() => toFormState(plan, fallbackPlanCode));

  useEffect(() => {
    if (!open) return;
    setForm(toFormState(plan, fallbackPlanCode));
  }, [fallbackPlanCode, open, plan]);

  const featurePreviewCount = useMemo(
    () =>
      form.featuresText
        .split(/\r?\n/)
        .map((feature) => feature.trim())
        .filter(Boolean).length,
    [form.featuresText],
  );

  const submitDisabled = mode === "create" && availablePlanCodes.length === 0;

  const handleSubmit = async () => {
    if (submitDisabled) return;

    const payload: AdminPricingPlanCreateInput = {
      plan_code: form.plan_code,
      name: form.name,
      description: form.description.trim() || null,
      doctor_limit_label: form.doctor_limit_label,
      features: form.featuresText
        .split(/\r?\n/)
        .map((feature) => feature.trim())
        .filter(Boolean),
      monthly_price: Number(form.monthly_price || 0),
      annual_price: Number(form.annual_price || 0),
      currency: form.currency.trim().toUpperCase(),
      default_billing_cycle: form.default_billing_cycle,
      is_popular: form.is_popular,
      is_public: form.is_public,
      is_enterprise_contact: form.is_enterprise_contact,
      display_order: Number(form.display_order || 0),
    };

    if (mode === "edit") {
      await onSubmit(payload as AdminPricingPlanUpdateInput);
      return;
    }

    await onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? t("admin.pricingDialog.createTitle")
              : t("admin.pricingDialog.editTitle", {
                name: plan?.name ?? t("admin.pricingDialog.editFallbackName"),
              })}
          </DialogTitle>
          <DialogDescription>
            {t("admin.pricingDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pricing-plan-code">{t("admin.pricingDialog.planCode")}</Label>
            <Select
              value={form.plan_code}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, plan_code: value as PricingPlanFormState["plan_code"] }))
              }
              disabled={mode === "edit" || availablePlanCodes.length === 0}
            >
              <SelectTrigger id="pricing-plan-code">
                <SelectValue placeholder={t("admin.pricingDialog.selectPlanCode")} />
              </SelectTrigger>
              <SelectContent>
                {(mode === "edit" ? PLAN_OPTIONS : PLAN_OPTIONS.filter((option) => availablePlanCodes.includes(option.value))).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-plan-name">{t("admin.pricingDialog.displayName")}</Label>
            <Input
              id="pricing-plan-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t("admin.pricingDialog.displayNamePlaceholder")}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pricing-plan-description">{t("admin.pricingDialog.descriptionLabel")}</Label>
            <Textarea
              id="pricing-plan-description"
              rows={3}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={t("admin.pricingDialog.descriptionPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-plan-doctor-limit">{t("admin.pricingDialog.doctorLimitLabel")}</Label>
            <Input
              id="pricing-plan-doctor-limit"
              value={form.doctor_limit_label}
              onChange={(event) => setForm((current) => ({ ...current, doctor_limit_label: event.target.value }))}
              placeholder={t("admin.pricingDialog.doctorLimitPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-plan-currency">{t("admin.pricingDialog.currency")}</Label>
            <Input
              id="pricing-plan-currency"
              value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
              placeholder={t("admin.pricingDialog.currencyPlaceholder")}
              maxLength={10}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-plan-monthly">{t("admin.pricingDialog.monthlyPrice")}</Label>
            <Input
              id="pricing-plan-monthly"
              type="number"
              min="0"
              step="0.01"
              value={form.monthly_price}
              onChange={(event) => setForm((current) => ({ ...current, monthly_price: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-plan-annual">{t("admin.pricingDialog.annualPrice")}</Label>
            <Input
              id="pricing-plan-annual"
              type="number"
              min="0"
              step="0.01"
              value={form.annual_price}
              onChange={(event) => setForm((current) => ({ ...current, annual_price: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-plan-cycle">{t("admin.pricingDialog.defaultBillingCycle")}</Label>
            <Select
              value={form.default_billing_cycle}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, default_billing_cycle: value as "monthly" | "annual" }))
              }
            >
              <SelectTrigger id="pricing-plan-cycle">
                <SelectValue placeholder={t("admin.pricingDialog.selectBillingCycle")} />
              </SelectTrigger>
              <SelectContent>
                {BILLING_CYCLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-plan-order">{t("admin.pricingDialog.displayOrder")}</Label>
            <Input
              id="pricing-plan-order"
              type="number"
              min="0"
              step="1"
              value={form.display_order}
              onChange={(event) => setForm((current) => ({ ...current, display_order: event.target.value }))}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="pricing-plan-features">{t("admin.pricingDialog.features")}</Label>
              <span className="text-xs text-muted-foreground">
                {t("admin.common.featuresCount", { count: featurePreviewCount })}
              </span>
            </div>
            <Textarea
              id="pricing-plan-features"
              rows={7}
              value={form.featuresText}
              onChange={(event) => setForm((current) => ({ ...current, featuresText: event.target.value }))}
              placeholder={t("admin.pricingDialog.featuresPlaceholder")}
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-3">
          <label className="flex items-center gap-3 text-sm font-medium">
            <Checkbox
              checked={form.is_popular}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, is_popular: Boolean(checked) }))}
            />
            {t("admin.pricingDialog.popularPlan")}
          </label>
          <label className="flex items-center gap-3 text-sm font-medium">
            <Checkbox
              checked={form.is_public}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, is_public: Boolean(checked) }))}
            />
            {t("admin.pricingDialog.showOnPublicPricing")}
          </label>
          <label className="flex items-center gap-3 text-sm font-medium">
            <Checkbox
              checked={form.is_enterprise_contact}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, is_enterprise_contact: Boolean(checked) }))
              }
            />
            {t("admin.pricingDialog.useContactSalesCta")}
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || submitDisabled}>
            {saving
              ? t("admin.pricingDialog.saving")
              : mode === "create"
                ? t("admin.pricingDialog.createAction")
                : t("admin.pricingDialog.saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
