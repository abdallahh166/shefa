import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Inputs";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/core/auth/authStore";
import { useI18n } from "@/core/i18n/i18nStore";
import { useReauthPromptStore } from "./reauthPrompt";
import { reauthService } from "@/services/auth/reauth.service";

export const ReauthDialog = () => {
  const { t } = useI18n(["auth"]);
  const { user } = useAuth();
  const { request, resolve, reject } = useReauthPromptStore();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (loading) return;
    setPassword("");
    setError(null);
    reject(new Error(t("auth.reauth.cancelled")));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await reauthService.reauthenticate(password);
      setPassword("");
      resolve();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={!!request} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-md" hideClose={loading}>
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription>
            {request.description}
            {user?.email ? (
              <span className="mt-2 block text-xs text-muted-foreground">
                {t("auth.reauthEmailHint").replace("{email}", user.email)}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reauth-password">{t("auth.passwordLabel")}</Label>
            <Input
              id="reauth-password"
              type="password"
              autoFocus
              value={password}
              error={!!error}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              {request.cancelLabel ?? t("common.cancel")}
            </Button>
            <Button type="submit" loading={loading} disabled={!password.trim()}>
              {request.actionLabel ?? t("auth.reauthAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
