import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-8">
          <LanguageSwitcher />
        </div>

        <div className="bg-card rounded-lg border p-8">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm mb-6">M</div>

          {sent ? (
            <div className="space-y-4">
              <h1 className="text-xl font-bold">Check your email</h1>
              <p className="text-muted-foreground text-sm">
                We sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
                Back to login
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-2">Forgot your password?</h1>
              <p className="text-muted-foreground text-sm mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "..." : "Send reset link"}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button onClick={() => navigate("/login")} className="text-sm text-primary hover:underline">
                  Back to login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
