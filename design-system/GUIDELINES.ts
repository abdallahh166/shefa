/**
 * MedFlow Design System — Component Guidelines
 * 
 * Rules every developer must follow when building or modifying UI.
 * This file is the canonical reference for the design system.
 */

// ─────────────────────────────────────────────────────────────────
// SECTION 1 — SPACING RULES
// ─────────────────────────────────────────────────────────────────

/**
 * SPACING HIERARCHY
 * 
 * Use these canonical values. Do not invent ad-hoc spacing.
 *
 *  gap-1   / gap-1.5  — icon-to-label gaps inside buttons/badges
 *  gap-2   / gap-2.5  — sibling icon gaps in nav items, toolbars
 *  gap-3   / gap-4    — field-level gaps inside FormGroup grids
 *  gap-4              — card grid column gaps (sm:grid-cols-2 etc.)
 *
 *  p-2                — compact buttons, action icon padding
 *  p-3                — filter strips, small card variants
 *  p-5                — standard card/panel body padding
 *  px-4 py-4
 *  lg:px-6 lg:py-6   — page-level padding (use PageContainer)
 *
 *  space-y-2          — label-to-input stack inside FormField
 *  space-y-4 / space-y-5 — form fields within a FormGroup; page sections
 *
 * NEVER:
 *  - Use arbitrary values like p-[13px] without designer sign-off
 *  - Mix mb- and space-y- on the same container
 *  - Use mt- to add top spacing to a first child (use parent padding)
 */

// ─────────────────────────────────────────────────────────────────
// SECTION 2 — TYPOGRAPHY HIERARCHY
// ─────────────────────────────────────────────────────────────────

/**
 * USE THESE ROLES CONSISTENTLY:
 *
 *  Page title      → .page-title class  (text-xl font-semibold tracking-tight)
 *                    One per page. Always inside <SectionHeader>.
 *
 *  Section title   → text-sm font-semibold text-foreground
 *                    Inside CardTitle or CardHeader. Not bolded headings — bold small text.
 *
 *  Body default    → text-sm text-foreground          (14px)
 *  Muted body      → text-sm text-muted-foreground    (labels, secondary info)
 *  Metadata        → text-xs text-muted-foreground    (timestamps, IDs, captions)
 *  Micro labels    → text-2xs text-muted-foreground   (sidebar role badge ONLY)
 *
 *  Table headers   → text-xs font-medium text-muted-foreground uppercase tracking-wide
 *                    Applied automatically by .data-table th
 *
 *  KPI values      → text-2xl font-semibold tracking-tight tabular
 *                    Applied automatically by StatCard
 *
 * NEVER:
 *  - Use text-base as body (it's too large for dense SaaS UI)
 *  - Apply font-bold to body text (use font-semibold for emphasis)
 *  - Use h1–h6 HTML elements for visual styling (use semantic classes instead)
 *  - Hardcode color values — always use Tailwind semantic tokens
 */

// ─────────────────────────────────────────────────────────────────
// SECTION 3 — COLOR USAGE RULES
// ─────────────────────────────────────────────────────────────────

/**
 * TOKEN INTENT (do not use colors outside their semantic role):
 *
 *  primary           → Brand actions: main CTAs, active nav, focus rings
 *  secondary         → Supplementary actions, less important buttons
 *  destructive       → Delete, remove, cancel, error states
 *  success           → Positive: paid, completed, active, online
 *  warning           → Caution: pending, low stock, expiring
 *  info              → Neutral positive: in-progress, informational
 *  muted             → Disabled states, skeleton backgrounds, subtle fills
 *  foreground        → All body text
 *  muted-foreground  → Secondary text, placeholders, labels
 *  border            → ALL borders (never use gray-200 or similar directly)
 *  background        → Page canvas only
 *  card              → All card/panel surfaces
 *
 * OPACITY MODIFIERS:
 *  Use /10 for subtle backgrounds:   bg-primary/10, bg-success/10
 *  Use /20 for rings and borders:    ring-success/20
 *  Use /5  for selected row fills:   bg-primary/5
 *  Avoid /30+ on semantic colors — they lose their meaning
 *
 * NEVER:
 *  - Use raw Tailwind color names: bg-blue-500, text-green-600
 *  - Hardcode HSL/hex strings in JSX (allowed only in SVG/chart definitions)
 *  - Mix background-color and bg-* token for the same element
 *  - Apply text-white to elements without a dark background token
 */

// ─────────────────────────────────────────────────────────────────
// SECTION 4 — CARD USAGE PATTERNS
// ─────────────────────────────────────────────────────────────────

