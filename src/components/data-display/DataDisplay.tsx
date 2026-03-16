/**
 * Data Display Components — MedFlow Design System
 *
 * DataTable  — sortable, filterable, paginated, exportable
 * StatCard   — KPI card with trend indicator
 * StatusBadge — semantic status pill
 * FilterBar  — tabbed/button filter strip
 * SearchInput — search field with icon
 * Pagination — page navigation
 * EmptyState — zero-data placeholder
 */

import * as React from "react";
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Download, Search, X, SlidersHorizontal,
  TrendingUp, TrendingDown, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../primitives/Button";
import { Skeleton, SkeletonCard } from "../primitives/Display";

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export type StatusVariant = "success" | "warning" | "danger" | "info" | "default" | "primary";

const statusClasses: Record<StatusVariant, string> = {
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  danger:  "bg-destructive/10 text-destructive ring-destructive/20",
  info:    "bg-info/10 text-info ring-info/20",
  primary: "bg-primary/10 text-primary ring-primary/20",
  default: "bg-muted text-muted-foreground ring-border",
};

const dotClasses: Record<StatusVariant, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger:  "bg-destructive",
  info:    "bg-info",
  primary: "bg-primary",
  default: "bg-muted-foreground",
};

interface StatusBadgeProps {
  variant?: StatusVariant;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant = "default", dot, children, className }: StatusBadgeProps) {
  return (
    <span className={cn("badge-status", statusClasses[variant], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotClasses[variant])} aria-hidden />}
      {children}
    </span>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

const accentConfig: Record<string, { icon: string; value: string }> = {
  primary:   { icon: "bg-primary/10 text-primary",     value: "text-foreground" },
  success:   { icon: "bg-success/10 text-success",     value: "text-foreground" },
  warning:   { icon: "bg-warning/10 text-warning",     value: "text-foreground" },
  danger:    { icon: "bg-destructive/10 text-destructive", value: "text-foreground" },
  info:      { icon: "bg-info/10 text-info",           value: "text-foreground" },
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label?: string; positive?: boolean };
  accent?: keyof typeof accentConfig;
  subtitle?: string;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title, value, icon: Icon,
  trend, accent = "primary", subtitle, loading, className, onClick,
}: StatCardProps) {
  const colors = accentConfig[accent] ?? accentConfig.primary;

  if (loading) return <SkeletonCard className={className} />;

  return (
    <div
      className={cn("stat-card", onClick && "cursor-pointer", className)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", colors.icon)}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
      <div className={cn("text-2xl font-semibold tracking-tight tabular", colors.value)}>
        {value}
      </div>
      {trend != null && (
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md",
              trend.positive !== false
                ? "text-success bg-success/10"
                : "text-destructive bg-destructive/10",
            )}
          >
            {trend.positive !== false
              ? <TrendingUp className="h-3 w-3" aria-hidden />
              : <TrendingDown className="h-3 w-3" aria-hidden />
            }
            {trend.positive !== false ? "+" : ""}{trend.value}%
          </span>
          {trend.label && (
            <span className="text-2xs text-muted-foreground">{trend.label}</span>
          )}
        </div>
      )}
      {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
    </div>
  );
}

// ─── SearchInput ─────────────────────────────────────────────────────────────

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  debounce?: number;
}

export function SearchInput({ value, onChange, placeholder = "Search…", className, debounce: debounceMs = 0 }: SearchInputProps) {
  const [local, setLocal] = React.useState(value);

  React.useEffect(() => { setLocal(value); }, [value]);

  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const handleChange = (v: string) => {
    setLocal(v);
    if (debounceMs > 0) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(v), debounceMs);
    } else {
      onChange(v);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden />
      <input
        type="search"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-8 w-full rounded-md border border-input bg-transparent ps-8 pe-7 text-sm",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "transition-colors duration-150",
        )}
      />
      {local && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => handleChange("")}
          aria-label="Clear search"
          title="Clear search"
          className="absolute end-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      )}
    </div>
  );
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

interface FilterOption {
  label: string;
  value: string | null;
  count?: number;
}

interface FilterBarProps {
  options: FilterOption[];
  value: string | null;
  onChange: (v: string | null) => void;
  className?: string;
}

export function FilterBar({ options, value, onChange, className }: FilterBarProps) {
  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)} role="group" aria-label="Filter options">
      {options.map((opt) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          key={String(opt.value)}
          onClick={() => onChange(value === opt.value ? null : opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "h-7 px-2.5 text-xs font-medium border transition-all duration-150",
            value === opt.value
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted",
          )}
        >
          {opt.label}
          {opt.count != null && (
            <span className={cn(
              "h-4 min-w-[1rem] rounded-full text-2xs flex items-center justify-center px-1",
              value === opt.value ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
            )}>
              {opt.count}
            </span>
            )}
        </Button>
      ))}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Show "X–Y of Z" label */
  showCount?: boolean;
  className?: string;
}

