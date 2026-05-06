import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/primitives/Inputs";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { formatCurrency, formatDate } from "@/shared/utils/formatDate";
import { toast } from "@/hooks/use-toast";
import { billingService } from "@/services/billing/billing.service";
import { queryKeys } from "@/services/queryKeys";
import type { InvoicePaymentCreateInput, InvoiceWithPatient } from "@/domain/billing/billing.types";

interface PostPaymentDialogProps {
  invoice: InvoiceWithPatient | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const defaultMethod = "cash";
const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 16);
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const getInvoiceStatusLabel = (status: string | undefined, t: (path: string, options?: Record<string, unknown>) => string) => {
  if (status === "paid") return t("billing.paid");
  if (status === "pending") return t("billing.pending");
  if (status === "overdue") return t("billing.overdue");
  if (status === "partially_paid") return t("billing.status.partiallyPaid");
  if (status === "void") return t("billing.status.void");
  return status ?? "-";
};

const getPaymentMethodLabel = (method: string, t: (path: string, options?: Record<string, unknown>) => string) => {
  switch (method) {
    case "cash":
      return t("billing.payment.methods.cash");
    case "card":
      return t("billing.payment.methods.card");
    case "bank_transfer":
      return t("billing.payment.methods.bankTransfer");
    case "mobile_wallet":
      return t("billing.payment.methods.mobileWallet");
    case "insurance":
      return t("billing.payment.methods.insurance");
    case "other":
      return t("billing.payment.methods.other");
    default:
      return method.replace("_", " ");
  }
};

export const PostPaymentDialog = ({ invoice, open, onClose, onSuccess }: PostPaymentDialogProps) => {
  const { t, locale, calendarType } = useI18n();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: invoice ? String(invoice.balance_due ?? invoice.amount) : "",
    payment_method: defaultMethod,
    paid_at: toDateTimeLocalValue(),
    reference: "",
    notes: "",
  });

  const paymentHistoryQuery = useQuery({
    queryKey: queryKeys.billing.payments(invoice?.id ?? "", user?.tenantId),
    queryFn: async () => billingService.listPayments(invoice!.id),
    enabled: open && !!invoice?.id && !!user?.tenantId,
  });

  const outstandingBalance = useMemo(
    () => Number(invoice?.balance_due ?? 0),
    [invoice?.balance_due],
  );

  const statusVariant = invoice?.status === "paid"
    ? "success"
    : invoice?.status === "void"
      ? "destructive"
      : invoice?.status === "overdue"
        ? "destructive"
        : invoice?.status === "partially_paid"
          ? "warning"
          : "warning";

  const resetForm = () => {
    setForm({
      amount: invoice ? String(invoice.balance_due ?? invoice.amount) : "",
      payment_method: defaultMethod,
      paid_at: toDateTimeLocalValue(),
      reference: "",
      notes: "",
    });
  };

  useEffect(() => {
    if (!open) return;
    setForm({
      amount: invoice ? String(invoice.balance_due ?? invoice.amount) : "",
      payment_method: defaultMethod,
      paid_at: toDateTimeLocalValue(),
      reference: "",
      notes: "",
    });
  }, [invoice, open]);

  const handleSubmit = async () => {
    if (!invoice) return;
    if (!form.amount.trim()) {
      toast({
        title: t("common.missingFields"),
        description: t("common.pleaseFillAllRequiredFields"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const input: InvoicePaymentCreateInput = {
        amount: Number.parseFloat(form.amount),
        payment_method: form.payment_method as InvoicePaymentCreateInput["payment_method"],
        paid_at: new Date(form.paid_at).toISOString(),
        reference: form.reference || null,
        notes: form.notes || null,
      };
      await billingService.postPayment(invoice.id, input);
      toast({ title: t("billing.payment.posted") });
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ title: t("common.error"), description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("billing.payment.title")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("billing.payment.description")}
          </DialogDescription>
        </DialogHeader>

        {invoice ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">{t("billing.invoice")}</div>
                <div className="font-medium">{invoice.invoice_code}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("appointments.patient")}</div>
                <div className="font-medium">{invoice.patients?.full_name ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("billing.outstanding")}</div>
                <div className="font-medium">{formatCurrency(outstandingBalance, locale)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("common.status")}</div>
                <StatusBadge variant={statusVariant}>{getInvoiceStatusLabel(invoice.status, t)}</StatusBadge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("billing.payment.amountRequired")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={String(outstandingBalance || invoice.amount)}
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("billing.payment.methodRequired")}</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, payment_method: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("billing.payment.selectMethod")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("billing.payment.methods.cash")}</SelectItem>
                    <SelectItem value="card">{t("billing.payment.methods.card")}</SelectItem>
                    <SelectItem value="bank_transfer">{t("billing.payment.methods.bankTransfer")}</SelectItem>
                    <SelectItem value="mobile_wallet">{t("billing.payment.methods.mobileWallet")}</SelectItem>
                    <SelectItem value="insurance">{t("billing.payment.methods.insurance")}</SelectItem>
                    <SelectItem value="other">{t("billing.payment.methods.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("billing.payment.collectedAt")}</Label>
                <Input
                  type="datetime-local"
                  value={form.paid_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, paid_at: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("billing.payment.reference")}</Label>
                <Input
                  value={form.reference}
                  onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
                  placeholder={t("billing.payment.referencePlaceholder")}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{t("billing.payment.notes")}</Label>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder={t("billing.payment.notesPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t("billing.payment.history")}</h3>
                <span className="text-xs text-muted-foreground">
                  {t("billing.payment.postedCount", { count: paymentHistoryQuery.data?.length ?? 0 })}
                </span>
              </div>
              <div className="rounded-lg border">
                {paymentHistoryQuery.isLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
                ) : (paymentHistoryQuery.data?.length ?? 0) === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">{t("billing.payment.emptyHistory")}</div>
                ) : (
                  <div className="divide-y">
                    {paymentHistoryQuery.data?.map((payment) => (
                      <div key={payment.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                        <div>
                          <div className="font-medium">{formatCurrency(Number(payment.amount), locale)}</div>
                          <div className="text-xs text-muted-foreground">
                            {t("billing.payment.methodOnDate", {
                              method: getPaymentMethodLabel(payment.payment_method, t),
                              date: formatDate(payment.paid_at, locale, "datetime", calendarType),
                            })}
                          </div>
                          {payment.reference ? (
                            <div className="text-xs text-muted-foreground">{t("billing.payment.referenceShort")}: {payment.reference}</div>
                          ) : null}
                        </div>
                        {payment.notes ? (
                          <div className="max-w-sm text-sm text-muted-foreground">{payment.notes}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving || !invoice}>
            {saving ? t("common.loading") : t("billing.payment.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
