import { cn } from "@/lib/utils";
import { useI18n } from "@/core/i18n/i18nStore";
import { Button } from "@/components/primitives/Button";

interface StatusFilterProps {
  options: { value: string; label: string }[];
  selected: string | null;
  onChange: (value: string | null) => void;
}

export const StatusFilter = ({ options, selected, onChange }: StatusFilterProps) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("common.filter")}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(null)}
        aria-pressed={selected === null}
        className={cn(
          "h-7 px-2.5 text-xs font-medium",
          selected === null
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "text-muted-foreground hover:bg-muted"
        )}
      >
        {t("common.all")}
      </Button>
      {options.map((opt) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          key={opt.value}
          onClick={() => onChange(selected === opt.value ? null : opt.value)}
          aria-pressed={selected === opt.value}
          className={cn(
            "h-7 px-2.5 text-xs font-medium",
            selected === opt.value
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
};
