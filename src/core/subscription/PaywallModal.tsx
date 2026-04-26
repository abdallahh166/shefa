import { useSubscription } from "./SubscriptionContext";
import { isSuperAdmin, useAuth } from "@/core/auth/authStore";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/primitives/Button";

export const PaywallModal = () => {
  const { isExpired, plan, expiresAt, isLoading } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Don't show for super_admins or while loading
  if (isLoading || !isExpired || isSuperAdmin(user)) return null;

  const formattedDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent hideClose className="max-w-md p-8 text-center space-y-6">
        <DialogHeader className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle className="text-2xl font-bold text-foreground">Subscription Access Paused</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Current plan: <span className="font-semibold text-foreground capitalize">{plan}</span>
          </DialogDescription>
        </DialogHeader>
        {formattedDate && (
          <p className="text-sm text-muted-foreground">
            Access ends on: {formattedDate}
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          Renew or upgrade the clinic subscription to continue using restricted modules.
        </p>
        <Button
          size="lg"
          className="w-full text-base"
          onClick={() => navigate("/pricing")}
        >
          View Plans
        </Button>
      </DialogContent>
    </Dialog>
  );
};
