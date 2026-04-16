import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Inputs";
import { portalService } from "@/services/portal/portal.service";

export const PortalLoginPage = () => {
  const { clinicSlug } = useParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!clinicSlug) {
        throw new Error("Invalid clinic link");
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error("Email is required");
      }

      await portalService.sendMagicLink({
        clinicSlug,
        email: normalizedEmail,
        redirectTo: `${window.location.origin}/portal/${clinicSlug}`,
      });
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send magic link";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-muted/20" data-testid="portal-login-page">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6">
        <div>
          <h1 className="text-xl font-semibold">Patient Portal</h1>
          <p className="text-sm text-muted-foreground">Enter your email to receive a magic link.</p>
        </div>

        {sent ? (
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground" data-testid="portal-login-success">
            Check your email for a sign-in link. You can close this page after signing in.
          </div>
        ) : (
          <>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="you@example.com"
              data-testid="portal-login-email"
            />
            {error ? <p className="text-sm text-destructive" data-testid="portal-login-error">{error}</p> : null}
            <Button
              onClick={handleSend}
              disabled={!email || loading}
              className="w-full"
              data-testid="portal-login-submit"
            >
              {loading ? "Sending..." : "Send magic link"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PortalLoginPage;
