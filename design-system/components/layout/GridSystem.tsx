/**
 * MedFlow Design System — Grid & Layout System (Step 8)
 *
 * This file defines:
 *  1. The 12-column grid system as Tailwind utility combos
 *  2. Responsive breakpoint reference
 *  3. Container widths
 *  4. Layout composition components (Grid, GridItem, Stack, Flex)
 *  5. Page structure rules with examples
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — BREAKPOINT REFERENCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Breakpoints (matches tailwind.config.ts):
 *
 *  xs   (default)   →  < 640px   — mobile portrait
 *  sm   640px+       — mobile landscape, small tablet
 *  md   768px+       — tablet portrait
 *  lg   1024px+      — tablet landscape, laptop
 *  xl   1280px+      — desktop
 *  2xl  1400px+      — wide desktop (container max)
 *
 * Design rules per breakpoint:
 *
 *  Mobile (default → sm):
 *    - Sidebar hidden; hamburger menu in topbar
 *    - All grids → single column
 *    - Cards stack vertically
 *    - Tables scroll horizontally
 *    - Page padding: px-4 py-4
 *
 *  Tablet (md → lg):
 *    - Sidebar hidden by default (open on demand)
 *    - 2-column grids activate at sm, 3-column at md
 *    - Page padding: px-4 py-4 (same as mobile)
 *
 *  Desktop (lg+):
 *    - Sidebar always visible (collapsible to icon rail at lg+)
 *    - 4-column KPI grids activate
 *    - Full table columns shown
 *    - Page padding: px-6 py-6
 */

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — 12-COLUMN GRID SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The layout uses Tailwind's CSS grid with a 12-column conceptual model.
 * We express this through named span variants rather than raw col-span-N.
 *
 * CANONICAL GRID PATTERNS:
 *
 * ── 4-column KPI row (most common) ──
 *   <Grid cols={4}>
 *     <StatCard ... />  ← spans 1 col each
 *   </Grid>
 *
 * ── 2/3 + 1/3 chart layout ──
 *   <Grid cols={3}>
 *     <GridItem span={2}><RevenueChart /></GridItem>
 *     <GridItem span={1}><PieChart /></GridItem>
 *   </Grid>
 *
 * ── 2-column equal layout ──
 *   <Grid cols={2}>
 *     <Card>Left</Card>
 *     <Card>Right</Card>
 *   </Grid>
 *
 * ── Full-width content ──
 *   <Grid cols={1}>  OR just don't use a grid
 *     <DataTable ... />
 *   </Grid>
 *
 * ── Form: 2-col fields ──
 *   <FormGroup cols={2}>  ← use FormGroup, not Grid, for form fields
 *
 * 12-COLUMN EXPLICIT SPANS (for complex layouts):
 *   col-span-1  → 1/12  (rarely used)
 *   col-span-2  → 2/12  (~16%)
 *   col-span-3  → 3/12  (25%  = 1 of 4 KPI cols)
 *   col-span-4  → 4/12  (33%  = 1/3)
 *   col-span-6  → 6/12  (50%  = half)
 *   col-span-8  → 8/12  (67%  = 2/3)
 *   col-span-9  → 9/12  (75%  = 3/4)
 *   col-span-12 → full width
 */

// ─────────────────────────────────────────────────────────────────────────────
// PART 3 — CONTAINER WIDTHS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Content width is determined by the viewport minus the sidebar width.
 *
 * Sidebar widths:
 *   Expanded:  240px  (w-[240px])
 *   Collapsed: 52px   (w-[3.25rem] = icon rail)
 *   Hidden:    0px    (mobile)
 *
 * Effective content width at each breakpoint:
 *   Mobile (375px):    375px − 0px   = 375px  (padding: 32px) → content: ~343px
 *   Tablet (768px):    768px − 0px   = 768px  (padding: 32px) → content: ~736px
 *   Laptop (1280px):   1280px − 240px = 1040px (padding: 48px) → content: ~992px
 *   Desktop (1440px):  1440px − 240px = 1200px (padding: 48px) → content: ~1152px
 *   Wide (1600px+):    content capped at max-w-screen-2xl (1400px) when needed
 *
 * PageContainer uses max-width only for specialized pages (settings, forms).
 * Most list/table pages use full available width.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PART 4 — LAYOUT COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Column count to Tailwind class map — responsive at sm, md, lg */
