# MedFlow Design System

A production-grade design system for the MedFlow clinic management SaaS.
Designed to integrate with the existing React + Vite + Tailwind CSS + shadcn/ui architecture.

---

## Repository placement

```
src/
├── design-system/
│   ├── tokens/
│   │   ├── index.ts          ← master export
│   │   ├── colors.ts         ← color palette + semantic tokens
│   │   ├── typography.ts     ← type scale + role map
│   │   ├── spacing.ts        ← spacing scale + z-index
│   │   └── shadows.ts        ← shadows + radii + animation + icon sizes
│   │
│   ├── styles/
│   │   └── globals.css       ← replaces src/index.css
│   │
│   └── GUIDELINES.ts         ← developer rules (read before contributing)
│
├── components/
│   ├── ui/                   ← shadcn/ui primitives (do not edit)
│   │
│   ├── primitives/           ← design-system enhanced primitives
│   │   ├── Button.tsx        ← extended buttonVariants (danger, success, loading)
│   │   ├── Inputs.tsx        ← Input, Textarea, Select (Radix-backed)
│   │   └── Display.tsx       ← Badge, Card, Avatar, Skeleton, Divider, Tooltip
│   │
│   ├── forms/
│   │   └── FormSystem.tsx    ← FormSection, FormGroup, FormField, FormLabel,
│   │                            FormHint, FormError, FormActions
│   │
│   ├── layout/
│   │   └── AppLayout.tsx     ← AppLayout, PageContainer, SectionHeader,
│   │                            AppSidebar (collapsible), AppTopbar
│   │
│   └── data-display/
│       └── DataDisplay.tsx   ← DataTable (sort+pagination+bulk+export),
│                                StatCard, StatusBadge, FilterBar,
│                                SearchInput, Pagination, EmptyState
│
├── shared/
│   └── components/           ← keep existing: ActivityFeed, GlobalSearch,
│                                NotificationCenter, ConfirmDialog, etc.
│
└── features/                 ← feature modules unchanged
```

---

## Step-by-step migration

### Step 1 — Install the CSS

Replace `src/index.css` with `design-system/styles/globals.css`.

Update `src/main.tsx`:
```ts
import "./design-system/styles/globals.css"  // was: import "./index.css"
```

### Step 2 — Replace tailwind.config.ts

Copy `design-system/tailwind.config.ts` to the project root.

Install the typography plugin if not already present:
```bash
npm install -D @tailwindcss/typography
```

### Step 3 — Copy component files

```bash
# Primitives
cp design-system/components/primitives/Button.tsx     src/components/primitives/Button.tsx
cp design-system/components/primitives/Inputs.tsx     src/components/primitives/Inputs.tsx
cp design-system/components/primitives/Display.tsx    src/components/primitives/Display.tsx

# Forms
cp design-system/components/forms/FormSystem.tsx      src/components/forms/FormSystem.tsx

# Layout
cp design-system/components/layout/AppLayout.tsx      src/components/layout/AppLayout.tsx

# Data display
cp design-system/components/data-display/DataDisplay.tsx src/components/data-display/DataDisplay.tsx

# Tokens
cp -r design-system/tokens/ src/design-system/tokens/
```

### Step 4 — Update path aliases (tsconfig.json / vite.config.ts)

```json
{
  "paths": {
    "@/design-system/*": ["./src/design-system/*"],
    "@/components/*":    ["./src/components/*"],
    "@/*":               ["./src/*"]
  }
}
```

### Step 5 — Migrate ClinicLayout.tsx

Replace `src/layouts/ClinicLayout.tsx` body with:

```tsx
import { AppLayout } from "@/components/layout/AppLayout";
import { navItems } from "./navConfig";   // extract nav array
// ... rest is now just wiring AppLayout props
```

### Step 6 — Migrate modals (highest priority)

Replace every raw `<div className="fixed inset-0 z-50 ...">` modal with
the Radix Dialog pattern shown in `PatientTableExample.tsx`.

Files to migrate first (per the audit):
1. `src/features/patients/AddPatientModal.tsx`
2. `src/features/settings/AddUserModal.tsx`  
3. `src/features/billing/NewInvoiceModal.tsx`
4. `src/features/laboratory/NewLabOrderModal.tsx`

### Step 7 — Replace native `<select>` elements

Find all `<select className="...">` and replace with the DS `<Select>` component.

### Step 8 — Wire sort into DataTable

In each feature page using DataTable, add:
```tsx
sortColumn={sort.col}
sortDirection={sort.dir}
onSortChange={(col, dir) => { setSort({ col, dir }); setPage(1); }}
```
And pass the sort to the service layer query.

---

## Import conventions

```tsx
// ── Design system tokens
import { tokens, colorTokens, shadows } from "@/design-system/tokens";

// ── Primitives
import { Button }   from "@/components/primitives/Button";
import { Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/primitives/Inputs";
import { Card, CardHeader, CardTitle, CardContent, Badge, Avatar, Skeleton, SimpleTooltip, Divider } from "@/components/primitives/Display";

// ── Forms
import { FormSection, FormGroup, FormField, FormLabel, FormHint, FormError, FormActions } from "@/components/forms/FormSystem";

// ── Layout
import { AppLayout, PageContainer, SectionHeader } from "@/components/layout/AppLayout";

// ── Data display
import { DataTable, StatCard, StatusBadge, FilterBar, SearchInput, Pagination, EmptyState } from "@/components/data-display/DataDisplay";

// ── shadcn primitives (unchanged — use directly from @/components/ui)
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch }  from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
```

---

## Chart color hook

Use this in every file that uses Recharts. Never hardcode HSL strings in charts.

```tsx
function useChartColors() {
  const isDark = document.documentElement.classList.contains("dark");
  return useMemo(() => ({
    primary:  `hsl(var(--chart-1))`,
    success:  `hsl(var(--chart-2))`,
    warning:  `hsl(var(--chart-3))`,
    info:     `hsl(var(--chart-4))`,
    violet:   `hsl(var(--chart-5))`,
    border:   `hsl(var(--border))`,
    muted:    `hsl(var(--muted-foreground))`,
    card:     `hsl(var(--card))`,
    fg:       `hsl(var(--foreground))`,
  }), [isDark]);
}

// In chart JSX:
const colors = useChartColors();
<CartesianGrid stroke={colors.border} />
<Area stroke={colors.primary} />
<Tooltip contentStyle={{ backgroundColor: colors.card, border: `1px solid ${colors.border}`, color: colors.fg }} />
```

---

## Priority order for implementation

| Priority | Task | Effort |
|----------|------|--------|
| P1 | Replace raw modals with Radix Dialog | 4–8h |
| P1 | Add aria-label to icon buttons | 1h |
| P1 | Add skip-to-content link (in AppTopbar — already included) | done |
| P2 | Replace native `<select>` with DS Select | 2h |
| P2 | Fix chart colors (use CSS vars) | 1h |
| P2 | Button loading state (Loader2 + label) | done |
| P3 | Migrate ClinicLayout → AppLayout | 1 day |
| P3 | Add column sorting to all DataTables | 2 days |
| P3 | Unified FormModal pattern | 2 days |
| P4 | Dark mode contrast audit | 1 day |
| P4 | Enhanced empty states per module | 2 days |

---

## Design System Score targets (post-implementation)

| Category | Current | Target |
|----------|---------|--------|
| Accessibility | 6.0 | 9.0 |
| Component Consistency | 7.5 | 9.5 |
| Form UX | 7.0 | 9.0 |
| Dark Mode | 8.0 | 9.5 |
| Data Tables | 7.0 | 9.0 |
| Overall | 7.7 | **9.0** |
