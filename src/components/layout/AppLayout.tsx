/**
 * Layout Components — MedFlow Design System
 *
 * AppLayout      — full SaaS shell (sidebar + topbar + content)
 * Sidebar        — collapsible sidebar using shadcn SidebarProvider
 * Topbar         — extracted topbar component
 * PageContainer  — wraps page content with standard padding and max-width
 * SectionHeader  — page title + subtitle + actions row
 *
 * Replaces the hand-rolled ClinicLayout.tsx.
 * Builds on the installed shadcn sidebar.tsx primitives.
 *
 * Usage:
 *   <AppLayout navItems={navItems} user={user} onLogout={logout}>
 *     <PageContainer>
 *       <SectionHeader title="Patients" subtitle="128 total">
 *         <Button>Add Patient</Button>
 *       </SectionHeader>
 *       ...page content...
 *     </PageContainer>
 *   </AppLayout>
 */

import * as React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, Heart, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, Divider, SimpleTooltip } from "../primitives/Display";
import { Button } from "@/components/primitives/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  group?: string; // optional group label for section dividers
}

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  displayRole?: string;
  avatar?: string;
}

export interface AppLayoutLabels {
  brandName: string;
  mainNavigation: string;
  logOut: string;
  collapseSidebar: string;
  expandSidebar: string;
  openMenu: string;
  closeMenu: string;
  skipToContent: string;
}

// ─── Sidebar Context ──────────────────────────────────────────────────────────

