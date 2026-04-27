import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/primitives/Button";
import { PrivilegedMfaPanel } from "@/features/auth/PrivilegedMfaPanel";
import { useAuth } from "@/core/auth/authStore";

export const PrivilegedSecurityPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Secure your privileged session</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Finish TOTP setup to restore privileged access for {user?.email ?? "this account"}.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
      <PrivilegedMfaPanel mode="page" />
    </div>
  );
};
