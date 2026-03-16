import { useI18n } from "@/core/i18n/i18nStore";
import { Button } from "@/components/primitives/Button";
import { PermissionGuard } from "@/core/auth/PermissionGuard";
import { UserPlus } from "lucide-react";
import type { ProfileWithRoles } from "@/domain/settings/profile.types";
import { DataTable, Column } from "@/shared/components/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";

interface UsersTabProps {
  profiles: ProfileWithRoles[];
  onAddUser: () => void;
  isLoading?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  sortColumn?: "full_name" | "created_at";
  sortDirection?: "asc" | "desc";
  onSortChange?: (column: "full_name" | "created_at", direction: "asc" | "desc") => void;
}

export const UsersTab = ({
  profiles,
  onAddUser,
  isLoading = false,
  page,
  pageSize,
  total,
  onPageChange,
  searchValue,
  onSearchChange,
  sortColumn,
  sortDirection,
  onSortChange,
}: UsersTabProps) => {
  const { t } = useI18n();

  const columns: Column<ProfileWithRoles>[] = [
    {
      key: "full_name",
      header: t("auth.fullName"),
      searchable: true,
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
            {p.full_name.charAt(0)}
          </div>
          <span className="text-sm font-medium">{p.full_name}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: t("settings.usersRoles"),
      render: (p) => {
        const role = p.user_roles?.[0]?.role ?? "-";
        const variant = role === "clinic_admin" ? "info" : role === "doctor" ? "success" : "default";
        return <StatusBadge variant={variant as any}>{role.replace("_", " ")}</StatusBadge>;
      },
    },
    {
      key: "actions",
      header: "",
      render: () => (
        <Button variant="outline" size="sm" disabled>
          {t("common.edit")}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{t("settings.usersRoles")}</h3>
          <p className="text-sm text-muted-foreground">{t("settings.manageStaff")}</p>
        </div>
        <PermissionGuard permission="manage_users">
          <Button onClick={onAddUser} size="sm">
            <UserPlus className="h-4 w-4" /> {t("settings.addUser")}
          </Button>
        </PermissionGuard>
      </div>
      <PermissionGuard
        permission="manage_users"
        fallback={<p className="text-muted-foreground">{t("settings.noPermission")}</p>}
      >
        <DataTable
          columns={columns}
          data={profiles}
          keyExtractor={(p) => p.id}
          searchable
          serverSearch
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          isLoading={isLoading}
          emptyMessage={t("common.noUsersFound")}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortChange={onSortChange ? (column, direction) => onSortChange(column as "full_name" | "created_at", direction) : undefined}
        />
      </PermissionGuard>
    </div>
  );
};
