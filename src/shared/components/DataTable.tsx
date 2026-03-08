import { ReactNode, useState, useMemo } from "react";
import { Search } from "lucide-react";
import { useI18n } from "@/core/i18n/i18nStore";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  searchable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  filterSlot?: ReactNode;
  isLoading?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage,
  searchable = false,
  searchPlaceholder,
  filterSlot,
  isLoading = false,
}: DataTableProps<T>) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const noData = emptyMessage ?? t("common.noData");

  const filtered = useMemo(() => {
    if (!search || !searchable) return data;
    const q = search.toLowerCase();
    const searchCols = columns.filter((c) => c.searchable !== false);
    return data.filter((item) =>
      searchCols.some((col) => {
        const val = (item as any)[col.key];
        return val && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchable, columns]);

  return (
    <div className="space-y-4">
      {(searchable || filterSlot) && (
        <div className="flex flex-wrap items-center gap-3">
          {searchable && (
            <div className="flex items-center gap-2 bg-card rounded-lg border px-4 py-2 max-w-sm flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder ?? t("common.search")}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          {filterSlot}
        </div>
      )}

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="bg-muted/50">
                {columns.map((col) => (
                  <th key={col.key}>{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    {noData}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={keyExtractor(item)} className="hover:bg-muted/30 transition-colors">
                    {columns.map((col) => (
                      <td key={col.key}>
                        {col.render ? col.render(item) : (item as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