/**
 * CARD ANATOMY:
 *
 *  <Card>
 *    <CardHeader>
 *      <CardTitle>Section name</CardTitle>
 *      <CardDescription>Optional subtitle</CardDescription>
 *    </CardHeader>
 *    <CardContent>
 *      ...content...
 *    </CardContent>
 *    <CardFooter>        ← optional; for actions at the bottom
 *      <Button>Save</Button>
 *    </CardFooter>
 *  </Card>
 *
 * CARD VARIANTS:
 *  Standard card       → <Card>                    (no shadow, border only)
 *  Elevated card       → <Card shadow="sm">         (subtle shadow)
 *  Interactive card    → <Card interactive>         (hover shadow + pointer)
 *  KPI card            → <StatCard>                 (use StatCard, not Card)
 *
 * CARD GRID PATTERNS:
 *  4-column KPI row    → grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4
 *  2-column layout     → grid grid-cols-1 lg:grid-cols-3 gap-4  (2/3 + 1/3)
 *  Equal 2-col         → grid grid-cols-1 md:grid-cols-2 gap-4
 *
 * NEVER:
 *  - Nest Card inside Card (use CardContent with dividers instead)
 *  - Use raw div with bg-card class (use Card component)
 *  - Apply padding inside CardHeader AND CardContent (CardHeader has p-5 pb-4, CardContent has p-5 pt-0)
 */

// ─────────────────────────────────────────────────────────────────
// SECTION 5 — TABLE PATTERNS
// ─────────────────────────────────────────────────────────────────

/**
 * ALWAYS use <DataTable> for tabular data. Never build raw <table> elements.
 *
 * REQUIRED PROPS:
 *  columns        → Column<T>[] — define key, header, render
 *  data           → T[]
 *  keyExtractor   → (item: T) => string
 *
 * SERVER-SIDE TABLES (all production tables):
 *  searchable + onSearchChange   → wired to API search param
 *  page + pageSize + total       → for Pagination
 *  onPageChange                  → resets query page
 *  sortColumn + sortDirection + onSortChange → server sort
 *
 * COLUMN DEFINITION RULES:
 *  - key must match the property name in T (used for CSV export)
 *  - Numeric/date columns must render with className="tabular"
 *  - Status columns must use <StatusBadge> with the correct variant
 *  - Action column must be last, with key="actions" and no header
 *  - Action buttons must have aria-label describing the row action
 *
 * EMPTY STATES:
 *  - Always provide emptyMessage (short, specific: "No patients found")
 *  - Always provide emptyDescription for zero-data state (first-run)
 *  - Always provide emptyAction with a relevant CTA for zero-data state
 *
 * NEVER:
 *  - Use DataTable without pagination for server data (always paginate)
 *  - Put multiple actions in a single column cell without a dropdown
 *  - Omit aria-label on action icon buttons
 */

// ─────────────────────────────────────────────────────────────────
// SECTION 6 — FORM LAYOUT RULES
// ─────────────────────────────────────────────────────────────────

/**
 * FORM STRUCTURE:
 *
 *  <form onSubmit={handleSubmit}>
 *    <FormSection title="Group Name">        ← group related fields
 *      <FormGroup cols={2}>                  ← responsive grid
 *        <FormField
 *          name="field_id"                   ← links label to input
 *          label="Label text"
 *          required                          ← adds * and aria-required
 *          error={errors.field_id}           ← shows FormError
 *          hint="Optional helper text"       ← shows FormHint
 *        >
 *          <Input ... />                     ← Input gets id/aria automatically
 *        </FormField>
 *      </FormGroup>
 *    </FormSection>
 *    <FormActions>
 *      <Button variant="outline">Cancel</Button>
 *      <Button type="submit" loading={loading}>Save</Button>
 *    </FormActions>
 *  </form>
 *
 * VALIDATION RULES:
 *  - Use Zod schema at the service/domain layer for all validation
 *  - Use React Hook Form for form state management in complex forms
 *  - For simple modals, use local useState + manual validate() before submit
 *  - NEVER show errors before the user has interacted with a field (onBlur)
 *  - ALWAYS clear errors when the field value changes (onChange)
 *  - ALWAYS disable the submit button while loading (use Button loading prop)
 *
 * MODAL FORMS — ALWAYS use Radix Dialog:
 *  <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
 *    <DialogPrimitive.Portal>
 *      <DialogPrimitive.Overlay className="modal-overlay animate-fade-in" />
 *      <DialogPrimitive.Content aria-labelledby="dialog-title">
 *        ...form content...
 *      </DialogPrimitive.Content>
 *    </DialogPrimitive.Portal>
 *  </DialogPrimitive.Root>
 *
 * NEVER:
 *  - Use a raw <div> with fixed positioning as a modal
 *  - Use native <select> — always use shadcn Select component
 *  - Show a form submit button outside FormActions
 *  - Use placeholder text as the only label (must have a visible <FormLabel>)
 */

