import {
  getDefaultCalendar,
  getIntlLocale,
  type CalendarType,
  type Locale,
} from "./config";

export type DateFormatStyle = "date" | "datetime" | "time" | "short";

export function formatDate(
  raw: string | Date | null | undefined,
  locale: Locale,
  style: DateFormatStyle = "date",
  calendarType?: CalendarType,
): string {
  if (!raw) return "-";

  const date = typeof raw === "string" ? parseDate(raw) : raw;
  if (Number.isNaN(date.getTime())) return "-";

  const resolvedCalendar = calendarType ?? getDefaultCalendar(locale);
  const intlLocale = getIntlLocale(locale, resolvedCalendar);

  switch (style) {
    case "short":
      return new Intl.DateTimeFormat(intlLocale, {
        month: "short",
        day: "numeric",
      }).format(date);
    case "time":
      return new Intl.DateTimeFormat(intlLocale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    case "datetime":
      return new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    case "date":
    default:
      return new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
  }
}

export function formatCurrency(
  amount: number,
  locale: Locale,
  currency: string = locale === "ar" ? "EGP" : "USD",
): string {
  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(getIntlLocale(locale), options).format(value);
}

function parseDate(raw: string): Date {
  if (!raw) return new Date(NaN);
  if (raw.includes("T")) return new Date(raw);
  if (raw.includes(" ")) return new Date(raw.replace(" ", "T"));
  return new Date(`${raw}T00:00:00`);
}
