import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Search, Stethoscope, Users } from "lucide-react";
import { useI18n } from "@/core/i18n/i18nStore";
import { useAuth } from "@/core/auth/authStore";
import { queryKeys } from "@/services/queryKeys";
import { searchService } from "@/services";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/primitives/Button";

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { t } = useI18n();
  const navigate = useNavigate();
  const { clinicSlug } = useParams();
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const debouncedQuery = useDebouncedValue(query, 300);

  const { data: results = [] } = useQuery({
    queryKey: queryKeys.globalSearch.query(debouncedQuery, tenantId),
    queryFn: async () => searchService.globalSearch({ term: debouncedQuery, limit: 8 }),
    enabled: !!tenantId && debouncedQuery.trim().length >= 2,
  });

  const effectiveResults = useMemo(
    () => (query.trim().length < 2 ? [] : results),
    [query, results],
  );

  const grouped = useMemo(
    () => ({
      patients: effectiveResults.filter((result) => result.entity_type === "patient"),
      doctors: effectiveResults.filter((result) => result.entity_type === "doctor"),
      invoices: effectiveResults.filter((result) => result.entity_type === "invoice"),
    }),
    [effectiveResults],
  );

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = useCallback(
    (path: string) => {
      navigate(`/tenant/${clinicSlug}/${path}`);
      setOpen(false);
    },
    [navigate, clinicSlug],
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="group hidden h-8 items-center gap-2 bg-background px-3 transition-colors hover:border-ring/50 sm:flex"
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="w-40 text-start text-sm text-muted-foreground">
          {t("common.search")}
        </span>
        <kbd className="hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground lg:inline-flex">
          {t("common.keyboardShortcut")}
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={t("common.search")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query.trim().length < 2 ? t("common.searchEmpty") : t("common.noData")}
          </CommandEmpty>

          {grouped.patients.length > 0 ? (
            <CommandGroup heading={t("common.patients")}>
              {grouped.patients.map((patient) => (
                <CommandItem
                  key={patient.entity_id}
                  onSelect={() => go(`patients/${patient.entity_id}`)}
                  className="gap-2"
                >
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{patient.label}</span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {patient.sublabel ?? ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {grouped.doctors.length > 0 ? (
            <CommandGroup heading={t("common.doctors")}>
              {grouped.doctors.map((doctor) => (
                <CommandItem
                  key={doctor.entity_id}
                  onSelect={() => go("doctors")}
                  className="gap-2"
                >
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                  <span>{doctor.label}</span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {doctor.sublabel ?? ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {grouped.invoices.length > 0 ? (
            <CommandGroup heading={t("common.billing")}>
              {grouped.invoices.map((invoice) => (
                <CommandItem
                  key={invoice.entity_id}
                  onSelect={() => go("billing")}
                  className="gap-2"
                >
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <span>{invoice.label}</span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {invoice.sublabel ?? ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
};
