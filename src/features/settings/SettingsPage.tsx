import { useState } from "react";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionGuard } from "@/core/auth/PermissionGuard";
import { cn } from "@/lib/utils";
import { Building, Users, Bell, Palette } from "lucide-react";

type Tab = "general" | "users" | "notifications" | "appearance";

export const SettingsPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const tabs: { key: Tab; icon: any; label: string }[] = [
    { key: "general", icon: Building, label: t("settings.general") },
    { key: "users", icon: Users, label: t("settings.usersRoles") },
    { key: "notifications", icon: Bell, label: t("common.notifications") },
    { key: "appearance", icon: Palette, label: t("settings.appearance") },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{t("settings.title")}</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-56 flex lg:flex-col gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-card rounded-lg border p-6 max-w-2xl">
          {activeTab === "general" && (
            <div className="space-y-6">
              <h3 className="font-semibold text-lg">{t("settings.clinicInfo")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("settings.clinicName")}</Label>
                  <Input defaultValue={user?.tenantName ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.slug")}</Label>
                  <Input defaultValue={user?.tenantSlug ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.phone")}</Label>
                  <Input defaultValue="+966 11 234 5678" />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.email")}</Label>
                  <Input defaultValue="info@democlini.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("settings.address")}</Label>
                <Input defaultValue="123 King Fahd Road, Riyadh, Saudi Arabia" />
              </div>
              <div className="flex items-center gap-4">
                <Label>{t("common.language")}</Label>
                <LanguageSwitcher />
              </div>
              <Button>{t("common.save")}</Button>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">{t("settings.usersRoles")}</h3>
              <p className="text-sm text-muted-foreground">{t("settings.manageStaff")}</p>
              <PermissionGuard permission="manage_users" fallback={<p className="text-muted-foreground">{t("settings.noPermission")}</p>}>
                <div className="space-y-3">
                  {["Dr. Sarah Ahmed - Admin", "Dr. John Smith - Doctor", "Emily Davis - Receptionist", "Nurse Mary - Nurse", "Ahmed Ali - Accountant"].map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="text-sm">{u}</span>
                      <Button variant="outline" size="sm">{t("common.edit")}</Button>
                    </div>
                  ))}
                </div>
              </PermissionGuard>
            </div>
          )}

          {activeTab === "notifications" && (
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
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-input accent-primary" />
                </div>
              ))}
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">{t("settings.appearance")}</h3>
              <div className="p-6 rounded-lg bg-muted/50 text-center text-muted-foreground">
                {t("settings.themeCustomization")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
