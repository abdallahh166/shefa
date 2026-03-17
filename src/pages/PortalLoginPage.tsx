import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/services/supabase/client";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Inputs";

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

      const { data: metadata, error: metadataError } = await supabase.rpc("get_portal_login_metadata", {
        _slug: clinicSlug,
        _email: normalizedEmail,
      });
      const metaRow = Array.isArray(metadata) ? metadata[0] : metadata;
      if (metadataError || !metaRow?.tenant_id || !metaRow?.patient_id) {
        throw new Error("No portal invite found for this email");
      }

      const redirectTo = `${window.location.origin}/portal/${clinicSlug}`;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            portal: true,
            tenant_id: metaRow.tenant_id,
            patient_id: metaRow.patient_id,
          },
        },
      });
      if (signInError) {
        throw signInError;
      }
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send magic link";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/20">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Patient Portal</h1>
          <p className="text-sm text-muted-foreground">Enter your email to receive a magic link.</p>
        </div>

        {sent ? (
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
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
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button onClick={handleSend} disabled={!email || loading} className="w-full">
              {loading ? "Sending..." : "Send magic link"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PortalLoginPage;
