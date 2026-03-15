import { useState } from "react";
import { useSubscription } from "./SubscriptionContext";
import { useAuth } from "@/core/auth/authStore";
import { useNavigate } from "react-router-dom";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/primitives/Button";

export const UpgradeBanner = () => {
  const { plan, isLoading } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed || plan !== "free" || user?.role === "super_admin") return null;

  return (
    <div className="bg-warning/15 border-b border-warning/30 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-warning-foreground min-w-0">
        <Sparkles className="h-4 w-4 shrink-0 text-warning" />
        <span className="truncate text-foreground">
          أنت على الخطة المجانية — قم بالترقية للوصول لجميع المميزات
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="default"
          className="text-xs h-7"
          onClick={() => navigate("/pricing")}
        >
          ترقية
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss upgrade banner"
          title="Dismiss upgrade banner"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

