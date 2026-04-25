import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ArrowRight } from "lucide-react";
import { useSubscription } from "@/core/subscription/SubscriptionContext";
import { useAuth } from "@/core/auth/authStore";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/primitives/Button";
import { Badge } from "@/components/ui/badge";
import { pricingService } from "@/services/pricing/pricing.service";
import { queryKeys } from "@/services/queryKeys";
import { cn } from "@/lib/utils";

const faqs = [
  { q: "هل يمكنني الإلغاء في أي وقت؟", a: "نعم، يمكنك الإلغاء في أي وقت وسيظل الوصول متاحاً حتى نهاية فترة الفوترة الحالية." },
  { q: "هل بياناتي آمنة؟", a: "نعم، نستخدم ضوابط أمان وتشفير لحماية بيانات العيادة والمرضى." },
  { q: "هل يمكنني البدء مجاناً؟", a: "نعم، يمكنك البدء بخطة مجانية ثم الترقية عندما تحتاج مزيداً من الإمكانات." },
];

export const PricingPage = () => {
  const [annual, setAnnual] = useState(false);
  const { plan: currentPlan } = useSubscription();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: queryKeys.pricing.public(),
    queryFn: () => pricingService.listPublic(),
  });

  const orderedPlans = useMemo(
    () => [...plans].sort((left, right) => left.display_order - right.display_order),
    [plans],
  );

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="text-center py-16 px-4">
        <h1 className="text-4xl font-bold text-foreground mb-4">اختر الخطة المناسبة لعيادتك</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          الأسعار والخطط أدناه يتم إدارتها مباشرة من لوحة المشرف العام.
        </p>

        <div className="inline-flex items-center gap-3 bg-muted rounded-full p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAnnual(false)}
            aria-pressed={!annual}
            className={cn(
              "h-auto rounded-full px-5 py-2 text-sm font-medium transition-colors",
              !annual ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
            )}
          >
            شهري
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAnnual(true)}
            aria-pressed={annual}
            className={cn(
              "h-auto rounded-full px-5 py-2 text-sm font-medium transition-colors",
              annual ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
            )}
          >
            سنوي
            <Badge variant="secondary" className="me-2 text-xs">مخفض</Badge>
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="min-h-[420px] animate-pulse">
              <CardHeader className="space-y-3">
                <div className="h-6 rounded bg-muted" />
                <div className="h-4 rounded bg-muted/70" />
                <div className="h-12 rounded bg-muted/70" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 rounded bg-muted/70" />
                <div className="h-4 rounded bg-muted/70" />
                <div className="h-4 rounded bg-muted/70" />
              </CardContent>
            </Card>
          ))
        ) : orderedPlans.map((plan) => {
          const isCurrent = isAuthenticated && currentPlan === plan.plan_code;
          const price = annual ? plan.annual_price : plan.monthly_price;

          return (
            <Card
              key={plan.id}
              data-testid={`pricing-card-${plan.plan_code}`}
              className={cn(
                "relative flex flex-col",
                plan.is_popular && "border-primary shadow-lg ring-2 ring-primary/20",
              )}
            >
              {plan.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3">الأكثر شعبية</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.doctor_limit_label}</p>
                {plan.description ? (
                  <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">{plan.description}</p>
                ) : (
                  <div className="min-h-[40px]" />
                )}
                {plan.is_enterprise_contact ? (
                  <div className="mt-4">
                    <span className="text-2xl font-bold text-foreground">تواصل معنا</span>
                  </div>
                ) : (
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">{price}</span>
                    <span className="text-muted-foreground text-sm me-1">
                      {plan.currency}/{annual ? "سنة" : "شهر"}
                    </span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1 pt-4">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    خطتك الحالية
                  </Button>
                ) : plan.is_enterprise_contact ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      window.location.href = "mailto:sales@medflow.app?subject=Enterprise pricing inquiry";
                    }}
                  >
                    تواصل معنا
                    <ArrowRight className="h-4 w-4 me-2" />
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.is_popular ? "default" : "outline"}
                    onClick={() => {
                      if (!isAuthenticated) {
                        navigate("/login");
                        return;
                      }
                      window.location.href = `mailto:sales@medflow.app?subject=${encodeURIComponent(`Plan upgrade request: ${plan.name}`)}`;
                    }}
                  >
                    طلب ترقية
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-center mb-8 text-foreground">الأسئلة الشائعة</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.q}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{faq.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
