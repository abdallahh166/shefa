import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/core/auth/authStore";
import { useI18n } from "@/core/i18n/i18nStore";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/core/auth/types";

const DEMO_USERS: { email: string; name: string; role: Role }[] = [
  { email: "admin@medflow.com", name: "Dr. Sarah Ahmed", role: "clinic_admin" },
  { email: "doctor@medflow.com", name: "Dr. John Smith", role: "doctor" },
  { email: "receptionist@medflow.com", name: "Emily Davis", role: "receptionist" },
];

export const LoginPage = () => {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@medflow.com");
  const [password, setPassword] = useState("demo123");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const demoUser = DEMO_USERS.find((u) => u.email === email) ?? DEMO_USERS[0];
    login(
      { id: "1", name: demoUser.name, email: demoUser.email, role: demoUser.role, tenantId: "demo-clinic" },
      { id: "demo-clinic", slug: "demo-clinic", name: "MedFlow Demo Clinic" }
    );
    navigate("/tenant/demo-clinic/dashboard");
  };

  const quickLogin = (user: (typeof DEMO_USERS)[number]) => {
    login(
      { id: "1", name: user.name, email: user.email, role: user.role, tenantId: "demo-clinic" },
      { id: "demo-clinic", slug: "demo-clinic", name: "MedFlow Demo Clinic" }
    );
    navigate("/tenant/demo-clinic/dashboard");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative items-center justify-center">
        <div className="text-primary-foreground text-center px-12">
          <div className="h-16 w-16 rounded-2xl bg-primary-foreground/20 flex items-center justify-center text-3xl font-bold mx-auto mb-6">
            M
          </div>
          <h2 className="text-3xl font-bold mb-4">MedFlow</h2>
          <p className="text-primary-foreground/80 text-lg">
            Enterprise Healthcare Management Platform
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4 text-sm text-primary-foreground/70">
            <div className="bg-primary-foreground/10 rounded-lg p-4">Multi-Tenant Architecture</div>
            <div className="bg-primary-foreground/10 rounded-lg p-4">RBAC Security</div>
            <div className="bg-primary-foreground/10 rounded-lg p-4">EMR Integration</div>
            <div className="bg-primary-foreground/10 rounded-lg p-4">Bilingual Support</div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex justify-end mb-8">
            <LanguageSwitcher />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">{t("auth.loginTitle")}</h1>
            <p className="text-muted-foreground">{t("auth.loginSubtitle")}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("auth.emailLabel")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("auth.passwordLabel")}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">{t("auth.login")}</Button>
          </form>

          <div className="mt-8">
            <p className="text-xs text-muted-foreground mb-3">Quick demo login:</p>
            <div className="space-y-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => quickLogin(u)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-start"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{u.role.replace("_", " ")}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
