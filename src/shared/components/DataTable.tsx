import { ReactNode, useState, useMemo, useCallback } from "react";
import { Search, Download, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useI18n } from "@/core/i18n/i18nStore";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Inputs";
import { TableSkeleton } from "./TableSkeleton";
import { generatePDF } from "@/shared/utils/pdfGenerator";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  searchable?: boolean;
  sortable?: boolean;
}

interface BulkAction<T> {
  label: string;
  icon?: ReactNode;
  variant?: "default" | "danger" | "outline";
  action: (selectedIds: string[]) => Promise<void> | void;
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
  exportFileName?: string;
  pdfExport?: {
    title: string;
    subtitle?: string;
  };
  bulkActions?: BulkAction<T>[];
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  serverSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (column: string, direction: "asc" | "desc") => void;
  onRowClick?: (item: T) => void;
  tableLabel?: string;
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
  exportFileName,
  pdfExport,
  bulkActions,
  page,
  pageSize,
  total,
  onPageChange,
  serverSearch = false,
  searchValue,
  onSearchChange,
  sortColumn,
  sortDirection,
  onSortChange,
  onRowClick,
  tableLabel,
}: DataTableProps<T>) {
  const { dir, t } = useI18n();
  const [localSearch, setLocalSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const noData = emptyMessage ?? t("common.noData");
  const search = serverSearch ? (searchValue ?? "") : localSearch;
  const isPaged = typeof total === "number" && typeof pageSize === "number" && !!onPageChange;
  const currentPage = page ?? 1;
  const totalPages = isPaged ? Math.max(1, Math.ceil((total ?? 0) / (pageSize ?? 1))) : 1;
  const pageStart = isPaged && total ? (currentPage - 1) * (pageSize ?? 1) + 1 : 0;
  const pageEnd = isPaged && total ? Math.min(total, currentPage * (pageSize ?? 1)) : 0;

  const filtered = useMemo(() => {
    if (serverSearch || !search || !searchable) return data;
    const q = search.toLowerCase();
    const searchCols = columns.filter((c) => c.searchable !== false);
    return data.filter((item) =>
      searchCols.some((col) => {
        const val = (item as any)[col.key];
        return val && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchable, columns, serverSearch]);

  const handleSearchChange = (value: string) => {
    if (serverSearch) {
      onSearchChange?.(value);
      return;
    }
    setLocalSearch(value);
  };

  const handleSort = (col: Column<T>) => {
    if (!col.sortable || !onSortChange) return;
    const nextDirection: "asc" | "desc" =
      sortColumn === col.key ? (sortDirection === "asc" ? "desc" : "asc") : "asc";
    onSortChange(col.key, nextDirection);
  };

  const exportCsv = useCallback(() => {
    const headers = columns.filter((c) => c.key !== "actions").map((c) => c.header);
    const keys = columns.filter((c) => c.key !== "actions").map((c) => c.key);
    const rows = filtered.map((item) =>
      keys.map((k) => {
        const val = (item as any)[k];
        const str = val == null ? "" : String(val);
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      })
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFileName || "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, columns, exportFileName]);

  const exportPdfHandler = useCallback(() => {
    if (!pdfExport) return;
    const cols = columns
      .filter((c) => c.key !== "actions")
      .map((c) => ({ header: c.header, dataKey: c.key }));
    const rows = filtered.map((item) => {
      const row: any = {};
      cols.forEach((c) => {
        const val = (item as any)[c.dataKey];
        row[c.dataKey] = val == null ? "" : String(val);
      });
      return row;
    });
    generatePDF({
      title: pdfExport.title,
      subtitle: pdfExport.subtitle,
      columns: cols,
      data: rows,
      filename: `${exportFileName || "export"}-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  }, [filtered, columns, exportFileName, pdfExport]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((item) => keyExtractor(item))));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkAction = async (action: BulkAction<T>) => {
    setBulkLoading(true);
    try {
      await action.action(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const hasBulkActions = !!bulkActions?.length;
  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0;
  const rowClickable = typeof onRowClick === "function";
  const resolvedTableLabel = tableLabel ?? t("common.dataTable");

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(searchable || filterSlot || hasBulkActions) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="flex-1 min-w-[200px] max-w-sm">
              <Input
                size="sm"
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={searchPlaceholder ?? t("common.search")}
                aria-label={searchPlaceholder ?? t("common.search")}
                leadingIcon={<Search className="h-4 w-4" />}
              />
            </div>
          )}
          {filterSlot}
          <div className="flex items-center gap-1.5 ms-auto">
            {hasBulkActions && someSelected && (
              <>
                <span className="text-xs text-muted-foreground me-1">
                  {selectedIds.size} {t("common.selected")}
                </span>
                {bulkActions!.map((action, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={action.variant ?? "outline"}
                    onClick={() => handleBulkAction(action)}
                    disabled={bulkLoading}
                    className="h-8"
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </>
            )}
            {data.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={exportCsv} className="h-8 text-xs">
                  <Download className="h-3.5 w-3.5 me-1" />
                  {t("common.exportCsv")}
                </Button>
                {pdfExport && (
                  <Button variant="ghost" size="sm" onClick={exportPdfHandler} className="h-8 text-xs">
                    <Download className="h-3.5 w-3.5 me-1" />
                    {t("common.exportPdf")}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table" aria-label={resolvedTableLabel}>
            <thead>
              <tr>
                {hasBulkActions && (
                  <th className="w-10 px-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-border accent-primary cursor-pointer"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    aria-sort={
                      col.sortable && sortColumn === col.key
                        ? (sortDirection === "asc" ? "ascending" : "descending")
                        : undefined
                    }
                  >
                    {col.sortable && onSortChange ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-0 text-xs font-semibold"
                        onClick={() => handleSort(col)}
                      >
                        <span>{col.header}</span>
                        {sortColumn === col.key ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        )}
                      </Button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length + (hasBulkActions ? 1 : 0)} className="p-0">
                    <TableSkeleton columns={columns.length} rows={5} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (hasBulkActions ? 1 : 0)} className="text-center py-12 text-muted-foreground text-sm">
                    {noData}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const id = keyExtractor(item);
                  return (
                    <tr
                      key={id}
                      className={cn(
                        selectedIds.has(id) && "bg-primary/[0.03]",
                        rowClickable && "cursor-pointer hover:bg-muted/30",
                      )}
                      onClick={rowClickable ? (event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest("button,a,input,select,textarea,label")) return;
                        onRowClick?.(item);
                      } : undefined}
                      onKeyDown={rowClickable ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick?.(item);
                        }
                      } : undefined}
                      role={rowClickable ? "button" : undefined}
                      tabIndex={rowClickable ? 0 : undefined}
                    >
                      {hasBulkActions && (
                        <td className="w-10 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(id)}
                            onChange={() => toggleSelect(id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-border accent-primary cursor-pointer"
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.key}>
                          {col.render ? col.render(item) : (item as any)[col.key]}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {isPaged && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground border-t">
            <span>
              {pageStart}-{pageEnd} {t("common.of")} {total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                aria-label={t("common.previous")}
              >
                  {dir === "rtl" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
              <span className="px-2 font-medium tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                aria-label={t("common.next")}
              >
                  {dir === "rtl" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