export function Pagination({ page, pageSize, total, onPageChange, showCount = true, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);

  const pages = React.useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "…", totalPages];
    if (page >= totalPages - 3) return [1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "…", page - 1, page, page + 1, "…", totalPages];
  }, [page, totalPages]);

  if (totalPages <= 1 && !showCount) return null;

  return (
    <div className={cn("flex items-center justify-between gap-4 px-4 py-3 border-t border-border", className)}>
      {showCount && (
        <p className="text-xs text-muted-foreground tabular">
          {total === 0 ? "No results" : `${from}–${to} of ${total.toLocaleString()}`}
        </p>
      )}
      <nav role="navigation" aria-label="Pagination" className="flex items-center gap-1 ms-auto">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronDown className="h-3.5 w-3.5 rotate-90" aria-hidden />
        </Button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground" aria-hidden>…</span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              key={p}
              onClick={() => onPageChange(p as number)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "h-7 w-7 rounded-md text-xs font-medium transition-colors",
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {p}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronDown className="h-3.5 w-3.5 -rotate-90" aria-hidden />
        </Button>
      </nav>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("empty-state", className)}>
      {Icon && <Icon className="empty-state-icon" aria-hidden />}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-description mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc" | null;

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  searchable?: boolean;
  width?: string; // e.g. "w-32"
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export interface BulkAction<T> {
  label: string;
  icon?: React.ReactNode;
  variant?: "danger" | "default";
  action: (ids: string[]) => Promise<void>;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;

  // Search
  searchable?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (v: string) => void;

  // Sort
  sortColumn?: string;
  sortDirection?: SortDirection;
  onSortChange?: (column: string, direction: SortDirection) => void;

  // Pagination (server-side)
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;

  // Export
  exportFileName?: string;
  onExportCsv?: () => void;

  // Bulk
  bulkActions?: BulkAction<T>[];

  // Toolbar extra content
  toolbarSlot?: React.ReactNode;

  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, keyExtractor,
  isLoading, emptyMessage = "No results found.", emptyDescription, emptyAction,
  searchable, searchValue = "", searchPlaceholder, onSearchChange,
  sortColumn, sortDirection, onSortChange,
  page = 1, pageSize = 25, total, onPageChange,
  exportFileName, onExportCsv,
  bulkActions,
  toolbarSlot,
  className,
}: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = React.useState(false);

  const allSelected = data.length > 0 && selectedIds.size === data.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(data.map(keyExtractor)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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

  const handleSort = (colKey: string) => {
    if (!onSortChange) return;
    if (sortColumn !== colKey) return onSortChange(colKey, "asc");
    if (sortDirection === "asc") return onSortChange(colKey, "desc");
    onSortChange(colKey, null);
  };

  const SortIcon = ({ col }: { col: Column<T> }) => {
    if (!col.sortable) return null;
    if (sortColumn !== col.key) return <ChevronsUpDown className="h-3 w-3 ms-1 text-muted-foreground/50" aria-hidden />;
    if (sortDirection === "asc")  return <ChevronUp   className="h-3 w-3 ms-1 text-primary" aria-hidden />;
    if (sortDirection === "desc") return <ChevronDown  className="h-3 w-3 ms-1 text-primary" aria-hidden />;
    return <ChevronsUpDown className="h-3 w-3 ms-1 text-muted-foreground/50" aria-hidden />;
  };

  const showBulkBar = bulkActions && bulkActions.length > 0;
  const showToolbar = searchable || showBulkBar || exportFileName || toolbarSlot;

  return (
    <div className={cn("card-base overflow-hidden", className)}>
      {/* ── Toolbar ── */}
      {showToolbar && (
        <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
          {searchable && (
            <SearchInput
              value={searchValue}
              onChange={onSearchChange ?? (() => {})}
              placeholder={searchPlaceholder ?? "Search…"}
              className="w-56 lg:w-72"
              debounce={300}
            />
          )}

          {toolbarSlot}

          <div className="flex items-center gap-2 ms-auto">
            {/* Bulk actions */}
            {showBulkBar && selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1">
                <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                {bulkActions!.map((action, i) => (
                  <Button
                    key={i}
                    variant={action.variant === "danger" ? "danger" : "ghost"}
                    size="sm"
                    loading={bulkLoading}
                    onClick={() => handleBulkAction(action)}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Export */}
            {exportFileName && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExportCsv}
                aria-label="Export as CSV"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="data-table" aria-label="Data table">
          <thead>
            <tr>
              {showBulkBar && (
                <th className="w-10 px-4">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                    className="rounded border-border accent-primary cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(col.sortable && "cursor-pointer select-none hover:text-foreground", col.width)}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    sortColumn === col.key
                      ? sortDirection === "asc" ? "ascending" : "descending"
                      : col.sortable ? "none" : undefined
                  }
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    <SortIcon col={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} aria-hidden>
                  {showBulkBar && <td><Skeleton className="h-4 w-4 rounded" /></td>}
                  {columns.map((col) => (
                    <td key={col.key}>
                      <Skeleton className={cn("h-4", col.key === "actions" ? "w-12" : "w-full max-w-[120px]")} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (showBulkBar ? 1 : 0)} className="p-0">
                  <EmptyState
                    title={emptyMessage}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const id = keyExtractor(item);
                const selected = selectedIds.has(id);
                return (
                  <tr key={id} className={selected ? "selected" : ""}>
                    {showBulkBar && (
                      <td className="w-10 px-4">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleOne(id)}
                          aria-label={`Select row ${id}`}
                          className="rounded border-border accent-primary cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={cn(col.className)}>
                        {col.render
                          ? col.render(item)
                          : <span className="text-sm">{String(item[col.key] ?? "—")}</span>
                        }
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {total != null && onPageChange && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
