import { useEffect, useMemo, useState } from "react";

const getIsDark = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark");

export function useChartColors() {
  const [isDark, setIsDark] = useState(getIsDark);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(getIsDark()));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return useMemo(
    () => ({
      primary: "hsl(var(--chart-1))",
      success: "hsl(var(--chart-2))",
      warning: "hsl(var(--chart-3))",
      info: "hsl(var(--chart-4))",
      violet: "hsl(var(--chart-5))",
      destructive: "hsl(var(--destructive))",
      border: "hsl(var(--border))",
      muted: "hsl(var(--muted-foreground))",
      card: "hsl(var(--card))",
      fg: "hsl(var(--foreground))",
    }),
    [isDark],
  );
}
