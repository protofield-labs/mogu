"use client";

import { cn } from "@/lib/utils";

export type CollectionSpotViewMode = "list" | "map";

type CollectionSpotViewTabsProps = {
  mode: CollectionSpotViewMode;
  onChange: (mode: CollectionSpotViewMode) => void;
  className?: string;
};

export function CollectionSpotViewTabs({
  mode,
  onChange,
  className,
}: CollectionSpotViewTabsProps) {
  return (
    <div
      role="group"
      aria-label="スポット表示切替"
      className={cn("flex gap-2", className)}
    >
      <button
        type="button"
        aria-pressed={mode === "list"}
        className={cn(
          "inline-flex h-9 flex-1 items-center justify-center rounded-full border text-sm font-medium transition-colors",
          mode === "list"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground hover:bg-muted/40",
        )}
        onClick={() => onChange("list")}
      >
        リスト
      </button>
      <button
        type="button"
        aria-pressed={mode === "map"}
        className={cn(
          "inline-flex h-9 flex-1 items-center justify-center rounded-full border text-sm font-medium transition-colors",
          mode === "map"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground hover:bg-muted/40",
        )}
        onClick={() => onChange("map")}
      >
        地図
      </button>
    </div>
  );
}
