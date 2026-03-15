import { useI18n, Locale } from "@/core/i18n/i18nStore";
import { Globe } from "lucide-react";
import { Button } from "@/components/primitives/Button";

export const LanguageSwitcher = () => {
  const { locale, setLocale, t } = useI18n();

  const toggle = () => {
    const next: Locale = locale === "en" ? "ar" : "en";
    setLocale(next);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <Globe className="h-3.5 w-3.5" />
      {locale === "en" ? t("common.arabic") : t("common.english")}
    </Button>
  );
};
