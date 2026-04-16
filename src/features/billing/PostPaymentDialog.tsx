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

const getInvoiceStatusLabel = (status?: string) => {
  if (status === "paid") return "Paid";
  if (status === "pending") return "Pending";
  if (status === "overdue") return "Overdue";
  if (status === "partially_paid") return "Partially paid";
  if (status === "void") return "Void";
  return status ?? "-";
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
      toast({ title: "Payment posted" });
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
          <DialogTitle>Post payment</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Record a collected payment against this invoice and keep the remaining balance accurate.
          </DialogDescription>
        </DialogHeader>

        {invoice ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-4 md:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Invoice</div>
                <div className="font-medium">{invoice.invoice_code}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Patient</div>
                <div className="font-medium">{invoice.patients?.full_name ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Outstanding</div>
                <div className="font-medium">{formatCurrency(outstandingBalance, locale)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <StatusBadge variant={statusVariant}>{getInvoiceStatusLabel(invoice.status)}</StatusBadge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount *</Label>
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
                <Label>Method *</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, payment_method: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="mobile_wallet">Mobile wallet</SelectItem>
                    <SelectItem value="insurance">Insurance remittance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Collected at</Label>
                <Input
                  type="datetime-local"
                  value={form.paid_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, paid_at: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input
                  value={form.reference}
                  onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
                  placeholder="Terminal receipt, transfer ref, etc."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Walk-in payment, insurer batch, split settlement notes, etc."
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Payment history</h3>
                <span className="text-xs text-muted-foreground">
                  {paymentHistoryQuery.data?.length ?? 0} posted payment{(paymentHistoryQuery.data?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
              <div className="rounded-lg border">
                {paymentHistoryQuery.isLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
                ) : (paymentHistoryQuery.data?.length ?? 0) === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No payments recorded yet.</div>
                ) : (
                  <div className="divide-y">
                    {paymentHistoryQuery.data?.map((payment) => (
                      <div key={payment.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                        <div>
                          <div className="font-medium">{formatCurrency(Number(payment.amount), locale)}</div>
                          <div className="text-xs text-muted-foreground">
                            {payment.payment_method.replace("_", " ")} on {formatDate(payment.paid_at, locale, "datetime", calendarType)}
                          </div>
                          {payment.reference ? (
                            <div className="text-xs text-muted-foreground">Ref: {payment.reference}</div>
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
            {saving ? t("common.loading") : "Post payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