const SidebarStateContext = React.createContext<{
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}>({
  collapsed: false,
  toggle: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

function useSidebarState() {
  return React.useContext(SidebarStateContext);
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  navItems: NavItem[];
  user: AppUser;
  onLogout: () => void;
  clinicSlug: string;
  logo?: React.ReactNode;
  topbarStartSlot?: React.ReactNode;
  topbarEndSlot?: React.ReactNode;
  topbarSlot?: React.ReactNode;  // backward compatible end slot
  children?: React.ReactNode;
  upgradeSlot?: React.ReactNode; // upgrade banner slot
  labels: AppLayoutLabels;
}

export function AppLayout({
  navItems,
  user,
  onLogout,
  clinicSlug,
  logo,
  topbarStartSlot,
  topbarEndSlot,
  topbarSlot,
  children,
  upgradeSlot,
  labels,
}: AppLayoutProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Persist sidebar state
  React.useEffect(() => {
    const stored = localStorage.getItem("sidebar:collapsed");
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  const toggle = React.useCallback(() => {
    setCollapsed((v) => {
      localStorage.setItem("sidebar:collapsed", String(!v));
      return !v;
    });
  }, []);

  return (
    <SidebarStateContext.Provider value={{ collapsed, toggle, mobileOpen, setMobileOpen }}>
      <div className="flex h-svh overflow-hidden bg-background">

        {/* ── Desktop Sidebar ── */}
        <AppSidebar
          navItems={navItems}
          user={user}
          onLogout={onLogout}
          clinicSlug={clinicSlug}
          logo={logo}
          labels={labels}
          collapsed={collapsed}
          onToggle={toggle}
          className="hidden lg:flex"
        />

        {/* ── Mobile Sidebar ── */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-overlay bg-foreground/20 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <AppSidebar
              navItems={navItems}
              user={user}
              onLogout={onLogout}
              clinicSlug={clinicSlug}
              logo={logo}
              labels={labels}
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              className="fixed inset-y-0 start-0 z-modal flex lg:hidden animate-slide-in-left"
            />
          </>
        )}

        {/* ── Main column ── */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {upgradeSlot}
          <AppTopbar
            startSlot={topbarStartSlot}
            endSlot={topbarEndSlot ?? topbarSlot}
            labels={labels}
          />
          <main
            id="main-content"
            className="flex-1 overflow-y-auto scroll-thin"
            tabIndex={-1}
          >
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
    </SidebarStateContext.Provider>
  );
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────

interface AppSidebarProps {
  navItems: NavItem[];
  user: AppUser;
  onLogout: () => void;
  clinicSlug: string;
  logo?: React.ReactNode;
  labels: AppLayoutLabels;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

function AppSidebar({
  navItems, user, onLogout, clinicSlug,
  logo, labels, collapsed, onToggle, className,
}: AppSidebarProps) {
  // Group nav items
  const groups = React.useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of navItems) {
      const key = item.group ?? "";
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [navItems]);

  const sidebarWidth = collapsed ? "w-[3.25rem]" : "w-[240px]";

  return (
    <aside
      className={cn(
        "flex flex-col flex-shrink-0 bg-sidebar border-e border-sidebar-border",
        "transition-[width] duration-200 ease-decelerate overflow-hidden",
        sidebarWidth,
        className,
      )}
      aria-label={labels.mainNavigation}
    >
      {/* ── Logo ── */}
      <div className={cn(
        "flex items-center h-14 border-b border-sidebar-border px-3 flex-shrink-0",
        collapsed ? "justify-center" : "gap-2.5 px-4",
      )}>
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          {logo ?? <Heart className="h-3.5 w-3.5 text-primary-foreground" aria-hidden />}
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm text-foreground truncate">{labels.brandName}</span>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto scroll-thin py-3 px-2 space-y-0.5">
        {Array.from(groups.entries()).map(([group, items], gi) => (
          <React.Fragment key={group || gi}>
            {group && !collapsed && (
              <p className="px-3 py-2 text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
                {group}
              </p>
            )}
            {group && !collapsed && gi > 0 && <Divider className="my-2 mx-2" />}
            {items.map((item) => (
              <SidebarNavItem
                key={item.path}
                item={item}
                clinicSlug={clinicSlug}
                collapsed={collapsed}
              />
            ))}
          </React.Fragment>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div className={cn(
        "border-t border-sidebar-border p-2 flex-shrink-0",
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors">
            <Avatar
              fallback={user.name.charAt(0)}
              size="sm"
              color="bg-primary/10 text-primary"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user.name}</p>
              <p className="text-2xs text-muted-foreground capitalize truncate">
                {user.displayRole?.replace("_", " ")}
              </p>
            </div>
            <SimpleTooltip content={labels.logOut} side="right">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onLogout}
                aria-label={labels.logOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </SimpleTooltip>
          </div>
        ) : (
          <SimpleTooltip content={`${user.name} - ${labels.logOut}`} side="right">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onLogout}
              aria-label={`${labels.logOut} ${user.name}`}
              className="w-full justify-center rounded-lg hover:bg-sidebar-accent"
            >
              <Avatar fallback={user.name.charAt(0)} size="sm" color="bg-primary/10 text-primary" />
            </Button>
          </SimpleTooltip>
        )}

        {/* Collapse toggle (desktop) */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggle}
          aria-label={collapsed ? labels.expandSidebar : labels.collapseSidebar}
          className={cn(
            "hidden lg:flex w-full items-center gap-2 mt-1.5 px-2 py-1.5 rounded-lg",
            "text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors",
            collapsed && "justify-center",
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />
            : <><PanelLeftClose className="h-3.5 w-3.5" aria-hidden /><span>{labels.collapseSidebar}</span></>
          }
        </Button>
      </div>
    </aside>
  );
}

// ─── SidebarNavItem ───────────────────────────────────────────────────────────

function SidebarNavItem({
  item, clinicSlug, collapsed,
}: { item: NavItem; clinicSlug: string; collapsed: boolean }) {
  const link = (
    <NavLink
      to={`/tenant/${clinicSlug}/${item.path}`}
      className={({ isActive }) =>
        cn("sidebar-item", isActive && "active", collapsed && "justify-center px-0 py-2")
      }
      aria-label={collapsed ? item.label : undefined}
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge != null && item.badge > 0 && (
            <span className="ms-auto h-5 min-w-[1.25rem] rounded-full bg-primary/10 text-primary text-2xs font-semibold flex items-center justify-center px-1">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <SimpleTooltip content={item.label} side="right" delayDuration={200}>
        {link}
      </SimpleTooltip>
    );
  }

  return link;
}

// ─── AppTopbar ────────────────────────────────────────────────────────────────

interface AppTopbarProps {
  startSlot?: React.ReactNode;
  endSlot?: React.ReactNode;
  labels: AppLayoutLabels;
}

function AppTopbar({ startSlot, endSlot, labels }: AppTopbarProps) {
  const { setMobileOpen, mobileOpen } = useSidebarState();

  return (
    <>
      {/* Skip to main content — first focusable element */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-tooltip focus:bg-background focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:rounded-md focus:ring-2 focus:ring-ring"
      >
        {labels.skipToContent}
      </a>

      <header className="topbar" role="banner">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? labels.closeMenu : labels.openMenu}
            aria-expanded={mobileOpen}
            className="lg:hidden hover:bg-muted"
          >
            {mobileOpen
              ? <X className="h-5 w-5" aria-hidden />
              : <Menu className="h-5 w-5" aria-hidden />
            }
          </Button>
          {startSlot && (
            <div className="flex items-center gap-2">
              {startSlot}
            </div>
          )}
        </div>

        {endSlot && (
          <div className="flex items-center gap-1.5">
            {endSlot}
          </div>
        )}
      </header>
    </>
  );
}

// ─── PageContainer ────────────────────────────────────────────────────────────

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Max width constraint. Defaults to 'full'. */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const maxWidthClass = {
  sm:   "max-w-2xl",
  md:   "max-w-4xl",
  lg:   "max-w-6xl",
  xl:   "max-w-7xl",
  "2xl":"max-w-screen-2xl",
  full: "",
} as const;

function PageContainer({ maxWidth = "full", className, children, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        "px-4 py-4 lg:px-6 lg:py-6 space-y-5 animate-fade-in",
        maxWidth !== "full" && maxWidthClass[maxWidth],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  /** Icon displayed before the title */
  icon?: React.ComponentType<{ className?: string }>;
  /** Content rendered to the right (action buttons) */
  actions?: React.ReactNode;
}

function SectionHeader({ title, subtitle, icon: Icon, actions, className, children, ...props }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between", className)} {...props}>
      <div>
        <h1 className={cn("page-title", Icon && "flex items-center gap-2")}>
          {Icon && <Icon className="h-5 w-5 text-primary" aria-hidden />}
          {title}
        </h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {(actions || children) && (
        <div className="flex items-center gap-2 ms-4 flex-shrink-0">
          {actions ?? children}
        </div>
      )}
    </div>
  );
}

export { AppSidebar, AppTopbar, PageContainer, SectionHeader, useSidebarState };