const gridColsMap: Record<1 | 2 | 3 | 4 | 5 | 6 | 12, string> = {
  1:  "grid-cols-1",
  2:  "grid-cols-1 md:grid-cols-2",
  3:  "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4:  "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  5:  "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  6:  "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  12: "grid-cols-12",
};

/** Gap size map */
const gapMap = {
  none: "",
  xs:   "gap-2",
  sm:   "gap-3",
  md:   "gap-4",
  lg:   "gap-5",
  xl:   "gap-6",
} as const;

type GridCols = keyof typeof gridColsMap;
type GridGap  = keyof typeof gapMap;

// ── Grid ──────────────────────────────────────────────────────────────────────

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: GridCols;
  gap?: GridGap;
}

/**
 * Grid — responsive CSS grid wrapper.
 *
 * @example
 *   // 4-column KPI row
 *   <Grid cols={4} gap="md">
 *     <StatCard title="Patients" value={128} icon={Users} accent="primary" />
 *     <StatCard title="Appointments" value={42} icon={Calendar} accent="info" />
 *   </Grid>
 *
 *   // 2/3 + 1/3 layout
 *   <Grid cols={3} gap="md">
 *     <GridItem span={2}><RevenueChart /></GridItem>
 *     <GridItem span={1}><PieChart /></GridItem>
 *   </Grid>
 */
