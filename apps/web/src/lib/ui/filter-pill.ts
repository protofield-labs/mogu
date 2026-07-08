import { cn } from "@/lib/utils";

/** Airbnb-style filter / quick-reply pill (#101). */
export function filterPillClass(selected: boolean, className?: string) {
  return cn(
    "inline-flex min-h-9 items-center justify-center rounded-full px-3.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    selected
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground hover:bg-muted/80",
    className,
  );
}
