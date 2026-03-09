import { useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export const NotificationsTab = () => {
  const { t } = useI18n();
  const [notifSettings, setNotifSettings] = useState({
    appointmentReminders: true,
    labResultsReady: true,
    billingAlerts: true,
    systemUpdates: false,
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">{t("settings.notifPreferences")}</h3>
      {[
        { key: "appointmentReminders", label: t("settings.appointmentReminders") },
        { key: "labResultsReady", label: t("settings.labResultsReady") },
        { key: "billingAlerts", label: t("settings.billingAlerts") },
        { key: "systemUpdates", label: t("settings.systemUpdates") },
      ].map((pref) => (
        <div key={pref.key} className="flex items-center justify-between p-3 rounded-lg border">
          <span className="text-sm">{pref.label}</span>
          <input
            type="checkbox"
            checked={(notifSettings as any)[pref.key]}
            onChange={(e) => setNotifSettings({ ...notifSettings, [pref.key]: e.target.checked })}
            className="h-4 w-4 rounded border-input accent-primary"
          />
        </div>
      ))}
      <Button onClick={() => toast({ title: t("common.preferencesSaved") })}>{t("common.save")}</Button>
    </div>
  );
};
