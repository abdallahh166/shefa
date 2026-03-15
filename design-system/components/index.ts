/**
 * MedFlow Design System — Component Index
 * 
 * Single import point for all design system components.
 * 
 * Usage:
 *   import { Button, Input, Card, DataTable, FormField } from "@/design-system/components";
 */

// ── Primitives ──────────────────────────────────────────────────────────────

export { Button, buttonVariants }       from "./primitives/Button";
export type { ButtonProps }             from "./primitives/Button";

export {
  Input, inputVariants,
  Textarea,
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent,
  SelectLabel, SelectItem, SelectSeparator,
}                                       from "./primitives/Inputs";
export type { InputProps, TextareaProps } from "./primitives/Inputs";

export {
  Badge, badgeVariants,
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Avatar,
  Skeleton, SkeletonText, SkeletonCard,
  Divider,
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SimpleTooltip,
}                                       from "./primitives/Display";
export type { BadgeProps, CardProps }   from "./primitives/Display";

export {
  Checkbox,
  CheckboxGroup,
  RadioGroup,
  RadioItem,
  RadioCard,
}                                       from "./primitives/CheckboxRadio";
export type { CheckboxProps }           from "./primitives/CheckboxRadio";

// ── Forms ────────────────────────────────────────────────────────────────────

export {
  FormSection,
  FormGroup,
  FormField,
  FormLabel,
  FormHint,
  FormError,
  FormActions,
}                                       from "./forms/FormSystem";

// ── Layout ───────────────────────────────────────────────────────────────────

export {
  AppLayout,
  AppSidebar,
  AppTopbar,
  PageContainer,
  SectionHeader,
  useSidebarState,
}                                       from "./layout/AppLayout";
export type { NavItem, AppUser }        from "./layout/AppLayout";

export {
  Grid,
  GridItem,
  Stack,
  Flex,
}                                       from "./layout/GridSystem";
export type { GridCols, GridGap, SpanValue } from "./layout/GridSystem";

// ── Data Display ─────────────────────────────────────────────────────────────

export {
  DataTable,
  StatCard,
  StatusBadge,
  FilterBar,
  SearchInput,
  Pagination,
  EmptyState,
}                                       from "./data-display/DataDisplay";
export type {
  Column,
  BulkAction,
  StatusVariant,
  SortDirection,
}                                       from "./data-display/DataDisplay";