// ─────────────────────────────────────────────────────────────────
// SECTION 7 — ACCESSIBILITY CHECKLIST
// ─────────────────────────────────────────────────────────────────

/**
 * Every component shipped MUST pass these checks:
 *
 *  ✓ All interactive elements have a visible focus ring (focus-visible:ring-2)
 *  ✓ Icon-only buttons have aria-label describing the action
 *  ✓ Form inputs are linked to their label via id/htmlFor
 *  ✓ Error messages use role="alert" (FormError does this automatically)
 *  ✓ Required fields have aria-required="true"  (FormField does this automatically)
 *  ✓ Modals use Radix Dialog (focus trap, Escape, aria-modal)
 *  ✓ Tables have aria-label, th elements, aria-sort on sortable columns
 *  ✓ Charts have role="img" and an aria-label describing the data
 *  ✓ Status badges communicate meaning beyond color (always include text label)
 *  ✓ Color contrast: 4.5:1 for text, 3:1 for non-text on both light and dark
 *  ✓ Skip-to-content link is present in AppTopbar (already implemented)
 *  ✓ Loading states use aria-busy or aria-label with "Loading..."
 *
 *  Run axe DevTools (browser extension) on every new page before PR.
 */

// ─────────────────────────────────────────────────────────────────
// SECTION 8 — ICON USAGE RULES
// ─────────────────────────────────────────────────────────────────

/**
 * ICON LIBRARY: Lucide React only. No mixing with other icon sets.
 *
 * SIZE CONVENTIONS:
 *  h-3 w-3     → Micro: status dot replacements (very rare)
 *  h-3.5 w-3.5 → Button icons (sm size), topbar controls
 *  h-4 w-4     → Default inline icons, sidebar nav, table action buttons
 *  h-5 w-5     → Medium emphasis: modal close, page title companion
 *  h-6 w-6     → Large: page-level feature icon in SectionHeader
 *  h-8 w-8     → Card accent icons (inside colored rounded bg)
 *  h-12 w-12   → Empty state illustrations
 *
 * ALWAYS add aria-hidden="true" to decorative icons.
 * ALWAYS add aria-label to icon-only interactive elements.
 * NEVER scale icons with custom width/height outside this scale.
 */

// ─────────────────────────────────────────────────────────────────
// SECTION 9 — ANIMATION RULES
// ─────────────────────────────────────────────────────────────────

/**
 * Page entry         → animate-fade-in (applied by PageContainer automatically)
 * Modal/dialog entry → animate-scale-in (applied by dialog wrapper)
 * Sidebar slide-in   → animate-slide-in-left (applied by mobile sidebar)
 * Loading skeleton   → animate-shimmer or animate-pulse (use Skeleton component)
 * Button spinner     → animate-spin on Loader2 (applied by Button loading prop)
 *
 * DURATION GUIDELINES:
 *  Micro (hover/focus)   → 150ms  (Tailwind default transition)
 *  Standard (appear)     → 200ms  (fade-in, scale-in)
 *  Sidebar collapse      → 200ms  (width transition)
 *  Skeleton shimmer      → 2000ms loop
 *
 * NEVER:
 *  - Animate layout-affecting properties (height, width) without will-change
 *  - Use transitions longer than 300ms for interactive UI elements
 *  - Add animation to pure data elements (numbers, labels)
 *  - Disable prefers-reduced-motion without implementing a reduced alternative
 */

// ─────────────────────────────────────────────────────────────────
// SECTION 10 — DARK MODE RULES
// ─────────────────────────────────────────────────────────────────

/**
 * Dark mode is class-based: .dark on <html>.
 * Toggled via useDarkMode() hook (persists to DB per user).
 *
 * ALL colors must use CSS variable tokens — never hardcode HSL/hex.
 * Chart colors must use CSS variables via useChartColors() hook.
 * Shadow values must reference CSS variable shadows in dark mode.
 *
 * When adding new colored elements:
 *  1. Check contrast in both light and dark mode with the axe extension
 *  2. Success/warning/info tokens are slightly lightened in dark mode
 *     (see globals.css .dark block) — use these, not the raw hsl values
 *  3. Test tooltip, popover, and modal backgrounds in dark mode
 */

export {};