function Grid({ cols = 1, gap = "md", className, children, ...props }: GridProps) {
  return (
    <div
      className={cn("grid", gridColsMap[cols], gapMap[gap], className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ── GridItem ─────────────────────────────────────────────────────────────────

type SpanValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | "full";

const spanClass: Record<SpanValue, string> = {
  1: "col-span-1", 2: "col-span-2", 3: "col-span-3",
  4: "col-span-4", 5: "col-span-5", 6: "col-span-6",
  7: "col-span-7", 8: "col-span-8", 9: "col-span-9",
  10: "col-span-10", 11: "col-span-11", 12: "col-span-12",
  full: "col-span-full",
};

/** Responsive span: at mobile (sm) it can fall back to full width */
const smSpanClass: Record<SpanValue, string> = {
  1: "sm:col-span-1", 2: "sm:col-span-2", 3: "sm:col-span-3",
  4: "sm:col-span-4", 5: "sm:col-span-5", 6: "sm:col-span-6",
  7: "sm:col-span-7", 8: "sm:col-span-8", 9: "sm:col-span-9",
  10: "sm:col-span-10", 11: "sm:col-span-11", 12: "sm:col-span-12",
  full: "sm:col-span-full",
};

interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** How many columns this item spans (in a cols={12} grid) */
  span?: SpanValue;
  /** Span at sm+ breakpoint (defaults to span value) */
  smSpan?: SpanValue;
  /** Start column (1-based) */
  start?: number;
}

function GridItem({ span = 1, smSpan, start, className, children, ...props }: GridItemProps) {
  return (
    <div
      className={cn(
        "col-span-full",                                    // default: full width on mobile
        smSpan ? smSpanClass[smSpan] : smSpanClass[span],   // sm+
        spanClass[span],                                    // lg+ (overrides sm via cascade)
        start && `col-start-${start}`,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Stack ─────────────────────────────────────────────────────────────────────

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Vertical spacing between children */
  gap?: GridGap;
  /** Horizontal alignment */
  align?: "start" | "center" | "end" | "stretch";
}

/**
 * Stack — vertical flex container with consistent gap.
 * Use for page sections, form groups, card contents.
 *
 * @example
 *   <Stack gap="lg">
 *     <SectionHeader title="Patients" />
 *     <FilterBar ... />
 *     <DataTable ... />
 *   </Stack>
 */
function Stack({ gap = "md", align = "stretch", className, children, ...props }: StackProps) {
  const alignClass = {
    start:   "items-start",
    center:  "items-center",
    end:     "items-end",
    stretch: "items-stretch",
  }[align];

  return (
    <div
      className={cn("flex flex-col", gapMap[gap], alignClass, className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Flex ──────────────────────────────────────────────────────────────────────

interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: GridGap;
  align?: "start" | "center" | "end" | "baseline" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  wrap?: boolean;
  /** Make children fill available space equally */
  equal?: boolean;
}

/**
 * Flex — horizontal flex container.
 * Use for toolbars, button groups, inline metadata rows.
 *
 * @example
 *   <Flex justify="between" align="center" gap="sm">
 *     <h1 className="page-title">Dashboard</h1>
 *     <Button>Add Patient</Button>
 *   </Flex>
 */
function Flex({
  gap = "sm", align = "center", justify = "start",
  wrap = false, equal = false, className, children, ...props
}: FlexProps) {
  const justifyClass = {
    start:   "justify-start",
    center:  "justify-center",
    end:     "justify-end",
    between: "justify-between",
    around:  "justify-around",
    evenly:  "justify-evenly",
  }[justify];

  const alignClass = {
    start:    "items-start",
    center:   "items-center",
    end:      "items-end",
    baseline: "items-baseline",
    stretch:  "items-stretch",
  }[align];

  return (
    <div
      className={cn(
        "flex",
        gapMap[gap],
        alignClass,
        justifyClass,
        wrap && "flex-wrap",
        equal && "[&>*]:flex-1",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 5 — PAGE STRUCTURE PATTERNS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * STANDARD LIST/TABLE PAGE:
 *
 *   <PageContainer>                                      ← p-4 lg:p-6
 *     <SectionHeader title="Patients" subtitle="128">   ← flex justify-between
 *       <Button>Add Patient</Button>
 *     </SectionHeader>
 *
 *     <FilterBar ... />                                  ← horizontal filter strip
 *
 *     <DataTable ... />                                  ← full-width table
 *   </PageContainer>
 *
 * ─────────────────────────────────────────────────────
 * STANDARD DASHBOARD PAGE:
 *
 *   <PageContainer>
 *     <SectionHeader title="Dashboard" subtitle="..." />
 *
 *     <FilterBar ... />                                  ← period selector
 *
 *     <Grid cols={4} gap="md">                          ← KPI row
 *       <StatCard ... />
 *       <StatCard ... />
 *       <StatCard ... />
 *       <StatCard ... />
 *     </Grid>
 *
 *     <Grid cols={3} gap="md">                          ← chart row
 *       <GridItem span={2}><RevenueChart /></GridItem>
 *       <GridItem span={1}><TypePie /></GridItem>
 *     </Grid>
 *
 *     <Card>                                            ← status summary
 *       ...
 *     </Card>
 *   </PageContainer>
 *
 * ─────────────────────────────────────────────────────
 * SETTINGS / FORM PAGE (constrained width):
 *
 *   <PageContainer maxWidth="lg">
 *     <SectionHeader title="Settings" />
 *
 *     <Grid cols={12} gap="lg">
 *       <GridItem span={3}>                             ← sidebar tabs
 *         <SettingsTabs />
 *       </GridItem>
 *       <GridItem span={9}>                             ← content area
 *         <Card>
 *           <CardHeader><CardTitle>General</CardTitle></CardHeader>
 *           <CardContent>
 *             <form>
 *               <FormSection title="Clinic Info">
 *                 <FormGroup cols={2}>
 *                   <FormField name="name" label="Clinic Name">
 *                     <Input ... />
 *                   </FormField>
 *                 </FormGroup>
 *               </FormSection>
 *               <FormActions>
 *                 <Button type="submit">Save</Button>
 *               </FormActions>
 *             </form>
 *           </CardContent>
 *         </Card>
 *       </GridItem>
 *     </Grid>
 *   </PageContainer>
 *
 * ─────────────────────────────────────────────────────
 * DETAIL PAGE (e.g. PatientDetailPage):
 *
 *   <PageContainer>
 *     <Stack gap="lg">
 *       {/* Patient header card *\/}
 *       <Card>
 *         <CardContent>
 *           <Flex justify="between">
 *             <Avatar ... />
 *             <Flex gap="sm">
 *               <Button variant="outline">Print</Button>
 *               <Button>Book Appointment</Button>
 *             </Flex>
 *           </Flex>
 *         </CardContent>
 *       </Card>
 *
 *       {/* Stats strip *\/}
 *       <Grid cols={4} gap="md">
 *         <StatCard title="Lab Orders" ... />
 *       </Grid>
 *
 *       {/* Tab nav + content *\/}
 *       <div>
 *         <TabNav ... />
 *         <TabContent ... />
 *       </div>
 *     </Stack>
 *   </PageContainer>
 */

export { Grid, GridItem, Stack, Flex };
export type { GridCols, GridGap, SpanValue };
